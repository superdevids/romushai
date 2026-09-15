// POST /api/clarify - pertanyaan klarifikasi pre-flight (sebelum generate).
// Ringan: model kecil, respons JSON biasa (bukan SSE). Gagal -> questions kosong agar pipeline tetap jalan.

import { envConfig, runClarify } from "@/lib/prd/pipeline";
import { createRateLimiter } from "@/lib/prd/rate-limit";
import { clientIp } from "@/lib/prd/client-ip";
import { readJsonLimited } from "@/lib/prd/http-body";

export const runtime = "nodejs";
// Batas eksekusi platform dalam detik. Plan Hobby Vercel maksimum 300;
// turunkan nilai ini bila plan/kuota lebih rendah.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_IDEA_LENGTH = 2000;
const MAX_BODY_BYTES = 16 * 1024;
// BETA: rate limit in-memory per IP (5/menit).
const clarifyLimiter = createRateLimiter({ capacity: 5, refillPerSec: 5 / 60 });

interface ClarifyBody {
  idea?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const parsed = await readJsonLimited(request, MAX_BODY_BYTES);
  if (!parsed.ok) {
    return Response.json({ error: parsed.message }, { status: parsed.status });
  }
  const body = parsed.value as ClarifyBody;

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