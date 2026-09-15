// Single source kebenaran aturan prompt.
// Dipakai oleh prompts.ts (inject ke LLM). Data knowledge ada di folder knowledge/
// (skrip generator tidak ada di working tree ini). Semua teks WAJIB ASCII-only (0x20-0x7E).

// LANG_RULE - Bahasa Indonesia total (baku formal-teknis) + aturan ASCII.
export const LANG_RULE = [
  "ATURAN BAHASA - WAJIB: SELURUH kalimat, paragraf, judul, bullet, dan tabel WAJIB dalam Bahasa Indonesia baku formal-teknis.",
  "DILARANG keras menulis kalimat, frasa, atau keterangan dalam bahasa Inggris.",
  "Pengecualian yang BOLEH tetap bahasa Inggris: kode sumber, nama file/path, nama fungsi/komponen/kelas, dan istilah teknis yang sudah baku (endpoint, schema, API, framework, library, repository). Pengecualian ini HANYA dipakai sebagai istilah, BUKAN sebagai kalimat.",
  "JANGAN pernah mengganti kalimat Indonesia dengan English. CONTOH YANG HARUS DITIRU: 'Endpoint POST /api/users dipakai untuk membuat pengguna baru.' - BUKAN 'This endpoint is used to create a new user.'",
  "Gunakan istilah teknis Indonesia bila natural: bagian atas halaman (header), tombol, lajur navigasi, kotak input, pengguna, fitur, kebutuhan, syarat, antarmuka.",
  "ATURAN ASCII - WAJIB: gunakan HANYA karakter ASCII printable (0x20-0x7E). DILARANG emoji, tanda kutip melengkung (curly quote), panah unicode (tulis '->'), bullet unicode, atau simbol non-ASCII.",
  "Marker checklist WAJIB '- [ ]' (tanda hubung, spasi, kurung). Tanda pembulatan memakai '-' atau '*'. Tanda kutip memakai ASCII straight quote.",
].join(" ");

// ZERO_FLUFF - Anti-verbose.
export const ZERO_FLUFF = [
  "Langsung ke inti. TANPA intro, TANPA sapaan, TANPA penjelasan berlebihan, TANPA ringkasan di awal selain bagian yang diminta, TANPA penutup/kesimpulan yang tidak diminta.",
  "Gunakan bullet dan tabel bila membandingkan; kalimat pendek; per bagian dibatasi ringkas namun lengkap.",
  "Jangan ulangi isi bagian lain. Setiap bagian hanya membahas topiknya.",
  "Kalimat pendek. Tanpa kata pengantar seperti 'Dengan ini', 'Perlu diketahui', 'Penting untuk dicatat'.",
].join(" ");

// PLAIN_LANGUAGE_RULE - Bahasa awam: mudah dipahami non-teknis, kalimat pendek.
export const PLAIN_LANGUAGE_RULE = [
  "ATURAN BAHASA AWAM - WAJIB: gunakan bahasa Indonesia sehari-hari yang mudah dipahami orang awam, bukan hanya orang IT/programmer.",
  "Jelaskan istilah teknis dengan kata sederhana saat pertama kali disebut (contoh: endpoint -> jalur komunikasi aplikasi; database -> tempat menyimpan data).",
  "Kalimat pendek (maks 20 kata per kalimat).",
  "Langsung ke inti, tanpa jargon kosong, tanpa kata sambungan berlebihan.",
  "Singkat padat tapi tetap on-point: setiap bagian wajib ada isi yang jelas dan berguna, bukan kalimat pengisi.",
].join(" ");

// FORMAT_RULE - Header & format konsisten.
export const FORMAT_RULE = [
  "Setiap dokumen DIMULAI tepat dengan SATU H1: '# <NAMA-DOKUMEN>' lalu SATU baris deskripsi, lalu bagian-bagian.",
  "DILARANG ada H1 lain. DILARANG membungkus seluruh dokumen dengan code fence (```).",
  "Bagian ditulis berurutan bernomor konsisten: '## 0. Metadata Dokumen' lalu '## 1. ...', '## 2. ...', dst.",
  "Semua bagian WAJIB terisi substansi asli project - DILARANG placeholder '<...>' atau nilai contoh yang tidak ditelusuri dari ide.",
  "Setiap bagian WAJIB ada isi substantif dan DILARANG hanya berisi 1 kalimat pendek.",
].join(" ");

