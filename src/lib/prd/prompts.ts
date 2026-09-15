// Template prompt pipeline PRD. Semua prompt memaksa output Bahasa Indonesia baku,
// anti-verbose, ASCII-only, dan memakai template ketat.

import type { ChatMessage } from "./llm.ts";
import type { DocName, GeneratedDoc } from "./types.ts";
import { DOC_NAMES } from "./types.ts";
import { LANG_RULE, ZERO_FLUFF, PLAIN_LANGUAGE_RULE, FORMAT_RULE, MARKDOWN_RULE, RULE_ANTI_AMBIG, DEPTH_RULE, RULE_ENG } from "./rules.ts";
import { buildAgentContext, buildSkillContext, buildRuleContext, agentHint } from "./knowledge/index.ts";
import { QUESTION_CATEGORIES } from "./types.ts";

/** Daftar kategori baku dalam bentuk teks untuk prompt klarifikasi (single source: QUESTION_CATEGORIES). */
const QUESTION_CATEGORY_LIST = QUESTION_CATEGORIES.join(", ");

// Anggaran karakter per prompt stage 3:
// - prompt dasar + template per doc : ~4000 char
// - konteks agent (AGENTS.md)       : <= 16000 char (AGENT_BUDGET_DEFAULT)
// - konteks skill (SKILLS.md)       : <= 12000 char (SKILL_BUDGET_DEFAULT)
// - konteks aturan (RULES.md)       : <= 8000 char (hanya blok engineering, lihat buildRuleContext)
// - digest memori + analisis scope  : ~2000 char
// => plafon aman satu prompt stage 3: 90000 char.
// Plafon dinaikkan dari 70000 karena trim per dokumen naik ke TRIM_DOC_CHARS
// pada tahap verifikasi/audit; prompt stage 3 sendiri tetap ~44000 char,
// tetapi plafon longgar memberi ruang bagi ide/scope/analisis yang panjang.
// Tetap di bawah batas platform (~128k token konteks).
export const STAGE3_PROMPT_CEILING = 90_000;

/** Peringatan server-side bila prompt melebihi plafon (best-effort, tanpa throw). */
function warnIfOverCeiling(stage: string, totalChars: number): void {
	if (totalChars > STAGE3_PROMPT_CEILING && typeof console !== "undefined") {
		console.warn(
			`[prd] prompt ${stage} ${totalChars} char melebihi plafon ${STAGE3_PROMPT_CEILING} char; ` +
				`kurangi konteks atau pecah dokumen.`,
		);
	}
}

/**
 * Blok katalog konteks untuk stage 3. AGENTS.md/SKILLS.md/RULES.md memakai konteks
 * penuh berbudget dari knowledge catalogs; dokumen teknis lain mendapat hint nama agent.
 */
function catalogBlock(doc: DocName, idea?: string): string {
	if (doc === "AGENTS") {
		return `

KATALOG AGENT ECC (katalog nyata; wajib jadi bahan pemilihan):
${buildAgentContext(doc)}

WAJIB: pilih MIN 3 MAKS 10 agent PALING relevan dari daftar di atas (salin nama PERSIS; DILARANG mengarang nama agent). Untuk SETIAP agent tulis: nama PERSIS, alasan 1 kalimat yang merujuk fitur nyata project, kapan dipakai, jangan dipakai bila, dan referensi Task N. Sajikan sebagai tabel.
Tabel tech/stack project (nama + versi) wajib ditulis di bagian metadata.`;
	}
	if (doc === "SKILLS") {
		return `

KATALOG SKILL ECC (katalog nyata; wajib jadi bahan pemilihan):
${buildSkillContext(doc, { idea })}

WAJIB: pilih MIN 3 MAKS 10 skill PALING relevan dari daftar di atas (salin nama PERSIS; DILARANG mengarang nama skill). Untuk SETIAP skill tulis: nama PERSIS, alasan 1 kalimat yang merujuk fitur nyata project, kapan dipakai, jangan dipakai bila, dan referensi Task N. Sajikan sebagai tabel.
Tabel tech/stack project (nama + versi) wajib ditulis di bagian metadata.`;
	}
	if (doc === "RULES") {
		return `

ATURAN ENGINEERING KANONIK WAJIB (adaptasikan ke Bahasa Indonesia; JANGAN mengubah makna):
${buildRuleContext()}

WAJIB: dokumen ini wajib mengadaptasi blok aturan engineering di atas menjadi aturan wajib spesifik project ini (gaya kode, test, keamanan, performa, review, alur kerja) tanpa menghilangkan poin kunci.`;
	}
	const hint = agentHint(doc);
	if (hint.length === 0) return "";
	return `

AGENT PENANGGUNG JAWAB (tulis dokumen ini dari sudut pandang Agent berikut): ${hint}.`;
}

/** Pengingat bahasa per-dokumen, disisipkan di akhir SETIAP prompt user. */
function docReminder(doc?: string): string {
	const d = doc ? ` (${doc})` : "";
	return ` INGAT per-dokumen${d}: seluruh teks WAJIB Bahasa Indonesia baku - periksa ulang sebelum selesai.`;
}

/**
 * Bagian pelajaran dari eksekusi sebelumnya (memori agent). Additif: hanya disisipkan
 * bila digest tidak kosong, sehingga prompt tanpa memori TIDAK berubah sama sekali.
 */
function memorySection(memoryDigest?: string): string {
	const digest = (memoryDigest ?? "").trim();
	if (digest.length === 0) return "";
	return `\n\n## Pelajaran dari eksekusi sebelumnya\n${digest}`;
}

