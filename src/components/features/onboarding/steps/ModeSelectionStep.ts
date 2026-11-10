import { t } from "@/translations/helper";
import {
	SelectableCard,
	SelectableCardConfig,
} from "@/components/features/onboarding/ui/SelectableCard";
import { OnboardingController } from "@/components/features/onboarding/OnboardingController";
import { Alert } from "@/components/features/onboarding/ui/Alert";
// Preview images are embedded into the bundle (esbuild dataurl loader) so the
// onboarding screen never fetches them from the network.
import fluentPreviewDark from "../../../../../media/fluent.png";
import fluentPreviewLight from "../../../../../media/fluent-light.png";
import legacyPreviewDark from "../../../../../media/legacy.png";
import legacyPreviewLight from "../../../../../media/legacy-light.png";

export type UIMode = "fluent" | "legacy";

/**
 * Mode Selection Step - Choose between Fluent and Legacy UI
 */
export class ModeSelectionStep {
	/**
	 * Render the mode selection step
	 */
	static render(
		headerEl: HTMLElement,
		contentEl: HTMLElement,
		controller: OnboardingController,
	) {
		// Clear
		headerEl.empty();
		contentEl.empty();

		headerEl.toggleClass("intro-typing-wrapper", true);
		contentEl.toggleClass("intro-typing-wrapper", true);

		// Intro guidance text (same as intro-line-4)
		headerEl.createEl("p", {
			cls: "intro-line intro-line-4",
			text: t(
				"In the current version, Task Genius provides a brand new visual and interactive experience: Fluent; while also providing the option to return to the previous interface. Which one do you prefer?",
			),
		});

		// Get current state
		const currentMode = controller.getState().uiMode;

		// Create cards configuration
		const cardConfigs: SelectableCardConfig<UIMode>[] = [
			{
				id: "fluent",
				title: t("Fluent"),
				subtitle: t("Modern & Sleek"),
				description: t(
					"New visual design with elegant animations and modern interactions",
				),
				preview: this.createFluentPreview(),
			},
			{
				id: "legacy",
				title: t("Legacy"),
				subtitle: t("Classic & Familiar"),
				description: t(
					"Keep the familiar interface and interaction style you know",
				),
				preview: this.createLegacyPreview(),
			},
		];

		// Render selectable cards
		const card = new SelectableCard<UIMode>(
			contentEl,
			cardConfigs,
			{
				containerClass: "selectable-cards-container",
				cardClass: "selectable-card",
				showPreview: true,
			},
			(mode) => {
				controller.setUIMode(mode);
			},
		);

		// Set initial selection
		if (currentMode) {
			card.setSelected(currentMode);
		}

		// Add info alert
		Alert.create(
			contentEl,
			t("You can change this option later in interface settings"),
			{
				variant: "info",
				className: "mode-selection-tip",
			},
		);
	}

	/**
	 * Create Fluent mode preview
	 */
	private static createFluentPreview(): HTMLElement {
		const preview = createDiv({
			cls: ["mode-preview", "mode-preview-fluent"],
		});

		// Check theme
		const isDark = document.body.classList.contains("theme-dark");
		const imageUrl = isDark ? fluentPreviewDark : fluentPreviewLight;

		const img = preview.createEl("img", {
			attr: {
				src: imageUrl,
				alt: "Fluent mode preview",
			},
		});
		img.style.maxWidth = "100%";
		img.style.maxHeight = "100%";
		img.style.objectFit = "contain";
		img.style.borderRadius = "4px";

		return preview;
	}

	/**
	 * Create Legacy mode preview
	 */
	private static createLegacyPreview(): HTMLElement {
		const preview = createDiv({
			cls: ["mode-preview", "mode-preview-legacy"],
		});

		// Check theme
		const isDark = document.body.classList.contains("theme-dark");
		const imageUrl = isDark ? legacyPreviewDark : legacyPreviewLight;

		const img = preview.createEl("img", {
			attr: {
				src: imageUrl,
				alt: "Legacy mode preview",
			},
		});
		img.style.maxWidth = "100%";
		img.style.maxHeight = "100%";
		img.style.objectFit = "contain";
		img.style.borderRadius = "4px";

		return preview;
	}
}
