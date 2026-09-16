# PRD Generator

Aplikasi Next.js: ketik ide project - sistem menghasilkan **paket dokumen markdown** (Bahasa Indonesia): master PRD, dokumen teknis pilihan (API-TECH, WEB-REFERENCE, UIUX-SPEC, DATABASE, dsb.) + TASK-LIST. Tanpa autentikasi, publik, streaming langsung (SSE).

## Route

| Route | Keterangan |
| --- | --- |
| `/` | Landing page: ringkasan produk + tombol menuju generator. |
| `/prd` | Generator PRD: composer, klarifikasi, stream dokumen, preview, riwayat. |

## Setup

1. `cp .env.example .env` lalu isi `LLM_API_KEY`. Wajib.
2. `npm run dev` - buka http://localhost:3000/prd

Variabel env (server-only, tanpa prefix `NEXT_PUBLIC_`):

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `LLM_API_KEY` | - (wajib) | API key penyedia OpenAI-compatible |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Dasar URL API (harus berakhir `/v1`) |
| `LLM_MODEL_SMALL` | `gpt-4o-mini` | Tahap scope & rekomendasi dokumen |
| `LLM_MODEL_STRONG` | `gpt-4o` | Tahap menulis dokumen & task list |
| `LLM_TIMEOUT_MS` | `300000` | Timeout per panggilan model (inactivity-based, di-reset saat ada chunk) |
| `LLM_TOTAL_TIMEOUT_MS` | `900000` | Deadline absolut satu panggilan model |
| `GENERATE_BUDGET_MS` | `280000` | Plafon total generate (job + legacy); wajib < maxDuration Vercel 300s |
| `REGENERATE_BUDGET_MS` | `280000` | Plafon total regenerate satu dokumen |
| `DEV_ORIGINS` | - (kosong) | Origin dev tambahan dipisah koma, mis. IP LAN |
| `HEALTH_TOKEN` | - (kosong) | Token untuk detail GET `/api/health`; kosong = mode terbuka |
| `TRUSTED_PROXY_COUNT` | `1` | Jumlah proxy tepercaya untuk memilih entri `x-forwarded-for` |
| `MEMORY_PATH` | `.memory/agent-memory.json` | Lokasi memori kemampuan agent (server-only) |
| `MEMORY_MAX_RECORDS` | `2000` | Batas entri memori setelah prune LRU |
| `MEMORY_MAX_AGE_DAYS` | `120` | Umur maksimum entri memori (hari) |

## API

- `POST /api/clarify` `{ idea }` - pertanyaan klarifikasi terstruktur sebelum generate.
- `POST /api/generate` `{ idea, answers? }` - SSE pipeline **9 stage (stage 0-8)**, terikat umur request (legacy; masih dipertahankan sebagai fallback).
- `POST /api/regenerate-doc` `{ idea, scope, doc, docs? }` - SSE regenerate satu dokumen (stateless, legacy).
- `POST /api/jobs` `{ idea, answers?, analysis?, gaps? }` - buat **job generate** di background; pipeline jalan lepas dari koneksi (diikat `after()`), balas `{ jobId }` segera.
- `POST /api/jobs/regenerate` `{ idea, scope, doc, docs?, answers?, analysis?, gaps? }` - buat job regenerate satu dokumen.
- `GET /api/jobs/[id]` - status ringkas job (JSON).
- `GET /api/jobs/[id]/events?cursor=N` - **SSE replay + live** event job mulai dari event `N` (0 = dari awal). Menutup koneksi TIDAK membatalkan job.
- `DELETE /api/jobs/[id]/cancel` - batalkan job yang sedang berjalan.
- `GET /api/health` - status konfigurasi; detail hanya bila `HEALTH_TOKEN` cocok.
- Validasi: idea 1-2000 karakter (400). Rate limit in-memory per IP (BETA): generate burst 5 / isi 3 per menit; regenerate 10 per menit - 429 + `Retry-After`.
- Retry 2x (backoff 1s/2s) untuk timeout 60s/stage, HTTP 5xx, JSON rekomendasi tidak valid. 401/403/429 penyedia = fatal.

## Streaming tahan putus (arsitektur job)

Pipeline TIDAK lagi terikat 1:1 ke request HTTP. Alur:

1. Client `POST /api/jobs` -> `{ jobId }`; pipeline berjalan di background (`after()`), event ditampung di buffer in-memory per job.
2. Client membuka `GET /api/jobs/[id]/events` dan menerima replay dari cursor + event live. Setiap event punya `id:` monotonik.
3. Tab ditutup / pindah app -> stream putus, **pipeline tetap jalan** (sampai budget 280s atau selesai).
4. Tab dibuka lagi -> client membaca `romushai-active-job:v1` dari localStorage, replay dari cursor 0, tampilan pulih tanpa menjalankan ulang model.
5. Event `done` dijamin diproses tepat satu kali per job (guard `markJobProcessed`).

Batasan: buffer job **per-proses**. Di deploy multi-instance, reconnect bisa mendarat di instansi lain dan menerima 404; upgrade path = pindahkan buffer ke Upstash Redis / Vercel KV.

## Catatan teknis

- Satu codepath OpenAI-compatible (plain fetch, tanpa SDK). **Ollama tidak didukung** - butuh mode kompatibilitas berbeda.
- Rate limit **in-memory per instance** - upgrade ke Upstash Redis bila deploy multi-instance.
- Riwayat tersimpan di `localStorage` per browser/device; job aktif tersimpan di `romushai-active-job:v1` agar reconnect otomatis setelah tab ditutup.
- Tema default **gelap**; pilihan pengguna disimpan di `localStorage` (`romushai-theme`).

## Scripts

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint`
- `npm run typecheck` (tsc --noEmit)
- `npm test` (runner bawaan Node.js, tanpa dependency; menguji job-store, parser SSE, dan validator markdown)
