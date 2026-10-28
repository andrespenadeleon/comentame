import Link from 'next/link';
export const metadata = {robots:{index:false,follow:false}};
export default function AuthLayout({children}:{children:React.ReactNode}) {
  return <div className="auth-layout"><aside className="auth-story"><Link href="/" className="wordmark">comenta.me</Link><div><div className="story-orbit" aria-hidden="true">{Array.from({length:7},(_,i)=><span key={i}/>)}</div><h2>Escuchar es el primer paso para mejorar.</h2><p>Tu restaurante, tu equipo y las opiniones que hacen la diferencia. En un solo lugar.</p></div><footer>Hecho para restaurantes en México.</footer></aside><main id="main" className="auth-main"><Link href="/" className="wordmark">comenta.me</Link>{children}</main></div>;
}
