import { Component, setIcon } from "obsidian";

export class WidgetShell extends Component {
	public containerEl: HTMLElement;
	public headerEl: HTMLElement;
	public titleEl: HTMLElement;
	public actionsEl: HTMLElement;
	public bodyEl: HTMLElement;

	private linkButtonEl?: HTMLElement;
	private linked = false;
	private onToggleLinked?: (linked: boolean) => void;

	constructor(
		parentEl: HTMLElement,
		opts: {
			title: string;
			linkable?: boolean;
			linked?: boolean;
			onToggleLinked?: (linked: boolean) => void;
		},
	) {
		super();

		this.containerEl = parentEl.createDiv({ cls: "tg-widget-shell" });
		this.headerEl = this.containerEl.createDiv({ cls: "tg-widget-header" });
		this.titleEl = this.headerEl.createDiv({
			cls: "tg-widget-title",
			text: opts.title,
		});
		this.actionsEl = this.headerEl.createDiv({ cls: "tg-widget-actions" });
		this.bodyEl = this.containerEl.createDiv({ cls: "tg-widget-body" });

		this.linked = opts.linked ?? false;
		this.onToggleLinked = opts.onToggleLinked;

		if (opts.linkable) {
			this.linkButtonEl = this.actionsEl.createDiv({
				cls: "tg-widget-link-toggle",
			});
			this.registerDomEvent(this.linkButtonEl, "click", () => {
				this.setLinked(!this.linked);
				this.onToggleLinked?.(this.linked);
			});
			this.renderLinkIcon();
		}
	}

	setTitle(title: string): void {
		this.titleEl.setText(title);
	}

	setLinked(linked: boolean): void {
		if (this.linked === linked) {
			return;
		}
		this.linked = linked;
		this.renderLinkIcon();
		this.containerEl.toggleClass("tg-widget-linked", linked);
		this.containerEl.toggleClass("tg-widget-unlinked", !linked);
	}

	getLinked(): boolean {
		return this.linked;
	}

	private renderLinkIcon(): void {
		if (!this.linkButtonEl) {
			return;
		}
		this.linkButtonEl.setAttr(
			"aria-label",
			this.linked
				? "Linked to global filter"
				: "Unlinked from global filter",
		);
		// this.linkButtonEl.setAttr("title", this.linked ? "Linked" : "Unlinked");
		this.linkButtonEl.empty();
		setIcon(this.linkButtonEl, this.linked ? "link" : "unlink");
	}
}