// MARKDOWN_RULE - Kontrak markdown siap tempel (satu tabel per entitas, fence berlabel, dsb).
export const MARKDOWN_RULE = [
  "ATURAN MARKDOWN - WAJIB:",
  "SATU tabel untuk SATU entitas; DILARANG menggabungkan beberapa entitas berbeda (contoh: toko, produk, pesanan) ke dalam satu tabel - buat tabel terpisah per entitas.",
  "Setiap tabel WAJIB punya baris header dan baris separator markdown '| --- | --- |'; tabel TANPA separator dianggap rusak.",
  "Sel tabel WAJIB tidak kosong; bila tidak ada nilai, tulis '-'. DILARANG menaruh karakter pipe mentah ('|') di dalam sel - ganti dengan '/' atau 'atau'.",
  "H1 tepat SATU di awal, diikuti satu baris deskripsi dokumen, lalu bagian '## 1.', '## 2.', dst berurutan TANPA lompat nomor dan tanpa duplikasi nomor.",
  "Code fence WAJIB berlabel bahasa (contoh: ```bash, ```json, ```ts, ```sql, ```yaml, ```text); DILARANG fence tanpa label.",
  "Daftar WAJIB memakai '- ' untuk poin biasa dan '- [ ]' untuk checklist; DILARANG mencampur simbol bullet unicode.",
  "Rujukan antar dokumen WAJIB eksplisit dengan nomor bagian, contoh: 'Lihat API-TECH ## 2'; DILARANG rujukan kabur seperti 'lihat dokumen lain'.",
  "Setiap angka WAJIB disertai satuan dan setiap kolom tipe data WAJIB eksplisit (contoh: '512 MB', 'waktu respons < 200 ms', 'kolom harga bertipe NUMERIC(12,2)').",
  "Seluruh teks tetap Bahasa Indonesia teknis dan larangan kalimat generik berlaku pada tabel dan daftar.",
].join(" ");

// RULE_ANTI_AMBIG - Setiap klaim wajib konkret + terukur; larangan kata ambigu.
export const RULE_ANTI_AMBIG = [
  "ATURAN ANTI-AMBIGU - WAJIB: setiap klaim WAJIB menyertakan minimal SATU bukti konkret berupa (file path konkret ATAU endpoint konkret ATAU tipe/versi konkret).",
  "Setiap klaim WAJIB memiliki kriteria terukur: angka, status code HTTP, batas waktu, atau kondisi eksplisit yang bisa diverifikasi.",
  "DILARANG memakai kata ambigu tanpa ukuran: secukupnya, yang baik, user friendly, mudah digunakan, cepat, optimal, fleksibel, handal, modern, efisien, dan sejenisnya. Ganti dengan angka atau kondisi terukur.",
  "Setiap fitur WAJIB punya ID unik berformat 'F-nn' (contoh: F-01, F-02) dan setiap fitur WAJIB punya acceptance test yang bisa dieksekusi.",
  "DILARANG penanda tempat seperti 'TBD', 'TODO', 'dst.' pada klaim teknis; bila data belum ada, tulis asumsi eksplisit beserta angka default yang dipakai.",
].join(" ");

// DEPTH_RULE - Kedalaman & kerapian isi per bagian.
export const DEPTH_RULE = [
  "ATURAN KEDALAMAN DAN KERAPIAN - WAJIB: setiap bagian wajib berisi 3-6 kalimat atau bullet SPESIFIK project: angka konkret (target, ambang, jumlah), nama fitur/entitas nyata dari ide, dan contoh request/response atau skema asli bila relevan.",
  "DILARANG kalimat generik atau template tanpa ukuran (misal 'sistem yang baik', 'user friendly', 'memudahkan pengguna') - setiap klaim fitur wajib menyebut kriteria terukur yang bisa diverifikasi (angka, status code, batas waktu, atau kondisi eksplisit).",
  "Bila membandingkan opsi atau menyajikan daftar beratribut, WAJIB memakai tabel markdown, bukan kalimat panjang.",
  "Kedalaman berasal dari detail spesifik, BUKAN dari kalimat bertele-tele; tetap patuhi aturan ASCII-only dan Bahasa Indonesia baku.",
].join(" ");

