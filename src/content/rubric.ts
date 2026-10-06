import type { Role } from './types';

/**
 * Rúbrica del evaluador (sección 9.7) y preguntas modelo de entrevista (9.8).
 * Es material de referencia del panel: nunca se envía a la API del candidato.
 */

export type EvalStatus = 'solida' | 'indicio' | 'sin_evidencia';
export const EVAL_STATUS_LABEL: Record<EvalStatus, string> = {
  solida: 'Evidencia sólida',
  indicio: 'Indicio',
  sin_evidencia: 'Sin evidencia suficiente',
};
export const EVAL_STATUSES = Object.keys(EVAL_STATUS_LABEL) as EvalStatus[];

export interface Skill {
  code: string;
  name: string;
  /** Dónde puede aparecer evidencia en la prueba. */
  source: string;
  /** false = la prueba no la evidencia: se muestra "validar en entrevista" y no hay selector. */
  evidenced: boolean;
}

export const SKILLS: Skill[] = [
  { code: '01', name: 'Diseño basado en evidencia', source: 'Partes 1A y 2', evidenced: true },
  { code: '02', name: 'Visión estratégica', source: 'Partes 1A, 1B y 2', evidenced: true },
  { code: '03', name: 'Diseño iterativo', source: 'Partes 1A y 2', evidenced: true },
  { code: '04', name: 'Adopción de IA', source: 'Parte 3 (y ítem 10 de la Parte 2)', evidenced: true },
  { code: '05', name: 'Facilitación', source: 'Solo situacional, Parte 2', evidenced: true },
  { code: '06', name: 'Comunicación y negociación', source: 'Partes 1B y 3 (y ítem 7 de la Parte 2)', evidenced: true },
  { code: '07', name: 'Trabajo en equipo', source: 'No la evidencia esta prueba', evidenced: false },
  { code: '08', name: 'Liderar el diseño', source: 'Solo situacional, Parte 2', evidenced: true },
  { code: '09', name: 'Organización y gestión del tiempo', source: 'Uso del reloj e ítem 9 de la Parte 2', evidenced: true },
];

export const SKILL_BY_CODE = Object.fromEntries(SKILLS.map((s) => [s.code, s]));

export const RUBRIC_NOTES = [
  'Esta prueba NO evidencia la habilidad 07 (trabajo en equipo) ni la comunicación oral: validar en entrevista.',
  'La prueba no sustenta Nivel 4 (Experto) en ninguna habilidad.',
  'Parte 2: no hay puntaje de corte. Se muestran aciertos por ítem y por habilidad; esta parte pesa menos que las Partes 1 y 3.',
  'No se calcula ni se muestra un puntaje total.',
];

export interface Criterion {
  key: string;
  title: string;
  skills: string;
  operativo: string;
  avanzado: string;
  alertas: string;
}

/** Criterios de la Parte 1 (se muestran junto a las respuestas). */
export const PART1_CRITERIA: Record<'1A' | '1B', Criterion[]> = {
  '1A': [
    {
      key: 'diagnostico',
      title: 'Diagnóstico y lectura de datos',
      skills: '01, 02',
      operativo: 'Problema coherente sustentado con al menos una cifra.',
      avanzado: 'Cuestiona la meta y nombra un dato dudoso con razón.',
      alertas: 'Lista datos sin priorizar, acepta la meta tal cual, no duda de ningún dato.',
    },
    {
      key: 'hipotesis',
      title: 'Hipótesis',
      skills: '01, 03',
      operativo: 'Plausible pero general.',
      avanzado: 'Falsable y validable en una semana con lo disponible.',
      alertas: 'Propone una investigación larga que ignora el plazo y los recursos.',
    },
    {
      key: 'decision',
      title: 'Decisión',
      skills: '02, 03',
      operativo: '2 cambios razonables y un "no".',
      avanzado: 'Cada cambio ligado a una hipótesis y el "no" justificado con costo de oportunidad o riesgo.',
      alertas: '"No" vago, más de 2 cambios, ignora la capacidad.',
    },
  ],
  '1B': [
    {
      key: 'ajuste',
      title: 'Ajuste ante el giro',
      skills: '02',
      operativo: 'Ajusta parcialmente y reconoce la restricción.',
      avanzado: 'Identifica la tensión nueva y reordena.',
      alertas: 'Repite 1A sin cambios o se contradice sin explicar.',
    },
    {
      key: 'mensaje',
      title: 'Mensaje',
      skills: '06',
      operativo: 'Claro y cordial; explica su propuesta.',
      avanzado: 'Reconoce la restricción y pide una decisión concreta u ofrece alternativa.',
      alertas: 'Tono de informe, largo, sin pedido concreto.',
    },
  ],
};

