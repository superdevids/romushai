// Fungsi parsing murni (tanpa efek samping); helper pipeline diimpor langsung dari sini.

import { DOC_NAMES, QUESTION_CATEGORIES, type DocName, type ClarifyQuestion, type AuditFinding } from "./types.ts";

/**
 * Ambil blok JSON pertama dari teks LLM.
 * Toleran terhadap markdown fence (```json ... ```) dan teks di sekitarnya.
 */
export function extractJsonBlock(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    // lanjut ke pembersihan fence
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Ekstrak rekomendasi nama dokumen dari teks LLM stage 2.
 * Urutan prioritas: JSON {"docs": [...]} -> fallback regex nama dokumen valid.
 * MASTER-PRD selalu disertakan di urutan pertama; hasil dibatasi maxDocs dan di-dedup.
 * Urutan kanonik DOC_NAMES dijaga: hasil diurut sesuai posisi di DOC_NAMES.
 */
export function parseDocRecommendation(text: string, maxDocs = 13): DocName[] {
  const canonical = new Map<string, DocName>(DOC_NAMES.map((n) => [n.toUpperCase(), n]));
  const raw = extractJsonBlock(text);
  let names: string[] = [];
  if (raw !== null && typeof raw === "object" && Array.isArray((raw as { docs?: unknown }).docs)) {
    const docs = (raw as { docs: unknown[] }).docs;
    for (const n of docs) {
      if (typeof n === "string") names.push(n);
    }
  }
  if (names.length === 0) {
    names = text.match(new RegExp(DOC_NAMES.join("|"), "g")) ?? [];
  }
  const unique: DocName[] = [];
  for (const n of names) {
    const c = canonical.get(n.trim().toUpperCase());
    if (!c || unique.includes(c)) continue;
    unique.push(c);
  }
  // Urutan kanonik DOC_NAMES dijaga (urutan 13 dokumen final), MASTER-PRD tetap pertama.
  const order = new Map<string, number>(DOC_NAMES.map((n, i) => [n, i]));
  unique.sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
  const master = "MASTER-PRD" as DocName;
  const final = [master, ...unique.filter((d) => d !== master)];
  return final.slice(0, maxDocs);
}

/** Kapasitas maksimum pertanyaan klarifikasi yang diterima pipeline (satu sumber kebenaran). */
export const MAX_CLARIFY_QUESTIONS = 8;

/** Validasi array pertanyaan (dipakai parseClarify & parseStage0b). */
export function parseQuestions(arr: unknown, maxQuestions = MAX_CLARIFY_QUESTIONS): ClarifyQuestion[] {
  if (!Array.isArray(arr)) return [];
  const out: ClarifyQuestion[] = [];
  for (const item of arr) {
    if (out.length >= maxQuestions) break;
    if (typeof item !== "object" || item === null) continue;
    const { q, options, recommended, title, category } = item as {
      q?: unknown;
      options?: unknown;
      recommended?: unknown;
      title?: unknown;
      category?: unknown;
    };
    if (typeof q !== "string" || q.trim().length === 0) continue;
    // Dedup: lewati pertanyaan dengan teks ternormalisasi yang sama (case-insensitive).
    const normalized = q.trim().toLowerCase().replace(/\s+/g, " ");
    if (out.some((existing) => existing.q.toLowerCase().replace(/\s+/g, " ") === normalized)) continue;
    const validOptions = Array.isArray(options)
      ? options
          .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
          .slice(0, 4)
      : [];
    if (validOptions.length < 2) continue;
    const rec =
      typeof recommended === "string" && validOptions.includes(recommended)
        ? recommended
        : validOptions[0];
    const cleanTitle = typeof title === "string" ? title.trim().slice(0, TITLE_MAX) : "";
    const rawCategory = typeof category === "string" ? category.trim() : "";
    const validCategory = (QUESTION_CATEGORIES as readonly string[]).includes(rawCategory)
      ? rawCategory
      : undefined;
    out.push({
      q: q.trim(),
      options: validOptions,
      recommended: rec,
      title: cleanTitle.length > 0 ? cleanTitle : fallbackTitle(q),
      category: validCategory ?? "Lainnya",
    });
  }
  return out;
}

const TITLE_MAX = 80;
const TITLE_WORDS = 8;

/** Fallback judul: 8 kata pertama dari pertanyaan + "..." bila terpotong. */
function fallbackTitle(q: string): string {
  const words = q.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return "";
  return words.length > TITLE_WORDS ? words.slice(0, TITLE_WORDS).join(" ") + "..." : words.join(" ");
}

/** Parse clarify response (stage 0) -> array of questions with options + recommended. */
export function parseClarify(text: string, maxQuestions = MAX_CLARIFY_QUESTIONS): ClarifyQuestion[] {
  const raw = extractJsonBlock(text);
  if (!raw || typeof raw !== "object") return [];
  return parseQuestions((raw as { questions?: unknown }).questions, maxQuestions);
}

export interface Stage0bResult {
  analysis: string;
  gaps: string[];
  questions: ClarifyQuestion[];
}

/** Parse respons stage 0b: analysis + gaps + questions (fallback aman bila shape salah). */
export function parseStage0b(text: string): Stage0bResult {
  const raw = extractJsonBlock(text);
  const obj = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const analysis = typeof obj?.analysis === "string" ? obj.analysis.trim() : "";
  const gaps = Array.isArray(obj?.gaps)
    ? obj.gaps
        .filter((g): g is string => typeof g === "string" && g.trim().length > 0)
        .slice(0, 10)
        .map((g) => g.trim())
    : [];
  const questions = Array.isArray(obj?.questions)
    ? parseQuestions(obj.questions, MAX_CLARIFY_QUESTIONS)
    : [];
  return { analysis, gaps, questions };
}

/** Parsing satu blok SSE (dipisahkan baris kosong): hasilkan event + data + id. */
export interface SseBlock {
  event?: string;
  data?: string;
  /** Cursor resume (`id:` server); undefined pada stream lama tanpa id. */
  id?: number;
}

export function parseSseBlock(block: string): SseBlock {
  let event: string | undefined;
  let data: string | undefined;
  let id: number | undefined;
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data = (data === undefined ? "" : data + "\n") + line.slice(5).trimStart();
    } else if (line.startsWith("id:")) {
      const n = Number(line.slice(3).trim());
      if (Number.isFinite(n)) id = n;
    }
  }
  return { event, data, id };
}

