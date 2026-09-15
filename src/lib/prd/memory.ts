// Lapisan persistensi memori agent (server-only, node:fs). Client TIDAK BOLEH mengimpor file ini.
// Re-export seluruh logika murni dari memory-core.ts agar satu titik impor di sisi server.

import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MAX_AGE_DAYS,
  DEFAULT_MAX_RECORDS,
  MEMORY_VERSION,
  isAgentMemory,
  mergeMemory,
  memoryDigest,
  pruneMemory,
  promoteMemory,
  type PruneOptions,
} from "./memory-core.ts";
import type { AgentMemory, DocName, MemorySummary } from "./types.ts";

export {
  DEFAULT_MAX_AGE_DAYS,
  DEFAULT_MAX_RECORDS,
  MEMORY_MAX_PER_DOC,
  MEMORY_VERSION,
  PROMOTE_MIN_AVG_QUALITY,
  PROMOTE_MIN_OCCURRENCES,
  dedupeStrings,
  deriveDomain,
  isAgentMemory,
  memoryDigest,
  memoryFromSummary,
  mergeMemory,
  pruneMemory,
  promoteMemory,
  recordOutcome,
} from "./memory-core.ts";
export type { RecordOutcomeInput, PruneOptions } from "./memory-core.ts";

// Batas pertumbuhan: cap 50 entri per docType (mergeMemory) + prune LRU
// (DEFAULT_MAX_RECORDS total, umur DEFAULT_MAX_AGE_DAYS hari) menjaga berkas tetap kecil.
// Env override: MEMORY_MAX_RECORDS, MEMORY_MAX_AGE_DAYS; lokasi: MEMORY_PATH.

const DEFAULT_MEMORY_FILE = "agent-memory.json";
// Direktori root memori: dibatasi ke subfolder statis agar Turbopack tidak menelusuri
// seluruh project (lihat peringatan "Dynamic filesystem access" saat build).
const MEMORY_DIR = ".memory";

let warned = false;
function warnOnce(error: unknown): void {
  if (warned) return;
  warned = true;
  const message = error instanceof Error ? error.message : String(error);
  console.warn("[agent-memory] penyimpanan memori dilewati (degrade aman):", message);
}

