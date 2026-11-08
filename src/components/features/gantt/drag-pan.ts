import type { Component } from "obsidian";

/** Drag empty chart space to pan; project bars keep their date-edit gesture. */
export function registerGanttPan(owner: Component, container: HTMLElement): void {
	let cancel: (() => void) | undefined;
	owner.registerDomEvent(container, "pointerdown", event => {
		if (event.button !== 0 || (event.target as Element).closest(".gantt-task-item,button,input")) return;
		cancel?.(); event.preventDefault();
		const x = event.clientX, y = event.clientY, left = container.scrollLeft, top = container.scrollTop;
		const doc = container.ownerDocument;
		container.addClass("is-panning");
		const move = (next: PointerEvent) => { container.scrollLeft = left - (next.clientX - x); container.scrollTop = top - (next.clientY - y); };
		const end = () => { doc.removeEventListener("pointermove", move); doc.removeEventListener("pointerup", end); doc.removeEventListener("pointercancel", end); doc.defaultView?.removeEventListener("blur", end); container.removeClass("is-panning"); cancel = undefined; };
		cancel = end;
		doc.addEventListener("pointermove", move); doc.addEventListener("pointerup", end); doc.addEventListener("pointercancel", end); doc.defaultView?.addEventListener("blur", end);
	});
	owner.register(() => cancel?.());
}
