// Respons SSE yang di-replay dari buffer job (bukan mengeksekusi pipeline).
// Kontrak event identik dengan sse.ts supaya readSse() client tetap terpakai.
// Server-only.

import { subscribeJob, type BufferedEvent, type JobState } from "./job-store.ts";

/** Jeda heartbeat: komentar ": ping" menjaga koneksi hidup di balik proxy. */
const HEARTBEAT_MS = 15_000;

function isTerminal(evt: BufferedEvent): boolean {
  if (evt.event === "done") return true;
  return evt.event === "error" && (evt.data as { kind?: unknown } | null)?.kind === "fatal";
}

/**
 * Stream event satu job mulai dari `cursor` (event id terakhir yang sudah diterima
 * client; 0 = dari awal). Bila job sudah terminal dan buffer sudah habis dikirim,
 * stream ditutup seketika. Menutup stream TIDAK membatalkan job: pipeline jalan terus.
 */
export function sseJobResponse(job: JobState, cursor: number, request: Request): Response {
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  const stopHeartbeat = (): void => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = undefined;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let lastIdSent = 0;
      let terminalSent = false;
      const pending: BufferedEvent[] = [];

      const stop = (): void => {
        stopHeartbeat();
        unsubscribe?.();
        unsubscribe = undefined;
      };
      const rawWrite = (text: string): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          closed = true;
          stop();
        }
      };
      const writeEvent = (evt: BufferedEvent): void => {
        if (closed || terminalSent) return;
        if (evt.id <= lastIdSent) return; // guard duplikat (delta selalu id baru)
        lastIdSent = evt.id;
        rawWrite(`id: ${evt.id}\nevent: ${evt.event}\ndata: ${JSON.stringify(evt.data)}\n\n`);
        if (isTerminal(evt)) {
          terminalSent = true;
          // Penutupan stream ditunda ke microtask: writeEvent bisa dipanggil dari
          // dalam loop replay/notify, dan controller.close() di tengah iterasi
          // berisiko melempar bila masih ada enqueue pada tick yang sama.
          queueMicrotask(finish);
        }
      };
      const finish = (): void => {
        if (closed) return;
        stop();
        closed = true;
        try {
          controller.close();
        } catch {
          // sudah tertutup
        }
      };

      // Langganan dipasang SEBELUM replay; event yang datang saat replay masuk
      // `pending` supaya urutannya tidak pernah mendahului buffer. Delta chunk
      // live selalu ber-id baru dari nextSeq (lihat pushJobEvent), jadi tidak
      // mungkin tertolak guard duplikat di writeEvent.
      let replaying = true;
      unsubscribe = subscribeJob(job, (evt) => {
        if (replaying) pending.push(evt);
        else writeEvent(evt);
      });

      // Replay hanya event yang BELUM diterima client (id > cursor).
      for (const evt of job.events) {
        if (evt.id <= cursor) continue;
        if (closed || terminalSent) break;
        writeEvent(evt);
      }
      replaying = false;
      for (const evt of pending) {
        if (closed || terminalSent) break;
        writeEvent(evt);
      }

      // Job sudah terminal dan seluruh buffer terkirim: tidak ada yang ditunggu.
      if (!closed && job.status !== "running") {
        finish();
        return;
      }
      if (closed) return;

      heartbeat = setInterval(() => rawWrite(": ping\n\n"), HEARTBEAT_MS);
      if (request.signal.aborted) finish();
      else request.signal.addEventListener("abort", () => finish(), { once: true });
    },
    cancel() {
      // Client putus (tab pindah/ditutup): lepas langganan, job TETAP jalan.
      stopHeartbeat();
      unsubscribe?.();
      unsubscribe = undefined;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}