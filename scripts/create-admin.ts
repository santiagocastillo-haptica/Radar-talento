import { firestoreConfigured, getStore } from '../src/server/store';
import { createAdminUser, diagnoseLogin, getAdminUser, listAdminUsers, resetPassword } from '../src/server/adminUsers';

/**
 * Crea (o restablece) una persona administradora del panel contra Firestore.
 *   npm run admin:create -- correo@ejemplo.com "Nombre Apellido"
 *   npm run admin:create -- correo@ejemplo.com --reset
 *   npm run admin:create -- correo@ejemplo.com --check   (lee la contraseña de la variable CHECK_PASSWORD)
 *   npm run admin:create -- --list        (muestra correos y estado; nunca contraseñas)
 * Genera una contraseña temporal aleatoria y la muestra UNA vez; la persona debe cambiarla al entrar.
 * (No se acepta la contraseña por argumento para que no quede en el historial de la terminal.)
 */
async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const list = args.includes('--list');
  const email = args.find((a) => a.includes('@'));
  const reset = args.includes('--reset');
  const check = args.includes('--check');
  const name = args.find((a) => !a.includes('@') && !a.startsWith('--')) ?? '';
  if (list) {
    if (!firestoreConfigured()) {
      console.error('Define FIREBASE_SERVICE_ACCOUNT para usar Firestore.');
      process.exit(1);
    }
    const users = await listAdminUsers(await getStore());
    console.log(users.length ? '' : 'No hay usuarios.');
    for (const u of users) console.log(`${u.email}  ${u.active ? 'activa' : 'DESACTIVADA'}  ${u.mustChange ? 'cambio de contraseña pendiente' : ''}`);
    process.exit(0);
  }
  if (!email) {
    console.error('Uso: npm run admin:create -- correo@ejemplo.com "Nombre" [--reset]');
    process.exit(1);
  }
  if (!firestoreConfigured()) {
    console.error('Define FIREBASE_SERVICE_ACCOUNT (o FIRESTORE_EMULATOR_HOST) para usar Firestore.');
    process.exit(1);
  }
  const store = await getStore();
  if (check) {
    console.log(`\n${await diagnoseLogin(store, email, process.env.CHECK_PASSWORD ?? '')}\n`);
    process.exit(0);
  }
  const actor = 'script:create-admin';
  const existing = await getAdminUser(store, email);
  let password: string;
  if (existing) {
    if (!reset) {
      console.error(`Ya existe ${email}. Usa --reset para restablecer su contraseña.`);
      process.exit(1);
    }
    password = await resetPassword(store, email, actor);
    console.log(`Contraseña restablecida para ${email}.`);
  } else {
    const r = await createAdminUser(store, { email, name, actor });
    password = r.temporaryPassword!;
    console.log(`Usuario creado: ${email}.`);
  }
  console.log('\nContraseña temporal (se muestra una sola vez; deberá cambiarla al entrar):\n');
  console.log(`  ${password}\n`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
