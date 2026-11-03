import { NextResponse } from 'next/server';

// Plan §2.4: health check with no DB dependency, used by Docker orchestration.
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