// RULE_ENG - aturan engineering inti (diperkaya dari aturan umum ECC).
// Tetap diekspor dengan isi yang sama agar import lama tidak rusak; blok baru
// (gaya, test, keamanan, performa, review, alur kerja) dirujuk dari sini.
export const RULE_ENG = [
  "Rancangan WAJIB menghindari: query N+1, over-engineering/YAGNI violation, hardcoded credential/secrets, blocking operasi di main thread bila ada alternatif async, duplikasi logika (DRY), dan ketergantungan yang tidak perlu.",
  "WAJIB mengikuti best practice: SOLID (bila OOP), input validation di trust boundary, error handling di semua level, keamanan OWASP (XSS, injection, authz), accessibility, dan testabilitas.",
  "Rujukan wajib yang melengkapi blok ini: aturan gaya kode, aturan test, checklist keamanan, aturan performa, standar code review, dan alur kerja pengembangan.",
].join(" ");

// RULE_STYLE - Gaya kode: immutability, prinsip inti, ukuran file, penamaan, aroma kode.
// Sumber: ECC common/coding-style.md.
export const RULE_STYLE = [
  "ATURAN GAYA KODE - WAJIB:",
  "IMMUTABILITY (KRITIS): SELALU buat objek/nilai BARU, DILARANG memutasi objek yang sudah ada. Pola salah: ubah field pada objek asli (partial mutation). Pola benar: kembalikan salinan baru yang sudah diperbarui. Alasan: mencegah efek samping tersembunyi, mempermudah debugging, dan aman untuk konkurensi.",
  "PRINSIP INTI - KISS: pilih solusi paling sederhana yang benar-benar bekerja; hindari optimasi dini; utamakan kejelasan ketimbang kecerdikan.",
  "PRINSIP INTI - DRY: ekstrak logika yang berulang ke fungsi atau util bersama; cegah pergeseran implementasi hasil copy-paste; buat abstraksi hanya saat pengulangan benar-benar nyata, bukan spekulatif.",
  "PRINSIP INTI - YAGNI: jangan membangun fitur atau abstraksi sebelum dibutuhkan; hindari generalitas spekulatif; mulai sederhana lalu refactor saat tekanan nyata muncul.",
  "ORGANISASI FILE - BANYAK FILE KECIL lebih baik daripada sedikit file besar: kohesi tinggi, kopling rendah; ukuran wajar 200-400 baris dengan batas lunak 800 baris sebagai plafon pemeliharaan; file test, file hasil generate, dan file pihak ketiga boleh melewati plafon bila ukurannya dibenarkan perannya; ekstrak util dari modul besar; kelompokkan per fitur/domain, bukan per tipe.",
  "PENANGANAN ERROR: tangani error secara eksplisit di setiap level; beri pesan ramah pengguna pada kode yang menghadap UI; catat konteks error rinci di sisi server; DILARANG menelan error secara diam-diam.",
  "VALIDASI INPUT: validasi semua input pengguna sebelum diproses; gunakan validasi berbasis skema bila tersedia; gagal cepat dengan pesan error jelas; JANGAN pernah memercayai data eksternal (respons API, input pengguna, isi file).",
  "PENAMAAN: nama deskriptif - nama menyatakan isi atau perbuatannya tanpa perlu komentar; nama boolean terbaca jelas sebagai klaim; pada bahasa yang membedakan, konstanta dan tipe harus terlihat berbeda dari nilai biasa.",
  "AROMA KODE YANG DILARANG: nesting dalam (lebih dari 4 level) - pakai early return; magic number - pakai konstanta bernama untuk ambang, jeda, dan limit bermakna; fungsi panjang - pecah menjadi bagian fokus dengan tanggung jawab jelas.",
  "CHECKLIST MUTU KODE sebelum pekerjaan dinyatakan selesai: [ ] kode terbaca dan penamaannya baik; [ ] fungsi kecil (kurang dari 50 baris); [ ] file fokus (kurang dari 800 baris); [ ] tanpa nesting dalam (lebih dari 4 level); [ ] penanganan error memadai; [ ] tanpa nilai hardcoded (pakai konstanta atau config); [ ] tanpa mutasi (pakai pola immutable).",
].join(" ");

