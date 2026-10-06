import type { SeedPart, SeedQuestion, SeedVariant } from './types';

/**
 * Contenido de la prueba (sección 9 del brief). Se carga tal cual por el seed.
 * Todos los casos, cifras y citas son ficticios, creados para la prueba.
 * Para añadir una variante nueva de un rol: agrega otro objeto con `slug` distinto y el mismo `role`.
 */

// ───────────────────────── 9.1 Reglas y aviso (pantalla de inicio) ─────────────────────────

export const RULES_TEXT =
  'Puedes usar IA en esta prueba donde lo consideres conveniente y donde sume valor a tus resultados: nos interesa tu criterio para decidir cuándo y cómo usarla. Lo que sí te pedimos es hacerla sin ayuda de otras personas. En la Parte 3 te pedimos contar con honestidad cómo usas la IA en tu trabajo real. Tienes 90 minutos desde que presionas Comenzar; el reloj no se detiene si cierras la página.';

// ───────────────────────── 9.2 Tiempos sugeridos ─────────────────────────

export const SUGGESTED_MINUTES = { '1A': 30, '1B': 15, '2': 20, '3': 20 } as const;
export const MARGIN_MINUTES = 10;

// ───────────────────────── 9.5 Parte 2: ítems comunes (1 a 10) ─────────────────────────
// Opciones en el orden original A, B, C, D. `correctIndex` sigue la clave de la sección 9.5.

