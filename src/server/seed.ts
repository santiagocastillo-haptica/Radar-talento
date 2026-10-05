import crypto from 'node:crypto';
import type { Store } from './store';
import { encodeBlocks, type VariantKeysDoc, type VariantQuestion } from './model';
import { VARIANTS } from '@/content/variants';

const optionId = (slug: string, qid: string, index: number) =>
  crypto.createHash('sha256').update(`${slug}|${qid}|${index}`).digest('hex').slice(0, 12);

/**
 * Carga (idempotente) el contenido de la sección 9: un documento por variante y otro, aparte, con su clave.
 * Reejecutarlo sobrescribe los textos de esa variante. Si ya hay invitaciones en curso, crea una variante nueva
 * (otro `slug`) en lugar de editar una que ya se está aplicando.
 */
export async function seedContent(store: Store): Promise<{ variants: number; questions: number }> {
  let questionCount = 0;
  for (const v of VARIANTS) {
    const questions: VariantQuestion[] = [];
    const keys: VariantKeysDoc['keys'] = {};
    for (const p of v.parts) {
      for (const q of p.questions) {
        questionCount += 1;
        const id = `${p.part}-${q.number}`;
        const vq: VariantQuestion = {
          id,
          part: p.part,
          number: q.number,
          kind: q.kind,
          label: q.label ?? null,
          prompt: q.prompt,
          wordLimit: q.wordLimit ?? null,
        };
        if (q.kind === 'mc') {
          if (!q.options || q.correctIndex === undefined || !q.skill) {
            throw new Error(`Ítem ${p.part}/${q.number} de ${v.slug}: faltan opciones, clave o habilidad`);
          }
          vq.options = q.options.map((o, i) => ({ id: optionId(v.slug, id, i), text: o.text }));
          keys[id] = { correctOptionId: vq.options[q.correctIndex].id, skill: q.skill };
        }
        questions.push(vq);
      }
    }
    const doc = {
      slug: v.slug,
      role: v.role,
      name: v.name,
      active: true,
      caseTitle: v.caseTitle,
      caseContext: encodeBlocks(v.caseContext),
      twist: encodeBlocks(v.twist),
      parts: v.parts.map((p) => ({
        part: p.part,
        title: p.title,
        intro: encodeBlocks(p.intro ?? []),
        outro: p.outro ?? null,
        suggestedMinutes: p.suggestedMinutes,
        groupWordLimit: p.groupWordLimit ?? null,
      })),
      questions,
    } satisfies Record<string, unknown>;
    await store.set(`variants/${v.slug}`, doc);
    await store.set(`variantKeys/${v.slug}`, { keys });
  }
  return { variants: VARIANTS.length, questions: questionCount };
}

export async function seedIfEmpty(store: Store): Promise<void> {
  const any = await store.query('variants', { limit: 1 });
  if (any.length === 0) await seedContent(store);
}