// RULE_TEST - Cakupan, jenis test, TDD, struktur AAA, penamaan test.
// Sumber: ECC common/testing.md.
export const RULE_TEST = [
  "ATURAN TEST - WAJIB:",
  "CAKUPAN MINIMUM 80 persen untuk kode yang ditulis.",
  "JENIS TEST - SEMUA WAJIB ADA: (1) unit test untuk fungsi, util, dan komponen tunggal; (2) integration test untuk endpoint API dan operasi database; (3) e2e test untuk alur pengguna kritis (framework dipilih sesuai bahasa).",
  "TEST-DRIVEN DEVELOPMENT - alur WAJIB: (1) tulis test lebih dulu (RED); (2) jalankan test - harus GAGAL; (3) tulis implementasi minimal (GREEN); (4) jalankan test - harus LULUS; (5) refactor (IMPROVE); (6) verifikasi cakupan 80 persen atau lebih.",
  "STRUKTUR AAA: susun test dengan pola Arrange-Act-Assert - siapkan data dan prasyarat (Arrange), jalankan aksi yang diuji (Act), lalu periksa hasil (Assert).",
  "PENAMAAN TEST: pakai nama deskriptif yang menyatakan perilaku yang diuji, misalnya 'mengembalikan array kosong saat tidak ada data yang cocok', 'melempar error saat API key tidak diisi', 'jatuh ke pencarian substring saat Redis tidak tersedia'.",
  "SAAT TEST GAGAL: periksa isolasi test; pastikan mock benar; perbaiki implementasi, bukan test (kecuali memang test yang salah); data uji wajib deterministik (fixture).",
].join(" ");

// RULE_SECURITY - Checklist keamanan wajib sebelum commit.
// Sumber: ECC common/security.md.
export const RULE_SECURITY = [
  "ATURAN KEAMANAN - CHECKLIST WAJIB sebelum commit apa pun: [ ] tanpa secret hardcoded (API key, password, token); [ ] semua input pengguna divalidasi; [ ] pencegahan SQL injection (query parameterized, bukan string concatenation); [ ] pencegahan XSS (HTML disanitasi, output di-escape); [ ] proteksi CSRF aktif; [ ] autentikasi dan otorisasi (authz) terverifikasi; [ ] rate limit pada semua endpoint; [ ] pesan error tidak membocorkan data sensitif.",
  "MANAJEMEN SECRET: JANGAN pernah menulis secret di source code; SELALU pakai environment variable atau secret manager; validasi keberadaan secret wajib saat startup; rotasi setiap secret yang mungkin telah terekspos.",
  "PROTOKOL RESPONS KEAMANAN bila ditemukan isu: (1) STOP segera; (2) pakai sesi review keamanan khusus; (3) perbaiki isu CRITICAL sebelum melanjutkan; (4) rotasi secret yang terekspos; (5) periksa seluruh codebase untuk isu serupa.",
].join(" ");

// RULE_PERF - Anti N+1, pagination, batas query, caching, I/O async.
// Sumber: ECC common/code-review.md (bagian Performance).
export const RULE_PERF = [
  "ATURAN PERFORMA - WAJIB:",
  "HINDARI N+1 query - pakai JOIN atau batching saat mengambil relasi, jangan query di dalam loop.",
  "PAGINATION WAJIB - setiap daftar yang berpotensi besar HARUS memakai LIMIT dan offset/cursor.",
  "HINDARI unbounded query - selalu beri batasan (filter, limit, rentang waktu) pada query.",
  "CACHING - cache operasi mahal (query berat, panggilan eksternal, komputasi berulang) dan tentukan strategi invalidasi.",
  "ASYNC UNTUK I/O - jalankan operasi I/O (disk, jaringan, database) secara asinkron; jangan memblokir main thread bila ada alternatif async.",
  "Jangan optimasi dini (prematur); ukur dulu, baru optimasi titik panas yang terbukti.",
].join(" ");

