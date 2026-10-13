/** @type {import('next').NextConfig} */
const nextConfig = {
  // El body de la request lo maneja el runtime de Vercel (limite duro ~4.5 MB).
  // Nuestro limite propio de 4 MB vive en lib/validate.js y se aplica en el server.
};

export default nextConfig;
