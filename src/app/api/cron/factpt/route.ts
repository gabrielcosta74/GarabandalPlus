import { NextResponse } from 'next/server';

import { processFactPtQueue } from '../../../../lib/factpt/processor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const requestedLimit = Number(new URL(request.url).searchParams.get('limit'));
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 5;
    const sandbox = await processFactPtQueue('sandbox', limit);
    const production = await processFactPtQueue('production', limit);
    return NextResponse.json({
      ok: true,
      environments: { sandbox, production },
    });
  } catch (error) {
    console.error('FACT.pt worker failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'FACT.pt worker failed',
      },
      { status: 500 },
    );
  }
}
