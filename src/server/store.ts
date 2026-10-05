import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Capa de almacenamiento de documentos. Dos implementaciones con la misma semántica:
 *  - Firestore (producción), vía firebase-admin;
 *  - memoria (pruebas y desarrollo local), con las mismas reglas de transacción de Firestore
 *    (todas las lecturas antes de las escrituras) para atrapar errores antes de desplegar.
 *
 * Rutas: 'coleccion/id' o 'coleccion/id/sub/id'. Los valores de fecha se guardan como texto ISO-8601 (UTC).
 */

export type Data = Record<string, any>;
export type Doc = { id: string; data: Data };
export type Op = '==' | '<' | '<=' | '>' | '>=';
export interface Query {
  where?: [field: string, op: Op, value: unknown][];
  orderBy?: [field: string, dir: 'asc' | 'desc'];
  limit?: number;
}

export interface Reader {
  get(path: string): Promise<Data | null>;
  query(collection: string, q?: Query): Promise<Doc[]>;
}
export interface Writer {
  /** Reemplaza el documento. */
  set(path: string, data: Data): Promise<void>;
  /** Crea; falla si ya existe (la auditoría solo se crea, nunca se modifica). */
  create(path: string, data: Data): Promise<void>;
  /** Fusión profunda de mapas (los arreglos se reemplazan; `null` borra el valor al leerlo). Crea si no existe. */
  merge(path: string, data: Data): Promise<void>;
  delete(path: string): Promise<void>;
}
export interface Tx extends Reader, Writer {}
export interface Store extends Reader, Writer {
  tx<T>(fn: (t: Tx) => Promise<T>): Promise<T>;
}

export const newId = () => crypto.randomUUID();

/** El registro de auditoría es solo-añadir: ninguna ruta de la aplicación puede reescribirlo ni borrarlo. */
export function assertMutable(path: string, op: 'set' | 'merge' | 'delete') {
  if (path.startsWith('auditLog/')) throw new Error(`auditLog es inmutable (${op} no permitido)`);
}

// ───────────────────────── Memoria ─────────────────────────

function deepMerge(target: Data, patch: Data): Data {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const cur = target[k] && typeof target[k] === 'object' && !Array.isArray(target[k]) ? target[k] : {};
      target[k] = deepMerge(cur, v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

const clone = <T>(v: T): T => structuredClone(v);

function matches(data: Data, q: Query | undefined): boolean {
  for (const [f, op, val] of q?.where ?? []) {
    const x = data[f] === undefined ? null : data[f];
    const y = val === undefined ? null : val;
    if (op === '==' && x !== y) return false;
    if (op !== '==' && (x === null || y === null)) return false;
    if (op === '<' && !((x as any) < (y as any))) return false;
    if (op === '<=' && !((x as any) <= (y as any))) return false;
    if (op === '>' && !((x as any) > (y as any))) return false;
    if (op === '>=' && !((x as any) >= (y as any))) return false;
  }
  return true;
}

export class MemoryStore implements Store {
  private docs = new Map<string, Data>();
  private lock: Promise<unknown> = Promise.resolve();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private persistPath?: string) {
    if (persistPath && fs.existsSync(persistPath)) {
      const raw = JSON.parse(fs.readFileSync(persistPath, 'utf8')) as Record<string, Data>;
      for (const [k, v] of Object.entries(raw)) this.docs.set(k, v);
    }
  }

  private persist() {
    if (!this.persistPath) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      fs.mkdirSync(path.dirname(this.persistPath!), { recursive: true });
      fs.writeFileSync(this.persistPath!, JSON.stringify(Object.fromEntries(this.docs)));
    }, 200);
  }

  async get(p: string) {
    const d = this.docs.get(p);
    return d ? clone(d) : null;
  }

  async query(col: string, q?: Query): Promise<Doc[]> {
    const prefix = col + '/';
    let out: Doc[] = [];
    for (const [p, d] of this.docs) {
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      if (rest.includes('/')) continue; // documento de una subcolección más profunda
      if (matches(d, q)) out.push({ id: rest, data: clone(d) });
    }
    if (q?.orderBy) {
      const [f, dir] = q.orderBy;
      out.sort((a, b) => ((a.data[f] ?? '') < (b.data[f] ?? '') ? -1 : (a.data[f] ?? '') > (b.data[f] ?? '') ? 1 : 0) * (dir === 'desc' ? -1 : 1));
    }
    if (q?.limit) out = out.slice(0, q.limit);
    return out;
  }

  async set(p: string, data: Data) {
    assertMutable(p, 'set');
    this.docs.set(p, clone(data));
    this.persist();
  }
  async create(p: string, data: Data) {
    if (this.docs.has(p)) throw new Error(`El documento ${p} ya existe`);
    this.docs.set(p, clone(data));
    this.persist();
  }
  async merge(p: string, data: Data) {
    assertMutable(p, 'merge');
    this.docs.set(p, deepMerge(this.docs.get(p) ?? {}, clone(data)));
    this.persist();
  }
  async delete(p: string) {
    assertMutable(p, 'delete');
    this.docs.delete(p);
    this.persist();
  }

  /** Transacciones serializadas; escrituras en búfer; leer después de escribir falla (igual que Firestore). */
  async tx<T>(fn: (t: Tx) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const writes: (() => void)[] = [];
      let wrote = false;
      const guard = () => {
        if (wrote) throw new Error('Firestore: en una transacción todas las lecturas deben ir antes de las escrituras');
      };
      const view = (p: string): Data | null => {
        const d = this.docs.get(p);
        return d ? clone(d) : null;
      };
      const t: Tx = {
        get: async (p) => (guard(), view(p)),
        query: async (c, q) => (guard(), this.query(c, q)),
        set: async (p, d) => {
          assertMutable(p, 'set');
          wrote = true;
          writes.push(() => this.docs.set(p, clone(d)));
        },
        create: async (p, d) => {
          wrote = true;
          writes.push(() => {
            if (this.docs.has(p)) throw new Error(`El documento ${p} ya existe`);
            this.docs.set(p, clone(d));
          });
        },
        merge: async (p, d) => {
          assertMutable(p, 'merge');
          wrote = true;
          writes.push(() => this.docs.set(p, deepMerge(this.docs.get(p) ?? {}, clone(d))));
        },
        delete: async (p) => {
          assertMutable(p, 'delete');
          wrote = true;
          writes.push(() => this.docs.delete(p));
        },
      };
      const out = await fn(t);
      for (const w of writes) w();
      if (writes.length) this.persist();
      return out;
    };
    const result = this.lock.then(run, run);
    this.lock = result.catch(() => undefined);
    return result;
  }
}

