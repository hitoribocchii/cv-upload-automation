// Datos del comercio, en UN solo lugar: el formulario, el título y las
// páginas legales tienen que decir lo mismo (Google muestra /privacidad y
// /terminos en la pantalla de consentimiento).
//
// Las variables de entorno de Vercel pisan estos valores por defecto.

export const EMPRESA = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Comercio Ejemplo';
export const SUCURSAL = process.env.NEXT_PUBLIC_BRANCH_NAME || '';

// Tiene que ser un email REAL: la política de privacidad lo da como el
// canal para pedir acceso o baja de los datos (Ley 25.326).
export const CONTACTO = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'rrhh@ejemplo.com';
