import { t } from "@/translations/helper";

/**
 * Transition message - Shows friendly confirmation after mode selection
 */
export class TransitionMessage {
	private container: HTMLElement;
	private timer?: number;

	constructor(container: HTMLElement, message: string, delay = 0) {
		this.container = container;
		this.show(message, delay);
	}

	/**
	 * Show transition message with fade-in animation
	 */
	private show(message: string, delay: number) {
		const messageEl = this.container.createDiv({
			cls: "intro-transition-message",
		});

		// Start hidden
		messageEl.style.opacity = "0";
		messageEl.style.transform = "translateY(10px)";

		// Create icon
		const icon = messageEl.createSpan({
			cls: "transition-icon",
			text: "✨",
		});

		// Create text
		messageEl.createSpan({
			cls: "transition-text",
			text: message,
		});

		// Fade in after delay
		if (delay > 0) {
			this.timer = window.setTimeout(() => {
				messageEl.style.opacity = "1";
				messageEl.style.transform = "translateY(0)";
			}, delay);
		} else {
			// Immediate fade in
			requestAnimationFrame(() => {
				messageEl.style.opacity = "1";
				messageEl.style.transform = "translateY(0)";
			});
		}
	}

	/**
	 * Cleanup
	 */
	cleanup() {
		if (this.timer) {
			window.clearTimeout(this.timer);
		}
	}

	/**
	 * Get appropriate message based on mode and user state
	 */
	static getMessage(mode: "fluent" | "legacy", hasChanges: boolean): string {
		if (hasChanges) {
			return mode === "fluent"
				? t(
						"Nice choice! We noticed you've customized Task Genius. Let's make sure your settings are preserved."
				  )
				: t(
						"Got it! We'll help you keep your existing customizations while setting up the classic interface."
				  );
		}

		return mode === "fluent"
			? t(
					"Excellent! Let's set up your modern workspace with the Fluent interface."
			  )
			: t(
					"Perfect! Let's configure Task Genius with the familiar classic interface."
			  );
	}
}
