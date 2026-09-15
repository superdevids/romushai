"use client";

import { useId } from "react";
import { BRAND } from "@/lib/brand";

export function LogoMark({ size }: { size: number }) {
	const gradId = useId().replace(/:/g, "");
	return (
		<span
			aria-hidden="true"
			className="logo-bob group-hover:[animation-play-state:paused] relative inline-flex shrink-0"
		>
			<svg
				width={size}
				height={size}
				viewBox="0 0 56 56"
				className="block"
			>
				<defs>
					<linearGradient
						id={gradId}
						x1="0"
						y1="0"
						x2="1"
						y2="1"
					>
						<stop
							offset="0%"
							stopColor="#FF9A5B"
						/>
						<stop
							offset="100%"
							stopColor="#F9622B"
						/>
					</linearGradient>
				</defs>
				<rect
					x="2"
					y="2"
					width="52"
					height="52"
					rx="26"
					fill={`url(#${gradId})`}
				/>
				<path
					d="M18 38 C20 30 26 26 38 22"
					stroke="#FFFFFF"
					strokeOpacity=".85"
					strokeWidth="3.5"
					strokeLinecap="round"
					fill="none"
				/>
				<path
					d="M30 40 C31 34 34 30 38 27"
					stroke="#FFFFFF"
					strokeOpacity=".85"
					strokeWidth="3.5"
					strokeLinecap="round"
					fill="none"
				/>
				<path
					d="M44 12 L45.6 18.4 L52 20 L45.6 21.6 L44 28 L42.4 21.6 L36 20 L42.4 18.4 Z"
					fill="var(--logo-spark)"
					className="twinkle"
				/>
			</svg>
		</span>
	);
}

export function Wordmark({ size, onClick, subBrand }: { size: "header" | "hero"; onClick?: () => void; subBrand: string }) {
	const cls = `items-baseline leading-none tracking-[-0.03em] ${size === "hero" ? "text-[34px] sm:text-[44px]" : "text-lg"}`;
	const inner = (
		<>
			<span className="font-extrabold text-[var(--fg)]">{subBrand === "" ? "Romush" : BRAND}</span>
			<span className="font-extrabold text-[var(--wordmark-accent)]">{subBrand === "" ? "ai" : subBrand}</span>
		</>
	);
	if (!onClick) {
		return <span className={`flex ${cls}`}>{inner}</span>;
	}
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={BRAND}
			className={`flex ${cls}`}
		>
			{inner}
		</button>
	);
}
