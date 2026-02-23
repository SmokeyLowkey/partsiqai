import { NextRequest, NextResponse } from 'next/server';

/**
 * Validate that the request Origin matches the app's own domain.
 * Returns null if valid, or a 403 NextResponse if invalid.
 *
 * Defense-in-depth: CORS headers already block cross-origin JSON requests,
 * but this catches edge cases (old browsers, non-standard clients).
 */
export function checkOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const appOrigin = new URL(appUrl).origin;

  // If no origin and no referer, allow (server-side calls, curl testing)
  if (!origin && !referer) return null;

  // Check origin header first (present on CORS requests)
  if (origin && origin !== appOrigin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check referer as fallback (some browsers send referer but not origin)
  if (!origin && referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (refOrigin !== appOrigin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return null;
}
