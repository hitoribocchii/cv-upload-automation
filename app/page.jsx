'use client';

import { useRef, useState } from 'react';
import Script from 'next/script';
import { EMPRESA, SUCURSAL } from '@/lib/site';

const MAX_BYTES = 4 * 1024 * 1024;
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Ajustá esta lista a los puestos que realmente busca la sucursal.
const PUESTOS = [
  'Atención al cliente',
  'Cajero/a',
  'Repositor/a',
  'Depósito',
  'Administración',
  'Otro / Espontánea',
];

// Solo PDF: es lo que valida el server. Si activás ALLOW_DOCX,
// agregá acá '.docx' y su MIME.
const ACCEPT = '.pdf,application/pdf';

export default function Page() {
  const formRef = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState('idle'); // idle | uploading | done

  function onPickFile(e) {
    const picked = e.target.files?.[0] ?? null;
    setError('');

    if (!picked) return setFile(null);

    // Chequeo en el navegador: feedback inmediato para que nadie espere
    // una subida de 4 MB por 4G para enterarse de que el formato no va.
    // El server vuelve a validar todo, esto no es seguridad.
    if (picked.size > MAX_BYTES) {
      setError(`"${picked.name}" pesa ${(picked.size / 1048576).toFixed(1)} MB. El máximo es 4 MB.`);
      e.target.value = '';
      return setFile(null);
    }
    if (!picked.name.toLowerCase().endsWith('.pdf')) {
      setError('Por ahora solo aceptamos PDF. Si tenés el CV en Word, exportalo o imprimilo como PDF.');
      e.target.value = '';
      return setFile(null);
    }

    setFile(picked);
  }

  function onSubmit(e) {
    e.preventDefault();
    setError('');

    if (!file) return setError('Adjuntá tu CV en PDF.');

    const data = new FormData(formRef.current);
    setState('uploading');
    setProgress(0);

    // XHR y no fetch: fetch todavía no da progreso de subida, y en 4G
    // una barra que no se mueve hace que la gente reintente o se vaya.
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.timeout = 120000;

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };

    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch {}

      if (xhr.status >= 200 && xhr.status < 300 && body.ok) {
        setState('done');
        return;
      }

      setState('idle');
      setProgress(0);
      setError(body.error || 'No pudimos enviar tu postulación. Probá de nuevo.');
      window.turnstile?.reset();
    };

    xhr.onerror = () => {
      setState('idle');
      setProgress(0);
      setError('Se cortó la conexión. Revisá tu señal y volvé a intentar.');
      window.turnstile?.reset();
    };

    xhr.ontimeout = () => {
      setState('idle');
      setProgress(0);
      setError('La subida tardó demasiado. Probá con mejor señal o con wifi.');
      window.turnstile?.reset();
    };

    xhr.send(data);
  }

  function reset() {
    setFile(null);
    setError('');
    setProgress(0);
    setState('idle');
    formRef.current?.reset();
  }

  if (state === 'done') {
    return (
      <main className="wrap">
        <div className="card done">
          <div className="tick" aria-hidden="true">✓</div>
          <h2>¡Recibimos tu CV!</h2>
          <p>
            Guardamos tu postulación. Si tu perfil encaja con una búsqueda abierta,
            te escribimos al mail o teléfono que dejaste.
          </p>
          <button type="button" className="linkish" onClick={reset}>
            Enviar otra postulación
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">
      {SITE_KEY && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      )}

      <header>
        <h1>Trabajá con nosotros</h1>
        <p>
          Dejanos tu CV{SUCURSAL ? ` en ${SUCURSAL}` : ''} y te contactamos si surge
          una búsqueda que encaje con tu perfil.
        </p>
      </header>

      <form ref={formRef} onSubmit={onSubmit} className="card" noValidate>
        {error && <p className="msg error" role="alert">{error}</p>}

        <div className="field">
          <label htmlFor="nombre">Nombre y apellido</label>
          <input id="nombre" name="nombre" type="text" required maxLength={80}
                 autoComplete="name" enterKeyHint="next" />
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          {/* inputMode + type correctos = el teclado del celular muestra la @ */}
          <input id="email" name="email" type="email" required maxLength={120}
                 autoComplete="email" inputMode="email" enterKeyHint="next" />
        </div>

        <div className="field">
          <label htmlFor="telefono">Teléfono</label>
          <input id="telefono" name="telefono" type="tel" required
                 autoComplete="tel" inputMode="tel" placeholder="11 2345 6789"
                 enterKeyHint="next" />
        </div>

        <div className="field">
          <label htmlFor="puesto">Puesto de interés</label>
          <select id="puesto" name="puesto" required defaultValue="">
            <option value="" disabled>Elegí una opción</option>
            {PUESTOS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="file">Tu CV</label>
          <label className={`filebox${file ? ' has-file' : ''}`} htmlFor="file">
            {file ? (
              <>
                <span className="filename">{file.name}</span>
                <div className="hint">
                  {(file.size / 1048576).toFixed(2)} MB · Tocá para cambiarlo
                </div>
              </>
            ) : (
              <>
                <strong>Tocá para elegir tu archivo</strong>
                <div className="hint">PDF, hasta 4 MB</div>
              </>
            )}
            <input id="file" name="file" type="file"
                   accept={ACCEPT} required onChange={onPickFile} />
          </label>
        </div>

        <div className="field">
          <label className="check">
            <input type="checkbox" name="consentimiento" required />
            <span>
              Autorizo a {EMPRESA} a guardar y tratar mis datos y mi CV con el fin de
              evaluar mi postulación.{' '}
              <a href="/privacidad" target="_blank" rel="noopener">Ver cómo los usamos</a>.
            </span>
          </label>
        </div>

        {SITE_KEY && <div className="cf-turnstile" data-sitekey={SITE_KEY} data-language="es" />}

        <button type="submit" disabled={state === 'uploading'}>
          {state === 'uploading' ? `Enviando… ${progress}%` : 'Enviar postulación'}
        </button>

        {state === 'uploading' && (
          <div className="bar" role="progressbar" aria-valuenow={progress}
               aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${progress}%` }} />
          </div>
        )}
      </form>

      <footer>
        <a href="/privacidad">Política de privacidad</a> · <a href="/terminos">Términos</a>
      </footer>
    </main>
  );
}
