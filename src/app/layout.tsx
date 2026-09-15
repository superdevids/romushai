import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { BRAND, BRAND_TAGLINE } from "@/lib/brand";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jbmono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: `${BRAND} - ${BRAND_TAGLINE}`,
  description: "Masukkan ide project - dapatkan paket PRD master, dokumen teknis, dan task list dalam Bahasa Indonesia.",
  openGraph: {
    title: `${BRAND} - ${BRAND_TAGLINE}`,
    description: "Masukkan ide project - dapatkan paket PRD master, dokumen teknis, dan task list dalam Bahasa Indonesia.",
    type: "website",
    locale: "id_ID",
  },
  twitter: {
    card: "summary",
    title: `${BRAND} - ${BRAND_TAGLINE}`,
    description: "Masukkan ide project - dapatkan paket PRD master, dokumen teknis, dan task list dalam Bahasa Indonesia.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A1410",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${jakarta.variable} ${jbmono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* Theme init: default SELALU dark. localStorage dipakai hanya bila user pernah memilih (agar toggle tetap berfungsi).
          Harus di dalam <head> agar valid sebagai anak <html> dan tidak memicu error hydration. */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('aiprd-theme');var d=t?t==='dark':true;document.documentElement.classList.toggle('dark',d);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
