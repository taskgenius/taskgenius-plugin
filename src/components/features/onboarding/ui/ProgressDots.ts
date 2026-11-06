export interface ProgressDotsOptions {
	containerClass?: string;
	dotClass?: string;
	showLabels?: boolean;
}

/**
 * Progress dots component for step indication
 * Shows current progress through onboarding steps
 */
export class ProgressDots {
	private container: HTMLElement;
	private totalSteps: number;
	private currentStep = 0;
	private dots: HTMLElement[] = [];
	private labels?: string[];

	constructor(
		container: HTMLElement,
		totalSteps: number,
		labels?: string[],
		options: ProgressDotsOptions = {}
	) {
		this.container = container;
		this.totalSteps = totalSteps;
		this.labels = labels;
		this.render(options);
	}

	private render(options: ProgressDotsOptions) {
		const {
			containerClass = "progress-dots",
			dotClass = "progress-dot",
			showLabels = false,
		} = options;

		const dotsContainer = this.container.createDiv({
			cls: containerClass,
		});

		for (let i = 0; i < this.totalSteps; i++) {
			const dotWrapper = dotsContainer.createDiv({
				cls: `${dotClass}-wrapper`,
			});

			const dot = dotWrapper.createDiv({
				cls: dotClass,
			});

			// Add label if provided
			if (showLabels && this.labels && this.labels[i]) {
				dotWrapper.createEl("span", {
					text: this.labels[i],
					cls: `${dotClass}-label`,
				});
			}

			this.dots.push(dot);
		}
	}

	/**
	 * Set current step
	 */
	setStep(step: number) {
		if (step < 0 || step >= this.totalSteps) return;

		// Remove active from previous
		if (this.currentStep < this.dots.length) {
			this.dots[this.currentStep].removeClass("is-active");
		}

		// Set new step
		this.currentStep = step;
		this.dots[step].addClass("is-active");

		// Mark completed steps
		this.dots.forEach((dot, index) => {
			if (index < step) {
				dot.addClass("is-completed");
				dot.removeClass("is-active");
			} else if (index === step) {
				dot.addClass("is-active");
				dot.removeClass("is-completed");
			} else {
				dot.removeClass("is-active");
				dot.removeClass("is-completed");
			}
		});
	}

	/**
	 * Get current step
	 */
	getStep(): number {
		return this.currentStep;
	}
}
