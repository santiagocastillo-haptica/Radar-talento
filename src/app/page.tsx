import Link from 'next/link';

export default function Home() {
  return (
    <main className="wrap">
      <p className="eyebrow">Háptica</p>
      <h1>Prueba de selección</h1>
      <span className="rail" aria-hidden="true" />
      <p>Si recibiste una invitación, abre el enlace completo que te enviamos. Esta página no da acceso a la prueba por sí sola.</p>
      <p className="small muted">
        ¿Eres parte del equipo de Háptica? <Link href="/admin">Entra al panel</Link>.
      </p>
    </main>
  );
}
