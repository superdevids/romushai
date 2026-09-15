import Link from "next/link";
import { ArrowRight, FileText, Languages, MessagesSquare, ShieldCheck } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/BrandLogo";
import { BRAND, BRAND_TAGLINE } from "@/lib/brand";

// SUB_BRAND="" membuat Wordmark menampilkan nama brand lengkap (Romushai),
// berbeda dari /prd yang memakai subBrand="PRD".
const SUB_BRAND = "";

const FEATURES = [
	{
		icon: FileText,
		title: "Dokumen Lengkap",
		desc: "PRD master, dokumen teknis, dan task list siap pakai dalam satu paket.",
	},
	{
		icon: Languages,
		title: "Bahasa Indonesia",
		desc: "Seluruh keluaran ditulis dalam Bahasa Indonesia baku dan mudah dibaca.",
	},
	{
		icon: MessagesSquare,
		title: "Streaming Langsung",
		desc: "Proses generate terlihat bertahap, jadi Anda tahu tahap yang sedang berjalan.",
	},
	{
		icon: ShieldCheck,
		title: "Audit Red-Team",
		desc: "Setiap dokumen melewati peninjauan ulang untuk menutup celah dan risiko.",
	},
];

export default function RootPage() {
	return (
		<div className="relative isolate flex min-h-[100dvh] flex-col bg-[var(--bg)]">
			<div
				className="landing-grid absolute inset-0 -z-10 pointer-events-none"
				aria-hidden="true"
			/>

			<header
				role="banner"
				className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-[var(--border)] bg-[var(--bg)]/80 px-3 backdrop-blur"
			>
				<div className="flex min-w-0 items-center gap-2">
					<LogoMark size={26} />
					<Wordmark
						size="header"
						subBrand={SUB_BRAND}
					/>
				</div>
				<Link
					href="/prd"
					className="flex h-8 min-h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[11px] font-medium transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-hover)] sm:text-xs"
				>
					Buka Generator
					<ArrowRight
						className="size-3.5"
						aria-hidden="true"
					/>
				</Link>
			</header>

			<main className="flex flex-1 flex-col">
				<h1 className="sr-only">
					{BRAND} - {BRAND_TAGLINE}
				</h1>
				<section className="relative flex min-h-[calc(100dvh-48px)] flex-col items-center justify-center overflow-hidden px-3 py-8 text-center">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-60"
						style={{
							background: "radial-gradient(560px 300px at 50% 10%, var(--hero-glow), transparent 70%)",
						}}
					/>
					<LogoMark size={64} />
					<div className="mt-2">
						<Wordmark
							size="hero"
							subBrand={SUB_BRAND}
						/>
					</div>
					<p className="mt-3 text-[13px] font-semibold tracking-wide text-[var(--fg-muted)] sm:text-sm">{BRAND_TAGLINE}</p>
					<Link
						href="/prd"
						className="mt-6 flex h-10 min-h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-600)] bg-[var(--accent-600)] px-4 text-[13px] font-semibold text-[var(--on-accent)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--accent)]"
					>
						Mulai Buat PRD
						<ArrowRight
							className="size-3.5"
							aria-hidden="true"
						/>
					</Link>
					<p className="mt-2 text-[11px] text-[var(--fg-faint)]">Gratis, tanpa perlu pendaftaran akun.</p>
				</section>

				<section
					aria-label="Fitur utama"
					className="mx-auto w-full max-w-7xl px-3 pb-10 sm:pb-14"
				>
					<h2 className="mb-3 text-center text-[11px] font-semibold tracking-wide text-[var(--fg-faint)] uppercase">Yang Anda dapatkan</h2>
					<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
						{FEATURES.map((f) => (
							<li
								key={f.title}
								className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)]"
							>
								<span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent-600)]">
									<f.icon
										className="size-4"
										aria-hidden="true"
									/>
								</span>
								<span className="flex min-w-0 flex-col gap-1">
									<span className="text-[13px] leading-tight font-semibold text-[var(--fg)]">{f.title}</span>
									<span className="text-[12px] leading-5 text-[var(--fg-muted)]">{f.desc}</span>
								</span>
							</li>
						))}
					</ul>
				</section>
			</main>

			<footer className="border-t border-[var(--border)] px-3 py-4">
				<div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-1.5 px-3 text-center sm:flex-row sm:justify-between sm:text-left">
					<p className="text-[12px] font-medium text-[var(--fg-muted)]">
						&copy; {BRAND} - {BRAND_TAGLINE} - {new Date().getFullYear()}
					</p>
					<p className="text-[12px] text-[var(--fg-faint)]">Hasil dokumen dapat mengandung kesalahan, mohon periksa kembali sebelum dipakai.</p>
				</div>
			</footer>
		</div>
	);
}
