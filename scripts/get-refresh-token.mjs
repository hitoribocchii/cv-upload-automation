/**
 * Autoriza la app con la cuenta de Google del comercio y deja todo listo.
 * Se corre UNA sola vez, con el dueño de la cuenta al lado:
 *
 *   npm.cmd run token
 *
 * Hace tres cosas:
 *   1. Consigue el refresh token (el dueño acepta en la pantalla de Google).
 *   2. Crea la carpeta de postulaciones en su Drive.
 *   3. Sube un LEEME.txt a esa carpeta con el MISMO codigo que usa produccion
 *      (lib/drive.js). Si esto termina bien, las subidas reales van a andar.
 *
 * Por que la carpeta la crea el script y no una persona: con el scope
 * drive.file la app solo puede tocar lo que ella misma creo. Subir a una
 * carpeta hecha a mano desde Drive da 404.
 *
 * No abre el navegador solo, a proposito: tu navegador ya tiene TU cuenta
 * de Google logueada y es muy facil autorizar con la equivocada.
 */

import http from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';

const PORT = 3000;
const REDIRECT = `http://localhost:${PORT}/oauth/callback`;
const FOLDER_NAME = 'Postulaciones - CVs';
const ENV_FILE = '.env.local';

// Carga simple de .env.local (evita depender de dotenv).
let envText;
try {
  envText = readFileSync(ENV_FILE, 'utf8');
} catch {
  console.error(`No encontré ${ENV_FILE}. Copiá .env.example y completá el client ID/secret.`);
  process.exit(1);
}
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: CLIENT_SECRET } = process.env;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(`Faltan GOOGLE_CLIENT_ID y/o GOOGLE_CLIENT_SECRET en ${ENV_FILE}`);
  process.exit(1);
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: 'code',
    // drive.file = solo los archivos que crea esta app. No ve el resto del Drive.
    // openid + email = solo para mostrar con que cuenta se autorizo.
    scope: 'https://www.googleapis.com/auth/drive.file openid email',
    access_type: 'offline', // <- sin esto no hay refresh token
    prompt: 'consent',      // <- fuerza que lo devuelva aunque ya haya autorizado antes
  });

const LEEME = `Esta carpeta la usa el formulario "Trabajá con nosotros".
Cada CV que llega se guarda acá automáticamente.

- Podés renombrarla o moverla dentro de tu Drive: sigue funcionando.
- NO la borres: el formulario dejaría de poder guardar postulaciones.
- No la compartas con "cualquier persona con el enlace": son datos personales.
- Los CVs se conservan 12 meses (ver la política de privacidad del sitio).

Configurado el ${new Date().toLocaleDateString('es-AR')}.
`;

/** El id_token es un JWT; solo lo leemos para mostrar el email, no hace falta verificarlo. */
function emailFromIdToken(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    return payload.email ?? null;
  } catch {
    return null;
  }
}

async function createFolder(accessToken) {
  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!res.ok) throw new Error(`No se pudo crear la carpeta (${res.status}): ${await res.text()}`);
  return res.json();
}

/** Escribe (o reemplaza) variables en .env.local para no copiar a mano. */
function saveEnv(vars) {
  let text = readFileSync(ENV_FILE, 'utf8');
  for (const [key, value] of Object.entries(vars)) {
    const re = new RegExp(`^${key}=.*$`, 'm');
    text = re.test(text)
      ? text.replace(re, () => `${key}=${value}`)
      : text.replace(/\s*$/, () => `\n${key}=${value}\n`);
  }
  writeFileSync(ENV_FILE, text);
}

function page(res, title, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(
    `<!doctype html><meta name="viewport" content="width=device-width">` +
      `<body style="font:16px system-ui;max-width:32rem;margin:3rem auto;padding:0 1rem">` +
      `<h1 style="font-size:1.3rem">${title}</h1><p>${body}</p></body>`,
  );
}

/** Termina el proceso cuando el navegador ya recibio la respuesta. */
function exitAfter(res, code) {
  res.on('finish', () => setTimeout(() => process.exit(code), 200));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/oauth/callback') {
    res.statusCode = 404;
    return res.end();
  }

  // El dueño apreto "Cancelar" en la pantalla de Google.
  if (url.searchParams.get('error')) {
    exitAfter(res, 1);
    page(res, 'Autorización cancelada', 'Volvé a correr <code>npm.cmd run token</code> para reintentar.');
    console.error(`\nGoogle devolvió: ${url.searchParams.get('error')}. No se guardó nada.`);
    return;
  }

  const code = url.searchParams.get('code');
  if (!code) return page(res, 'Falta el código', 'Volvé a abrir el link que imprimió la terminal.');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT,
        grant_type: 'authorization_code',
      }),
    });
    const data = await tokenRes.json();

    if (!data.refresh_token) {
      throw new Error(
        `Google no devolvió refresh token: ${JSON.stringify(data)}\n` +
          'Si dice invalid_client, revisá CLIENT_ID/SECRET en .env.local.\n' +
          'Si la cuenta ya había autorizado antes, revocá el acceso en\n' +
          'https://myaccount.google.com/permissions y repetí.',
      );
    }

    const email = emailFromIdToken(data.id_token);
    const folder = await createFolder(data.access_token);

    // Prueba de punta a punta con el codigo real de produccion:
    // renueva el token desde el refresh token y sube a la carpeta nueva.
    process.env.GOOGLE_REFRESH_TOKEN = data.refresh_token;
    process.env.DRIVE_FOLDER_ID = folder.id;
    const { uploadToDrive } = await import('../lib/drive.js');
    await uploadToDrive({
      filename: 'LEEME.txt',
      mimeType: 'text/plain; charset=UTF-8',
      buffer: Buffer.from(LEEME, 'utf8'),
      description: 'Creado por el script de configuración.',
    });

    saveEnv({ GOOGLE_REFRESH_TOKEN: data.refresh_token, DRIVE_FOLDER_ID: folder.id });

    exitAfter(res, 0);
    page(res, 'Listo ✓', `Autorizado como <b>${email ?? '(email no disponible)'}</b>. Ya podés cerrar esta ventana.`);

    const line = '='.repeat(62);
    console.log(`\n${line}`);
    console.log(` Autorizado como: ${email ?? '(no disponible)'}`);
    console.log(' ¿Es la cuenta del comercio? Si no, avisá: hay que repetir.');
    console.log(line);
    console.log(`\n Carpeta creada: ${FOLDER_NAME}`);
    console.log(` ${folder.webViewLink}`);
    console.log(' Adentro hay un LEEME.txt. Si lo ven, la subida anda.\n');
    console.log(` GOOGLE_REFRESH_TOKEN y DRIVE_FOLDER_ID quedaron guardados en ${ENV_FILE}.`);
    console.log(' El refresh token es como una contraseña de esa carpeta:');
    console.log(' no lo mandes por WhatsApp ni por mail.\n');
  } catch (err) {
    exitAfter(res, 1);
    page(res, 'Algo falló', 'Mirá el mensaje en la terminal.');
    console.error(`\n${err.message}\n`);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nEl puerto ${PORT} está ocupado. ¿Tenés "npm run dev" corriendo?`);
    console.error('Cortalo con Ctrl+C en esa terminal y volvé a probar.\n');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log('\n1. Abrí una ventana de INCÓGNITO (Ctrl+Shift+N en Chrome / Ctrl+Shift+P en Edge).');
  console.log('2. Pegá este link y que el dueño inicie sesión con la cuenta del comercio:\n');
  console.log(authUrl);
  console.log('\nEsperando la autorización... (Ctrl+C para cancelar)');
});
