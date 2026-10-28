import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://comentame.vercel.app'),
  title: {default:'comenta.me — Cada opinión cuenta.',template:'%s — comenta.me'},
  description:'Escucha a tus clientes y mejora cada experiencia en tu restaurante con comenta.me.',
  icons:{icon:[{url:'/favicon.ico?v=8',sizes:'any'},{url:'/favicon.svg?v=8',type:'image/svg+xml'},{url:'/favicon-32.png?v=8',sizes:'32x32',type:'image/png'}],apple:'/assets/favicon-192.png?v=8'},
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="es-MX"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet"/></head><body><a className="skip" href="#main">Ir al contenido</a>{children}</body></html>;
}