/** Ringkasan jawaban klarifikasi pengguna, disisipkan sebagai konteks di semua tahap. */
function clarifySummary(answers?: string[]): string {
	if (!answers || answers.length === 0) return "";
	return `\n\nJawaban klarifikasi pengguna:\n${answers.map((a) => `- ${a}`).join("\n")}`;
}

/**
 * Konteks analisis mendalam (stage 0) yang disisipkan di semua tahap 1-4,
 * dengan format tetap: Hasil analisis mendalam -> Gap yang diidentifikasi -> Jawaban klarifikasi.
 */
function deepAnalysisContext(analysis?: string, gaps?: string[], answers?: string[]): string {
	const a = (analysis ?? "").trim();
	const g = Array.isArray(gaps) ? gaps.map((x) => x.trim()).filter((x) => x.length > 0) : [];
	const parts: string[] = [];
	if (a) parts.push(`Hasil analisis mendalam:\n${a}`);
	if (g.length > 0) parts.push(`Gap yang diidentifikasi:\n${g.map((x) => `- ${x}`).join("\n")}`);
	const cs = clarifySummary(answers).trim();
	if (cs) parts.push(cs);
	return parts.length > 0 ? `\n\n${parts.join("\n\n")}` : "";
}

// Kandidat dokumen final: diturunkan dari DOC_NAMES (single source di types.ts)
// agar urutan kanonik tidak pernah drift dari daftar resmi.
const DOC_CANDIDATES = DOC_NAMES.join(", ");

export function stage1Messages(idea: string, answers?: string[], analysis?: string, gaps?: string[]): ChatMessage[] {
	return [
		{
			role: "system",
			content: "Kamu adalah analis produk & software architect senior dengan 20+ tahun pengalaman merancang produk digital. Analisismu tajam, keputusanmu pragmatis, outputmu padat dan langsung dapat dieksekusi. " + LANG_RULE + " " + PLAIN_LANGUAGE_RULE + " " + ZERO_FLUFF,
		},
		{
			role: "user",
			content: `Analisis ide project berikut dan susun scope PRD awal. Batas ~500 kata.

Ide project:
"""
${idea}
"""
${deepAnalysisContext(analysis, gaps, answers)}
Tulis PERSIS dalam struktur markdown berikut (judul bagian dalam Bahasa Indonesia, jangan ubah urutan):
# <Judul Singkat Project>
## Ringkasan
<1-2 kalimat ringkas tentang aplikasi.>
## Masalah
<masalah nyata yang ingin dipecahkan.>
## Target Pengguna
<siapa pengguna utama.>
## Tujuan
<tujuan utama produk.>
## Di Luar Lingkup (Out of Scope)
<fitur yang sengaja TIDAK dibuat pada rilis awal.>

CONTOH (format yang harus ditiru, project fiktif "aplikasi catatan"):
# Aplikasi Catatan Pribadi
## Ringkasan
Aplikasi web untuk menulis dan mengelompokkan catatan harian pengguna.
## Masalah
Pengguna kesulitan menyimpan ide cepat dan membaginya ke beberapa topik.
## Target Pengguna
Mahasiswa dan pekerja kantoran yang sering mencatat.
## Tujuan
Memudahkan pencatatan cepat dan pencarian kembali.
## Di Luar Lingkup (Out of Scope)
Tidak ada kolaborasi multi-pengguna pada rilis awal.

Tulis langsung skeleton di atas dengan isi untuk ide project. ${LANG_RULE}${docReminder()}`,
		},
	];
}

export function stage2Messages(idea: string, scope: string, retryNote?: string, answers?: string[], analysis?: string, gaps?: string[]): ChatMessage[] {
	const note = retryNote ? `\n\nCATATAN PERCOBAAN ULANG: ${retryNote}\n` : "";
	return [
		{
			role: "system",
			content: "Kamu adalah arsitek software. Jawab HANYA dengan satu objek JSON, tanpa teks lain, tanpa markdown fence. " + "Nilai teks di dalam JSON WAJIB Bahasa Indonesia. " + ZERO_FLUFF,
		},
		{
			role: "user",
			content: `Ide project:
"""
${idea}
"""
${deepAnalysisContext(analysis, gaps, answers)}
Hasil analisis scope:
"""
${scope}
"""

Pilih dokumen teknis yang RELEVAN untuk project ini dari kandidat berikut:
${DOC_CANDIDATES}

Pedoman:
- MASTER-PRD WAJIB selalu disertakan.
- Susun urutan dokumen mengikuti urutan kandidat di atas.
- AGENTS, SKILLS, dan RULES direkomendasikan untuk hampir semua project (panduan konvensi bagi AI coding agent yang akan mengerjakan project).
- ARCHITECTURE direkomendasikan untuk semua project berlogika (boundary modul + ADR).
- ENV-SECURITY direkomendasikan bila ada autentikasi, data pengguna, atau panggilan API eksternal.
- Ide tanpa API/backend (misal landing page statis) -> JANGAN pilih API-TECH atau DATABASE.
- Ide tanpa aspek deployment/ops -> JANGAN pilih DEPLOYMENT.
- Maksimal 13 dokumen total.${note}

Output HANYA satu objek JSON persis format:
{"docs":["MASTER-PRD","ARCHITECTURE"]}`,
		},
	];
}

