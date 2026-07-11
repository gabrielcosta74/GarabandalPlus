import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/products-source-3.xml', request.url), 308);
}
