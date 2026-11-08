/**
 * Resolve a CSS colour (including `var(...)` references and a habit's own
 * accent) to a concrete `rgb(...)` value Chart.js can use. `root` anchors the
 * probe element to the right document/window (relevant for popout windows).
 */
export function resolveColor(
	root: HTMLElement,
	preferred: string,
	fallback: string,
): string {
	const probe = root.doc.body.createSpan();
	probe.style.color = preferred || fallback;
	const resolved = probe.win.getComputedStyle(probe).color;
	probe.remove();
	return resolved || "#888888";
}

/** Apply an alpha channel to an `rgb(r, g, b)` colour string. */
export function withAlpha(color: string, alpha: number): string {
	const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
	if (!match) {
		return color;
	}
	return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
}

/**
 * Perceptual brightness of an `rgb()`/`rgba()` colour, 0 (darkest) to 255
 * (lightest), via the fast "YIQ" approximation. Alpha is ignored — this
 * reads the colour's own hue and lightness, not how transparent it is.
 * Returns `null` when `color` isn't a parseable rgb(a) string (e.g. a
 * keyword like `"transparent"`).
 */
function brightness(color: string): number | null {
	const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
	if (!match) {
		return null;
	}
	const [, r, g, b] = match.map(Number);
	return (r * 299 + g * 587 + b * 114) / 1000;
}

/**
 * Pick whichever of near-white or near-black reads more clearly against
 * both `fill` (what's drawn under the border) and `surrounding` (what's
 * drawn around it — the page behind the gaps between cells/bars). Contrast
 * against the fill alone isn't enough: a pale fill wants a dark border for
 * contrast against *it*, but if the page itself is dark, that same dark
 * border disappears into the gap right next to it. Picking whichever of
 * white/black has the better *worst-case* contrast against the two (not
 * just the fill) keeps the border visible against both at once. Unparsable
 * colours (e.g. `"transparent"`) are treated as a neutral middle grey.
 */
export function contrastColor(fill: string, surrounding: string): string {
	const fillB = brightness(fill) ?? 128;
	const surroundB = brightness(surrounding) ?? 128;
	const whiteContrast = Math.min(255 - fillB, 255 - surroundB);
	const blackContrast = Math.min(fillB, surroundB);
	return whiteContrast >= blackContrast ? "#fafafa" : "#1a1a1a";
}