// FIX 3 - Stage 3: panduan per dokumen (sections literal + field wajib + spesifikasi tabel +
// acceptance + rujukan). Semua teks ASCII.
type DocTemplate = {
	sections: string;
	requiredFields: string;
	tableSpec: string;
	acceptance: string;
	refs: string;
};

// Field wajib blok "## 0. Metadata Dokumen" (berlaku untuk SEMUA dokumen).
const METADATA_FIELDS = "tech stack dan versi persis (contoh: Next.js 16.3.5, PostgreSQL 16.2); file path konkret yang disentuh (contoh: src/app/api/generate/route.ts); nama agent dan skill PERSIS dari katalog; cross-reference ke dokumen lain dengan nomor bagian (contoh: Lihat API-TECH ## 2); kriteria penerimaan terukur (angka, status code, atau batas waktu).";

const DOC_GUIDES: Record<DocName, DocTemplate> = {
	"MASTER-PRD": {
		sections: "## 0. Metadata Dokumen\n## 1. Ringkasan & Visi\n## 2. Masalah\n## 3. Target Pengguna\n## 4. Tujuan & Metrik Sukses\n## 5. Kebutuhan Fungsional\n## 6. User Stories\n## 7. Spesifikasi Teknis\n## 8. Di Luar Lingkup (Out of Scope)",
		requiredFields: METADATA_FIELDS + " Setiap fitur WAJIB ber-ID F-nn dan punya acceptance terukur.",
		tableSpec: "Satu tabel Kebutuhan Fungsional (kolom: ID, Fitur, Prioritas, Acceptance terukur); satu tabel terpisah untuk Metrik Sukses (kolom: Metrik, Target, Cara Ukur).",
		acceptance: "Setiap fitur F-nn punya minimal satu acceptance terukur; setiap metrik punya angka + satuan (contoh: waktu simpan < 2 detik).",
		refs: "Rujuk API-TECH ## 2 untuk endpoint, DATABASE ## 2 untuk tabel, TEST-PLAN ## 7 untuk kriteria lulus.",
	},
	ARCHITECTURE: {
		sections: "## 0. Metadata Dokumen\n## 1. Ikhtisar Arsitektur\n## 2. Boundary Modul\n## 3. Data Flow\n## 4. Kontrak Antar Modul\n## 5. Keputusan Arsitektur (ADR)\n## 6. Alternatif yang Ditolak\n## 7. Risiko Arsitektur",
		requiredFields: METADATA_FIELDS + " Sebutkan pola arsitektur yang dipakai dan alasannya.",
		tableSpec: "Satu tabel Boundary Modul (kolom: Modul, Tanggung Jawab, File, Dependensi); satu tabel ADR (kolom: ID, Keputusan, Alasan, Alternatif Ditolak).",
		acceptance: "Setiap modul punya file path konkret; setiap ADR punya minimal satu alternatif ditolak + alasan terukur.",
		refs: "Rujuk MASTER-PRD ## 7, API-TECH ## 2, DATABASE ## 2.",
	},
	"API-TECH": {
		sections: "## 0. Metadata Dokumen\n## 1. Ikhtisar Endpoint\n## 2. Daftar Endpoint\n## 3. Skema Otentikasi\n## 4. Contoh Request/Response\n## 5. Penanganan Error\n## 6. Catatan Rate Limit",
		requiredFields: METADATA_FIELDS + " Sebutkan base URL dan format data.",
		tableSpec: "Satu tabel Daftar Endpoint (kolom: Metode, Path, Auth, Sukses, Error).",
		acceptance: "Setiap endpoint punya status code sukses + error eksplisit (contoh: 200, 400, 401); contoh request/response JSON valid.",
		refs: "Rujuk ARCHITECTURE ## 2, DATABASE ## 3, ENV-SECURITY ## 2.",
	},
	"WEB-REFERENCE": {
		sections: "## 0. Metadata Dokumen\n## 1. Stack Teknologi\n## 2. Struktur Halaman & Rute\n## 3. Komponen Utama\n## 4. State Management\n## 5. Integrasi Pihak Ketiga",
		requiredFields: METADATA_FIELDS + " Versi setiap library wajib eksplisit.",
		tableSpec: "Satu tabel Rute (kolom: Path, Tipe, Komponen, Sumber Data).",
		acceptance: "Setiap rute punya file path; setiap komponen punya satu tanggung jawab.",
		refs: "Rujuk UIUX-SPEC ## 2 dan API-TECH ## 2.",
	},
	"UIUX-SPEC": {
		sections: "## 0. Metadata Dokumen\n## 1. Alur Pengguna\n## 2. Wireframe Teks (ASCII)\n## 3. Gaya Visual\n## 4. Komponen Antarmuka\n## 5. Aksesibilitas\n## 6. Responsivitas",
		requiredFields: METADATA_FIELDS + " Sebutkan breakpoint responsif konkret.",
		tableSpec: "Satu tabel Komponen (kolom: Komponen, Properti, Status, Aksesibilitas).",
		acceptance: "Kontras minimal rasio 4.5:1; setiap input punya label; navigasi keyboard lengkap.",
		refs: "Rujuk WEB-REFERENCE ## 2 dan TEST-PLAN ## 4.",
	},
	DATABASE: {
		sections: "## 0. Metadata Dokumen\n## 1. Ikhtisar Skema\n## 2. Daftar Tabel\n## 3. Kolom & Tipe Data\n## 4. Relasi\n## 5. Indeks\n## 6. Contoh Kueri Penting",
		requiredFields: METADATA_FIELDS + " Sebutkan engine database + versi dan file migrasi.",
		tableSpec: "BENAR: satu tabel per entitas, setiap tabel punya header + separator. Contoh tiga entitas terpisah:\nTabel toko:\n| Kolom | Tipe | Keterangan |\n| --- | --- | --- |\n| id | UUID | primary key |\nTabel produk:\n| Kolom | Tipe | Keterangan |\n| --- | --- | --- |\n| id | UUID | primary key |\nTabel pesanan:\n| Kolom | Tipe | Keterangan |\n| --- | --- | --- |\n| id | UUID | primary key |\nSALAH: menggabungkan toko, produk, dan pesanan ke dalam satu tabel.",
		acceptance: "Setiap tabel punya primary key; setiap foreign key punya indeks; tipe data eksplisit (contoh: NUMERIC(12,2)).",
		refs: "Rujuk ARCHITECTURE ## 2 dan API-TECH ## 4.",
	},
	"TEST-PLAN": {
		sections: "## 0. Metadata Dokumen\n## 1. Strategi Pengujian\n## 2. Unit\n## 3. Integrasi\n## 4. End-to-End\n## 5. Skenario Penting\n## 6. Data Uji\n## 7. Kriteria Lulus",
		requiredFields: METADATA_FIELDS + " Sebutkan framework test + versi.",
		tableSpec: "Satu tabel Skenario (kolom: ID, Skenario, Jenis, Ekspektasi, Status).",
		acceptance: "Cakupan minimal 80 persen; setiap skenario punya ekspektasi terukur.",
		refs: "Rujuk API-TECH ## 5 dan UIUX-SPEC ## 1.",
	},
	"ENV-SECURITY": {
		sections: "## 0. Metadata Dokumen\n## 1. Env dan Secret\n## 2. Matriks Otorisasi\n## 3. Threat Model\n## 4. Kontrol Keamanan\n## 5. Rotasi dan Respons Insiden",
		requiredFields: METADATA_FIELDS + " Sebutkan platform dan mekanisme penyimpanan secret.",
		tableSpec: "Satu tabel Env (kolom: Nama, Wajib, Contoh, Rahasia); satu tabel Matriks Otorisasi (kolom: Peran, Sumber Daya, Aksi, Izin).",
		acceptance: "Tanpa secret hardcoded; setiap endpoint punya cek otorisasi; setiap ancaman punya mitigasi terukur.",
		refs: "Rujuk API-TECH ## 3 dan DEPLOYMENT ## 2.",
	},
	DEPLOYMENT: {
		sections: "## 0. Metadata Dokumen\n## 1. Lingkungan\n## 2. Variabel Env\n## 3. Langkah Build\n## 4. Langkah Rilis\n## 5. Rollback\n## 6. Monitoring",
		requiredFields: METADATA_FIELDS + " Sebutkan platform deploy + versi runtime.",
		tableSpec: "Satu tabel Lingkungan (kolom: Nama, Platform, Tujuan, URL).",
		acceptance: "Build sukses exit code 0; rollback punya batas waktu; alert punya ambang angka.",
		refs: "Rujuk ENV-SECURITY ## 1 dan TEST-PLAN ## 7.",
	},
	"TASK-LIST": {
		sections: "Tidak dipakai pada tahap penulisan dokumen (dibuat di tahap task breakdown).",
		requiredFields: "",
		tableSpec: "",
		acceptance: "",
		refs: "",
	},
	AGENTS: {
		sections: "## 0. Metadata Dokumen\n## 1. Daftar Agent AI (Dipilih dari Katalog)\n## 2. Peran & Konvensi Bahasa\n## 3. Struktur Repo yang Disarankan\n## 4. Konvensi Penulisan Kode & Komentar\n## 5. Cara Verifikasi\n## 6. Definisi Selesai per Tugas",
		requiredFields: METADATA_FIELDS + " Sebutkan tech stack dan versinya.",
		tableSpec: "Satu tabel Agent (kolom: Nama Agent, Alasan, Kapan Dipakai, Jangan Dipakai Bila, Referensi Task).",
		acceptance: "Minimal 3 maksimal 10 agent; setiap agent punya nama PERSIS + referensi Task N.",
		refs: "Rujuk TASK-LIST ## Task 1 dan RULES.md ## 5.",
	},
	SKILLS: {
		sections: "## 0. Metadata Dokumen\n## 1. Daftar Skill Wajib (Dipilih dari Katalog)\n## 2. Skill Pendukung Berdasarkan Kebutuhan\n## 3. Cara Memuat & Memakai Skill",
		requiredFields: METADATA_FIELDS + " Sebutkan tech stack dan versinya.",
		tableSpec: "Satu tabel Skill (kolom: Nama Skill, Alasan, Kapan Dipakai, Jangan Dipakai Bila, Referensi Task).",
		acceptance: "Minimal 3 maksimal 10 skill; setiap skill punya nama PERSIS + referensi Task N.",
		refs: "Rujuk AGENTS.md ## 1 dan TASK-LIST ## Task 1.",
	},
	RULES: {
		sections: "## 0. Metadata Dokumen\n## 1. Aturan Gaya Kode\n## 2. Pengujian\n## 3. Keamanan\n## 4. Performa\n## 5. Code Review\n## 6. Alur Kerja & Verifikasi",
		requiredFields: METADATA_FIELDS + " Sebutkan perintah verifikasi project.",
		tableSpec: "Satu tabel Aturan (kolom: ID, Aturan, Ambang Terukur, Cara Verifikasi).",
		acceptance: "Setiap aturan punya ambang angka atau kondisi eksplisit.",
		refs: "Rujuk TEST-PLAN ## 7 dan AGENTS.md ## 5.",
	},
};

