import { firestoreConfigured, getStore } from '../src/server/store';
import { createInvitation } from '../src/server/invitations';

/**
 * Crea dos invitaciones de PRUEBA (una por rol) y muestra sus enlaces una sola vez.
 *   npm run test-invitations
 * Usa APP_URL para armar el enlace (en PowerShell: $env:APP_URL = "https://radar-talento-six.vercel.app").
 * Después se pueden eliminar desde el panel (detalle → Eliminar invitación).
 */
async function main() {
  if (!firestoreConfigured()) {
    console.error('Define FIREBASE_SERVICE_ACCOUNT para usar Firestore.');
    process.exit(1);
  }
  const store = await getStore();
  const people = [
    { name: 'Prueba Service Designer', email: 'prueba.sd@example.com', role: 'service_designer' as const },
    { name: 'Prueba Legal Service Designer', email: 'prueba.lsd@example.com', role: 'legal_service_designer' as const },
  ];
  for (const p of people) {
    const inv = await createInvitation(store, { ...p, actor: 'script:test-invitations' });
    console.log(`\n${p.name}\n  ${inv.link}`);
  }
  console.log('\nLos enlaces no se vuelven a mostrar. Valen 24 h si no se inician.\n');
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