// ───────────────────────── Firestore ─────────────────────────

function parseServiceAccount(raw: string): Record<string, unknown> {
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  return JSON.parse(text);
}

export function firestoreConfigured(): boolean {
  return !!(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIRESTORE_EMULATOR_HOST || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

async function createFirestoreStore(): Promise<Store> {
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (!getApps().length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      initializeApp({ credential: cert(parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT) as any) });
    } else {
      initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    }
  }
  const fs_ = getFirestore();
  try {
    fs_.settings({ ignoreUndefinedProperties: true });
  } catch {
    /* ya configurado en esta instancia */
  }

  const applyQuery = (ref: FirebaseFirestore.Query, q?: Query) => {
    let r = ref;
    for (const [f, op, v] of q?.where ?? []) r = r.where(f, op, v as any);
    if (q?.orderBy) r = r.orderBy(q.orderBy[0], q.orderBy[1]);
    if (q?.limit) r = r.limit(q.limit);
    return r;
  };
  const toDocs = (snap: FirebaseFirestore.QuerySnapshot): Doc[] => snap.docs.map((d) => ({ id: d.id, data: d.data() as Data }));

  const store: Store = {
    async get(p) {
      const s = await fs_.doc(p).get();
      return s.exists ? (s.data() as Data) : null;
    },
    async query(c, q) {
      return toDocs(await applyQuery(fs_.collection(c), q).get());
    },
    async set(p, d) {
      assertMutable(p, 'set');
      await fs_.doc(p).set(d);
    },
    async create(p, d) {
      await fs_.doc(p).create(d);
    },
    async merge(p, d) {
      assertMutable(p, 'merge');
      await fs_.doc(p).set(d, { merge: true });
    },
    async delete(p) {
      assertMutable(p, 'delete');
      await fs_.doc(p).delete();
    },
    tx(fn) {
      return fs_.runTransaction(async (t) => {
        const w: Tx = {
          get: async (p) => {
            const s = await t.get(fs_.doc(p));
            return s.exists ? (s.data() as Data) : null;
          },
          query: async (c, q) => toDocs(await t.get(applyQuery(fs_.collection(c), q))),
          set: async (p, d) => {
            assertMutable(p, 'set');
            t.set(fs_.doc(p), d);
          },
          create: async (p, d) => {
            t.create(fs_.doc(p), d);
          },
          merge: async (p, d) => {
            assertMutable(p, 'merge');
            t.set(fs_.doc(p), d, { merge: true });
          },
          delete: async (p) => {
            assertMutable(p, 'delete');
            t.delete(fs_.doc(p));
          },
        };
        return fn(w);
      });
    },
  };
  return store;
}

// ───────────────────────── Selección de implementación ─────────────────────────

const g = globalThis as unknown as { __hapticaStore?: Promise<Store> };

/** Singleton por proceso. Sin credenciales de Firebase: memoria con archivo local (SOLO desarrollo), sembrada al arrancar. */
export function getStore(): Promise<Store> {
  if (!g.__hapticaStore) {
    g.__hapticaStore = (async () => {
      if (firestoreConfigured()) return createFirestoreStore();
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Falta FIREBASE_SERVICE_ACCOUNT: en producción las respuestas se guardan en Firestore.');
      }
      const store = new MemoryStore(path.join(process.cwd(), '.data', 'store.json'));
      const { seedIfEmpty } = await import('./seed');
      await seedIfEmpty(store);
      return store;
    })();
    g.__hapticaStore.catch(() => {
      g.__hapticaStore = undefined;
    });
  }
  return g.__hapticaStore;
}
