import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {getAll: () => request.cookies.getAll(), setAll(items) {
      items.forEach(({name,value}) => request.cookies.set(name,value));
      response = NextResponse.next({request});
      items.forEach(({name,value,options}) => response.cookies.set(name,value,options));
    }},
  });
  // Refresh and validate the token; authorization is repeated in the data layer and RLS.
  const {data:{user}} = await supabase.auth.getUser();
  const protectedPath = ['/dashboard','/onboarding','/restablecer'].some(path => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + '/'));
  if (protectedPath && (!user || !user.email_confirmed_at)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = user ? '?notice=confirm' : '';
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    redirect.headers.set('Cache-Control','private, no-store');
    return redirect;
  }
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export const config = {matcher:['/dashboard/:path*','/onboarding/:path*','/login','/registro','/restablecer','/auth/:path*']};
