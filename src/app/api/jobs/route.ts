// POST /api/jobs - buat job generate di background (TANPA mengeksekusi pipeline
// selama request hidup). Pipeline jalan lepas dari koneksi: client boleh putus
// (pindah tab/tutup web) lalu reconnect ke /api/jobs/[id]/events.
// Body tidak valid -> JSON 400/413/415; rate limit -> JSON 429 + Retry-After.

import { after } from "next/server";
import { startGenerateJob } from "@/lib/prd/job-runner";
import { createRateLimiter } from "@/lib/prd/rate-limit";
import { clientIp } from "@/lib/prd/client-ip";
import { readJsonLimited } from "@/lib/prd/http-body";
import { MAX_CLARIFY_QUESTIONS } from "@/lib/prd/parse";

export const runtime = "nodejs";
// Batas platform (detik) - job berjalan paling lama selama ini setelah respons terkirim.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_IDEA_LENGTH = 2000;
const MAX_ANSWER_LENGTH = 500;
const MAX_BODY_BYTES = 64 * 1024;
// Batas seed analisis pre-flight: sama seperti penanganan /api/clarify.
const MAX_SEED_LENGTH = 16_000;
const MAX_SEED_GAPS = 12;
const MAX_GAP_LENGTH = 400;
// BETA: rate limit identik /api/generate (burst 5, isi 3/menit).
const generateLimiter = createRateLimiter({ capacity: 5, refillPerSec: 3 / 60 });

interface GenerateBody {
  idea?: unknown;
  answers?: unknown;
  /** Analisis mendalam pre-flight /api/clarify: bila ada, stage 0a+0b dilewati. */
  analysis?: unknown;
  /** Gap hasil pre-flight (pasangan analysis). */
  gaps?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const parsed = await readJsonLimited(request, MAX_BODY_BYTES);
  if (!parsed.ok) {
    return Response.json({ error: parsed.message }, { status: parsed.status });
  }
  const body = parsed.value as GenerateBody;

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
  const answers = Array.isArray(body.answers)
    ? body.answers
        .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
        .slice(0, MAX_CLARIFY_QUESTIONS)
        .map((a) => a.slice(0, MAX_ANSWER_LENGTH))
    : undefined;

  const limit = generateLimiter.check(clientIp(request));
  if (!limit.ok) {
    return Response.json(
      { error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfterSeconds} detik.` },
      {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  // Seed opsional dari pre-flight /api/clarify: hemat 2 panggilan model kecil.
  // Dibatasi agar body tetap kecil; seed adalah hasil analisis kita sendiri.
  const seededAnalysis =
    typeof body.analysis === "string" && body.analysis.trim().length > 0
      ? body.analysis.slice(0, MAX_SEED_LENGTH)
      : undefined;
  const seededGaps = Array.isArray(body.gaps)
    ? body.gaps
        .filter((g): g is string => typeof g === "string" && g.trim().length > 0)
        .slice(0, MAX_SEED_GAPS)
        .map((g) => g.slice(0, MAX_GAP_LENGTH))
    : undefined;

  const { job, promise } = startGenerateJob(
    idea,
    answers,
    seededAnalysis !== undefined && seededGaps !== undefined
      ? { analysis: seededAnalysis, gaps: seededGaps }
      : undefined,
  );
  // after(): fungsi tetap hidup sampai pipeline selesai, walau respons (jobId)
  // sudah terkirim dan koneksi client sudah putus.
  after(() => promise);

  return Response.json({ jobId: job.id }, { headers: { "Cache-Control": "no-store" } });
}