// Persona spesifik dokumen untuk stage 3 (semua teks ASCII).
// Tipe Record<DocName, string> memaksa SETIAP dokumen punya persona (doc baru
// tidak bisa lolos tanpa persona, gagal saat typecheck).
const DOC_PERSONAS: Record<DocName, string> = {
	"MASTER-PRD": "Kamu adalah product strategist senior 20+ tahun yang menulis spesifikasi produk standar industri.",
	ARCHITECTURE: "Kamu adalah software architect senior 20+ tahun yang menulis batas modul, aliran data, dan ADR presisi.",
	"API-TECH": "Kamu adalah AI Agent Specialist API & Backend dengan 20+ tahun pengalaman merancang endpoint, skema, dan integrasi.",
	"WEB-REFERENCE": "Kamu adalah AI Agent Specialist Web Frontend dengan 20+ tahun pengalaman membangun aplikasi web modern.",
	"UIUX-SPEC": "Kamu adalah senior UI/UX designer 20+ tahun yang menulis spesifikasi antarmuka presisi.",
	DATABASE: "Kamu adalah AI Agent Specialist Database & Data Model dengan 20+ tahun pengalaman merancang skema skalabel.",
	"TEST-PLAN": "Kamu adalah AI Agent Specialist Quality Assurance dengan 20+ tahun pengalaman menyusun strategi pengujian.",
	"ENV-SECURITY": "Kamu adalah security engineer senior 20+ tahun yang menulis konfigurasi env, matriks otorisasi, dan threat model.",
	DEPLOYMENT: "Kamu adalah AI Agent Specialist DevOps & Deployment dengan 20+ tahun pengalaman merancang rilis yang aman.",
	"TASK-LIST": "Kamu adalah engineering lead 20+ tahun yang menyusun task breakdown terurut fondasi-ke-fitur.",
	AGENTS: "Kamu adalah engineering lead 20+ tahun yang menulis panduan konvensi bagi AI coding agent.",
	SKILLS: "Kamu adalah engineering lead 20+ tahun yang memilih skill teknis untuk AI coding agent.",
	RULES: "Kamu adalah engineering lead 20+ tahun yang menyusun aturan kualitas kode.",
};

