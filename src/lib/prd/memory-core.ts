// Logika murni memori kemampuan agent (tanpa IO) - aman diimpor dari client.
// Lapisan filesystem (server-only) ada di memory.ts yang me-re-export modul ini.

import type { AgentMemory, DocName, MemorySignals, MemorySummary } from "./types.ts";

export const MEMORY_VERSION = 1;
/** Batas entri per docType; menjaga berkas memori tetap kecil (buffer growth bound). */
export const MEMORY_MAX_PER_DOC = 50;
/** Batas total entri setelah prune (LRU). */
export const DEFAULT_MAX_RECORDS = 2000;
/** Umur maksimum entri (hari) sebelum dibuang oleh prune. */
export const DEFAULT_MAX_AGE_DAYS = 120;
export const PROMOTE_MIN_OCCURRENCES = 3;
export const PROMOTE_MIN_AVG_QUALITY = 80;

const MS_PER_DAY = 86_400_000;

// Normalisasi ke ASCII printable, spasi tunggal.
function ascii(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

function clampQuality(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Dedupe string tanpa peduli besar-kecil huruf; mempertahankan kemunculan pertama. */
export function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = ascii(raw);
    if (value.length === 0) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

// Heuristik domain dari ide (urutan prioritas: paling spesifik lebih dulu).
const DOMAIN_RULES: ReadonlyArray<readonly [string, RegExp]> = [
  ["marketplace", /marketplace|multi[- ]?vendor|multi[- ]?penjual|\bseller\b|\bvendor\b/],
  ["booking", /booking|reservasi|jadwal|schedule|appointment|\btiket\b|antrian/],
  ["ecommerce", /e-?commerce|\btoko\b|belanja|keranjang|katalog|checkout|\bproduk\b|kasir|\bpos\b|\bshop\b|\bstore\b|retail|jual[- ]?beli/],
  ["social", /\bsosial\b|\bsocial\b|\bfeed\b|posting|komentar|\bchat\b|komunitas|community|follow|forum/],
  ["analytics", /analitik|analytics|dashboard|laporan|statistik|metrik|\breport\b|keuangan|finance|pembukuan|monitoring/],
];

/** Klasifikasi domain ide secara deterministik; "generic" bila tak ada kata kunci cocok. */
export function deriveDomain(idea: string): string {
  const text = (idea ?? "").toLowerCase();
  for (const [domain, pattern] of DOMAIN_RULES) {
    if (pattern.test(text)) return domain;
  }
  return "generic";
}

export interface RecordOutcomeInput {
  id?: string;
  idea: string;
  docType: DocName;
  agentName?: string;
  signals?: Partial<MemorySignals>;
  /** Skor mutu eksplisit 0-100; bila absen diturunkan dari sinyal. */
  quality?: number;
  timestamp?: number;
}

/**
 * Bangun satu AgentMemory dari hasil eksekusi nyata.
 * Teknik/pitfall diturunkan dari sinyal: retry>0 -> pitfall tahap; failedDocs>0 -> pitfall;
 * sukses tanpa retry -> teknik "satu kali jalan (tanpa retry)".
 */
export function recordOutcome(input: RecordOutcomeInput): AgentMemory {
  const timestamp = input.timestamp ?? Date.now();
  const domain = deriveDomain(input.idea);
  const signals: MemorySignals = {
    retries: Math.max(0, Math.trunc(input.signals?.retries ?? 0)),
    failedDocs: Math.max(0, Math.trunc(input.signals?.failedDocs ?? 0)),
    durationMs: Math.max(0, Math.trunc(input.signals?.durationMs ?? 0)),
    stage: Math.max(0, Math.trunc(input.signals?.stage ?? 0)),
  };

  const techniques: string[] = [];
  const pitfalls: string[] = [];
  if (signals.retries > 0) pitfalls.push(`retry pada tahap ${signals.stage}`);
  if (signals.failedDocs > 0) pitfalls.push(`dokumen gagal (${signals.failedDocs})`);
  if (signals.retries === 0 && signals.failedDocs === 0) {
    techniques.push("satu kali jalan (tanpa retry)");
  } else if (signals.retries > 0 && signals.failedDocs === 0) {
    techniques.push(`pulih setelah retry (${signals.retries}x)`);
  }

  const quality = clampQuality(input.quality ?? 100 - signals.retries * 10 - signals.failedDocs * 25);
  return {
    v: MEMORY_VERSION,
    id: input.id ?? `${input.docType}:${domain}`,
    timestamp,
    domain,
    docType: input.docType,
    agentName: input.agentName ?? "PRD Agent",
    techniques: dedupeStrings(techniques),
    pitfalls: dedupeStrings(pitfalls),
    signals,
    quality,
    occurrences: 1,
    avgQuality: quality,
    promoted: false,
    lastSeen: timestamp,
  };
}

/** Batasi maksimum MEMORY_MAX_PER_DOC entri terbaru per docType (berdasarkan lastSeen). */
function capPerDocType(store: AgentMemory[], cap = MEMORY_MAX_PER_DOC): AgentMemory[] {
  const counts = new Map<string, number>();
  const kept: AgentMemory[] = [];
  for (const record of [...store].sort((a, b) => b.lastSeen - a.lastSeen)) {
    const count = counts.get(record.docType) ?? 0;
    if (count >= cap) continue;
    counts.set(record.docType, count + 1);
    kept.push(record);
  }
  return kept;
}

/**
 * Gabungkan satu record ke store (imutabel: mengembalikan array baru).
 * - Dedupe techniques/pitfalls tanpa peduli besar-kecil huruf.
 * - Bump occurrences; avgQuality = rata-rata berjalan (running mean).
 * - Idempoten untuk replay record identik (id + lastSeen sama) -> store tak berubah.
 * - Cap MEMORY_MAX_PER_DOC entri per docType.
 */
export function mergeMemory(store: AgentMemory[], record: AgentMemory): AgentMemory[] {
  const existing = store.find((m) => m.id === record.id);
  if (existing && existing.lastSeen === record.lastSeen) return store;

  let next: AgentMemory[];
  if (!existing) {
    next = [record, ...store];
  } else {
    const occurrences = existing.occurrences + 1;
    const avgQuality = clampQuality((existing.avgQuality * existing.occurrences + record.quality) / occurrences);
    next = store.map((m) =>
      m.id !== record.id
        ? m
        : {
            ...m,
            techniques: dedupeStrings([...m.techniques, ...record.techniques]),
            pitfalls: dedupeStrings([...m.pitfalls, ...record.pitfalls]),
            signals: record.signals,
            quality: record.quality,
            occurrences,
            avgQuality,
            lastSeen: Math.max(m.lastSeen, record.lastSeen),
          },
    );
  }
  return capPerDocType(next);
}

export interface PruneOptions {
  maxAgeDays?: number;
  maxRecords?: number;
  /** Waktu acuan (ms); dapat di-override untuk pengujian deterministik. */
  now?: number;
}

/** Buang entri lebih tua dari maxAgeDays, lalu LRU (lastSeen terlama) bila melebihi maxRecords. */
export function pruneMemory(store: AgentMemory[], opts: PruneOptions = {}): AgentMemory[] {
  const maxAgeDays = opts.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const maxRecords = opts.maxRecords ?? DEFAULT_MAX_RECORDS;
  const now = opts.now ?? Date.now();
  const cutoff = now - maxAgeDays * MS_PER_DAY;
  const fresh = store.filter((m) => m.lastSeen >= cutoff);
  if (fresh.length <= maxRecords) return fresh;
  return [...fresh].sort((a, b) => b.lastSeen - a.lastSeen).slice(0, maxRecords);
}

/**
 * Tandai promoted=true bila occurrences >= 3 DAN avgQuality >= 80.
 * Memutasi record di store (menandai) dan mengembalikan jumlah record yang BARU dipromosikan.
 */
export function promoteMemory(store: AgentMemory[]): number {
  let promoted = 0;
  for (const record of store) {
    const should = record.occurrences >= PROMOTE_MIN_OCCURRENCES && record.avgQuality >= PROMOTE_MIN_AVG_QUALITY;
    if (should && !record.promoted) {
      record.promoted = true;
      promoted += 1;
    }
  }
  return promoted;
}

/**
 * Digest markdown ASCII kebiasaan tervalidasi (promoted lebih dulu).
 * Hanya record promoted=true ATAU occurrences>=2 yang disertakan (record sekali
 * jalan bukan pelajaran tervalidasi dan hanya mengotori prompt). Teknik/pitfall
 * generik yang tidak informatif ("satu kali jalan") dibuang.
 * Mengembalikan "" bila store kosong / tak ada record yang cocok.
 * Format baris: "- <teknik> (dipakai Nx, kualitas rata-rata Q)" dan "- HINDARI: <pitfall> (Nx)".
 */
export function memoryDigest(store: AgentMemory[], docType?: DocName, domain?: string, limit = 12): string {
  const matched = store.filter(
    (m) => (!docType || m.docType === docType) && (!domain || m.domain === domain),
  );
  // Noise guard: hanya kebiasaan tervalidasi (promoted) atau berulang (>= 2x).
  const eligible = matched.filter((m) => m.promoted === true || m.occurrences >= 2);
  if (eligible.length === 0) return "";

  const ordered = [...eligible].sort(
    (a, b) =>
      Number(b.promoted) - Number(a.promoted) ||
      b.occurrences - a.occurrences ||
      b.avgQuality - a.avgQuality ||
      b.lastSeen - a.lastSeen,
  );
  const promotedCount = eligible.filter((m) => m.promoted).length;

  // Teknik/pitfall generik tanpa informasi tidak disertakan.
  const isGeneric = (value: string): boolean => /satu kali jalan/i.test(value);

  const lines: string[] = [];
  const seen = new Set<string>();
  for (const record of ordered) {
    for (const technique of record.techniques) {
      if (isGeneric(technique)) continue;
      const key = `t:${technique.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`- ${technique} (dipakai ${record.occurrences}x, kualitas rata-rata ${record.avgQuality})`);
    }
    for (const pitfall of record.pitfalls) {
      if (isGeneric(pitfall)) continue;
      const key = `p:${pitfall.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`- HINDARI: ${pitfall} (${record.occurrences}x)`);
    }
  }
  if (lines.length === 0) return "";
  return `Pelajaran tervalidasi (${promotedCount} kebiasaan tervalidasi)\n${lines.slice(0, limit).join("\n")}`;
}

/** Guard shape AgentMemory untuk load dari JSON yang mungkin rusak/tidak tepercaya. */
export function isAgentMemory(value: unknown): value is AgentMemory {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    o.v === MEMORY_VERSION &&
    typeof o.id === "string" &&
    typeof o.docType === "string" &&
    typeof o.domain === "string" &&
    typeof o.occurrences === "number" &&
    typeof o.avgQuality === "number" &&
    typeof o.lastSeen === "number" &&
    Array.isArray(o.techniques) &&
    Array.isArray(o.pitfalls)
  );
}

/** Bangun AgentMemory dari ringkasan SSE (dipakai mirror client, tanpa IO). */
export function memoryFromSummary(
  summary: MemorySummary,
  opts: { docType: DocName; idea: string; agentName?: string; timestamp?: number },
): AgentMemory {
  const timestamp = opts.timestamp ?? Date.now();
  const domain = deriveDomain(opts.idea);
  const quality = clampQuality(summary.quality);
  return {
    v: MEMORY_VERSION,
    id: `${opts.docType}:${domain}`,
    timestamp,
    domain,
    docType: opts.docType,
    agentName: opts.agentName ?? "PRD Agent",
    techniques: dedupeStrings(summary.techniques),
    pitfalls: dedupeStrings(summary.pitfalls),
    signals: { retries: 0, failedDocs: 0, durationMs: 0, stage: opts.docType === "TASK-LIST" ? 4 : 3 },
    quality,
    occurrences: 1,
    avgQuality: quality,
    promoted: false,
    lastSeen: timestamp,
  };
}
