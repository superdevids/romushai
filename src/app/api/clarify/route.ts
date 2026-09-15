// POST /api/clarify - pertanyaan klarifikasi pre-flight (sebelum generate).
// Ringan: model kecil, respons JSON biasa (bukan SSE). Gagal -> questions kosong agar pipeline tetap jalan.

import { envConfig, runClarify } from "@/lib/prd/pipeline";
import { createRateLimiter } from "@/lib/prd/rate-limit";
import { clientIp } from "@/lib/prd/client-ip";

export const runtime = "nodejs";

const MAX_IDEA_LENGTH = 2000;
const MAX_BODY_BYTES = 16 * 1024;
// BETA: rate limit in-memory per IP (5/menit).
const clarifyLimiter = createRateLimiter({ capacity: 5, refillPerSec: 5 / 60 });

interface ClarifyBody {
  idea?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const n = Number(contentLength);
    if (Number.isFinite(n) && n > MAX_BODY_BYTES) {
      return Response.json({ error: "Body terlalu besar (maksimal 16 KB)." }, { status: 400 });
    }
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return Response.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }
  if (rawText.length > MAX_BODY_BYTES) {
    return Response.json({ error: "Body terlalu besar (maksimal 16 KB)." }, { status: 400 });
  }

  let body: ClarifyBody;
  try {
    body = JSON.parse(rawText) as ClarifyBody;
  } catch {
    return Response.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const idea = body.idea;
  if (typeof idea !== "string" || idea.trim().length === 0) {
    return Response.json({ error: "Ide tidak boleh kosong." }, { status: 400 });
  }
  if (idea.length > MAX_IDEA_LENGTH) {
    return Response.json(
      { error: `Ide terlalu panjang (maksimal ${MAX_IDEA_LENGTH} karakter).` },
      { status: 400 },
    );
  }

  const limit = clarifyLimiter.check(clientIp(request));
  if (!limit.ok) {
    return Response.json(
      { error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfterSeconds} detik.` },
      {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  let cfg;
  try {
    cfg = envConfig();
  } catch {
    // Misconfig server: pipeline generate yang akan melaporkan error; clarify di-skip.
    return Response.json({ questions: [] });
  }

  const result = await runClarify({ cfg, idea, signal: request.signal });
  return Response.json({ questions: result.questions, analysis: result.analysis, gaps: result.gaps });
}