export function stage3Messages(idea: string, scope: string, doc: DocName, answers?: string[], analysis?: string, gaps?: string[], memoryDigest?: string): ChatMessage[] {
	const guide = DOC_GUIDES[doc];
	const sections = guide.sections;
	const budget = doc === "MASTER-PRD" ? "1000-1500 kata total" : "800-1200 kata";
	const persona = DOC_PERSONAS[doc];
	// Konteks knowledge (agent/skill/rules) + hint agent per doc; memori selalu SETELAH konteks.
	const catalog = catalogBlock(doc, idea);
	// PLAIN_LANGUAGE_RULE dicabut untuk stage 3: dokumen teknis WAJIB full teknis.
	const messages: ChatMessage[] = [
		{
			role: "system",
			content: persona + " " + LANG_RULE + " " + ZERO_FLUFF + " " + FORMAT_RULE + " " + MARKDOWN_RULE + " " + RULE_ANTI_AMBIG + " " + DEPTH_RULE,
		},
		{
			role: "user",
			content: `Tulis dokumen teknis untuk project berikut. Batas ${budget}.

Ide project:
"""
${idea}
"""
${deepAnalysisContext(analysis, gaps, answers)}
Analisis scope:
"""
${scope}
"""

Dokumen yang ditulis: ${doc}

Tulis PERSIS dengan bagian-bagian berikut (judul LITERAL, jangan ubah, lanjutkan nomor sesuai urutan):
${sections}

Field wajib tiap bagian:
${guide.requiredFields}

Spesifikasi tabel:
${guide.tableSpec}

Kriteria penerimaan:
${guide.acceptance}

Rujukan wajib:
${guide.refs}
${catalog}${memorySection(memoryDigest)}
 Mulai dengan tepat satu H1 '# ${doc}' lalu SATU baris deskripsi, lalu bagian di atas. ${LANG_RULE} ${FORMAT_RULE} ${MARKDOWN_RULE} ${RULE_ANTI_AMBIG} ${DEPTH_RULE} ${RULE_ENG}${docReminder(doc)}`,
		},
	];
	// Assert ringan plafon prompt (server-side console.warn, tanpa throw).
	warnIfOverCeiling(
		`stage 3 (${doc})`,
		messages.reduce((sum, m) => sum + m.content.length, 0),
	);
	return messages;
}

// Cap karakter per dokumen pada digest prompt. 12000 char = ~3000 token,
// cukup untuk membaca sebagian besar dokumen (sebelumnya 2500 = ~20% isi).
const TRIM_DOC_CHARS = 12_000;
// Anggaran karakter digest dokumen pada prompt verifikasi/audit. Total prompt
// (konteks dasar ~4000 char + digest) dijaga <= 60000 char.
const DOC_DIGEST_BUDGET = 56_000;

function trimDoc(content: string, max = TRIM_DOC_CHARS): string {
	const c = content.trim();
	return c.length > max ? c.slice(0, max) + "\n...[dipotong]" : c;
}

