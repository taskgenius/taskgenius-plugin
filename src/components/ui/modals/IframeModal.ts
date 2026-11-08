import { t as settingsText } from "@/translations/helper";
import { App, Modal, setIcon } from "obsidian";

export class IframeModal extends Modal {
	private url: string;
	private title?: string;

	constructor(app: App, url: string, title?: string) {
		super(app);
		this.url = url;
		this.title = title;
	}

	onOpen() {
		if (this.title) {
			this.titleEl.setText(this.title);
		}

		// Add external link button to header
		const headerActions = this.titleEl;
		if (headerActions) {
			const externalLinkBtn = headerActions.createEl('button', {
				cls: 'clickable-icon task-genius-external-link-btn',
				attr: {
					'aria-label': settingsText('Open in external browser'),
					'title': settingsText('Open in external browser')
				}
			});
			
			// Add icon using Obsidian's setIcon
			setIcon(externalLinkBtn, 'external-link');
			
			externalLinkBtn.addEventListener('click', () => {
				window.open(this.url, '_blank');
			});
		}

		const { contentEl } = this;
		this.modalEl.toggleClass("task-genius-iframe-modal", true);
		contentEl.empty();

		const container = contentEl.createDiv({ cls: "iframe-modal-container" });
		container.setAttr("style", "width: 100%; height: 80vh; display: flex;");

		const iframe = container.createEl("iframe");
		iframe.setAttr("src", this.url);
		iframe.setAttr("style", "flex: 1; border: none; width: 100%; height: 100%;");
	}

	onClose() {
		this.contentEl.empty();
	}
}

