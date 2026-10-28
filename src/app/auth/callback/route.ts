import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(request:NextRequest) {
  const url=new URL(request.url);
  const db=await createClient();
  const code=url.searchParams.get('code');
  const tokenHash=url.searchParams.get('token_hash');
  const type=url.searchParams.get('type');
  let ok=false;
  if(code) {const {error}=await db.auth.exchangeCodeForSession(code);ok=!error;}
  else if(tokenHash && (type==='signup'||type==='recovery'||type==='email')) {const {error}=await db.auth.verifyOtp({token_hash:tokenHash,type});ok=!error;}
  // Destination allowlist prevents redirects to arbitrary domains or paths.
  const next=url.searchParams.get('next')==='/restablecer'||type==='recovery'?'/restablecer':'/onboarding';
  const response=NextResponse.redirect(new URL(ok?next:'/login?notice=link',url.origin));
  response.headers.set('Cache-Control','no-store');
  return response;
}