/**
 * Digest dokumen untuk prompt verifikasi/audit dengan anggaran adil (fair-share).
 * Strategi: bila jumlah dokumen sedikit, tiap dokumen dapat hingga TRIM_DOC_CHARS;
 * bila banyak, cap per dokumen turun merata (anggaran 56000 / n, minimum 2000)
 * sehingga SEMUA dokumen tetap terkirim dan total digest <= DOC_DIGEST_BUDGET
 * (total prompt <= ~60000 char). Contoh: 13 dokumen -> ~4300 char/dokumen
 * (tetap lebih besar dari 4000 sebelumnya); 8 dokumen -> 7000; <= 4 dokumen -> 12000.
 */
function docsDigest(docs: GeneratedDoc[]): string {
	const perDoc =
		docs.length > 0
			? Math.min(TRIM_DOC_CHARS, Math.max(2_000, Math.floor(DOC_DIGEST_BUDGET / docs.length)))
			: TRIM_DOC_CHARS;
	return docs.map((d) => `### ${d.name}\n${trimDoc(d.content, perDoc)}`).join("\n\n");
}

export function stage4Messages(idea: string, scope: string, docs: GeneratedDoc[], answers?: string[], analysis?: string, gaps?: string[], memoryDigest?: string): ChatMessage[] {
	// Digest memakai anggaran adil yang sama dengan verifikasi/audit agar prompt
	// TASK-LIST tidak membengkak (12 dokumen x 12000 char = 144000 char).
	const digest = docsDigest(docs);
	const messages: ChatMessage[] = [
		{
			role: "system",
			content: "Kamu adalah engineering lead 20+ tahun yang menyusun task breakdown untuk AI coding agent. Task-mu jelas, terurut, dan zero-ambiguity. " + LANG_RULE + " " + PLAIN_LANGUAGE_RULE + " " + ZERO_FLUFF,
		},
		{
			role: "user",
			content: `Buat TASK-LIST.md untuk project berikut berdasarkan ISI dokumen terkait.

Ide project:
"""
${idea}
"""
${deepAnalysisContext(analysis, gaps, answers)}
Analisis scope:
"""
${scope}
"""

ISI dokumen terkait (rujukan wajib, gunakan detail di dalamnya):
${digest}

Aturan TASK-LIST:
- Jumlah task TEPAT 5-12 tergantung ruang lingkup.
- Urutkan dari fondasi (setup, skema, konfigurasi) ke fitur (UI, logika bisnis).
- Setiap task berdiri sendiri (standalone) dan mengacu pada dokumen terkait saat diperlukan.
- Setiap task berisi 4-8 langkah konkret.
- 'Konteks' maksimal 2 kalimat.
- 'Kriteria penerimaan' KONKRET dan TERUJI (BUKAN 'berfungsi dengan baik'); harus bisa diverifikasi.

Format SETIAP task WAJIB persis:
### Task N: <judul task>
- **Konteks**: <latar belakang singkat, maks 2 kalimat>
- **File yang disentuh**: \`src/...\`
- **Langkah**:
  - [ ] <langkah 1>
  - [ ] <langkah 2>
- **Kriteria penerimaan**:
  - [ ] <kriteria yang bisa diuji>
- **Definisi selesai**: <hasil akhir yang bisa diverifikasi>

CONTOH SATU task (format rujukan):
### Task 1: Inisialisasi proyek Next.js
- **Konteks**: Project belum punya kerangka dasar. Perlu fondasi agar fitur bisa dibangun.
- **File yang disentuh**: \`package.json\`, \`next.config.ts\`
- **Langkah**:
  - [ ] Jalankan \`create-next-app\` dengan App Router.
  - [ ] Pasang dependencies inti.
  - [ ] Atur struktur folder \`src/app\`, \`src/lib\`.
- **Kriteria penerimaan**:
  - [ ] \`npm run dev\` membuka halaman tanpa error.
  - [ ] Lint lolos tanpa error.
- **Definisi selesai**: Halaman awal jalan di localhost dan build sukses.

WAJIB: jangan tulis intro, langsung tulis ### Task 1. ${LANG_RULE} ${RULE_ENG}${docReminder("TASK-LIST")}${memorySection(memoryDigest)}`,
		},
	];
	warnIfOverCeiling(
		"stage 4 (TASK-LIST)",
		messages.reduce((sum, m) => sum + m.content.length, 0),
	);
	return messages;
}

export function clarifyMessages(idea: string): ChatMessage[] {
	return [
		{
			role: "system",
			content: `Kamu adalah PM senior 20 tahun. Dari ide project, ajukan 4-8 pertanyaan klarifikasi yang PALING menentukan scope (bukan pertanyaan basa-basi). Format JSON internal persis: {"questions":[{"q":"...","title":"...","category":"...","options":["a","b","c"],"recommended":"b"}, ...]}. Tiap question wajib punya 2-4 options + recommended.

Aturan penyusunan pertanyaan (WAJIB):
- Grouping per kategori: sebar pertanyaan ke kategori ${QUESTION_CATEGORY_LIST}. Tulis nama kategori PERSIS pada field "category". Usahakan tiap kategori terpakai maksimal 2 pertanyaan agar cakupan luas.
- Dedup: DILARANG menanyakan hal yang sudah jelas/tersirat di ide project, dan DILARANG mengulang makna pertanyaan yang sama dengan kata berbeda.
- Prioritas penentu scope: urutkan dari pertanyaan yang paling mengubah arsitektur, fitur inti, biaya, atau data (paling menentukan) ke yang paling tidak menentukan.
- Larangan basa-basi: DILARANG menanyakan preferensi kosmetik, warna, nama brand, atau hal yang bisa diputuskan belakangan tanpa mengubah scope.
- Setiap pertanyaan wajib mengubah minimal satu keputusan nyata (fitur, arsitektur, data, atau batasan) bila jawabannya berubah.

Bahasa Indonesia untuk isi q/title/category/options/recommended. Setiap pertanyaan WAJIB singkat (maks 15 kata per pertanyaan, opsi maks 8 kata per opsi), jelas, dan mudah dipahami orang awam. HANYA JSON, tanpa teks lain.`,
		},
		{
			role: "user",
			content: `Ide project:
"""
${idea}
"""

Hasilkan pertanyaan klarifikasi dalam format JSON di atas.`,
		},
	];
}