const COMMON_ITEMS: SeedQuestion[] = [
  {
    number: 1,
    kind: 'mc',
    prompt:
      'Entrevistaste a 8 usuarios y 6 describieron el proceso como "confuso". El cliente decide mañana si lanza un cambio que cuesta poco y se puede revertir en una semana. ¿Qué recomiendas?',
    options: [
      { text: 'Lanzar y medir: 6 de 8 es señal suficiente para una decisión barata y reversible; dejas definida la métrica que mostraría que te equivocaste.' },
      { text: 'Esperar a una encuesta con muestra representativa antes de decidir, para no basarse en anécdotas.' },
      { text: 'No decidir todavía: con 8 entrevistas no se puede concluir nada.' },
      { text: 'Lanzar, y reportar que el 75% de los usuarios considera confuso el proceso.' },
    ],
    correctIndex: 0,
    skill: '01',
  },
  {
    number: 4,
    kind: 'mc',
    prompt:
      'Pruebas un prototipo con 5 personas. 4 completan la tarea, pero 3 de esas 4 lo hicieron por un camino que no habías previsto. ¿Qué haces?',
    options: [
      { text: 'Das la prueba por exitosa: 4 de 5 completaron la tarea.' },
      { text: 'Indagas por qué 3 de los 4 tomaron otro camino y evalúas si el flujo debería construirse alrededor de él antes de la siguiente ronda.' },
      { text: 'Repites la prueba con 15 personas más antes de cambiar nada.' },
      { text: 'Ajustas las instrucciones para que en la próxima ronda todos sigan el camino previsto.' },
    ],
    correctIndex: 1,
    skill: '03',
  },
  {
    number: 5,
    kind: 'mc',
    prompt:
      'Un cliente te contrata para "diseñar una app para recibir reclamos". En las primeras 2 entrevistas descubres que el problema es que los reclamos llegan por 4 canales y nadie los consolida. ¿Qué haces?',
    options: [
      { text: 'Diseñas la app como se pidió; es el encargo firmado.' },
      { text: 'Amplías la investigación tres semanas para tener más certeza antes de hablar con el cliente.' },
      { text: 'Diseñas la app e incluyes una sección para consolidar canales.' },
      { text: 'Llevas el hallazgo al cliente y acuerdan si el alcance sigue siendo la app o pasa a ser el flujo interno que la haría útil, antes de diseñar.' },
    ],
    correctIndex: 3,
    skill: '02',
  },
  {
    number: 6,
    kind: 'mc',
    prompt:
      'Facilitas un workshop de 12 personas. Dos directores dominan la conversación y el resto casi no habla. Quedan 40 minutos. ¿Qué haces?',
    options: [
      { text: 'Les pides amablemente a los directores que den espacio a los demás.' },
      { text: 'Cambias la dinámica: trabajo individual en silencio y luego puesta en común por rondas, para que las ideas entren antes que los rangos.' },
      { text: 'Sigues igual y recoges las ideas del resto por correo después del taller.' },
      { text: 'Haces una pausa, hablas con los directores en privado y retomas con la misma dinámica.' },
    ],
    correctIndex: 1,
    skill: '05',
  },
  {
    number: 7,
    kind: 'mc',
    prompt:
      'Tu cliente rechaza un hallazgo clave: "eso no es lo que ven nuestros clientes". Tienes evidencia de 10 entrevistas. ¿Qué haces primero?',
    options: [
      { text: 'Muestras las citas más contundentes de las entrevistas.' },
      { text: 'Reconoces que la muestra es pequeña y suavizas el hallazgo.' },
      { text: 'Preguntas qué evidencia tienen ellos, propones cómo contrastar ambas fuentes y acuerdan qué dato los haría cambiar de opinión.' },
      { text: 'Escalas el tema al sponsor del proyecto.' },
    ],
    correctIndex: 2,
    skill: '06',
  },
  {
    number: 8,
    kind: 'mc',
    prompt:
      'Tu líder de proyecto está fuera dos días. El cliente necesita que se elija entre dos conceptos para seguir trabajando. Tienes información parcial y la decisión se puede revertir la próxima semana. ¿Qué haces?',
    options: [
      { text: 'Decides con el criterio acordado en el proyecto, dejas por escrito la decisión y sus supuestos, y avisas a tu líder de inmediato.' },
      { text: 'Esperas a que tu líder regrese, porque la decisión es suya.' },
      { text: 'Le preguntas al cliente cuál prefiere.' },
      { text: 'Envías ambos conceptos con sus pros y contras y dejas que el cliente decida.' },
    ],
    correctIndex: 0,
    skill: '08',
  },
  {
    number: 9,
    kind: 'mc',
    prompt:
      'Estás al límite de tu capacidad esta semana y tienes tres compromisos pendientes: (A) entregable crítico para un cliente clave (vence el viernes); (B) iniciativa de Háptica que mantiene bloqueado a un compañero (vence el jueves); (C) propuesta de trabajo para otro proyecto (vence el miércoles). ¿Cómo priorizas?',
    options: [
      { text: 'Te enfocas únicamente en las entregas de clientes externos (A y C) y dejas el documento interno para la siguiente semana.' },
      { text: 'Acuerdas con tu compañero entregarle una versión mínima/esquemática de (B) para desbloquearlo rápidamente, y usas el tiempo restante para completar la propuesta (C) y el entregable (A).' },
      { text: 'Haces horas extra sin avisar para entregar el 100% del alcance de las tres tareas.' },
      { text: 'Entregas la propuesta (C) incompleta para garantizar la documentación interna de (B) a detalle.' },
    ],
    correctIndex: 1,
    skill: '09',
  },
  {
    number: 10,
    kind: 'mc',
    prompt:
      'Usas IA para sintetizar 20 entrevistas y el resumen sale coherente y bien escrito. ¿Qué haces antes de llevarlo al cliente?',
    options: [
      { text: 'Lo entregas: que sea coherente y esté bien escrito indica que la síntesis es buena.' },
      { text: 'Rastreas las afirmaciones centrales hasta citas reales de las transcripciones y buscas casos que contradigan el resumen o que haya dejado por fuera.' },
      { text: 'Le pides a la misma IA que evalúe su propio resumen.' },
      { text: 'Le pides a otra IA que resuma lo mismo y entregas lo que coincida.' },
    ],
    correctIndex: 1,
    skill: '04',
  },
];

// ───────────────────────── Ítems 11 y 12 por rol ─────────────────────────

