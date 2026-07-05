import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyCookieValue, signCookieValue } from '@/lib/cookie';

const COOKIE_NAME = 'yak_session';
const DEFAULT_SECRET = 'default-session-cookie-secret-key-2026';

export async function proxy(request: NextRequest) {
  const cookieSecret = process.env.SESSION_COOKIE_SECRET || DEFAULT_SECRET;
  const cookie = request.cookies.get(COOKIE_NAME);
  
  let sessionId: string | null = null;
  let response: NextResponse | null = null;

  // 1. Attempt to verify existing cookie
  if (cookie?.value) {
    sessionId = await verifyCookieValue(cookie.value, cookieSecret);
  }

  // 2. If invalid or missing, generate a new secure session ID and issue cookie
  let isNewSession = false;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    isNewSession = true;
  }

  // 3. Clone request headers and inject verified session ID
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-session-id', sessionId);

  // Create response and set request headers for downstream routes
  response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Set the signed cookie if it was newly generated
  if (isNewSession) {
    const signedValue = await signCookieValue(sessionId, cookieSecret);
    response.cookies.set({
      name: COOKIE_NAME,
      value: signedValue,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year session durability
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - Static assets (under public/ like favicon)
     * - Next.js internal static assets (_next/static, _next/image)
     */
    '/((?!_next/static|_next/image|favicon.ico|post-images/|.*\\..*).*)',
  ],
};
