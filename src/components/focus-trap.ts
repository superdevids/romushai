// Util bersama focus trap untuk dialog client (HistoryDrawer + PreviewModal).
// Komentar Bahasa Indonesia, string ASCII-only.
// Dipilih di src/components agar bulkhead src/lib/prd tetap tak tersentuh.

/** Selektor elemen yang bisa difokus via keyboard. */
export const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Kumpulkan elemen fokusable yang terlihat di dalam root. */
export function getFocusable(root: HTMLElement): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		(el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
	);
}

/** Trap Tab di dalam panel; Shift+Tab balik ke elemen terakhir. */
export function trapTab(e: KeyboardEvent, panel: HTMLElement | null): void {
	if (e.key !== "Tab" || !panel) return;
	const items = getFocusable(panel);
	if (items.length === 0) return;
	const first = items[0];
	const last = items[items.length - 1];
	const active = document.activeElement;
	if (e.shiftKey && (active === first || !panel.contains(active))) {
		e.preventDefault();
		last.focus();
	} else if (!e.shiftKey && (active === last || !panel.contains(active))) {
		e.preventDefault();
		first.focus();
	}
}
