import { firestoreConfigured, getStore } from '../src/server/store';
import { createInvitation } from '../src/server/invitations';

/**
 * Crea dos invitaciones de PRUEBA (una por rol) y muestra sus enlaces una sola vez.
 *   npm run test-invitations
 * Necesita las MISMAS variables que producción: APP_URL y TOKEN_HASH_SECRET (el valor que tiene Vercel). Con otro
 * TOKEN_HASH_SECRET los enlaces salen inválidos en el sitio. Más simple: crearlas desde el panel.
 * Después se pueden eliminar desde el panel (detalle → Eliminar invitación).
 */
async function main() {
  if (!firestoreConfigured()) {
    console.error('Define FIREBASE_SERVICE_ACCOUNT para usar Firestore.');
    process.exit(1);
  }
  if (!process.env.TOKEN_HASH_SECRET || !process.env.APP_URL) {
    console.error('Define TOKEN_HASH_SECRET (igual al de Vercel) y APP_URL; si no, los enlaces no funcionarán en el sitio.');
    console.error('Más simple: crea las invitaciones desde el panel (Nueva invitación).');
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
