import { t } from "../i18n";
import { Modal, setIcon } from "obsidian";
/** Own a predictable close control rather than depending on theme/native header variants. */
export function installHabitClose(modal: Modal): () => void {
	const native = modal.modalEl.querySelector<HTMLElement>(".modal-close-button, .modal-header-button");
	const button = modal.modalEl.createEl("button", { cls: "clickable-icon tg-habit-modal-close", attr: { type: "button", "aria-label": t("Close") } });
	setIcon(button, "x");
	const close = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); Modal.prototype.close.call(modal); };
	button.addEventListener("click", close, true);
	button.addEventListener("pointerup", close, true);
	native?.addEventListener("click", close, true);
	native?.addEventListener("pointerup", close, true);
	return () => { button.removeEventListener("pointerup", close, true); native?.removeEventListener("pointerup", close, true); native?.removeEventListener("click", close, true); button.removeEventListener("click", close, true); button.remove(); };
}
