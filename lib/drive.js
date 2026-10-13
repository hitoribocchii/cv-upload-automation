// Cliente minimo de Google Drive. Sin SDK: solo fetch, para no arrastrar
// googleapis (~50 MB) a una funcion serverless que hace una sola cosa.
//
// Estas credenciales JAMAS se exponen al cliente. Este archivo solo puede
// ser importado desde codigo de servidor (route handlers).

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink';

// Cache del access token entre invocaciones que reusen la misma instancia.
// Los access token duran 1 hora; pedir uno nuevo por request es desperdicio.
let cached = { token: null, expiresAt: 0 };

async function getAccessToken() {
  const now = Date.now();
  if (cached.token && now < cached.expiresAt - 60_000) return cached.token;

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Faltan credenciales de Google en las variables de entorno.');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    // El caso tipico: la app OAuth quedo en "Testing" y el refresh token
    // caduco a los 7 dias -> invalid_grant. Ver README.
    throw new Error(`No se pudo renovar el access token de Google: ${detail}`);
  }

  const data = await res.json();
  cached = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return cached.token;
}

/**
 * Sube un archivo a la carpeta configurada usando multipart upload
 * (una sola request: metadata + bytes). Suficiente hasta ~5 MB.
 */
export async function uploadToDrive({ filename, mimeType, buffer, description }) {
  const accessToken = await getAccessToken();
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!folderId) throw new Error('Falta DRIVE_FOLDER_ID.');

  const boundary = `boundary-${crypto.randomUUID()}`;
  const metadata = {
    name: filename,
    parents: [folderId],
    description,
  };

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`,
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Drive rechazo la subida (${res.status}): ${await res.text()}`);
  }

  return res.json(); // { id, name, webViewLink }
}
