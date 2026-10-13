import { EMPRESA, CONTACTO } from '@/lib/site';

export const metadata = { title: `Términos y condiciones | ${EMPRESA}` };

// OJO: esto es un borrador razonable, no asesoramiento legal.
// Hacelo revisar antes de publicar.
export default function Terminos() {
  return (
    <main className="wrap legal">
      <h1>Términos y condiciones</h1>
      <p>Última actualización: {new Date().toLocaleDateString('es-AR')}</p>

      <h2>Qué es este sitio</h2>
      <p>
        Un formulario para que las personas interesadas en trabajar en {EMPRESA} nos
        envíen su currículum. No tiene otro uso.
      </p>

      <h2>Al enviar tu postulación</h2>
      <ul>
        <li>Declarás que los datos que ingresás son verdaderos y que el CV es tuyo.</li>
        <li>
          No subas archivos con contenido ilegal, malicioso o de terceros sin su
          autorización. Podemos eliminar cualquier envío que no corresponda.
        </li>
        <li>
          Enviar tu CV no genera una relación laboral ni nos obliga a contactarte.
          Te escribimos solo si surge una búsqueda compatible con tu perfil.
        </li>
      </ul>

      <h2>Tus datos</h2>
      <p>
        Cómo guardamos y usamos tu información, y cómo pedir que la borremos, está
        explicado en la <a href="/privacidad">política de privacidad</a>.
      </p>

      <h2>Cambios</h2>
      <p>
        Podemos actualizar estos términos. La versión vigente es siempre la publicada
        en esta página.
      </p>

      <h2>Contacto</h2>
      <p>
        Por cualquier consulta, escribinos a <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
      </p>

      <p style={{ marginTop: '2rem' }}>
        <a href="/">← Volver al formulario</a>
      </p>
    </main>
  );
}