function isEnoent(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

/**
 * Root project = leluhur terdekat yang punya package.json, dilewati dari cwd lalu
 * (fallback) dari lokasi modul. Dipakai untuk MENGUNCI lokasi memori ke root project
 * secara deterministik: `npm run dev` dari subshell mana pun, PM2, maupun
 * `next start` setelah build akan selalu menulis ke berkas yang SAMA.
 * Direktori `.next` dilewati karena Next menaruh package.json sendiri di sana
 * (bundel server berada di `.next/server/...`, bukan root project).
 */
function nearestProjectRoot(start: string): string | null {
  let dir = path.resolve(start);
  for (let i = 0; i < 12; i++) {
    if (path.basename(dir) !== ".next" && existsSync(/* turbopackIgnore: true */ path.join(dir, "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function moduleDir(): string | null {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return null;
  }
}

let cachedProjectRoot: string | null = null;
function projectRoot(): string {
  if (cachedProjectRoot) return cachedProjectRoot;
  const fromCwd = nearestProjectRoot(process.cwd());
  const fromModule = fromCwd ?? (moduleDir() ? nearestProjectRoot(moduleDir() as string) : null);
  cachedProjectRoot = fromModule ?? process.cwd();
  return cachedProjectRoot;
}

/** Lokasi absolut berkas store memori (deterministik dari root project). */
export function memoryFilePath(): string {
  const raw = process.env.MEMORY_PATH?.trim();
  // MEMORY_PATH absolut dipakai apa adanya (escape hatch untuk deployment khusus).
  if (raw && path.isAbsolute(raw)) return raw;
  // Nilai relatif dipaksa ke subfolder statis ".memory" (mencegah tracing seluruh project).
  const name = raw && raw.length > 0 ? path.basename(raw) : DEFAULT_MEMORY_FILE;
  return path.join(projectRoot(), MEMORY_DIR, name);
}

/** Lokasi berkas backup (1 generasi sebelumnya) di sebelah berkas utama. */
export function memoryBackupPath(): string {
  const file = memoryFilePath();
  const ext = path.extname(file);
  return ext.length > 0 ? `${file.slice(0, -ext.length)}.backup${ext}` : `${file}.backup.json`;
}

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function pruneOptions(): PruneOptions {
  return {
    maxRecords: envInt("MEMORY_MAX_RECORDS", DEFAULT_MAX_RECORDS),
    maxAgeDays: envInt("MEMORY_MAX_AGE_DAYS", DEFAULT_MAX_AGE_DAYS),
  };
}

// Antrian promise in-process: tulisan diserialisasi agar rename atomik tidak saling menimpa.
let writeChain: Promise<void> = Promise.resolve();
function enqueueWrite(task: () => Promise<void>): Promise<void> {
  const next = writeChain.then(task, task);
  writeChain = next.catch(() => undefined);
  return next;
}

let tmpSeq = 0;

/** Parse isi berkas store; null bila JSON rusak / shape salah. */
function parseStore(raw: string): AgentMemory[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return null;
    const records = (parsed as { records?: unknown }).records;
    if (!Array.isArray(records)) return null;
    return records.filter(isAgentMemory);
  } catch {
    return null;
  }
}

/** Tulis atomik: tmp -> fsync berkas -> rename. Rename menjamin pembaca tak pernah lihat parsial. */
async function atomicWrite(file: string, payload: string): Promise<void> {
  await fs.mkdir(/* turbopackIgnore: true */ path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.${tmpSeq++}.tmp`;
  const handle = await fs.open(/* turbopackIgnore: true */ tmp, "w");
  try {
    await handle.writeFile(payload, "utf8");
    // fsync berkas best-effort: data harus mendarat sebelum rename, tapi fs yang menolak
    // sync (mis. tmpfs tertentu) tidak boleh menggagalkan penulisan.
    await handle.sync().catch(() => undefined);
  } finally {
    await handle.close();
  }
  await fs.rename(/* turbopackIgnore: true */ tmp, file);
}

/** fsync direktori setelah rename (best-effort; Windows biasanya menolak membuka direktori). */
async function syncDirBestEffort(dir: string): Promise<void> {
  try {
    const handle = await fs.open(/* turbopackIgnore: true */ dir, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    // tidak didukung platform/izin; rename sudah atomik, jadi ini hanya lapisan ekstra
  }
}

/**
 * Rotasi backup (1 generasi): salin isi berkas utama SAAT INI ke <nama>.backup.json
 * sebelum berkas utama ditimpa. Tulis pertama (belum ada berkas utama) -> tidak ada backup.
 */
async function rotateBackupBestEffort(file: string): Promise<void> {
  try {
    const previous = await fs.readFile(/* turbopackIgnore: true */ file, "utf8");
    await atomicWrite(memoryBackupPath(), previous);
  } catch {
    // backup gagal (izin/disk) tidak boleh menggagalkan penulisan utama
  }
}

/**
 * Pulihkan store dari berkas backup bila berkas utama hilang/rusak.
 * Mengembalikan null bila tidak ada backup valid; berkas utama ditulis ulang (best-effort).
 */
async function tryRestoreFromBackup(): Promise<AgentMemory[] | null> {
  try {
    const raw = await fs.readFile(/* turbopackIgnore: true */ memoryBackupPath(), "utf8");
    const records = parseStore(raw);
    if (records === null) return null;
    try {
      // Pulihkan berkas utama dari isi backup; kegagalan tulis tidak membatalkan hasil baca.
      await enqueueWrite(() => atomicWrite(memoryFilePath(), raw));
    } catch (error) {
      warnOnce(error);
    }
    return records;
  } catch {
    return null;
  }
}

/** Muat store dari disk. Berkas tidak ada / JSON rusak -> pulihkan backup -> store kosong; TIDAK pernah throw. */
export async function loadMemoryStore(): Promise<AgentMemory[]> {
  const file = memoryFilePath();
  let raw: string;
  try {
    raw = await fs.readFile(/* turbopackIgnore: true */ file, "utf8");
  } catch (error) {
    if (isEnoent(error)) {
      // Self-verify saat boot: berkas utama hilang -> coba pulihkan dari backup.
      return (await tryRestoreFromBackup()) ?? [];
    }
    warnOnce(error);
    return [];
  }
  const records = parseStore(raw);
  if (records !== null) return records;
  // Berkas utama rusak -> coba pulihkan dari backup.
  const restored = await tryRestoreFromBackup();
  if (restored !== null) return restored;
  warnOnce(new Error("store memori rusak dan tidak ada backup valid"));
  return [];
}

/**
 * Tulis store secara atomik (tmp + fsync + rename) lewat antrian.
 * Sebelum menimpa berkas utama, generasi sebelumnya dirotasikan ke backup (1 generasi).
 * Rename atomik menjamin pembaca tidak pernah melihat berkas parsial; bila proses mati di
 * tengah writeFile, hanya file .tmp yatim yang tertinggal, berkas utama tetap utuh.
 * TIDAK memprune: caller (learnFromOutcome) sudah prune sebelum persist; prune ganda
 * di sini hanya membuang CPU (sort + filter) untuk hasil yang sama. TIDAK pernah throw.
 */
export async function persistMemoryStore(store: AgentMemory[]): Promise<void> {
  await enqueueWrite(async () => {
    try {
      const file = memoryFilePath();
      const payload = JSON.stringify({
        v: MEMORY_VERSION,
        updatedAt: Date.now(),
        records: store,
      });
      await rotateBackupBestEffort(file);
      await atomicWrite(file, payload);
      await syncDirBestEffort(path.dirname(file));
    } catch (error) {
      warnOnce(error);
    }
  });
}

/** Digest memori untuk dokumen/domain target; "" bila kosong; TIDAK pernah throw. */
export async function digestFor(docType?: DocName, domain?: string, limit = 12): Promise<string> {
  try {
    return memoryDigest(await loadMemoryStore(), docType, domain, limit);
  } catch (error) {
    warnOnce(error);
    return "";
  }
}

/** Ringkasan status store untuk /api/health (read-only, tanpa efek samping). */
export interface MemoryHealth {
  path: string;
  exists: boolean;
  records: number;
  promoted: number;
  lastWriteAt: number | null;
}

/**
 * Snapshot status memori untuk endpoint health: TIDAK menulis, TIDAK memulihkan backup,
 * dan TIDAK pernah throw - setiap kegagalan dikembalikan sebagai exists=false.
 */
export async function memoryHealth(): Promise<MemoryHealth> {
  const file = memoryFilePath();
  try {
    const raw = await fs.readFile(/* turbopackIgnore: true */ file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const records =
      parsed !== null && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)
        ? (parsed as { records: unknown[] }).records.filter(isAgentMemory)
        : [];
    const stamp =
      parsed !== null && typeof parsed === "object" ? (parsed as { updatedAt?: unknown }).updatedAt : undefined;
    return {
      path: file,
      exists: true,
      records: records.length,
      promoted: records.filter((m) => m.promoted).length,
      lastWriteAt: typeof stamp === "number" ? stamp : null,
    };
  } catch {
    return { path: file, exists: false, records: 0, promoted: 0, lastWriteAt: null };
  }
}

export interface LearnResult {
  record: AgentMemory;
  /** Total kebiasaan yang sudah tervalidasi (promoted) di store setelah siklus ini. */
  promotedCount: number;
  summary: MemorySummary;
}

/**
 * Satu siklus pembelajaran: merge -> promote -> prune -> persist.
 * Seluruh IO sudah dibungkus try/catch di loadMemoryStore/persistMemoryStore,
 * sehingga fungsi ini TIDAK pernah melempar error ke jalur request.
 */
export async function learnFromOutcome(record: AgentMemory): Promise<LearnResult> {
  const summary: MemorySummary = {
    techniques: record.techniques,
    pitfalls: record.pitfalls,
    quality: record.quality,
    promotedCount: 0,
  };
  try {
    const store = await loadMemoryStore();
    const merged = mergeMemory(store, record);
    promoteMemory(merged);
    const pruned = pruneMemory(merged, pruneOptions());
    await persistMemoryStore(pruned);
    const promotedCount = pruned.filter((m) => m.promoted).length;
    return { record, promotedCount, summary: { ...summary, promotedCount } };
  } catch (error) {
    warnOnce(error);
    return { record, promotedCount: 0, summary };
  }
}
