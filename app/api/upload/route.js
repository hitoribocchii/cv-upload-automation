import { uploadToDrive } from '@/lib/drive';
import { fechaArgentina } from '@/lib/fecha';
import { checkRateLimit, clientIp } from '@/lib/ratelimit';
import {
  MAX_BYTES,
  allowedExtensions,
  mimeFor,
  slugify,
  sniffType,
  validateFields,
} from '@/lib/validate';

export const runtime = 'nodejs';   // necesitamos Buffer
export const maxDuration = 30;     // subir 4 MB a Drive entra comodo

function bad(error, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

/** Verifica el token de Cloudflare Turnstile. Si no esta configurado, no bloquea. */
async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // anti-spam desactivado
  if (!token) return false;

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const data = await res.json().catch(() => ({}));
  return data.success === true;
}

export async function POST(request) {
  const ip = clientIp(request);

  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    return bad(
      `Ya enviaste varias postulaciones. Probá de nuevo en ${limit.retryAfterMin} minutos.`,
      429,
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    // Un body ilegible suele ser el corte de Vercel (~4.5 MB), pero tambien
    // puede ser basura de un bot. Distinguimos por el largo declarado.
    const declarado = Number(request.headers.get('content-length') ?? 0);
    return declarado > MAX_BYTES
      ? bad('El archivo pesa más de 4 MB.', 413)
      : bad('No pudimos leer el formulario. Recargá la página e intentá de nuevo.', 400);
  }

  const passedTurnstile = await verifyTurnstile(form.get('cf-turnstile-response'), ip);
  if (!passedTurnstile) {
    return bad('No pudimos verificar que seas una persona. Recargá la página e intentá de nuevo.', 403);
  }

  const fields = {
    nombre: String(form.get('nombre') ?? '').trim(),
    email: String(form.get('email') ?? '').trim().toLowerCase(),
    telefono: String(form.get('telefono') ?? '').trim(),
    puesto: String(form.get('puesto') ?? '').trim(),
    consentimiento: String(form.get('consentimiento') ?? ''),
  };

  const fieldCheck = validateFields(fields);
  if (!fieldCheck.ok) return bad(fieldCheck.error);

  const file = form.get('file');
  if (!file || typeof file === 'string' || file.size === 0) {
    return bad('Adjuntá tu CV.');
  }
  if (file.size > MAX_BYTES) {
    return bad(`El archivo pesa ${(file.size / 1048576).toFixed(1)} MB. El máximo es 4 MB.`, 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Chequeo real de formato: los bytes, no la extension ni el Content-Type.
  const ext = sniffType(buffer);
  if (!ext) {
    const permitidos = allowedExtensions().map((e) => e.toUpperCase()).join(' o ');
    return bad(`El archivo no es un ${permitidos} válido. Convertilo y volvé a intentar.`);
  }

  // El nombre lo generamos nosotros: el del cliente es dato no confiable.
  const ahora = fechaArgentina();
  const sufijo = crypto.randomUUID().slice(0, 8);
  const filename = `${ahora.dia}_${slugify(fields.puesto, 24)}_${slugify(fields.nombre)}_${sufijo}.${ext}`;

  const description = [
    `Nombre: ${fields.nombre}`,
    `Email: ${fields.email}`,
    `Teléfono: ${fields.telefono}`,
    `Puesto: ${fields.puesto}`,
    `Recibido: ${ahora.legible} (hora de Argentina)`,
  ].join('\n');

  try {
    const result = await uploadToDrive({
      filename,
      mimeType: mimeFor(ext),
      buffer,
      description,
    });
    // No devolvemos el link de Drive al postulante: es de uso interno.
    console.log(`CV recibido: ${result.name} (${result.id})`);
    return Response.json({ ok: true });
  } catch (err) {
    // El detalle va al log de Vercel, nunca al navegador.
    console.error('Fallo la subida a Drive:', err);
    return bad('No pudimos guardar tu CV. Probá de nuevo en unos minutos.', 502);
  }
}
