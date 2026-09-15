import type { NextConfig } from "next";

// CSP ketat tanpa memecah app: 'unsafe-inline' diperlukan karena Next menyuntik
// script theme inline di layout.tsx.
// 'unsafe-eval' diperlukan untuk React dev mode/Turbopack (eval untuk rekonstruksi
// stack); di production React tidak memakai eval sehingga tidak ada dampak runtime,
// hanya pelonggaran header.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: CSP },
  // HSTS hanya efektif di HTTPS (Vercel mengirim HTTPS di produksi).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
	/* config options here */
	allowedDevOrigins: ["192.168.110.133"],
	async headers() {
		return [{ source: "/:path*", headers: SECURITY_HEADERS }];
	},
};

export default nextConfig;
