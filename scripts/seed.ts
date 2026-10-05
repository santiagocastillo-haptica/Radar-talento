import { firestoreConfigured, getStore } from '../src/server/store';
import { seedContent } from '../src/server/seed';

async function main() {
  if (!firestoreConfigured()) {
    console.error('Define FIREBASE_SERVICE_ACCOUNT (o FIRESTORE_EMULATOR_HOST) para sembrar Firestore. En local sin credenciales la app siembra sola su almacén de desarrollo.');
    process.exit(1);
  }
  const store = await getStore();
  const r = await seedContent(store);
  console.log(`Seed listo: ${r.variants} variantes, ${r.questions} preguntas.`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