const SD_ITEMS: SeedQuestion[] = [
  {
    number: 11,
    kind: 'mc',
    prompt:
      'Un cliente tiene un flujo digital bien diseñado, pero los usuarios siguen llamando al call center. Al mapear el servicio descubres que el back-office actualiza el estado de los casos manualmente una vez al día. ¿Qué implica para el diseño?',
    options: [
      { text: 'La app puede estar prometiendo una inmediatez que la operación no sostiene: hay que alinear lo que se muestra con lo que el back-office puede cumplir, o cambiar la operación.' },
      { text: 'Rediseñar la app para mostrar el estado de los casos con más claridad.' },
      { text: 'Entrenar al call center para responder más rápido.' },
      { text: 'Automatizar el back-office con IA.' },
    ],
    correctIndex: 0,
    skill: '02',
  },
  {
    number: 12,
    kind: 'mc',
    prompt:
      'Tienes 3 días para validar si los clientes estarían dispuestos a resolver reclamos mediante un asistente virtual antes de invertir en su desarrollo técnico. ¿Qué prototipo planteas?',
    options: [
      { text: 'Diseñas maqueta en Figma del flujo de conversación y le preguntas a los usuarios en una encuesta si lo usarían.' },
      { text: 'Ejecutas un piloto "Mago de oz": un miembro del equipo responde manualmente por mensajería simulando ser el asistente para evaluar las interacciones reales de 10 usuarios.' },
      { text: 'Una encuesta a 200 clientes para saber si usarían un asesor virtual.' },
      { text: 'Pospones la validación hasta contar con presupuesto para contratar una plataforma de IA.' },
    ],
    correctIndex: 1,
    skill: '03',
  },
];

const LSD_ITEMS: SeedQuestion[] = [
  {
    number: 11,
    kind: 'mc',
    prompt:
      'Jurídico teme que un resumen en lenguaje simple de una cláusula de pago anticipado cree obligaciones nuevas. ¿Qué haces?',
    options: [
      { text: 'Reemplazas la cláusula por el resumen para que el usuario solo lea lo simple.' },
      { text: 'Omites el resumen para no arriesgar nada jurídicamente.' },
      { text: 'Muestras el resumen junto al texto íntegro, rotulado como orientativo, y lo iteras cláusula por cláusula con Jurídico y con pruebas de comprensión con usuarios.' },
      { text: 'Pides que el área comercial valide el resumen, porque conoce al cliente.' },
    ],
    correctIndex: 2,
    skill: '03',
  },
  {
    number: 12,
    kind: 'mc',
    prompt: '¿Qué evidencia demuestra con mayor certeza que un usuario comprendió las consecuencias de una cláusula legal compleja?',
    options: [
      { text: 'Que el 95% de los usuarios haya marcado la casilla obligatoria de "He leído y acepto los términos".' },
      { text: 'Que el usuario pase más de 2 minutos navegando en la pantalla donde se encuentra la cláusula.' },
      { text: 'Que el usuario pueda explicar con sus propias palabras qué ocurriría en un caso práctico o escenario hipotético regulado por esa cláusula.' },
      { text: 'Que el área jurídica valide que el texto utiliza un vocabulario accesible.' },
    ],
    correctIndex: 2,
    skill: '01',
  },
];

// ───────────────────────── Preguntas de la Parte 1 ─────────────────────────

/** Imagen opcional: "Opcional: adjuntar imagen si lo consideras necesario". */
const Q_1A = (para: string): SeedQuestion[] => [
  {
    number: 1,
    kind: 'open',
    label: 'Hipótesis',
    wordLimit: 200,
    allowImage: true,
    prompt: 'Hipótesis (máx. 200 palabras): ¿Cuáles son tus principales hipótesis a validar en la investigación?',
  },
  {
    number: 2,
    kind: 'open',
    label: 'Investigación',
    wordLimit: 200,
    allowImage: true,
    prompt: 'Investigación (máx. 200 palabras): Tienes 3 semanas para realizar tu investigación. ¿A qué actores propones dentro de la muestra? ¿Qué actividades propondrías?',
  },
  {
    number: 3,
    kind: 'open',
    label: 'Resultados',
    wordLimit: 100,
    allowImage: true,
    prompt: `Resultados (máx. 100 palabras): ¿Qué entregables propondrías ${para}? Sustenta tu respuesta.`,
  },
];

const Q_1B_ADJUST = (allowImage: boolean): SeedQuestion => ({
  number: 4,
  kind: 'open',
  label: 'Ajuste ante el giro',
  wordLimit: 200,
  allowImage,
  prompt: '¿Qué cambia en tu decisión de 1A y qué se mantiene? (máx. 200 palabras)',
});

