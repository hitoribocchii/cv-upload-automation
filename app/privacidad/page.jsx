import { EMPRESA, CONTACTO } from '@/lib/site';

export const metadata = { title: `Política de privacidad | ${EMPRESA}` };

// OJO: esto es un borrador razonable, no asesoramiento legal.
// Hacelo revisar antes de publicar, y sobre todo: cumplí lo que dice
// (el plazo de conservación hay que ejecutarlo de verdad).
export default function Privacidad() {
  return (
    <main className="wrap legal">
      <h1>Política de privacidad</h1>
      <p>Última actualización: {new Date().toLocaleDateString('es-AR')}</p>

      <h2>Qué datos recolectamos</h2>
      <p>
        Cuando te postulás por este formulario guardamos tu nombre y apellido, email,
        teléfono, el puesto que elegiste y el archivo de CV que adjuntás, junto con
        el contenido que hayas incluido en él.
      </p>

      <h2>Para qué los usamos</h2>
      <p>
        Únicamente para evaluar tu postulación y contactarte si surge una búsqueda
        laboral compatible con tu perfil. No los usamos para publicidad ni los
        cedemos, vendemos ni compartimos con terceros ajenos a {EMPRESA}.
      </p>

      <h2>Dónde se guardan</h2>
      <p>
        En una carpeta privada de Google Drive de {EMPRESA}, a la que solo accede
        el personal a cargo de las búsquedas laborales.
      </p>

      <h2>Cuánto tiempo</h2>
      <p>
        Conservamos las postulaciones por <strong>12 meses</strong> desde su recepción.
        Cumplido ese plazo las eliminamos, salvo que nos pidas antes que las borremos.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Podés pedirnos en cualquier momento acceder, rectificar, actualizar o suprimir
        tus datos escribiendo a <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
      </p>
      <p>
        El titular de los datos personales tiene la facultad de ejercer el derecho de
        acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses,
        salvo que se acredite un interés legítimo al efecto, conforme lo establecido en
        el artículo 14, inciso 3 de la Ley Nº 25.326. La Agencia de Acceso a la
        Información Pública, en su carácter de Órgano de Control de la Ley Nº 25.326,
        tiene la atribución de atender las denuncias y reclamos que interpongan quienes
        resulten afectados en sus derechos por incumplimiento de las normas vigentes en
        materia de protección de datos personales.
      </p>

      <p style={{ marginTop: '2rem' }}>
        <a href="/">← Volver al formulario</a>
      </p>
    </main>
  );
}
