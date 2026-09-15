"use client";

import { LogoMark, Wordmark } from "./BrandLogo";
import { ComposerCard } from "./Composer";

const HERO_TAGLINE = {
	main: "Ada ide brilian tapi masih berantakan? Buat di sini - Cetak jadi blueprint siap pakai ke AI Agent terbaikmu.",
};
const SAMPLE_CHIPS = ["Buatkan website toko online untuk UMKM jual snack rumahan. Fitur: katalog produk dengan foto dan harga, keranjang belanja, dan tombol pesan via WhatsApp dengan pesan otomatis berisi detail pesanan.", "Buatkan sistem kasir berbasis web untuk UMKM. Fitur yang dibutuhkan: input penjualan harian, manajemen stok sederhana, laporan penjualan harian/mingguan, dan cetak struk sederhana.", "Buatkan aplikasi pencatatan keuangan sederhana untuk UMKM. Fitur: catat pemasukan dan pengeluaran harian, kategori pengeluaran (bahan baku, operasional, dll), dan laporan laba-rugi bulanan dalam tampilan yang mudah dipahami."];

export function Hero({ subBrand, idea, onChange, onSubmit, busy, onPick }: { subBrand: string; idea: string; onChange: (v: string) => void; onSubmit: () => void; busy: boolean; onPick: (t: string) => void }) {
	return (
		<div className="relative flex min-h-[calc(100dvh-56px)] flex-col items-center justify-center overflow-hidden px-3 py-8">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-60"
				style={{
					background: "radial-gradient(560px 300px at 50% 10%, var(--hero-glow), transparent 70%)",
				}}
			/>
			<div className="flex w-full max-w-3xl flex-col items-center gap-4">
				<div className="flex flex-col items-center gap-2 text-center">
					<LogoMark size={48} />
					<Wordmark
						size="hero"
						subBrand={subBrand}
					/>
					<div className="flex flex-col items-center gap-1">
						<p className="max-w-[500px] text-[13px] leading-5 font-medium text-[var(--fg-muted)] sm:text-[14px]">{HERO_TAGLINE.main}</p>
					</div>
				</div>

				<div className="flex flex-col w-full gap-2">
					<ComposerCard
						idea={idea}
						onChange={onChange}
						onSubmit={onSubmit}
						busy={busy}
					/>
					<span className={`text-[12px] text-center text-[var(--fg-muted)] font-semibold`}>Romushai bisa membuat kesalahan. Harap periksa kembali respons yang diberikan.</span>
				</div>
				<div className="flex w-full max-w-3xl flex-col items-center gap-2">
					<span className="text-[11px] font-medium tracking-wide text-[var(--fg-faint)]">Coba salah satu contoh:</span>
					<ul
						aria-label="Contoh ide project"
						className="flex w-full list-none flex-col items-center gap-2 p-0 sm:flex-wrap sm:flex-row sm:justify-center"
					>
						{SAMPLE_CHIPS.map((s) => (
							<li
								key={s}
								className="w-full sm:w-3/7"
							>
								<button
									type="button"
									onClick={() => onPick(s)}
									title={s}
									aria-label={s}
									className="w-full truncate rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 min-h-[36px] text-xs font-medium text-[var(--fg-muted)] transition-colors duration-[var(--dur-fast)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
								>
									{s}
								</button>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}
