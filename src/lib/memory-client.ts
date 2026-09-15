// Mirror client memori agent di localStorage (client-only, TANPA node:*).
// Memakai aturan merge/promote/prune yang sama dari memory-core.ts.

import type { AgentMemory, DocName, MemorySummary } from "./prd/types";
import {
  DEFAULT_MAX_AGE_DAYS,
  DEFAULT_MAX_RECORDS,
  MEMORY_VERSION,
  isAgentMemory,
  memoryFromSummary,
  mergeMemory,
  promoteMemory,
  pruneMemory,
} from "./prd/memory-core";

export const CLIENT_MEMORY_KEY = "buatprd-memory";

/** Muat store client; JSON rusak / localStorage tidak tersedia -> []. */
export function loadClientMemory(): AgentMemory[] {
  try {
    const raw = localStorage.getItem(CLIENT_MEMORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    const records =
      parsed !== null && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)
        ? (parsed as { records: unknown[] }).records
        : [];
    return records.filter(isAgentMemory);
  } catch {
    return [];
  }
}

function writeClientMemory(store: AgentMemory[]): void {
  try {
    localStorage.setItem(
      CLIENT_MEMORY_KEY,
      JSON.stringify({
        v: MEMORY_VERSION,
        updatedAt: Date.now(),
        records: pruneMemory(store, { maxRecords: DEFAULT_MAX_RECORDS, maxAgeDays: DEFAULT_MAX_AGE_DAYS }),
      }),
    );
  } catch {
    // penyimpanan penuh / tidak tersedia; abaikan
  }
}

/**
 * Mirror ringkasan memori dari event SSE "done" ke store client.
 * Mengembalikan total kebiasaan tervalidasi; 0 bila gagal (tidak pernah throw).
 *
 * SUMBER KEBENARAN = store server (.memory/agent-memory.json, permanen lintas restart).
 * localStorage hanya cermin optimistis agar UI tetap punya data saat server mati; pada
 * generasi berikutnya server mengirim digest dari store server, sehingga nilai server
 * yang dipakai. localStorage otomatis bertahan saat reload (dikelola browser), tidak
 * perlu langkah tambahan. Bila keduanya berbeda, server yang menang.
 */
export function mirrorMemory(summary: MemorySummary, opts: { docType: DocName; idea: string }): number {
  try {
    const record = memoryFromSummary(summary, opts);
    const merged = mergeMemory(loadClientMemory(), record);
    promoteMemory(merged);
    const pruned = pruneMemory(merged, { maxRecords: DEFAULT_MAX_RECORDS, maxAgeDays: DEFAULT_MAX_AGE_DAYS });
    writeClientMemory(pruned);
    return pruned.filter((m) => m.promoted).length;
  } catch {
    return 0;
  }
}

/**
 * Pintasan aman untuk page: mirror ringkasan memori dari event "done".
 * Ringkasan absen atau kegagalan tidak boleh mengganggu alur UI (best-effort).
 */
export function mirrorDoneMemory(memory: MemorySummary | undefined, docType: DocName, idea: string): void {
  if (!memory) return;
  try {
    mirrorMemory(memory, { docType, idea });
  } catch {
    // abaikan: memori client bersifat best-effort
  }
}
