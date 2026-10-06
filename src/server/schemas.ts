import { z } from 'zod';

export const partSchema = z.enum(['1A', '1B', '2', '3']);

export const answerSchema = z.object({
  questionId: z.string().min(1).max(20),
  text: z.string().max(25000).optional(),
  optionId: z.string().min(1).max(40).optional(),
});

export const signalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('paste'), questionId: z.string().min(1).max(20), chars: z.number().min(0).max(1_000_000), ageMs: z.number().min(0).optional() }),
  z.object({ kind: z.literal('blur_start'), ageMs: z.number().min(0).optional() }),
  z.object({ kind: z.literal('blur_end'), ms: z.number().min(0).max(24 * 3600_000), ageMs: z.number().min(0).optional() }),
]);

export const saveBody = z.object({
  part: partSchema,
  answers: z.array(answerSchema).max(40),
  signals: z.array(signalSchema).max(100).optional(),
});

export const signalsBody = z.object({ signals: z.array(signalSchema).max(100) });
export const startBody = z.object({ accepted: z.literal(true) });

export const inviteBody = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  role: z.enum(['service_designer', 'legal_service_designer']),
});
export const resetBody = z.object({ reason: z.string().trim().min(5).max(1000) });
export const evaluationBody = z.object({
  key: z.string().min(2).max(40),
  status: z.enum(['solida', 'indicio', 'sin_evidencia']).nullable(),
});
export const noteBody = z.object({ part: partSchema, note: z.string().max(20000) });

export const attachmentPutBody = z.object({
  part: partSchema,
  questionId: z.string().min(1).max(20),
  data: z.string().min(16).max(900_000),
});
export const attachmentDeleteBody = z.object({ part: partSchema, questionId: z.string().min(1).max(20) });
