# Carga de CVs → Google Drive

Página pública para que la gente deje su CV. El archivo se valida en el servidor
y se guarda en una carpeta privada de Google Drive del comercio.

## Cómo funciona

```
Celular ──POST multipart──> /api/upload (Vercel) ──Drive API──> Carpeta de Drive
                                  │
                                  ├─ rate limit por IP
                                  ├─ Turnstile (anti-bot)
                                  ├─ campos + consentimiento
                                  ├─ tamaño ≤ 4 MB
                                  └─ magic bytes (%PDF), no la extensión
```

El archivo **pasa por el servidor a propósito**: es la única forma de mirar los
bytes reales antes de que lleguen a Drive. Como un CV pesa poco, el límite de
body de Vercel (~4.5 MB) no molesta — por eso el máximo es 4 MB.

Los postulantes nunca ven una pantalla de Google ni necesitan cuenta.

## Setup

### 1. Carpeta de Drive

**No la crees a mano.** La crea el script del paso 3.

Con el scope `drive.file` (el mínimo posible: la app no ve nada más del Drive)
la app solo puede escribir en lo que ella misma creó. Una carpeta hecha a mano
desde Drive da 404 al subir.

### 2. Proyecto en Google Cloud

En [console.cloud.google.com](https://console.cloud.google.com):

1. Proyecto nuevo
2. **APIs & Services → Library →** habilitar **Google Drive API**

Lo que sigue vive en **Google Auth Platform**
([console.cloud.google.com/auth/overview](https://console.cloud.google.com/auth/overview)).
Google eliminó el menú viejo "OAuth consent screen" y lo partió en pestañas;
si buscás ese nombre no lo vas a encontrar.

3. **Get started** — nombre de la app (el que va a ver el dueño al autorizar,
   poné algo reconocible como `Postulaciones <Comercio>`), email de soporte,
   **Audience: External**, email de contacto, aceptar y crear.
4. **Audience →** botón **Publish app** → el estado pasa de *Testing* a
   **In production**.
   Google no te deja publicar sin completar en **Branding** la página
   principal, la política de privacidad y los términos, más el dominio en
   *Dominios autorizados*. Esas URLs salen del deploy: hacé primero el paso 5
   y usá `https://<proyecto>.vercel.app`, `/privacidad` y `/terminos`.
   No subas logo: eso dispara la verificación de Google.
5. **Data Access → Add or remove scopes →** pegá en el filtro
   `https://www.googleapis.com/auth/drive.file`, tildalo, **Update** y **Save**.
6. **Clients → Create client → Web application**
   - Authorized redirect URI: `http://localhost:3000/oauth/callback`
   - Es la única URI que hace falta: el flujo corre en localhost, no en Vercel.
7. Guardá el **Client ID** y el **Client secret** que aparecen al crearlo.

> ⚠️ **El paso 4 no es opcional.** Si la app queda en *Testing*, el refresh
> token **caduca a los 7 días** y el formulario deja de andar sin aviso, con un
> `invalid_grant` en los logs. Es el bug más común de este setup.
>
> El scope `drive.file` no es un scope restringido, así que publicar acá no
> dispara el proceso de verificación de Google. (Si Google llegara a cambiar
> ese criterio, la pantalla de consentimiento avisa antes de autorizar.)

### 3. Autorizar con la cuenta del comercio

Este paso necesita **al dueño de la cuenta al lado** (unos 5 minutos).
No hace falta que te pase la contraseña — nunca se la pidas: la escribe él
en la pantalla de Google.

Antes, agregá `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` a `.env.local`. Ese archivo
lo crea `vercel link`: sumá las líneas al final, no lo pises copiando `.env.example`.

```bash
npm.cmd run token
```

La terminal imprime un link. **Abrilo en una ventana de incógnito** y que el
dueño inicie sesión ahí. En tu navegador normal ya está tu cuenta de Google, y
es muy fácil autorizar con la equivocada sin darse cuenta.

El script entonces:

1. Consigue el refresh token.
2. Crea la carpeta `Postulaciones - CVs` en el Drive del comercio.
3. Sube un `LEEME.txt` adentro usando el mismo código que producción.
   Si el LEEME aparece en Drive, las subidas reales van a andar.
4. Guarda `GOOGLE_REFRESH_TOKEN` y `DRIVE_FOLDER_ID` en `.env.local`.
5. Muestra el email con el que se autorizó. Confirmá que sea el del comercio.

Tiene que hacerse en la compu donde corre el script: el link de Google vuelve
a `localhost`, o sea a esa misma máquina. Si alguna vez hay que repetirlo a
distancia, lo más simple es que el dueño controle tu compu por AnyDesk o
Chrome Remote Desktop y escriba él su contraseña en la ventana de incógnito.

### 4. Anti-spam (Turnstile)

Un formulario público en internet **recibe bots**. En
[Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
creás un widget gratis y copiás las dos claves al `.env`.

Si dejás las variables vacías el sitio funciona igual, sin protección.
No lo dejes así en producción.

### 5. Deploy en Vercel

```bash
npx.cmd vercel link
```

Crea el proyecto en Vercel. Después, en **Settings → Environment Variables**,
pegá el contenido completo de `.env.local` en el campo *Key* (Vercel lo separa
solo). Antes, completá los `NEXT_PUBLIC_*` con los datos reales del comercio y
borrá las líneas vacías y la de `VERCEL_OIDC_TOKEN`
(es de Vercel y la maneja solo: no hace falta cargarla).

```bash
npx.cmd vercel --prod
```

El orden importa: las variables `NEXT_PUBLIC_*` se incrustan **al compilar**.
Si las cargás después del deploy, hay que volver a deployar.

## Probar en local

```bash
npm run dev
```

Casos que conviene probar antes de publicar:

| Prueba | Esperado |
|---|---|
| PDF normal | Aparece en la carpeta de Drive |
| Archivo de 6 MB | Rechazado antes de subir |
| `.jpg` renombrado a `.pdf` | Rechazado por el server (magic bytes) |
| POST con `curl` sin campos | 400, no llega nada a Drive |
| 6 envíos seguidos | El sexto da 429 |
| Desde el celular, con datos | La barra de progreso avanza |

```bash
# El caso que más importa: saltear el navegador.
curl -X POST http://localhost:3000/api/upload -F "file=@foto.jpg;filename=cv.pdf"
```

## Datos personales

Un CV es información personal sensible. Ley 25.326 (Argentina):

- El formulario pide **consentimiento explícito** con checkbox, sin premarcar.
- `/privacidad` declara finalidad, plazo y cómo pedir la baja.
- **El plazo de 12 meses hay que cumplirlo de verdad**: poné un recordatorio
  para limpiar la carpeta, o no lo declares.
- La carpeta de Drive va **privada**. Un "cualquiera con el link" ahí adentro
  es una filtración de datos de decenas de personas.
- Revisá quién tiene acceso a la carpeta cuando alguien deja el comercio.

## Extensiones útiles

- **Aviso por email al recibir un CV** — Resend, 3 líneas en el route handler.
- **Planilla de seguimiento** — agregar una fila a un Google Sheet con los datos.
  El scope `drive.file` alcanza si la app crea la planilla.
- **Rate limit real** — `@upstash/ratelimit`, compartido entre instancias.
- **Aceptar .docx** — `ALLOW_DOCX=true`, pero ojo: la firma de un .docx es la de
  un ZIP genérico, así que también pasan otros archivos. Solo-PDF es más seguro.

## Windows: "la ejecución de scripts está deshabilitada"

`npm` en Windows es un script de PowerShell, y por defecto PowerShell no los
ejecuta. No es un problema del proyecto. Dos salidas:

```bash
# a) sin tocar nada del sistema: usar el .cmd en vez del .ps1
npm.cmd run dev
```

```powershell
# b) permanente: habilitar scripts firmados para tu usuario
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

La opción (b) cambia una configuración de seguridad de Windows para tu usuario
(permite correr scripts locales y remotos firmados). Es lo que hace la mayoría
de quienes desarrollan en Windows, pero decidilo vos.

También podés usar CMD o Git Bash en lugar de PowerShell, donde no aplica.
