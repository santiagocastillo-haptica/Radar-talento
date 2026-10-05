# Radar Talento · Prueba de selección de Háptica

Plataforma web en español para aplicar la prueba asíncrona de selección de **Service Designer** y **Legal Service Designer**: 90 minutos reales, ventana de 24 horas para iniciar, panel para el equipo de evaluación.

- **Stack:** Next.js (App Router, TypeScript) · Firestore (vía `firebase-admin`) · despliegue en Vercel.
- **Lo crítico es la integridad:** el reloj, el orden de las partes, los límites de palabras y la clave de la Parte 2 se aplican **en el servidor**.

## Correr en local

```bash
npm install
cp .env.example .env.local     # en Windows: copy .env.example .env.local
npm run dev                    # http://localhost:3000
npm test                       # pruebas automáticas
```

Sin `FIREBASE_SERVICE_ACCOUNT`, en desarrollo la app usa un **almacén en memoria con archivo en `./.data`** y se siembra sola con el contenido de la prueba. En local el panel (`/admin/login`) tiene un administrador de prueba: `dev@haptica.local` / `desarrollo-local-123` (solo existe en ese almacén local). Para borrar los datos locales: elimina la carpeta `.data`.

## Variables de entorno

Ver [`.env.example`](.env.example). Las obligatorias en producción: `FIREBASE_SERVICE_ACCOUNT`, `SESSION_SECRET`, `TOKEN_HASH_SECRET`, `CRON_SECRET`, `APP_URL`.

## Despliegue (GitHub → Vercel + Firestore)

