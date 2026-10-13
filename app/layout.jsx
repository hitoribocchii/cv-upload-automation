import './globals.css';
import { EMPRESA } from '@/lib/site';

export const metadata = {
  title: `Trabajá con nosotros | ${EMPRESA}`,
  description: 'Dejanos tu CV y te contactamos.',
  robots: { index: true, follow: true },
  // Codigo de Google Search Console, para probar que el dominio es nuestro
  // (lo pide la pantalla de consentimiento de OAuth). Se carga como variable
  // en Vercel; si no esta, no se agrega nada.
  ...(process.env.GOOGLE_SITE_VERIFICATION && {
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
  }),
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#00ae41',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
