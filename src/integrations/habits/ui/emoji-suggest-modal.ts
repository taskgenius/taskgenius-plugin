import { App, FuzzyMatch, FuzzySuggestModal } from "obsidian";
import { t } from "../i18n";

/** A selectable emoji with a searchable name and keywords. */
interface EmojiEntry {
	emoji: string;
	name: string;
	keywords: string;
}

/** A curated set of emojis that suit common habits. */
const EMOJIS: readonly EmojiEntry[] = [
	{ emoji: "💧", name: "Droplet", keywords: "water drink hydrate" },
	{ emoji: "🥛", name: "Glass of milk", keywords: "milk drink glass" },
	{ emoji: "☕", name: "Coffee", keywords: "coffee drink caffeine" },
	{ emoji: "🍵", name: "Tea", keywords: "tea drink" },
	{ emoji: "🧃", name: "Juice", keywords: "juice drink" },
	{ emoji: "🥤", name: "Cup", keywords: "cup drink soda" },
	{ emoji: "🍎", name: "Apple", keywords: "apple fruit food healthy" },
	{ emoji: "🥦", name: "Broccoli", keywords: "broccoli vegetable veggies food" },
	{ emoji: "🥕", name: "Carrot", keywords: "carrot vegetable food" },
	{ emoji: "🥗", name: "Salad", keywords: "salad food healthy" },
	{ emoji: "🍳", name: "Cooking", keywords: "cook food breakfast egg" },
	{ emoji: "🍫", name: "Chocolate", keywords: "chocolate sweet sugar treat" },
	{ emoji: "🍬", name: "Sweets", keywords: "candy sugar sweet" },
	{ emoji: "🚭", name: "No smoking", keywords: "smoking quit cigarette" },
	{ emoji: "🍺", name: "Beer", keywords: "beer alcohol drink" },
	{ emoji: "🍷", name: "Wine", keywords: "wine alcohol drink" },
	{ emoji: "🏃", name: "Running", keywords: "run running exercise cardio jog" },
	{ emoji: "🚶", name: "Walking", keywords: "walk walking steps" },
	{ emoji: "👟", name: "Trainers", keywords: "shoe run walk steps" },
	{ emoji: "🥾", name: "Hiking", keywords: "hike boot walk outdoors" },
	{ emoji: "🏋️", name: "Weights", keywords: "gym lift weights strength workout" },
	{ emoji: "💪", name: "Muscle", keywords: "muscle strength gym workout" },
	{ emoji: "🧘", name: "Meditation", keywords: "meditate yoga calm mindful" },
	{ emoji: "🤸", name: "Stretching", keywords: "stretch gymnastics flexible" },
	{ emoji: "🚴", name: "Cycling", keywords: "bike cycle cycling ride" },
	{ emoji: "🏊", name: "Swimming", keywords: "swim swimming pool" },
	{ emoji: "⚽", name: "Football", keywords: "football soccer sport" },
	{ emoji: "🏀", name: "Basketball", keywords: "basketball sport" },
	{ emoji: "🎾", name: "Tennis", keywords: "tennis sport" },
	{ emoji: "🥊", name: "Boxing", keywords: "boxing sport fight" },
	{ emoji: "🧗", name: "Climbing", keywords: "climb climbing bouldering" },
	{ emoji: "🏆", name: "Trophy", keywords: "trophy win achieve goal" },
	{ emoji: "💊", name: "Pill", keywords: "pill medicine vitamins tablet" },
	{ emoji: "🩺", name: "Health", keywords: "health doctor medical" },
	{ emoji: "🦷", name: "Tooth", keywords: "tooth floss teeth dental brush" },
	{ emoji: "🪥", name: "Toothbrush", keywords: "toothbrush brush teeth" },
	{ emoji: "🛌", name: "Sleep", keywords: "sleep bed rest night" },
	{ emoji: "😴", name: "Sleepy", keywords: "sleep tired rest nap" },
	{ emoji: "🚿", name: "Shower", keywords: "shower wash clean cold" },
	{ emoji: "🛁", name: "Bath", keywords: "bath wash relax" },
	{ emoji: "🧼", name: "Soap", keywords: "soap wash clean hygiene" },
	{ emoji: "🧴", name: "Skincare", keywords: "lotion skincare cream" },
	{ emoji: "📖", name: "Reading", keywords: "book read reading study" },
	{ emoji: "📚", name: "Books", keywords: "books study read learn" },
	{ emoji: "✍️", name: "Writing", keywords: "write writing journal" },
	{ emoji: "📝", name: "Notes", keywords: "notes memo write journal" },
	{ emoji: "✏️", name: "Pencil", keywords: "pencil draw write" },
	{ emoji: "🧠", name: "Brain", keywords: "brain mind think learn" },
	{ emoji: "💻", name: "Laptop", keywords: "laptop work code computer" },
	{ emoji: "📅", name: "Calendar", keywords: "calendar plan schedule" },
	{ emoji: "⏰", name: "Alarm", keywords: "alarm clock wake early" },
	{ emoji: "⏳", name: "Hourglass", keywords: "time hourglass timer" },
	{ emoji: "🎯", name: "Target", keywords: "target goal aim focus" },
	{ emoji: "✅", name: "Check", keywords: "check done complete tick" },
	{ emoji: "📈", name: "Progress", keywords: "chart progress growth graph" },
	{ emoji: "💡", name: "Idea", keywords: "idea light bulb learn" },
	{ emoji: "🔬", name: "Science", keywords: "science study research" },
	{ emoji: "🗣️", name: "Speaking", keywords: "speak language talk practice" },
	{ emoji: "🌐", name: "Language", keywords: "language globe world learn" },
	{ emoji: "🎸", name: "Guitar", keywords: "guitar music practice instrument" },
	{ emoji: "🎹", name: "Piano", keywords: "piano music practice instrument" },
	{ emoji: "🎵", name: "Music", keywords: "music note practice" },
	{ emoji: "🎧", name: "Headphones", keywords: "headphones listen music podcast" },
	{ emoji: "🎤", name: "Singing", keywords: "sing microphone music" },
	{ emoji: "🎨", name: "Art", keywords: "art paint draw creative" },
	{ emoji: "🖌️", name: "Paintbrush", keywords: "brush paint art" },
	{ emoji: "📷", name: "Camera", keywords: "camera photo photography" },
	{ emoji: "🎬", name: "Film", keywords: "film movie video" },
	{ emoji: "🎮", name: "Gaming", keywords: "game gaming play" },
	{ emoji: "♟️", name: "Chess", keywords: "chess strategy game" },
	{ emoji: "🧩", name: "Puzzle", keywords: "puzzle game brain" },
	{ emoji: "🧶", name: "Knitting", keywords: "knit yarn craft" },
	{ emoji: "🌱", name: "Seedling", keywords: "plant grow seedling nature" },
	{ emoji: "🪴", name: "Plant", keywords: "plant water pot nature" },
	{ emoji: "🌳", name: "Tree", keywords: "tree nature outdoors" },
	{ emoji: "🌸", name: "Blossom", keywords: "flower blossom nature" },
	{ emoji: "☀️", name: "Sun", keywords: "sun day morning" },
	{ emoji: "🌙", name: "Moon", keywords: "moon night evening" },
	{ emoji: "⭐", name: "Star", keywords: "star favourite" },
	{ emoji: "🔥", name: "Fire", keywords: "fire streak hot" },
	{ emoji: "🐕", name: "Dog", keywords: "dog walk pet" },
	{ emoji: "🐈", name: "Cat", keywords: "cat pet" },
	{ emoji: "🙏", name: "Gratitude", keywords: "pray gratitude thanks" },
	{ emoji: "❤️", name: "Heart", keywords: "heart love health" },
	{ emoji: "😊", name: "Smile", keywords: "smile happy mood" },
	{ emoji: "🕯️", name: "Candle", keywords: "candle calm relax" },
	{ emoji: "💰", name: "Money", keywords: "money save budget savings" },
	{ emoji: "🪙", name: "Coin", keywords: "coin money save" },
	{ emoji: "🧹", name: "Cleaning", keywords: "clean sweep tidy chore" },
	{ emoji: "🧺", name: "Laundry", keywords: "laundry wash chore" },
	{ emoji: "🛒", name: "Shopping", keywords: "shopping groceries" },
	{ emoji: "🏠", name: "Home", keywords: "home house chore" },
	{ emoji: "📵", name: "No phone", keywords: "phone off screen digital detox" },
	{ emoji: "🎒", name: "Backpack", keywords: "backpack school pack" },
	{ emoji: "🚗", name: "Car", keywords: "car drive commute" },
	{ emoji: "🎉", name: "Celebrate", keywords: "celebrate party reward" },
];

/** Fuzzy-search modal for picking an emoji to represent a habit. */
export class EmojiSuggestModal extends FuzzySuggestModal<EmojiEntry> {
	constructor(
		app: App,
		private onChoose: (emoji: string) => void,
	) {
		super(app);
		this.modalEl.addClass("tg-habits-surface");
		this.setPlaceholder(t("Search emojis…"));
		this.limit = 100;
	}

	getItems(): EmojiEntry[] {
		return [...EMOJIS];
	}

	getItemText(item: EmojiEntry): string {
		return `${item.name} ${item.keywords}`;
	}

	renderSuggestion(match: FuzzyMatch<EmojiEntry>, el: HTMLElement): void {
		el.addClass("habits-emoji-suggestion");
		el.createSpan({
			cls: "habits-emoji-suggestion-glyph",
			text: match.item.emoji,
		});
		el.createSpan({ text: match.item.name });
	}

	onChooseItem(item: EmojiEntry): void {
		this.onChoose(item.emoji);
	}
}
