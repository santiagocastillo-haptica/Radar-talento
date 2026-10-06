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

/** Legal Service Designer: 10 ítems propios (reemplazan los comunes + 11 y 12). La clave y la habilidad de cada uno
 *  las definió el equipo de contenido por el sentido de cada ítem: confirmar en README. */
const LSD_OWN_ITEMS: SeedQuestion[] = [
  {
    number: 1,
    kind: 'mc',
    prompt: 'Reescribes en lenguaje simple una cláusula de intereses de mora y notas que el texto original no dice desde qué día se cuentan los intereses. ¿Qué haces?',
    options: [
      { text: 'Escribes "desde el día siguiente al vencimiento", que es lo que normalmente se entiende, para que quede claro.' },
      { text: 'Dejas la duda visible, se la reportas a Jurídico y no la resuelves por tu cuenta en la versión simple.' },
      { text: 'Omites ese punto en la versión simple, porque no aparece en el original.' },
      { text: 'Preguntas al área comercial cómo se aplica en la práctica y lo escribes así.' },
    ],
    correctIndex: 1,
    skill: '06',
  },
  {
    number: 2,
    kind: 'mc',
    prompt:
      'Entrevistaste a 8 usuarios sobre la cláusula de pago anticipado y 6 entendieron mal cuánto les cobrarían. El cliente decide mañana si agrega un aviso en pantalla, que cuesta poco y se puede retirar en una semana. ¿Qué recomiendas?',
    options: [
      { text: 'Agregar el aviso y medir después cuántos lo interpretan bien, dejando definido qué resultado indicaría que no funcionó; 6 de 8 es una señal, no una cifra poblacional.' },
      { text: 'Esperar a una encuesta amplia antes de agregar nada.' },
      { text: 'Agregar el aviso y reportar que el 75% de los usuarios malinterpreta la cláusula.' },
      { text: 'No agregar nada: 8 entrevistas no bastan para decidir.' },
    ],
    correctIndex: 0,
    skill: '01',
  },
  {
    number: 3,
    kind: 'mc',
    prompt: 'Jurídico teme que un resumen en lenguaje simple de una cláusula de pago anticipado cree obligaciones nuevas. ¿Qué haces?',
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
    number: 4,
    kind: 'mc',
    prompt:
      'Jurídico rechaza tu propuesta de reordenar el contrato para poner primero las cláusulas más reclamadas, porque "el orden es el que aprobó el regulador". No puedes verificarlo hoy. ¿Qué haces?',
    options: [
      { text: 'Insistes con la evidencia de las quejas: el orden afecta a los usuarios.' },
      { text: 'Aceptas y descartas cualquier cambio de presentación.' },
      { text: 'Escalas a la gerencia para que decida por encima de Jurídico.' },
      { text: 'Preguntas qué fue exactamente lo aprobado (el orden o solo el contenido) y propones alternativas que no alteren el orden, como una capa de lectura previa o resaltados, para validarlas con Jurídico.' },
    ],
    correctIndex: 3,
    skill: '06',
  },
  {
    number: 5,
    kind: 'mc',
    prompt:
      'Un usuario dice: "pensé que si pagaba antes me cobraban menos intereses". La cláusula dice que los pagos parciales se aplican primero a intereses, comisiones y gastos. ¿Qué implica para tu explicación?',
    options: [
      { text: 'Que debe decir de forma explícita en qué orden se aplica el dinero, con un ejemplo, porque contradice la expectativa que el propio usuario expresó.' },
      { text: 'Que basta con decir "puedes pagar antes de tiempo".' },
      { text: 'Que el orden de aplicación es un detalle técnico que va solo en el texto completo.' },
      { text: 'Que hay que pedirle a Jurídico que cambie el orden de aplicación de los pagos.' },
    ],
    correctIndex: 0,
    skill: '01',
  },
  {
    number: 6,
    kind: 'mc',
    prompt: 'Tu equipo propone reemplazar "sin perjuicio de los intereses causados" por "además de los intereses" en la versión simple. ¿Cómo lo evalúas?',
    options: [
      { text: 'Lo aceptas: en lenguaje cotidiano son sinónimos.' },
      { text: 'Lo marcas como posible cambio de sentido y lo consultas con Jurídico: las dos expresiones no necesariamente significan lo mismo en un contrato.' },
      { text: 'Lo aceptas si los usuarios lo entienden mejor en la prueba de comprensión.' },
      { text: 'Lo rechazas: nunca se debe cambiar ninguna palabra de un contrato.' },
    ],
    correctIndex: 1,
    skill: '03',
  },
  {
    number: 7,
    kind: 'mc',
    prompt: 'Usas IA para simplificar 6 cláusulas y el resultado se lee claro. ¿Qué haces antes de llevarlo a Jurídico?',
    options: [
      { text: 'Se lo envías indicando que lo hizo una IA para que ellos lo revisen.' },
      { text: 'Le pides a la misma IA que verifique que no cambió el sentido.' },
      { text: 'Lo lees tú y, si suena bien, lo envías.' },
      { text: 'Contrastas cada versión con su cláusula, línea por línea (cifras, plazos, condiciones y excepciones), marcas lo que la IA omitió, añadió o interpretó, y envías a Jurídico solo lo que ya pasó tu revisión, con esas marcas.' },
    ],
    correctIndex: 3,
    skill: '04',
  },
  {
    number: 8,
    kind: 'mc',
    prompt: 'Quieres probar tu reescritura pegando en una herramienta de IA un contrato real de un cliente, con nombres y montos de personas. ¿Qué haces?',
    options: [
      { text: 'Lo pegas: la herramienta de la empresa se ve segura.' },
      { text: 'No pegas datos reales: usas una versión anonimizada o un contrato modelo, y confirmas con Jurídico y con el cliente qué herramientas y datos están permitidos.' },
      { text: 'Lo pegas en una cuenta personal para no comprometer la de la empresa.' },
      { text: 'Quitas solo los nombres y pegas el resto.' },
    ],
    correctIndex: 1,
    skill: '04',
  },
  {
    number: 9,
    kind: 'mc',
    prompt: 'Tienes 30 minutos con la abogada de Jurídico para avanzar la revisión de tu reescritura de una cláusula. ¿Cómo los usas?',
    options: [
      { text: 'Le envías el borrador completo y le pides que lo revise y te lo devuelva.' },
      { text: 'Le explicas primero el contexto completo del proyecto.' },
      { text: 'Le pides que reescriba ella la cláusula en lenguaje simple.' },
      { text: 'Llevas el borrador con las dudas ya marcadas y tres preguntas concretas que solo ella puede responder, y sales con decisiones o con los siguientes pasos acordados.' },
    ],
    correctIndex: 3,
    skill: '09',
  },
  {
    number: 10,
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
  minutes1B: number;
  q1a: SeedQuestion[];
  q1b: SeedQuestion[];
  items: SeedQuestion[];
}): SeedPart[] {
  return [
    { part: '1A', title: 'Parte 1A', suggestedMinutes: opts.minutes1A, questions: opts.q1a },
    { part: '1B', title: 'Parte 1B', suggestedMinutes: opts.minutes1B, questions: opts.q1b },
    {
      part: '2',
      title: 'Parte 2: selección múltiple',
      intro: [{ type: 'p', text: 'Elige una respuesta por ítem.' }],
      suggestedMinutes: SUGGESTED_MINUTES['2'],
      // Se numera de corrido (1…n) aunque se retiren ítems del banco.
      questions: opts.items.map((q, i) => ({ ...q, number: i + 1 })),
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
    minutes1B: SUGGESTED_MINUTES['1B'],
    q1a: Q_1A('para la Aseguradora'),
    items: [...COMMON_ITEMS, ...SD_ITEMS],
    q1b: [
      Q_1B_ADJUST(true),
      {
        number: 5,
        kind: 'open',
        label: 'Mensaje a la gerente comercial',
        wordLimit: 100,
        prompt: 'Escribe el mensaje que le enviarías a la gerente comercial (máx. 100 palabras, tono de mensaje real).',
      },
    ],
  }),
};

