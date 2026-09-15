// Helper terpusat pembacaan body JSON dengan batas ukuran (server-only).
// Alur: cek Content-Type (415) -> cek content-length (413) -> parse -> cap byte body.

export type JsonBody =
  | { ok: true; value: unknown }
  | { ok: false; status: number; message: string };

/** Content-Type JSON ketat: application/json atau application/<x>+json (charset boleh). */
function isJsonContentType(value: string): boolean {
  return /^application\/(?:[\w.+-]+\+)?json\b/i.test(value.trim());
}

/** Baca body JSON dengan plafon maxBytes. Gagal -> status 415/413/400 + pesan siap kirim. */
export async function readJsonLimited(request: Request, maxBytes: number): Promise<JsonBody> {
  const contentType = request.headers.get("content-type");
  if (contentType === null || !isJsonContentType(contentType)) {
    return { ok: false, status: 415, message: "Content-Type harus application/json." };
  }

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, status: 413, message: `Body terlalu besar (maksimal ${maxBytes} byte).` };
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, status: 400, message: "Body JSON tidak valid." };
  }
  // Cap dihitung dalam BYTE (bukan jumlah karakter UTF-16) agar multibyte tidak lolos.
  if (new TextEncoder().encode(raw).length > maxBytes) {
    return { ok: false, status: 413, message: `Body terlalu besar (maksimal ${maxBytes} byte).` };
  }

  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, status: 400, message: "Body JSON tidak valid." };
  }
}
