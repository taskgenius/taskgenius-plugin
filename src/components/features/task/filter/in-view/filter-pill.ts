import { t as settingsText } from "@/translations/helper";
import { Component, ExtraButtonComponent } from "obsidian";
import { ActiveFilter, FilterPillOptions } from "./filter-type";

export class FilterPill extends Component {
	private filter: ActiveFilter;
	private onRemove: (id: string) => void;
	public element: HTMLElement; // Made public for parent access

	constructor(options: FilterPillOptions) {
		super();
		this.filter = options.filter;
		this.onRemove = options.onRemove;
	}

	override onload(): void {
		this.element = this.createPillElement();
	}

	private createPillElement(): HTMLElement {
		// Create the main pill container
		const pill = document.createElement("div");
		pill.className = "filter-pill";
		pill.setAttribute("data-filter-id", this.filter.id);

		// Create and append category label span
		pill.createSpan({
			cls: "filter-pill-category",
			text: `${this.filter.categoryLabel}:`, // Add colon here
		});

		// Create and append value span
		pill.createSpan({
			cls: "filter-pill-value",
			text: this.filter.value,
		});

		// Create the remove button
		const removeButton = pill.createEl("span", {
			cls: "filter-pill-remove",
			attr: { "aria-label": settingsText("Remove filter") },
		});

		// Create and append the remove icon span inside the button
		removeButton.createSpan(
			{
				cls: "filter-pill-remove-icon",
			},
			(el) => {
				new ExtraButtonComponent(el).setIcon("x").onClick(() => {
					this.removePill();
				});
			}
		);

		return pill;
	}

	private removePill(): void {
		// Animate removal
		this.element.classList.add("filter-pill-removing");

		// Use Obsidian's Component lifecycle to handle removal after animation
		setTimeout(() => {
			this.onRemove(this.filter.id); // Notify parent
			// Parent component should handle removing this child component
		}, 150);
	}
}