// ───────────────────────── Parte 3 ─────────────────────────

const PART3_OUTRO = 'No hay respuesta correcta; queremos entender cómo piensas y cómo trabajas hoy.';

/** Pregunta abierta única de la Parte 3 (límite compartido de 300 palabras). `{{rol}}` se reemplaza si aparece. */
const Q_3: SeedQuestion[] = [
  {
    number: 1,
    kind: 'open',
    allowImage: true,
    prompt:
      'Hoy en día, una IA puede estructurar un Service Blueprint, sintetizar 20 hallazgos de investigación o redactar la síntesis de un contrato en segundos con un tono convincente y profesional. Ante esta realidad, ¿en qué momento un entregable deja de reflejar el criterio del diseñador y pasa a ser solo un producto de la herramienta? Argumenta tu postura sobre cuál es el rol del diseñador como "autor" cuando la IA ejecuta gran parte del trabajo.',
  },
];

function buildParts(opts: {
  minutes1A: number;
  q1a: SeedQuestion[];
  q1b4: SeedQuestion;
  q1b5: SeedQuestion;
  roleItems: SeedQuestion[];
}): SeedPart[] {
  return [
    { part: '1A', title: 'Parte 1A', suggestedMinutes: opts.minutes1A, questions: opts.q1a },
    { part: '1B', title: 'Parte 1B', suggestedMinutes: SUGGESTED_MINUTES['1B'], questions: [opts.q1b4, opts.q1b5] },
    {
      part: '2',
      title: 'Parte 2: selección múltiple',
      intro: [{ type: 'p', text: 'Elige una respuesta por ítem.' }],
      suggestedMinutes: SUGGESTED_MINUTES['2'],
      // Se numera de corrido (1…n) aunque se retiren ítems del banco.
      questions: [...COMMON_ITEMS, ...opts.roleItems].map((q, i) => ({ ...q, number: i + 1 })),
    },
    {
      part: '3',
      title: 'Parte 3: tu rol frente a la IA',
      outro: PART3_OUTRO,
      suggestedMinutes: SUGGESTED_MINUTES['3'],
      groupWordLimit: 300,
      questions: Q_3,
    },
  ];
}

// ───────────────────────── Variante Service Designer ─────────────────────────

const SD_VARIANT: SeedVariant = {
  slug: 'sd-renovacion-polizas-v3',
  role: 'service_designer',
  name: 'Service Designer: Renovación de pólizas',
  caseTitle: 'Renovación de pólizas',
  caseContext: [
    {
      type: 'p',
      lead: 'Contexto.',
      text: 'Seguros Meridiano (aseguradora ficticia) vende pólizas de auto. Hace un año lanzó la renovación digital en app y web. El negocio quiere realizar una migración de clientes a canales digitales y aumentar la renovación digital de 31% a 60%. Tú entras como Service Designer al proyecto.',
    },
    { type: 'h', text: 'Datos del último trimestre (40.000 pólizas por vencer)' },
    {
      type: 'table',
      headers: ['Etapa', 'Pólizas', '% del paso anterior', '% sobre 40.000'],
      rows: [
        ['Recibieron el recordatorio', '40.000', '100%', '100%'],
        ['Abrieron la renovación (app o web)', '24.800', '62%', '62%'],
        ['Vieron la nueva cotización', '18.600', '75%', '46,5%'],
        ['Iniciaron el pago', '14.900', '80%', '37,3%'],
        ['Pagaron (renovación digital)', '12.400', '83%', '31%'],
      ],
    },
    { type: 'h', text: 'Otros datos' },
    {
      type: 'ul',
      items: [
        'Renovaron por call center: 11.000 pólizas. No renovaron: 16.600.',
        'Costo por renovación gestionada (índice): digital = 1; call center = 4,5.',
        'La tarifa promedio de renovación subió 14% frente al año anterior.',
        'Motivo de la llamada, en una muestra de 500 llamadas de renovación: "No entendí por qué subió el precio" 38%; "No encontré cómo cambiar mi cobertura" 24%; "Falló el pago" 19%; "Prefiero hablar con una persona" 12%; "Otros" 12%.',
        'NPS: app y web +41 (210 respuestas); call center +58 (95 respuestas).',
      ],
    },
    { type: 'h', text: 'Fragmentos de entrevistas' },
    { type: 'quote', text: 'Me llegó el recordatorio, abrí la app y el precio era otro. Pensé que me estaban estafando, así que llamé.' },
    { type: 'quote', text: 'Quería quitar una cobertura y no encontré dónde, así que llamé.' },
    { type: 'quote', text: 'Pagué con la tarjeta, me dio error y no sé si quedó renovada. Preferí llamar.' },
  ],
  twist: [
    {
      type: 'p',
      text: 'La gerente comercial te escribe: por decisión de la gerencia, la investigación tendrá una duración de 2 semanas y tenemos una semana para actividades presenciales y otra solo para actividades virtuales.',
    },
  ],
  parts: buildParts({
    minutes1A: 30,
    q1a: Q_1A('para la Aseguradora'),
    q1b4: Q_1B_ADJUST(true),
    roleItems: SD_ITEMS,
    q1b5: {
      number: 5,
      kind: 'open',
      label: 'Mensaje a la gerente comercial',
      wordLimit: 100,
      prompt: 'Escribe el mensaje que le enviarías a la gerente comercial (máx. 100 palabras, tono de mensaje real).',
    },
  }),
};