// Stage 0a: analisis mendalam ide (model kecil, non-JSON).
export function stage0aMessages(idea: string): ChatMessage[] {
	return [
		{
			role: "system",
			content: "Kamu adalah product strategist senior 20+ tahun yang menganalisis produk digital dari ide awal. Analisis tajam, pragmatis, dan langsung dapat dieksekusi. " + LANG_RULE + " " + PLAIN_LANGUAGE_RULE + " " + ZERO_FLUFF,
		},
		{
			role: "user",
			content: `Lakukan analisis mendalam atas ide project berikut. Gali makna tersirat, tujuan sebenarnya, asumsi yang belum dinyatakan, risiko yang mudah terlewat, dan peluang yang belum terlihat. Jangan mengulang ide; langsung ke analisis. Batas 500 kata.

Ide project:
"""
${idea}
"""

Tulis PERSIS struktur markdown berikut (judul LITERAL, jangan diubah):
## Analisis Makna
<analisis mendalam makna dan tujuan project.>
## Tujuan Utama
<tujuan utama yang ingin dicapai.>
## Asumsi Kunci
<asumsi yang mendasari project, berformat bullet '- ...'.>
## Risiko Tersembunyi
<risiko yang tidak terlihat di permukaan, berformat bullet '- ...'.>
## Peluang Unik
<peluang yang membuat project berbeda, berformat bullet '- ...'.>

Tulis langsung struktur di atas dengan isi untuk ide project. ${LANG_RULE}${docReminder()}`,
		},
	];
}

// Stage 0b: identifikasi gap + pertanyaan klarifikasi berbasis analisis (model kecil, JSON internal).
export function stage0bMessages(idea: string, analysis: string): ChatMessage[] {
	return [
		{
			role: "system",
			content: "Kamu adalah PM senior 20+ tahun yang menyusun spesifikasi produk. Identifikasi kelemahan rencana yang belum terpikirkan, lalu ajukan pertanyaan klarifikasi yang benar-benar menentukan scope: dari hal umum yang fundamental hingga edge case paling tidak terduga yang jarang terpikirkan. Tolak pertanyaan dangkal/superfisial yang jawabannya bisa ditebak dari ide; setiap pertanyaan harus menyelidik aspek yang mengubah isi dokumentasi dan keputusan arsitektur. " + LANG_RULE + " " + PLAIN_LANGUAGE_RULE + " " + ZERO_FLUFF + " Jawab HANYA dengan satu objek JSON, tanpa teks lain, tanpa markdown fence. Setiap pertanyaan WAJIB singkat (maks 15 kata per pertanyaan, opsi maks 8 kata per opsi), jelas, dan mudah dipahami orang awam.",
		},
		{
			role: "user",
			content: `Dari analisis mendalam berikut, identifikasi gap/kelemahan (dari hal umum hingga yang paling tidak terduga). Lalu bangun 4-8 pertanyaan klarifikasi TERBUKA (open-ended) yang PALING menentukan scope, masing-masing dengan 2-4 options dan satu recommended.

Aturan penyusunan pertanyaan (WAJIB):
- Grouping per kategori: sebar pertanyaan ke kategori ${QUESTION_CATEGORY_LIST}. Tulis nama kategori PERSIS pada field "category". Usahakan tiap kategori terpakai maksimal 2 pertanyaan agar cakupan luas.
- Dedup: DILARANG menanyakan hal yang sudah jelas/tersirat di ide atau analisis, dan DILARANG mengulang makna pertanyaan yang sama dengan kata berbeda.
- Prioritas penentu scope: urutkan dari pertanyaan yang paling mengubah arsitektur, fitur inti, biaya, atau data (paling menentukan) ke yang paling tidak menentukan.
- Larangan basa-basi: DILARANG menanyakan preferensi kosmetik, warna, nama brand, atau hal yang bisa diputuskan belakangan tanpa mengubah scope.
- Setiap pertanyaan wajib mengubah minimal satu keputusan nyata (fitur, arsitektur, data, atau batasan) bila jawabannya berubah.

Ide project:
"""
${idea}
"""

Analisis mendalam:
"""
${analysis}
"""

Output HANYA satu objek JSON persis format (JSON INTERNAL, tidak ditampilkan ke pengguna):
{"analysis":"<ringkasan analisis 1-2 kalimat>","gaps":["<gap 1>","<gap 2>"],"questions":[{"q":"<pertanyaan>","title":"<judul singkat>","category":"<salah satu dari ${QUESTION_CATEGORY_LIST}>","options":["<opsi a>","<opsi b>","<opsi c>"],"recommended":"<opsi b>"}]}

Seluruh nilai string dalam JSON WAJIB Bahasa Indonesia dan ASCII printable.`,
		},
	];
}