// ───────────────────────── Variante Legal Service Designer ─────────────────────────

const LSD_CLAUSE =
  'CLÁUSULA NOVENA. PAGO ANTICIPADO. EL DEUDOR podrá efectuar pagos anticipados, totales o parciales, previo aviso escrito a LA COOPERATIVA con una antelación no inferior a cinco (5) días. Cuando el pago anticipado, individual o acumulado en un periodo de doce (12) meses, supere el veinte por ciento (20%) del saldo de capital, LA COOPERATIVA cobrará una compensación equivalente al dos por ciento (2%) del valor prepagado, sin perjuicio de los intereses causados a la fecha del pago. Los pagos parciales se aplicarán, en primer lugar, a intereses, comisiones y gastos, y el excedente a capital, sin que ello implique reducción del valor de la cuota, salvo que EL DEUDOR solicite por escrito la reliquidación del plan de pagos. La compensación aquí prevista no se aplicará a pagos efectuados con recursos provenientes de refinanciación con la misma COOPERATIVA.';

const LSD_VARIANT: SeedVariant = {
  slug: 'lsd-contrato-credito-v4',
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
  // Se muestra SOLO en 1B: el giro y el documento con el que se trabaja.
  twist: [
    {
      type: 'p',
      text: 'Jurídico informa que se requiere una adición al proyecto añadiendo como entregable adicional, un contrato que aplique en términos de inclusión al segmento baby boomers en el que se incluya un "audio contrato".',
    },
    { type: 'h', text: 'Documento para 1B: cláusula novena del contrato' },
    { type: 'p', text: 'Texto ficticio, escrito solo para esta prueba: no es un modelo contractual ni refleja ninguna norma real.' },
    { type: 'quote', text: LSD_CLAUSE },
  ],
  parts: buildParts({
    minutes1A: 25,
    minutes1B: 30,
    items: LSD_OWN_ITEMS,
    q1a: [
      {
        number: 1,
        kind: 'open',
        label: 'Hipótesis',
        wordLimit: 150,
        prompt:
          'Hipótesis (máx. 150 palabras): ¿qué crees que explica el aumento de quejas? Incluye al menos una hipótesis sobre el texto del contrato mismo, no solo sobre la pantalla o el flujo.',
      },
      {
        number: 2,
        kind: 'open',
        label: 'Investigación',
        wordLimit: 150,
        prompt:
          'Investigación (máx. 150 palabras): tienes 3 semanas y acceso a la abogada de Jurídico. ¿Cómo verificarías si los usuarios entienden las 3 cláusulas que concentran más quejas? ¿Con quién hablarías y qué actividades harías?',
      },
      {
        number: 3,
        kind: 'open',
        label: 'Jurídico',
        wordLimit: 100,
        prompt: 'Jurídico (máx. 100 palabras): antes de cambiar nada, ¿qué 3 preguntas le harías a Jurídico y por qué cada respuesta cambia lo que puedes proponer?',
      },
    ],
    q1b: [
      {
        number: 4,
        kind: 'open',
        label: 'Ambigüedades',
        wordLimit: 100,
        prompt:
          'Ambigüedades (máx. 100 palabras): lee la cláusula novena. Señala hasta 3 puntos que podrían interpretarse de más de una manera o contradecir lo que el usuario cree, y qué le preguntarías a Jurídico en cada uno. No los resuelvas suponiendo una interpretación.',
      },
      {
        number: 5,
        kind: 'open',
        label: 'Reescritura',
        wordLimit: 150,
        prompt:
          'Reescritura (máx. 150 palabras): reescribe la cláusula en lenguaje claro para una persona sin formación jurídica. Conserva todas las cifras, plazos, condiciones y excepciones, no agregues obligaciones nuevas y piensa que también se leerá en voz alta en el "audio contrato".',
      },
      {
        number: 6,
        kind: 'open',
        label: 'Nota para la abogada de Jurídico',
        wordLimit: 100,
        prompt:
          'Nota para la abogada de Jurídico (máx. 100 palabras): ¿qué simplificaste y qué dejaste casi literal, y por qué? ¿Propondrías que tu versión reemplace el texto original o que se muestre junto a él? ¿Qué riesgo ves en cada opción?',
      },
    ],
  }),
};

/** Una variante por rol hoy. El modelo admite varias: se asigna una al azar a cada invitación. */
export const VARIANTS: SeedVariant[] = [SD_VARIANT, LSD_VARIANT];