// ───────────────────────── Variante Legal Service Designer ─────────────────────────

const LSD_VARIANT: SeedVariant = {
  slug: 'lsd-contrato-credito-v3',
  role: 'legal_service_designer',
  name: 'Legal Service Designer: Contrato de crédito digital',
  caseTitle: 'Contrato de crédito digital',
  caseContext: [
    {
      type: 'p',
      lead: 'Contexto.',
      text: 'Ahorro Mutuo (cooperativa ficticia) ofrece créditos de libre inversión 100% digitales. Antes del desembolso, el cliente firma electrónicamente un contrato de 14 páginas (unas 6.200 palabras). Las quejas aumentaron y la gerencia pide reducirlas 30% sin que la tasa de firma baje de 90%. Tú entras como Legal Service Designer al proyecto.',
    },
    { type: 'h', text: 'Datos del último trimestre' },
    {
      type: 'ul',
      items: [
        'Créditos aprobados: 30.000. Firmaron: 28.200 (94%).',
        'Quejas recibidas: 1.300. Por tema: comisiones y costos 34%; cobro por pago anticipado 22%; reporte a centrales de riesgo 15%; atención y tiempos 18%; otros 11%.',
        'Encuesta posterior a la firma (320 respuestas): 82% afirma "entendí las condiciones de mi crédito".',
      ],
    },
    { type: 'h', text: 'Fragmentos de entrevistas' },
    { type: 'quote', text: 'Firmé porque necesitaba la plata; igual nadie lee eso.' },
    { type: 'quote', text: 'Pensé que si pagaba antes me cobraban menos intereses, no que me iban a cobrar una penalidad.' },
    { type: 'quote', text: 'No sabía que reportaban a centrales si me atrasaba un día.' },
  ],
  twist: [
    {
      type: 'p',
      text: 'Jurídico informa que se requiere una adición al proyecto añadiendo como entregable adicional, un contrato que aplique en términos de inclusión al segmento baby boomers en el que se incluya un "audio contrato".',
    },
  ],
  parts: buildParts({
    minutes1A: 25,
    q1a: Q_1A('para la cooperativa'),
    q1b4: Q_1B_ADJUST(false),
    roleItems: LSD_ITEMS,
    q1b5: {
      number: 5,
      kind: 'open',
      label: 'Mensaje a la abogada de Jurídico',
      wordLimit: 80,
      prompt: 'Escribe el mensaje que le enviarías a la abogada de Jurídico para acordar cómo avanzar (máx. 80 palabras, tono de mensaje real).',
    },
  }),
};

/** Una variante por rol hoy. El modelo admite varias: se asigna una al azar a cada invitación. */
export const VARIANTS: SeedVariant[] = [SD_VARIANT, LSD_VARIANT];