/** Konteks ringkas untuk prompt retry stage 2 & resume. */
export function retryStage2Note(scope: string): string {
	return `Respons sebelumnya tidak menghasilkan daftar dokumen yang valid. Ulangi dengan output HANYA objek JSON {"docs":[...]}. Analisis scope:\n${scope}`;
}

// --- Tahap 5-7: verifikasi (baca ulang), audit red-team, perbaikan ---

/** Stage 5+10a: baca ulang dokumen yang disertakan dan cek kecocokan dengan kebutuhan pengguna (JSON internal). */
export function verifyDocsMessages(idea: string, scope: string, docs: GeneratedDoc[], answers?: string[], analysis?: string, gaps?: string[]): ChatMessage[] {
	const digest = docsDigest(docs);
	return [
		{
			role: "system",
			content: "Kamu adalah reviewer teknis senior 20+ tahun yang membaca ulang dokumentasi project yang disertakan dan menilai kecocokan dengan kebutuhan pengguna. " + LANG_RULE + " " + ZERO_FLUFF + " " + RULE_ANTI_AMBIG + " Jawab HANYA dengan satu objek JSON, tanpa teks lain, tanpa markdown fence.",
		},
		{
			role: "user",
			content: `Baca ulang seluruh dokumen yang disertakan berikut (dokumen panjang dipotong pada bagian akhir), lalu verifikasi apakah isinya mencakup seluruh kebutuhan pengguna dan saling konsisten.

Ide project:
"""
${idea}
"""
${deepAnalysisContext(analysis, gaps, answers)}
Analisis scope:
"""
${scope}
"""

Dokumen yang dibaca ulang:
${digest}

Aturan verifikasi:
- Bandingkan kebutuhan pengguna vs isi dokumen; catat setiap kebutuhan yang tidak tercakup.
- Catat setiap klaim TANPA bukti konkret (file path, endpoint, tipe/versi) atau TANPA kriteria terukur.
- Catat inkonsistensi antar dokumen (misal endpoint di MASTER-PRD tidak ada di API-TECH).
- cocok = true HANYA bila tidak ada temuan sama sekali.

Output HANYA satu objek JSON persis format:
{"ringkasan":"<1-2 kalimat>","cocok":true,"temuan":[{"doc":"NAMA-DOKUMEN","masalah":"<kekurangan spesifik>","saran":"<perbaikan konkret>"},{"doc":"NAMA-DOKUMEN","masalah":"...","saran":"..."}]}

Nilai string WAJIB Bahasa Indonesia teknis dan ASCII printable.`,
		},
	];
}

/** Stage 10b: audit red-team ala agent hacker atas dokumen yang disertakan (JSON internal). */
export function hackerAuditMessages(idea: string, docs: GeneratedDoc[], analysis?: string, gaps?: string[]): ChatMessage[] {
	const digest = docsDigest(docs);
	return [
		{
			role: "system",
			content: "Kamu adalah security red-team engineer (agent hacker) senior 20+ tahun yang menyerang desain di atas kertas: mencari celah authz, injeksi, secret leak, rate limit, data loss, dan edge case yang bisa dieksploitasi. " + LANG_RULE + " " + ZERO_FLUFF + " Jawab HANYA dengan satu objek JSON, tanpa teks lain, tanpa markdown fence.",
		},
		{
			role: "user",
			content: `Lakukan audit red-team terhadap desain dalam dokumen yang disertakan berikut (dokumen panjang dipotong pada bagian akhir). Temukan cara mengeksploitasi desain, bukan pujian.

Ide project:
"""
${idea}
"""
${deepAnalysisContext(analysis, gaps, undefined)}

Dokumen yang diaudit:
${digest}

Aturan audit:
- Setiap temuan WAJIB punya severity: CRITICAL, HIGH, MEDIUM, atau LOW.
- Setiap temuan WAJIB menyebut dokumen sasaran (nama persis) dan skenario serangan/gagalnya.
- Jika dokumen tidak menyebut kontrol keamanan, itu temuan (severity sesuai dampak).
- DILARANG temuan kosong tanpa skenario konkret.

Output HANYA satu objek JSON persis format:
{"catatan":"<1 kalimat>","risiko":[{"doc":"NAMA-DOKUMEN","severity":"HIGH","masalah":"<celah + skenario>","saran":"<mitigasi konkret>"},{"doc":"NAMA-DOKUMEN","severity":"CRITICAL","masalah":"...","saran":"..."}]}

Nilai string WAJIB Bahasa Indonesia teknis dan ASCII printable.`,
		},
	];
}

/** Stage 11: tulis ulang satu dokumen dengan memperbaiki temuan verifikasi + audit. */
export function repairDocMessages(idea: string, scope: string, doc: DocName, findings: string[], answers?: string[], analysis?: string, gaps?: string[], memoryDigest?: string): ChatMessage[] {
	const base = stage3Messages(idea, scope, doc, answers, analysis, gaps, memoryDigest);
	const note = findings.length > 0
		? `\n\nTEMUAN VERIFIKASI DAN AUDIT RED-TEAM YANG WAJIB DIPERBAIKI:\n${findings.map((f) => `- ${f}`).join("\n")}`
		: "";
	return [
		base[0],
		{
			role: "user",
			content: `${base[1].content}
${note}

WAJIB: tulis ULANG dokumen ${doc} secara LENGKAP dari awal dengan struktur bagian LITERAL yang sama, sambil memperbaiki seluruh temuan di atas. Setiap perbaikan wajib berupa isi konkret (angka, status code, file path, tipe/versi), bukan penjelasan bahwa sesuatu diperbaiki.`,
		},
	];
}