// RULE_REVIEW - Level severity + aksi + checklist review.
// Sumber: ECC common/code-review.md.
export const RULE_REVIEW = [
  "ATURAN CODE REVIEW - WAJIB: review setelah menulis atau mengubah kode, sebelum commit ke branch bersama, saat kode sensitif keamanan berubah (auth, pembayaran, data pengguna), dan sebelum merge pull request.",
  "LEVEL SEVERITY DAN AKSI: CRITICAL (kerentanan keamanan atau risiko kehilangan data) - BLOKIR, wajib diperbaiki sebelum merge; HIGH (bug atau masalah mutu signifikan) - PERINGATAN, sebaiknya diperbaiki sebelum merge; MEDIUM (masalah pemeliharaan, termasuk file sumber melewati plafon lunak 800 baris tanpa alasan) - INFO, pertimbangkan untuk diperbaiki; LOW (saran gaya atau minor) - CATATAN, opsional.",
  "CHECKLIST REVIEW sebelum kode dinyatakan selesai: [ ] kode terbaca dan penamaannya baik; [ ] fungsi fokus (kurang dari 50 baris); [ ] file sumber kohesif (di bawah plafon lunak 800 baris atau disertai alasan pengecualian); [ ] tanpa nesting dalam (lebih dari 4 level); [ ] error ditangani eksplisit; [ ] tanpa secret atau credential hardcoded; [ ] tanpa console.log atau pernyataan debug; [ ] ada test untuk fungsionalitas baru; [ ] cakupan test memenuhi minimum 80 persen.",
  "KRITERIA PERSETUJUAN: APPROVE bila tidak ada isu CRITICAL atau HIGH; WARNING bila hanya ada isu HIGH (merge dengan hati-hati); BLOCK bila ada isu CRITICAL.",
  "PEMICU REVIEW KEAMANAN - STOP dan lakukan review keamanan khusus bila menyentuh: kode autentikasi atau otorisasi; penanganan input pengguna; query database; operasi filesystem; panggilan API eksternal; operasi kriptografi; kode pembayaran atau finansial.",
].join(" ");

// RULE_WORKFLOW - Riset dulu, rencana, TDD, review, verifikasi gate.
// Sumber: ECC common/development-workflow.md.
export const RULE_WORKFLOW = [
  "ATURAN ALUR KERJA PENGEMBANGAN - WAJIB berurutan:",
  "0 RISET DAN REUSE (WAJIB sebelum implementasi baru): cari implementasi, template, dan pola yang sudah terbukti lebih dulu (pencarian kode repositori, lalu dokumentasi resmi library, baru riset web lebih luas bila dua langkah pertama belum cukup); periksa registry paket (npm, PyPI, crates.io) sebelum menulis kode util; utamakan library yang terbukti ketimbang solusi rakitan sendiri; cari proyek open source yang menyelesaikan 80 persen atau lebih masalah untuk diadaptasi; JANGAN menulis kode baru dari nol bila ada pendekatan terbukti yang memenuhi kebutuhan.",
  "1 RENCANA DULU: susun rencana implementasi dan dokumen perencanaan (PRD, arsitektur, desain sistem, dokumen teknis, daftar tugas) sebelum menulis kode; identifikasi dependensi dan risiko; pecah menjadi fase.",
  "2 TDD: tulis test lebih dulu (RED), implementasi sampai lulus (GREEN), lalu refactor (IMPROVE); verifikasi cakupan 80 persen atau lebih.",
  "3 CODE REVIEW: review segera setelah menulis kode; perbaiki isu CRITICAL dan HIGH; perbaiki isu MEDIUM bila memungkinkan.",
  "4 COMMIT DAN PUSH dengan pesan commit rinci dan format conventional commits.",
  "5 VERIFIKASI GATE - sebelum pekerjaan dinyatakan selesai, SEMUA gate wajib LULUS: typecheck (tanpa error tipe), lint (tanpa error), test (semua lulus, cakupan 80 persen atau lebih), dan build (sukses, exit code 0).",
].join(" ");

// RULE_BLOCKS - agregasi semua blok aturan untuk injeksi prompt.
// Urutan deterministik; kunci adalah nama konstanta.
export const RULE_BLOCKS: Record<string, string> = {
  LANG_RULE,
  ZERO_FLUFF,
  PLAIN_LANGUAGE_RULE,
  FORMAT_RULE,
  MARKDOWN_RULE,
  RULE_ANTI_AMBIG,
  DEPTH_RULE,
  RULE_ENG,
  RULE_STYLE,
  RULE_TEST,
  RULE_SECURITY,
  RULE_PERF,
  RULE_REVIEW,
  RULE_WORKFLOW,
};
