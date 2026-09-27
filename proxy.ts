import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAME, verifyToken } from '@/lib/utils/token';

/**
 * Garde de route (EX-SEC-06) : redirige vers /auth/signin quand le cookie de session
 * est absent, mal signé ou expiré. Défense en profondeur uniquement : le rôle et la
 * révocation sont vérifiés en base par les actions et par le layout du tableau de bord.
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (verifyToken(token)) return NextResponse.next();

  const signinUrl = new URL('/auth/signin', request.url);
  signinUrl.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(signinUrl);
}

export const config = {
  matcher: ['/dashboard/:path*', '/partie/:path*', '/match/:path*'],
};