/** Hitung jumlah task pada TASK-LIST.md (format "### Task N: judul"). */
export function countTasks(content: string): number {
  const matches = content.match(/^### Task \d+:/gm);
  return matches ? matches.length : 0;
}

// --- Validator markdown dokumen (murni, tanpa IO) ---

/** Satu isu struktural dokumen hasil validasi markdown. */
export interface DocIssue {
  code: string;
  message: string;
}

/** Panjang minimum dokumen yang dianggap berisi (di bawah ini -> TOO_SHORT). */
const MIN_DOC_CHARS = 400;

/** Baris tabel: diawali pipe (indentasi diabaikan). */
function isTableLine(line: string): boolean {
  return line.trimStart().startsWith("|");
}

/** Pecah baris tabel menjadi sel (buang pipe pembuka/penutup). */
function tableCells(line: string): string[] {
  const t = line.trim();
  const inner = t.startsWith("|") ? t.slice(1) : t;
  const body = inner.endsWith("|") ? inner.slice(0, -1) : inner;
  return body.split("|").map((c) => c.trim());
}

/** Baris separator tabel: semua sel cocok /^:?-{3,}:?$/. */
function isSeparatorRow(line: string): boolean {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

/**
 * Validasi struktur markdown satu dokumen (fungsi murni, tanpa IO).
 * Best-effort: mengembalikan daftar isu, TIDAK melempar dan TIDAK menggagalkan pipeline.
 * Cek: H1 tunggal di awal, tabel utuh (sel konsisten + separator), urutan nomor bagian,
 * karakter non-ASCII, dan panjang minimum.
 */
export function validateDocMarkdown(name: string, content: string): DocIssue[] {
  const issues: DocIssue[] = [];
  const text = (content ?? "").replace(/\r\n?/g, "\n");
  const trimmed = text.trim();
  if (trimmed.length < MIN_DOC_CHARS) {
    issues.push({
      code: "TOO_SHORT",
      message: `Dokumen ${name} hanya ${trimmed.length} karakter (minimum ${MIN_DOC_CHARS}).`,
    });
  }

  // Baris di dalam code fence dilewati agar contoh kode tidak dianggap struktur dokumen.
  const prose: string[] = [];
  let inFence = false;
  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) prose.push(line);
  }

  const isH1 = (line: string): boolean => /^#\s+\S/.test(line.trim());
  const h1Indexes = prose.map((l, i) => (isH1(l) ? i : -1)).filter((i) => i >= 0);
  if (h1Indexes.length === 0) {
    issues.push({ code: "MISSING_H1", message: `Dokumen ${name} tidak punya baris H1 '# <NAMA-DOKUMEN>'.` });
  } else if (h1Indexes.length > 1) {
    issues.push({ code: "MULTIPLE_H1", message: `Dokumen ${name} punya ${h1Indexes.length} baris H1; wajib tepat satu.` });
  } else if (h1Indexes[0] !== prose.findIndex((l) => l.trim().length > 0)) {
    issues.push({ code: "MISSING_H1", message: `H1 dokumen ${name} tidak berada di awal dokumen.` });
  }

  // Nomor bagian '## n.' wajib berurutan tanpa lompat/duplikat.
  const sectionNums: number[] = [];
  for (const line of prose) {
    const m = /^##\s+(\d+)\s*\./.exec(line.trim());
    if (m) sectionNums.push(Number(m[1]));
  }
  if (sectionNums.length > 0) {
    let bad = sectionNums[0] !== 0 && sectionNums[0] !== 1;
    for (let i = 1; i < sectionNums.length && !bad; i++) {
      if (sectionNums[i] !== sectionNums[i - 1] + 1) bad = true;
    }
    if (bad) {
      issues.push({
        code: "SECTION_ORDER",
        message: `Nomor bagian '## n.' dokumen ${name} tidak berurutan: ${sectionNums.join(", ")}.`,
      });
    }
  }

  // Tabel: setiap blok wajib punya separator setelah header dan jumlah sel konsisten.
  let i = 0;
  while (i < prose.length) {
    if (!isTableLine(prose[i])) {
      i++;
      continue;
    }
    const block: string[] = [];
    while (i < prose.length && isTableLine(prose[i])) {
      block.push(prose[i]);
      i++;
    }
    const counts = block.map((b) => tableCells(b).length);
    const consistent = counts.every((c) => c === counts[0]);
    const hasSeparator = block.length >= 2 && isSeparatorRow(block[1]);
    if (!consistent || !hasSeparator) {
      issues.push({
        code: "BROKEN_TABLE",
        message: `Tabel dokumen ${name} rusak (${block.length} baris; sel: ${counts.join("/")}; separator: ${hasSeparator ? "ada" : "tidak ada"}).`,
      });
    }
  }

  const nonAscii = text.match(/[^\n\x20-\x7E]/g);
  if (nonAscii) {
    const code = nonAscii[0].charCodeAt(0).toString(16).padStart(2, "0");
    issues.push({
      code: "NON_ASCII",
      message: `Dokumen ${name} memuat ${nonAscii.length} karakter non-ASCII (contoh kode 0x${code}).`,
    });
  }

  return issues;
}

