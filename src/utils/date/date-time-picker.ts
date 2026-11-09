/** Native date and optional time controls share the validated text model used by parsers. */
export function attachDateTimePicker(input: HTMLInputElement, label: string): void {
	const wrapper = input.ownerDocument.createElement("div"); wrapper.className = "tg-date-time-picker";
	input.after(wrapper); input.hidden = true;
	const date = input.ownerDocument.createElement("input"); date.type = "date"; date.setAttribute("aria-label", label); wrapper.appendChild(date);
	const time = input.ownerDocument.createElement("input"); time.type = "time"; time.setAttribute("aria-label", label + " (HH:mm)"); wrapper.appendChild(time);
	const sync = () => { const match = input.value.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/); date.value = match?.[1] || ""; time.value = match?.[2] || ""; time.disabled = !date.value; };
	const update = () => { if (!date.value) time.value = ""; input.value = date.value ? date.value + (time.value ? " " + time.value : "") : ""; input.dispatchEvent(new (input.ownerDocument.defaultView!.Event)("input", { bubbles: true })); input.dispatchEvent(new (input.ownerDocument.defaultView!.Event)("change", { bubbles: true })); sync(); };
	date.addEventListener("change", update); time.addEventListener("change", update);
	input.addEventListener("change", sync); input.addEventListener("tg-date-updated", sync); sync();
}
