import { App, setIcon } from "obsidian";
import { t } from "@/translations/helper";
/** Folder rows are navigation groups, never synthetic project records. */
export function projectFolderContainer(root: HTMLElement, app: App): (folder: string) => HTMLElement {
	const containers = new Map<string, HTMLElement>([["", root]]);
	const collapsed = new Set<string>(app.loadLocalStorage("task-genius-project-folders-collapsed") || []);
	const get = (path: string): HTMLElement => {
		if (containers.has(path)) return containers.get(path)!;
		const segments = path.split("/"), name = segments.pop()!, parent = get(segments.join("/"));
		const group = parent.createDiv({ cls: "tg-project-folder", attr: { "data-folder": path } });
		const header = group.createEl("button", { cls: "tg-project-folder-row", attr: { "aria-expanded": String(!collapsed.has(path)) } });
		const arrow = header.createSpan(); setIcon(arrow, collapsed.has(path) ? "chevron-right" : "chevron-down"); setIcon(header.createSpan(), "folder"); header.createSpan({ text: name });
		const body = group.createDiv({ cls: "tg-project-folder-children" }); body.hidden = collapsed.has(path);
		header.onclick = event => { event.stopPropagation(); body.hidden = !body.hidden; if (body.hidden) collapsed.add(path); else collapsed.delete(path); header.setAttribute("aria-expanded", String(!body.hidden)); setIcon(arrow, body.hidden ? "chevron-right" : "chevron-down"); app.saveLocalStorage("task-genius-project-folders-collapsed", [...collapsed]); };
		containers.set(path, body); return body;
	};
	return get;
}
