// GET /api/jobs/[id] - status ringkas satu job (tanpa stream).
// Dipakai reconnect diam-diam: true bila GET events masih aktif, false bila
// 404 (instansi berbeda / job dibuang) sehingga client jatuh ke /api/generate.

import { getJob } from "@/lib/prd/job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job) {
    return Response.json({ error: "Job tidak ditemukan atau sudah kedaluwarsa." }, { status: 404 });
  }
  return Response.json(
    {
      jobId: job.id,
      kind: job.kind,
      status: job.status,
      updatedAt: job.updatedAt,
      events: job.events.length,
      lastEventId: job.events.length > 0 ? job.events[job.events.length - 1].id : 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
