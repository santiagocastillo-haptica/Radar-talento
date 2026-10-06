/** Bloques de texto estructurado para renderizar casos y enunciados sin HTML libre. */
export type Block =
  | { type: 'p'; text: string; lead?: string }
  | { type: 'h'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'table'; caption?: string; headers: string[]; rows: string[][] };

export type Role = 'service_designer' | 'legal_service_designer';
export type PartId = '1A' | '1B' | '2' | '3';
export const PART_ORDER: PartId[] = ['1A', '1B', '2', '3'];

export const ROLE_LABEL: Record<Role, string> = {
  service_designer: 'Service Designer',
  legal_service_designer: 'Legal Service Designer',
};

export interface SeedOption {
  text: string;
}

export interface SeedQuestion {
  number: number;
  kind: 'open' | 'mc';
  label?: string;
  prompt: string;
  wordLimit?: number;
  /** Permite adjuntar una imagen opcional a la respuesta. */
  allowImage?: boolean;
  options?: SeedOption[]; // en el orden original (A, B, C, D) — se baraja por candidato
  correctIndex?: number; // SOLO servidor
  skill?: string; // SOLO servidor
}

export interface SeedPart {
  part: PartId;
  title: string;
  intro?: Block[];
  outro?: string;
  suggestedMinutes: number;
  groupWordLimit?: number;
  questions: SeedQuestion[];
}

export interface SeedVariant {
  slug: string;
  role: Role;
  name: string;
  caseTitle: string;
  caseContext: Block[];
  twist: Block[];
  parts: SeedPart[];
}
