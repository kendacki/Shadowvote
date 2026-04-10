import { NextRequest, NextResponse } from 'next/server';

/**
 * Forwards POST /check and POST /prove to the Midnight proof server (same API as
 * @midnight-ntwrk/midnight-js-http-client-proof-provider).
 *
 * Lets HTTPS sites (e.g. Vercel) prove without browser → http mixed content or CORS to the prover.
 * The proof server must be reachable from this Node runtime (not the visitor’s loopback).
 * For a laptop-bound Docker prover, use ngrok/Cloudflare Tunnel and set MIDNIGHT_PROOF_SERVER_INTERNAL_URL.
 */
const ALLOWED = new Set(['check', 'prove']);

function upstreamBase(): string {
  const raw =
    process.env.MIDNIGHT_PROOF_SERVER_INTERNAL_URL?.trim() ||
    process.env.PROOF_SERVER_URL?.trim() ||
    'http://127.0.0.1:6300';
  return raw.replace(/\/$/, '');
}

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ endpoint: string }> },
): Promise<NextResponse> {
  const { endpoint } = await ctx.params;
  if (!ALLOWED.has(endpoint)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const target = `${upstreamBase()}/${endpoint}`;
  let body: Buffer;
  try {
    body = Buffer.from(await req.arrayBuffer());
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body,
      signal: AbortSignal.timeout(300_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Proof server unreachable from app server', detail: msg, target },
      { status: 502 },
    );
  }

  const out = Buffer.from(await upstream.arrayBuffer());
  if (!upstream.ok) {
    return new NextResponse(out, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return new NextResponse(out, {
    status: 200,
    headers: { 'Content-Type': 'application/octet-stream' },
  });
}
