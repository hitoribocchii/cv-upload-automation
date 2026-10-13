// Validacion de archivos. Todo lo que hay aca corre en el SERVER.
// Lo que valida el navegador es cortesia para el usuario, no seguridad:
// cualquiera puede postear directo a /api/upload con curl.

export const MAX_BYTES = 4 * 1024 * 1024; // 4 MB (Vercel corta el body en ~4.5)

// Firmas reales de archivo ("magic bytes"). El Content-Type que manda el cliente
// es texto libre y no prueba nada.
const SIGNATURES = {
  pdf: {
    mime: 'application/pdf',
    magic: [0x25, 0x50, 0x44, 0x46], // "%PDF"
  },
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    magic: [0x50, 0x4b, 0x03, 0x04], // "PK\x03\x04" -> es un ZIP
  },
};

export function allowedExtensions() {
  return process.env.ALLOW_DOCX === 'true' ? ['pdf', 'docx'] : ['pdf'];
}

/**
 * Detecta el tipo real leyendo los primeros bytes.
 * Devuelve 'pdf' | 'docx' | null.
 *
 * OJO con docx: su firma es la de un ZIP generico, asi que un .zip renombrado
 * pasa este chequeo. Por eso el default es solo-PDF. Si habilitas docx,
 * asumis que el archivo es un contenedor ZIP arbitrario.
 */
export function sniffType(buffer) {
  for (const ext of allowedExtensions()) {
    const sig = SIGNATURES[ext];
    if (!sig) continue;
    if (sig.magic.every((byte, i) => buffer[i] === byte)) return ext;
  }
  return null;
}

export function mimeFor(ext) {
  return SIGNATURES[ext]?.mime ?? 'application/octet-stream';
}

/**
 * El nombre que manda el cliente es dato hostil: puede traer "../",
 * bytes nulos, 4 KB de basura o RTL overrides. No lo usamos: generamos
 * el nombre nosotros y solo tomamos el nombre de la persona como etiqueta.
 */
export function slugify(input, maxLen = 40) {
  return String(input)
    .normalize('NFD')
    .replace(COMBINING, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .toLowerCase() || 'sin-nombre';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[\d\s()+-]{6,20}$/;

/** Valida los campos de texto. Devuelve { ok } o { ok:false, error }. */
export function validateFields({ nombre, email, telefono, puesto, consentimiento }) {
  if (!nombre || nombre.trim().length < 2 || nombre.length > 80) {
    return { ok: false, error: 'Ingresá tu nombre y apellido.' };
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 120) {
    return { ok: false, error: 'El email no parece válido.' };
  }
  if (!telefono || !PHONE_RE.test(telefono)) {
    return { ok: false, error: 'El teléfono no parece válido.' };
  }
  if (!puesto || puesto.length > 80) {
    return { ok: false, error: 'Elegí el puesto al que te postulás.' };
  }
  if (consentimiento !== 'on' && consentimiento !== 'true') {
    return { ok: false, error: 'Necesitamos tu consentimiento para guardar tus datos.' };
  }
  return { ok: true };
}

// Marcas de acento combinantes (U+0300-U+036F). Se construye desde un string
// con escapes para que el fuente no dependa de caracteres invisibles.
const COMBINING = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