/** Lecturas posibles de datos dudosos (solo referencia para el evaluador, no respuestas únicas). */
export const DOUBTFUL_DATA: Record<Role, string[]> = {
  service_designer: [
    'Los motivos de llamada suman 105%.',
    'El NPS compara 210 y 95 respuestas de poblaciones distintas.',
    'El alza de tarifa de 14% confunde la lectura del abandono.',
    'La muestra de 500 llamadas no tiene criterio de selección.',
    'Cuestionar la meta: 16.600 pólizas no renovadas (41,5%) y 15.200 que nunca abrieron la renovación pesan más que el canal por el que renuevan los demás.',
  ],
  legal_service_designer: [
    '82% dice haber entendido pero la mediana de lectura es 9 segundos (autorreporte contra conducta).',
    'La encuesta de 320 respuestas cubre una fracción de 28.200 firmantes.',
    'Las quejas miden a quien reclama.',
    '3 cláusulas concentran 71% de las quejas (923 de 1.300).',
  ],
};

export interface Part3Indicator {
  key: string; // clave en la tabla evaluations
  title: string;
  solida: string;
  indicio: string;
  sin: string;
  note?: string;
}

export const PART3_INDICATORS: Part3Indicator[] = [
  {
    key: 'p3_criterio',
    title: 'Criterio de autoría (04)',
    solida: 'Propone un criterio concreto para saber cuándo el entregable sigue siendo suyo: qué decide, verifica o corrige él.',
    indicio: 'Reconoce que debe haber criterio propio, pero no dice cómo se reconoce.',
    sin: 'Dice que la IA es solo una herramienta, o que reemplaza al diseñador, sin ningún criterio.',
  },
  {
    key: 'p3_postura',
    title: 'Postura sobre su rol como autor (04)',
    solida: 'Postura clara y defendida, con matices: separa qué delega a la IA y qué retiene, y reconoce al menos un contraargumento.',
    indicio: 'Postura clara, pero sin sustento o sin considerar otra mirada.',
    sin: 'Entusiasmo o rechazo total de la IA, sin argumento.',
    note: 'No se penaliza a quien no usa IA si explica su criterio con un caso concreto.',
  },
  {
    key: 'p3_caso',
    title: 'Sustento con un caso concreto',
    solida: 'Apoya su tesis en un caso real o verosímil de diseño (herramienta, tarea y qué corrigió o decidió).',
    indicio: 'Da un ejemplo genérico, sin tarea ni resultado.',
    sin: 'Solo ideas generales.',
  },
  {
    key: 'p3_escritura',
    title: 'Argumentación escrita (06)',
    solida: 'Tesis, argumento y conclusión claros, concisos y dentro del límite de palabras.',
    indicio: 'Se entiende, pero es desordenada, repetitiva o se queda en descripciones.',
    sin: 'Confusa, o una lista de frases hechas sin hilo argumental.',
    note: 'Estructura impecable sin postura propia es una bandera de texto sin criterio.',
  },
];

/** Recordatorio de banderas de texto escrito sin criterio propio (señales, no pruebas). */
export const TEXT_FLAGS = [
  '1B que no dialoga con 1A.',
  'Frases generales sin ninguna cifra del caso.',
  'Ninguna duda sobre los datos.',
  'Estructura impecable sin postura.',
  'Texto largo pegado que no se conecta con las cifras del caso ni con las demás respuestas (posible uso de IA sin criterio propio).',
];

export const INTERVIEW_QUESTIONS = [
  'En 1A elegiste [cambio] y descartaste [otro]. Si tuvieras capacidad para 3 cambios, ¿qué sumarías y por qué?',
  'Dijiste que [dato] te generaba dudas. ¿Cómo comprobarías si importa?',
  'En 1B cambiaste [decisión]. ¿Qué te hizo cambiar, y qué no cambiarías aunque la restricción fuera peor?',
  'En el ítem [n] descartaste la opción [x]. ¿Por qué? (usar ítems que falló o que tardó en responder)',
  'En la Parte 3 contaste [ejemplo]. ¿Qué le diste a la herramienta y qué corregiste a mano?',
  'Si hay banderas: "Cuéntanos cómo abordaste la prueba: en qué orden y dónde te frenaste." Con tono neutro: la pregunta abre la conversación, no acusa.',
];

export const INTERVIEW_NOTE =
  'Antes de entrevistar, cruzar el resultado con el Talent Review del CV y el portafolio: lo que la prueba confirma sube de Indicio a Evidencia sólida; lo que contradice se pregunta.';

export const SIGNALS_DISCLAIMER =
  'En esta prueba se puede usar IA, así que pegar texto es esperable y no significa nada por sí solo. Estas señales sirven para preguntar en la entrevista qué hizo la persona con las herramientas y qué aportó ella (criterio, correcciones, cifras del caso). Nunca son motivo de descarte.';