1. **Firebase / Firestore**
   1. En [console.firebase.google.com](https://console.firebase.google.com) crea un proyecto → *Build → Firestore Database → Create database* (modo producción, región cercana, p. ej. `us-east1` o `southamerica-east1`).
   2. *Project settings → Service accounts → Generate new private key*. Guarda el JSON (no lo subas a GitHub).
   3. Publica las reglas (niegan todo acceso directo de clientes): `npx firebase-tools deploy --only firestore:rules --project <id>`; o pega el contenido de [`firestore.rules`](firestore.rules) en la consola.
2. **GitHub:** repositorio **privado** (contiene el contenido y la clave de la prueba).
3. **Vercel:** *Add New → Project →* importa el repositorio. En *Environment Variables* carga las de `.env.example` (el JSON de la cuenta de servicio va en `FIREBASE_SERVICE_ACCOUNT`, en texto o en base64). Despliega.
4. **Sembrar el contenido** (una vez, y cada vez que cambie el contenido): con `FIREBASE_SERVICE_ACCOUNT` en tu entorno local, `npm run seed`.
5. **Primera persona administradora del panel** (una vez): con `FIREBASE_SERVICE_ACCOUNT` en tu entorno local, `npm run admin:create -- correo@ejemplo.com "Nombre"`. Muestra una contraseña temporal aleatoria **una sola vez**; al entrar a `/admin/login` se te pide cambiarla. Después, agrega más personas desde **Panel → Usuarios** (no hace falta el script). Si pierdes el acceso de todas las cuentas: `npm run admin:create -- correo@ejemplo.com --reset`.
6. Define `PRIVACY_POLICY_URL` y `DATA_RETENTION_DAYS` (ver pendientes).

> Hosting estático (GitHub Pages) **no sirve**: hace falta servidor para el reloj y la clave.

## Modelo de datos (Firestore)

| Colección | Contenido |
|---|---|
| `variants/{slug}` | Una variante por rol (hoy una por rol; se asigna una al azar a cada invitación). Caso, giro, partes y preguntas. **Sin clave.** |
| `variantKeys/{slug}` | **Clave de la Parte 2.** Solo la leen el panel y la calificación; ninguna ruta del candidato la consulta. |
| `invitations/{id}` | Datos del candidato, `tokenHash`, `startedAt`/`deadlineAt`, partes enviadas, orden barajado de opciones, evaluación y notas. |
| `invitations/{id}/answers/{qid}` | Respuesta actual de cada pregunta. |
| `invitations/{id}/signals/*` | Señales (pegados, salidas de pestaña, tamaño de texto por autoguardado). |
| `auditLog/*` | Registro de auditoría solo-añadir. |
| `adminUsers/*` | Personas con acceso al panel (hash de contraseña, estado, versión de sesión). |
| `rateLimits/*` | Intentos fallidos (token de candidato por IP; inicio de sesión del panel por IP y correo). |

No se necesitan índices compuestos (`firestore.indexes.json` está vacío).

## Cómo se cumplen las reglas del brief

- **Reloj:** `deadlineAt = startedAt + 90 min` se fija al presionar *Comenzar*; el estado (`creada`, `vencida`, `en_curso`, `enviada`, `expirada`) se **calcula** de esas marcas en cada lectura/escritura, no con un timer. Reabrir el enlace reanuda con el tiempo restante correcto. El cliente muestra la cuenta regresiva anclada a la hora del servidor con un reloj monótono (`performance.now`), así que cambiar la hora del computador no la altera. Se aceptan escrituras hasta `deadline + 10 s`.
- **Vencimiento sin navegador abierto:** `expirada` se deriva del `deadlineAt`; además un cron diario (`/api/cron/close-expired`) deja constancia en el documento.
- **Enlace de 24 h:** `expiresAt = creación + 24 h`; si no se ha iniciado, está `vencida`. Una vez iniciada la prueba, ya no depende de las 24 h.
- **Secuencia fija:** 1A → 1B → 2 → 3. Solo se escribe en la parte activa; las enviadas quedan bloqueadas. El texto de 1B (giro y preguntas) solo se entrega cuando 1A está enviada.
- **Clave de la Parte 2:** vive en `variantKeys` y nunca se construye en las respuestas del candidato (que se arman campo por campo). Hay pruebas que recorren toda la API y revisan los nombres de campo.
- **Opciones barajadas por candidato**, persistidas en la invitación (el mismo candidato siempre ve el mismo orden).
- **Límites de palabras duros en el servidor** (por pregunta y 300 compartidas en la Parte 3). Un campo por encima del límite no se autoguarda (queda el último texto válido) y bloquea el envío.
- **Tokens:** 256 bits, solo se guarda el HMAC-SHA256; comparación en tiempo constante; máx. 20 intentos fallidos por IP cada 10 min; el token viaja en un encabezado (no en la URL de la API) y en el *fragmento* del enlace (`/i#token`), por lo que no llega a los logs de acceso.
- **Reinicio del reloj:** solo administrador, motivo obligatorio, queda en `auditLog` con quién, cuándo, motivo y el `startedAt` anterior. Da una ventana completa nueva y conserva lo escrito.
- **Panel:** lista, creación de invitaciones, detalle lado a lado (enunciado/criterios y respuesta), clave y aciertos por ítem y por habilidad, señales, notas por parte, estado por habilidad (**Evidencia sólida / Indicio / Sin evidencia suficiente**), exportación `.xlsx` y `.csv`. **No hay puntaje total.** La habilidad 07 se marca "validar en entrevista".

## Decisiones tomadas (ambigüedades del brief)

- **Firestore en lugar de Postgres** (decisión de Háptica). Consecuencia: la inmutabilidad de la auditoría la garantiza la aplicación (solo existe `create` sobre `auditLog`) y las reglas de Firestore; ver riesgos.
- **Enlace de invitación:** como solo se guarda el hash, el enlace se muestra **una vez** al crearlo. "Regenerar enlace" (solo si no ha iniciado) emite uno nuevo, invalida el anterior y reinicia las 24 h; queda en auditoría.
- **Reinicio del reloj:** conserva respuestas y partes enviadas; solo para pruebas en curso o expiradas.
- **1B no muestra las respuestas de 1A** (no hay retroceso), pero sí el caso original.
- **Señales:** pegados (cantidad y caracteres), salidas de pestaña (cantidad y tiempo), y una línea de tiempo de tamaño del texto medida por el servidor en cada autoguardado (~5 s). "Ráfaga" = ≥ 200 caracteres a ≥ 15 car/s entre dos autoguardados (heurística editable en `src/lib/signals.ts`). Son banderas para la entrevista; el panel lo dice.
- **Acceso al panel:** correo + contraseña propios guardados en Firestore (`adminUsers`), sin Google ni Microsoft. Contraseñas con scrypt y sal por usuario (mínimo 12 caracteres); las temporales (alta o restablecimiento) obligan a cambiarlas al primer ingreso; bloqueo de 15 min tras 5 fallos por correo o 10 por IP; cambiar o restablecer la contraseña y desactivar la cuenta cierran las sesiones abiertas (sesión de 8 h en cookie firmada, `HttpOnly`); no se puede desactivar al último administrador activo; todas las altas, restablecimientos y desactivaciones quedan en `auditLog` (sin contraseñas).
- **Rúbrica y preguntas de entrevista** viven en `src/content/rubric.ts` (referencia del panel); el contenido de la prueba, en `src/content/variants.ts` y se carga con `npm run seed`. Para añadir una variante de un rol, agrega otro objeto con distinto `slug`. **No edites una variante que ya se aplicó**: crea una nueva.
- Zona horaria del panel: America/Bogota.

## Pendientes antes de usar con candidatos reales

1. **Retención de datos:** `DATA_RETENTION_DAYS` está vacío a propósito. Definirlo con **Jurídico** (y, si se decide borrar, implementar el job de borrado; hoy no hay borrado automático).
2. **URL de la política de tratamiento de datos** (`PRIVACY_POLICY_URL`): hoy el aviso de datos de la pantalla de inicio es un texto mínimo y no enlaza a ninguna política hasta que se configure. Jurídico debe revisar ese texto.
3. **Crear la primera cuenta del panel** (paso 5 del despliegue) y compartir las contraseñas temporales solo por un canal seguro.
4. Revisar con Jurídico el aviso de señales y el texto de reglas (el texto de reglas es literal del brief).

## Riesgos conocidos

- **Firestore no se probó contra un servidor real** en el desarrollo (sin emulador ni credenciales disponibles): las 48 pruebas corren sobre un almacén en memoria que imita sus reglas de transacción (lecturas antes que escrituras, serialización, descarte al fallar). La primera prueba de humo contra Firestore real debe hacerse en un proyecto de ensayo antes de invitar a nadie.
- **Auditoría inmutable a nivel de aplicación**, no de base de datos: quien tenga la cuenta de servicio o permisos de editor en Firebase podría modificar documentos. Limita esos permisos (rol mínimo) y activa los *Data Access audit logs* de Google Cloud para tener un segundo registro.
- **Cuenta de servicio:** el JSON de la cuenta de servicio da acceso total a los datos; guárdalo solo en Vercel.
- **Señales no son pruebas:** pueden dar falsos positivos (dictado, autocorrector, extensiones). Nunca descartar a nadie solo por ellas.
- **Reloj del cliente:** el candidato ve una cuenta regresiva sincronizada; si pierde conexión, la fuente de verdad sigue siendo el servidor (el cierre ocurre igual).
- **Un campo por encima del límite no se autoguarda**; si el tiempo se acaba en ese estado, queda el último texto válido.
- **Cron diario** (plan gratuito de Vercel): solo materializa el estado; la corrección no depende de él.
- **Sin envío de correos:** el equipo copia el enlace y lo envía manualmente (por diseño del MVP).
- **Multipestaña:** si el candidato abre dos pestañas, gana la última escritura por campo.
- Los datos viven en la región de Firestore elegida: considerar residencia de datos con Jurídico.

## Estructura

```
src/content/    contenido de la prueba y rúbrica (sección 9 del brief)
src/server/     store (Firestore/memoria), intentos, invitaciones, panel, exportación, acceso
src/app/        páginas (candidato en /i, panel en /admin) y rutas de la API
src/components/ interfaz del candidato y del panel
tests/          pruebas automáticas (vitest)
scripts/seed.ts carga el contenido en Firestore
```

