// GET /api/jobs/[id]/events - SSE replay + live stream event satu job.
// `cursor` = id event terakhir yang diterima client (query ?cursor=N, default 0).
// Menutup koneksi TIDAK menghentikan job; buka ulang URL ini untuk lanjut.

import { sseJobResponse } from "@/lib/prd/sse-job";
import { getJob } from "@/lib/prd/job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job) {
    return Response.json({ error: "Job tidak ditemukan atau sudah kedaluwarsa." }, { status: 404 });
  }

  const raw = new URL(request.url).searchParams.get("cursor");
  const parsed = raw === null ? 0 : Number(raw);
  const cursor = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;

  return sseJobResponse(job, cursor, request);
}
