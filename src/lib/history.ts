// Penyimpanan riwayat generate di localStorage (client-only).

import type { ClarifyQuestion, FailedDoc, GeneratedDoc } from "./prd/types";

export const HISTORY_KEY = "romushai-history:v1";
export const HISTORY_LIMIT = 20;

export interface HistoryRecord {
  id: string;
  title: string;
  timestamp: number;
  docs: GeneratedDoc[];
  failed: FailedDoc[];
  taskCount: number;
  preview: string;
  sentIdea?: string;
  completedClarify?: { questions: ClarifyQuestion[]; answers: string[] } | null;
  scope?: string;
  answers?: string[];
  analysis?: string;
  gaps?: string[];
}

function readRaw(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as unknown as HistoryRecord[]) : [];
  } catch {
    return [];
  }
}

function writeRaw(records: HistoryRecord[]): HistoryRecord[] {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
  } catch {
    // penyimpanan penuh / tidak tersedia; abaikan
  }
  return records;
}

/** Ambil semua riwayat (terbaru dulu), dibatasi HISTORY_LIMIT. */
export function loadHistory(): HistoryRecord[] {
  return readRaw().slice(0, HISTORY_LIMIT);
}

/** Simpan satu entri di posisi teratas. Kembalikan daftar terbaru. */
export function saveHistory(entry: HistoryRecord): HistoryRecord[] {
  return writeRaw([entry, ...readRaw()].slice(0, HISTORY_LIMIT));
}

/** Hapus satu entri berdasarkan id. Kembalikan daftar terbaru. */
export function deleteHistory(id: string): HistoryRecord[] {
  return writeRaw(readRaw().filter((h) => h.id !== id));
}