/**
 * Parse hasil verifikasi (stage 5+10a) atau audit red-team (stage 10b) -> temuan.
 * Menerima key "temuan" (verifikasi) atau "risiko" (audit); toleran terhadap bentuk longgar.
 */
export function parseAuditFindings(text: string, maxFindings = 40): { ok: boolean; findings: AuditFinding[] } {
  const raw = extractJsonBlock(text);
  if (raw === null || typeof raw !== "object") return { ok: false, findings: [] };
  const obj = raw as { cocok?: unknown; temuan?: unknown; risiko?: unknown };
  const list = Array.isArray(obj.temuan) ? obj.temuan : Array.isArray(obj.risiko) ? obj.risiko : [];
  const findings: AuditFinding[] = [];
  for (const item of list) {
    if (findings.length >= maxFindings) break;
    if (typeof item !== "object" || item === null) continue;
    const { doc, severity, masalah, saran } = item as {
      doc?: unknown;
      severity?: unknown;
      masalah?: unknown;
      saran?: unknown;
    };
    const masalahStr = typeof masalah === "string" ? masalah.trim() : "";
    if (masalahStr.length === 0) continue;
    findings.push({
      doc: typeof doc === "string" && doc.trim().length > 0 ? doc.trim() : "UMUM",
      severity: typeof severity === "string" && severity.trim().length > 0 ? severity.trim().toUpperCase() : "MEDIUM",
      masalah: masalahStr,
      saran: typeof saran === "string" ? saran.trim() : "",
    });
  }
  const ok = typeof obj.cocok === "boolean" ? obj.cocok : findings.length === 0;
  return { ok, findings };
}