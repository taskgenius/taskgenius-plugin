import { App, Modal, Setting } from "obsidian";
import { t } from "../i18n";

/** Options for a simple confirm/cancel dialog. */
export interface ConfirmOptions {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	/** Style the confirm button as a destructive action. */
	danger?: boolean;
	onConfirm: () => void | Promise<void>;
}

/** A reusable confirmation dialog with a cancel and a confirm button. */
export class ConfirmModal extends Modal {
	static ask(app: App, title: string, message: string): Promise<boolean> {
		return new Promise(resolve => {
			let accepted = false;
			const modal = new ConfirmModal(app, {title, message, onConfirm: () => { accepted = true; resolve(true); }});
			const close = modal.onClose.bind(modal);
			modal.onClose = () => { close(); queueMicrotask(() => { if (!accepted) resolve(false); }); };
			modal.open();
		});
	}
	constructor(
		app: App,
		private options: ConfirmOptions,
	) {
		super(app);
		this.modalEl.addClass("tg-habits-surface");
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl).setName(this.options.title).setHeading();
		contentEl.createEl("p", { text: this.options.message });

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText(this.options.cancelText ?? t("Cancel"))
					.onClick(() => this.close()),
			)
			.addButton((button) => {
				button
					.setButtonText(this.options.confirmText ?? t("Confirm"))
					.onClick(async () => {
						this.close();
						await this.options.onConfirm();
					});
				if (this.options.danger) {
					button.buttonEl.addClass("mod-warning");
				} else {
					button.setCta();
				}
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
