/** French translations, keyed by the English source string. */
export const fr: Record<string, string> = {
	// Commands and ribbon
	"Create habit": "Créer une habitude",
	"Insert dashboard": "Insérer le tableau de bord",
	"Insert habit metrics": "Insérer les métriques d'habitude",
	"Insert habits table": "Insérer le tableau des habitudes",
	"Open panel": "Ouvrir le panneau",
	"Open habits panel": "Ouvrir le panneau des habitudes",
	Habits: "Habitudes",

	// Settings
	"Habits folder": "Dossier des habitudes",
	"Folder where each habit is stored as its own note. It is created automatically if it does not exist.":
		"Dossier où chaque habitude est enregistrée dans sa propre note. Il est créé automatiquement s'il n'existe pas.",
	"Follow daily note date": "Suivre la date de la note quotidienne",
	"When a dashboard is embedded in a daily note (a note whose name contains a date like 2026-07-01), open it on that note's date instead of today.":
		"Lorsqu'un tableau de bord est intégré dans une note quotidienne (une note dont le nom contient une date comme 2026-07-01), il s'ouvre à la date de cette note plutôt qu'à aujourd'hui.",
	"Daily note date format": "Format de date de la note quotidienne",
	"Moment.js format used to read the date from a daily note's name, such as YYYY-MM-DD or YYYYMMDD.":
		"Format Moment.js utilisé pour lire la date dans le nom d'une note quotidienne, par exemple YYYY-MM-DD ou YYYYMMDD.",

	// Sorting
	"Sort habits by": "Trier les habitudes par",
	"The base order of habit cards in the dashboard and side panel.":
		"L'ordre de base des cartes d'habitudes dans le tableau de bord et le panneau latéral.",
	"Name (A–Z)": "Nom (A–Z)",
	Color: "Couleur",
	"Last logged": "Dernier enregistrement",
	"Planned time": "Heure prévue",
	Manual: "Manuel",
	"Manual order": "Ordre manuel",
	"Drag the cards into the order you want. New habits join the end of the list.":
		"Faites glisser les cartes dans l'ordre souhaité. Les nouvelles habitudes rejoignent la fin de la liste.",
	"Move completed cards to the end":
		"Déplacer les cartes terminées à la fin",
	"Completed habits drift to the end of the queue and paused ones park behind them. Turn this off to keep every card in its sorted position.":
		"Les habitudes terminées glissent en fin de file et celles en pause se rangent derrière. Désactivez pour garder chaque carte à sa position triée.",
	Group: "Groupe",
	Ungrouped: "Sans groupe",
	"Optional group used to build dashboard sections — for example an area of responsibility.":
		"Groupe facultatif pour créer des sections dans le tableau de bord — par exemple un domaine de responsabilité.",
	"e.g. Health": "p. ex. Santé",
	"Group color": "Couleur du groupe",
	"Optional color shared by every habit in this group.":
		"Couleur facultative partagée par toutes les habitudes de ce groupe.",
	"Group icon": "Icône du groupe",
	"Shown in the group lip on cards and in section headers.":
		"Affichée dans le bandeau de groupe des cartes et dans les en-têtes de section.",
	"Use group color for this card":
		"Utiliser la couleur du groupe pour cette carte",
	"Show this card in the group color instead of its own.":
		"Affiche cette carte dans la couleur du groupe plutôt que la sienne.",
	General: "Général",
	Sorting: "Tri",
	Groups: "Groupes",
	"How to move through your habit cards: a paged carousel with arrows, a grid that wraps onto new rows, or a fixed-height grid that scrolls vertically. The stats page follows the same choice.":
		"Comment parcourir vos cartes d'habitudes : un carrousel paginé avec flèches, une grille qui passe à la ligne, ou une grille à hauteur fixe qui défile verticalement. La page de statistiques suit le même choix.",
	"Enable groups": "Activer les groupes",
	"Show habits in sections by their group, with a group lip on each card.":
		"Affiche les habitudes en sections selon leur groupe, avec un bandeau de groupe sur chaque carte.",
	"Group order": "Ordre des groupes",
	"Drag the groups into the order you want. Sections follow the same order.":
		"Faites glisser les groupes dans l'ordre souhaité. Les sections suivent le même ordre.",
	"Completion animations": "Animations de complétion",
	"Play the check swoosh, card departure, and perfect-day confetti when habits are completed. Turn off for instant, quiet updates.":
		"Joue le swoosh de la coche, le départ de la carte et les confettis du jour parfait quand une habitude est complétée. Désactivez pour des mises à jour instantanées et discrètes.",
	"Reminders": "Rappels",
	"Write reminders for due habits": "Écrire des rappels pour les habitudes dues",
	"Each day, write one reminder checklist line per planned time of every habit due that day, in the format the Reminder plugin picks up. The lines live in a marked block and refresh as you log habits.":
		"Chaque jour, écrit une ligne de rappel par heure prévue pour chaque habitude due ce jour-là, au format reconnu par le plugin Reminder. Les lignes vivent dans un bloc balisé et se mettent à jour au fil des enregistrements.",
	"Where to write reminders": "Où écrire les rappels",
	"The daily note follows the Daily notes core plugin's folder and date format; the block is added once the note exists. A fixed note is created automatically.":
		"La note quotidienne suit le dossier et le format de date du plugin de base « Notes quotidiennes » ; le bloc est ajouté dès que la note existe. Une note fixe est créée automatiquement.",
	"Today's daily note": "Note quotidienne du jour",
	"A fixed note": "Une note fixe",
	"Reminder note path": "Chemin de la note de rappels",
	"Vault path of the note that holds the reminder block.":
		"Chemin dans le coffre de la note qui contient le bloc de rappels.",
	"Manage groups": "Gérer les groupes",
	"See every habit by group and drag cards between groups.":
		"Voyez chaque habitude par groupe et faites glisser les cartes entre les groupes.",
	Open: "Ouvrir",
	"New group": "Nouveau groupe",
	Add: "Ajouter",
	"Drag habits between groups to reassign them, or within a group to reorder them.":
		"Faites glisser les habitudes entre les groupes pour les réaffecter, ou au sein d'un groupe pour les réordonner.",
	"No habits": "Aucune habitude",
	"Edit group style": "Modifier le style du groupe",
	"Delete group": "Supprimer le groupe",
	'Delete "{name}"? Its habits are kept and become ungrouped.':
		"Supprimer « {name} » ? Ses habitudes sont conservées et deviennent sans groupe.",
	Delete: "Supprimer",
	"Dashboard layout": "Disposition du tableau de bord",
	Carousel: "Carrousel",
	Grid: "Grille",
	"Vertical scroll": "Défilement vertical",
	"Cards per view": "Cartes par vue",
	"How many habit cards fit side by side on wider screens.":
		"Combien de cartes d'habitudes tiennent côte à côte sur les grands écrans.",
	"Cards per view on mobile": "Cartes par vue sur mobile",
	"How many habit cards fit side by side on phone-sized screens.":
		"Combien de cartes d'habitudes tiennent côte à côte sur les écrans de téléphone.",

	// Confirm dialog defaults
	Cancel: "Annuler",
	Confirm: "Confirmer",

	// Store notices
	'Could not find the note for "{name}".':
		'Impossible de trouver la note de « {name} ».',
	"Please enter a valid habit name.":
		"Veuillez saisir un nom d'habitude valide.",
	'A habit called "{name}" already exists.':
		'Une habitude nommée « {name} » existe déjà.',
	'Created habit "{name}".': 'Habitude « {name} » créée.',
	'Updated "{name}".': '« {name} » mise à jour.',
	'Paused "{name}".': '« {name} » mise en pause.',
	'Resumed "{name}".': '« {name} » reprise.',
	'Stopped tracking "{name}". Its history is kept in the note.':
		'Suivi de « {name} » arrêté. Son historique est conservé dans la note.',
	'Resumed tracking "{name}".': 'Suivi de « {name} » repris.',
	'Removed "{name}".': '« {name} » supprimée.',
	"Habit added to the dashboard.": "Habitude ajoutée au tableau de bord.",

	// Dashboard
	"Back to habits": "Retour aux habitudes",
	"View stats": "Voir les statistiques",
	"Export stats": "Exporter les statistiques",
	Weekly: "Hebdomadaire",
	Monthly: "Mensuel",
	"Previous day": "Jour précédent",
	"Next day": "Jour suivant",
	"Choose a date": "Choisir une date",
	"Add habit": "Ajouter une habitude",
	"No habits yet. Create your first habit to get started.":
		"Aucune habitude pour l'instant. Créez votre première habitude pour commencer.",
	Previous: "Précédent",
	Next: "Suivant",
	"Go to position {n}": "Aller à la position {n}",
	"Right-click or long-press for more options":
		"Clic droit ou appui long pour plus d'options",
	"Open habit note": "Ouvrir la note de l'habitude",
	"Open the note for {name}": "Ouvrir la note de {name}",
	Paused: "En pause",
	Stopped: "Arrêté",
	"Failed": "Échoué",
	"Skipped": "Passé",
	"Snoozed": "En sommeil",
	"Snoozed until {time}": "En sommeil jusqu'à {time}",
	"Undo fail": "Annuler l'échec",
	"Undo skip": "Annuler le passage",
	"End snooze": "Réveiller",
	"Fail for today": "Échouer pour aujourd'hui",
	"Fail this day": "Échouer ce jour",
	"Marked \"{name}\" as failed.": "« {name} » marqué comme échoué.",
	"Skip for today": "Passer pour aujourd'hui",
	"Skip this day": "Passer ce jour",
	"Skipped \"{name}\".": "« {name} » passé.",
	"Snooze…": "Mettre en sommeil…",
	"Snooze \"{name}\"": "Mettre « {name} » en sommeil",
	"It leaves today's lists and comes back on its own. Snoozing never counts for or against the habit.": "L'habitude quitte les listes du jour et revient d'elle-même. La mise en sommeil ne compte jamais pour ou contre l'habitude.",
	"Snooze for": "Mettre en sommeil pendant",
	"30 minutes": "30 minutes",
	"1 hour": "1 heure",
	"3 hours": "3 heures",
	"Snooze until": "En sommeil jusqu'à",
	"Snooze": "Mettre en sommeil",
	"Pick a time later today.": "Choisissez une heure plus tard aujourd'hui.",
	"Snoozed \"{name}\" until {time}.": "« {name} » en sommeil jusqu'à {time}.",
	"1 hidden for today": "1 masquée aujourd'hui",
	"{count} hidden for today": "{count} masquées aujourd'hui",
	"1 hidden for this day": "1 masquée ce jour",
	"{count} hidden for this day": "{count} masquées ce jour",
	"Undo": "Annuler",
	"Click to undo": "Cliquez pour annuler",
	"Nothing left on this day's list.": "Plus rien dans la liste de ce jour.",
	"Nothing left on today's list.": "Plus rien dans la liste du jour.",
	"At least: reach a target for habits you are building, like drinking 1.5 litres of water. At most: stay within a limit for habits you are cutting down, like no more than 2 coffees.": "Au moins : atteignez un objectif pour les habitudes que vous construisez, comme boire 1,5 litre d'eau. Au plus : restez sous une limite pour les habitudes que vous réduisez, comme pas plus de 2 cafés.",
	"At least (reach a target)": "Au moins (atteindre un objectif)",
	"At most (stay within a limit)": "Au plus (rester sous une limite)",
	"Step size": "Pas",
	"How much each + and − press adds or removes. Use a decimal such as 0.25 for amounts like litres.": "Quantité ajoutée ou retirée à chaque appui sur + et −. Utilisez une décimale comme 0.25 pour des quantités comme les litres.",
	"Decrease by {n}": "Diminuer de {n}",
	"4 weeks": "4 semaines",
	"12 weeks": "12 semaines",
	"6 months": "6 mois",
	"1 year": "1 an",
	"Completion rate": "Taux de réussite",
	"Monthly completion rate": "Taux de réussite mensuel",
	"Daily activity": "Activité quotidienne",
	"Week of {date}": "Semaine du {date}",
	"Since {date} · right-click to resume":
		"Depuis le {date} · clic droit pour reprendre",
	"Paused on this day": "En pause ce jour-là",
	"Mark as done": "Marquer comme fait",
	"Mark as not done": "Marquer comme non fait",
	Done: "Fait",
	"Not done": "À faire",
	"Edit value": "Modifier la valeur",
	Value: "Valeur",
	"Decrease by 1": "Diminuer de 1",
	"Increase by 1": "Augmenter de 1",
	"Increase by {n}": "Augmenter de {n}",
	"Edit habit": "Modifier l'habitude",
	"Pause habit": "Mettre en pause",
	"Resume habit": "Reprendre l'habitude",
	"Stop tracking": "Arrêter le suivi",
	"Remove habit": "Supprimer l'habitude",
	'Stop tracking "{name}"? It leaves the dashboard and stats, but its note and full history are kept. You can resume tracking any time from the note\'s metrics view.':
		'Arrêter le suivi de « {name} » ? Elle quitte le tableau de bord et les statistiques, mais sa note et tout son historique sont conservés. Vous pouvez reprendre le suivi à tout moment depuis la vue des métriques de la note.',
	'Remove "{name}"? Its note will be moved to the trash.':
		'Supprimer « {name} » ? Sa note sera déplacée vers la corbeille.',
	Remove: "Supprimer",
	"Perfect!": "Parfait !",
	Today: "Aujourd'hui",
	Yesterday: "Hier",
	Tomorrow: "Demain",
	"Last 7 days": "7 derniers jours",
	"Last 30 days": "30 derniers jours",
	"This week": "Cette semaine",
	"This month": "Ce mois-ci",

	// Sidebar panel
	"Habits completed today": "Habitudes accomplies aujourd'hui",
	"No habits yet.": "Aucune habitude pour l'instant.",
	"Click to type a value": "Cliquez pour saisir une valeur",
	"Open note": "Ouvrir la note",

	// Stats view
	"No habits to show stats for yet.":
		"Aucune habitude à afficher dans les statistiques pour l'instant.",
	Completion: "Réussite",
	"Best streak": "Meilleure série",
	"Perfect days": "Jours parfaits",
	Completions: "Accomplissements",
	"Goals met": "Objectifs atteints",
	"{completed}/{days} days": "{completed}/{days} jours",
	"{total} total": "{total} au total",
	best: "record",
	"perfect week": "semaine parfaite",
	"perfect month": "mois parfait",
	"weekly goal": "objectif hebdomadaire",
	"monthly goal": "objectif mensuel",
	"{progress}/{goal} days · {label} · {pct}%":
		"{progress}/{goal} jours · {label} · {pct} %",

	// Habit metrics block
	'Place this block inside a habit note, or point it at one with "habit: <name>".':
		'Placez ce bloc dans une note d\'habitude, ou désignez-en une avec « habit: <nom> ».',
	'No habit called "{name}" was found.':
		'Aucune habitude nommée « {name} » n\'a été trouvée.',
	"No longer tracked since {date}. All history is kept.":
		"Suivi arrêté depuis le {date}. Tout l'historique est conservé.",
	"No longer tracked. All history is kept.":
		"Suivi arrêté. Tout l'historique est conservé.",
	"Resume tracking": "Reprendre le suivi",
	"Paused since {date}. Paused days don't count against streaks or stats.":
		"En pause depuis le {date}. Les jours en pause ne comptent ni pour les séries ni pour les statistiques.",
	"Paused. Paused days don't count against streaks or stats.":
		"En pause. Les jours en pause ne comptent ni pour les séries ni pour les statistiques.",
	"Current streak": "Série actuelle",
	"Days completed": "Jours accomplis",
	"30-day rate": "Taux sur 30 jours",
	"Weekly completion rate": "Taux de réussite hebdomadaire",
	Logged: "Enregistré",
	Target: "Objectif",

	// Export modal
	Title: "Titre",
	"Habits report": "Rapport d'habitudes",
	"Date range": "Plage de dates",
	"Custom range": "Plage personnalisée",
	From: "Du",
	To: "Au",
	"Up to {n} days.": "Jusqu'à {n} jours.",
	Content: "Contenu",
	"Summary tiles": "Tuiles de résumé",
	"Completion trend chart": "Graphique de tendance de réussite",
	"Daily grids": "Grilles quotidiennes",
	"Goal progress": "Progression des objectifs",
	Layout: "Mise en page",
	Orientation: "Orientation",
	Portrait: "Portrait",
	Landscape: "Paysage",
	Density: "Densité",
	Comfortable: "Confortable",
	Compact: "Compact",
	Monochrome: "Monochrome",
	"Ink-friendly greys instead of accent colours.":
		"Des gris économes en encre plutôt que des couleurs d'accent.",
	"Export PDF": "Exporter le PDF",
	"No habits to export yet.": "Aucune habitude à exporter pour l'instant.",
	'Exported to "{path}" in your vault.':
		'Exporté vers « {path} » dans votre coffre.',

	// Habit modal
	"New habit": "Nouvelle habitude",
	Name: "Nom",
	Type: "Type",
	"Binary is done or not done. Repetition counts towards a target. Timed tracks minutes.":
		"Binaire : fait ou non fait. Répétition : compte vers un objectif. Chronométré : enregistre des minutes.",
	Binary: "Binaire",
	Repetition: "Répétition",
	Timed: "Chronométré",
	"Daily target (minutes)": "Objectif quotidien (minutes)",
	"Daily target": "Objectif quotidien",
	Unit: "Unité",
	"Optional label shown next to the count.":
		"Étiquette facultative affichée à côté du compteur.",
	Icon: "Icône",
	"Choose a Lucide icon or an emoji to represent this habit.":
		"Choisissez une icône Lucide ou un emoji pour représenter cette habitude.",
	Emoji: "Emoji",
	"Choose an emoji": "Choisir un emoji",
	"Clear icon": "Effacer l'icône",
	"Choose icon": "Choisir une icône",
	"Save changes": "Enregistrer les modifications",
	"Targets (optional)": "Objectifs (facultatif)",
	"Set an optional weekly or monthly goal for how many days you complete this habit. For example, hitting your daily goal on all 7 days is a weekly target of 7. Turn on a perfect toggle to aim for every day of the period automatically, whatever its length.":
		"Définissez un objectif hebdomadaire ou mensuel facultatif indiquant combien de jours vous accomplissez cette habitude. Par exemple, atteindre votre objectif quotidien les 7 jours équivaut à un objectif hebdomadaire de 7. Activez une option « parfait » pour viser automatiquement chaque jour de la période, quelle que soit sa durée.",
	"Perfect week": "Semaine parfaite",
	"Aim to complete this habit every day of the week.":
		"Visez à accomplir cette habitude chaque jour de la semaine.",
	"Weekly target": "Objectif hebdomadaire",
	"Optional. Days to complete per week (max 7).":
		"Facultatif. Jours à accomplir par semaine (max. 7).",
	None: "Aucun",
	"Perfect month": "Mois parfait",
	"Aim to complete this habit every day of the month.":
		"Visez à accomplir cette habitude chaque jour du mois.",
	"Monthly target": "Objectif mensuel",
	"Optional. Days to complete per month.":
		"Facultatif. Jours à accomplir par mois.",
	Colour: "Couleur",
	"Pick a colour from your theme, or choose a custom one.":
		"Choisissez une couleur de votre thème ou une couleur personnalisée.",
	"Your habit": "Votre habitude",

	// Icon and colour pickers
	"Search icons…": "Rechercher des icônes…",
	"Search emojis…": "Rechercher des émojis…",

	// Comments
	"Comments on cards": "Commentaires sur les cartes",
	"Show a comment flap on dashboard cards for jotting a note about any day.":
		"Affiche un volet de commentaire sur les cartes du tableau de bord pour annoter n'importe quel jour.",
	"Add comment": "Ajouter un commentaire",
	"Flip back": "Retourner la carte",
	"Edit comment": "Modifier le commentaire",
	"Move day comments into note bodies":
		"Déplacer les commentaires quotidiens dans le corps des notes",
	"No comments left to move.":
		"Plus aucun commentaire à déplacer.",
	"Moved comments in 1 note.":
		"Commentaires déplacés dans 1 note.",
	"Moved comments in {n} notes.":
		"Commentaires déplacés dans {n} notes.",
	"Add a comment for this day…": "Ajoutez un commentaire pour ce jour…",
	Comments: "Commentaires",

	// Limit habits (experimental)
	Experimental: "Expérimental",
	"These features are still being tested and may change before they become permanent. Turning one off only hides it from menus — anything you created with it keeps working.":
		"Ces fonctionnalités sont encore en cours de test et peuvent changer avant de devenir permanentes. Les désactiver ne fait que les masquer des menus — tout ce que vous avez créé avec continue de fonctionner.",
	"Break bad habits": "Rompre avec les mauvaises habitudes",
	"Track habits you want to reduce or avoid by staying under a daily limit — for example at most 2 hours of gaming, or no smoking at all.":
		"Suivez les habitudes que vous voulez réduire ou éviter en restant sous une limite quotidienne — par exemple au plus 2 heures de jeu vidéo, ou ne pas fumer du tout.",
	Goal: "Objectif",
	"Reach a target for habits you are building. Stay under a limit for habits you are cutting down or giving up.":
		"Atteignez un objectif pour les habitudes que vous construisez. Restez sous une limite pour les habitudes que vous réduisez ou abandonnez.",
	"Reach a target": "Atteindre un objectif",
	"Stay under a limit": "Rester sous une limite",
	"Binary means avoiding it entirely. Repetition counts against a daily limit. Timed tracks minutes against a daily limit.":
		"Binaire signifie l'éviter complètement. Répétition compte par rapport à une limite quotidienne. Chronométré mesure des minutes par rapport à une limite quotidienne.",
	"Daily limit": "Limite quotidienne",
	"Daily limit (minutes)": "Limite quotidienne (minutes)",
	"0 means none at all.": "0 signifie pas du tout.",
	"Set an optional weekly or monthly goal for how many days you stay within your limit. Turn on a perfect toggle to aim for every day of the period automatically, whatever its length.":
		"Définissez un objectif hebdomadaire ou mensuel facultatif pour le nombre de jours où vous restez dans votre limite. Activez une bascule parfaite pour viser automatiquement chaque jour de la période, quelle que soit sa durée.",
	Clean: "Sans écart",
	Slipped: "Écart",
	"Mark as clean": "Marquer comme sans écart",
	"Mark as slipped": "Marquer comme écart",
	"Days within limit": "Jours dans la limite",
	Limit: "Limite",

	// Frequencies and per-note metrics
	Frequency: "Fréquence",
	Daily: "Quotidien",
	"Days of week": "Jours de la semaine",
	Habit: "Habitude",
	Schedule: "Programme",
	"Time of day": "Heure de la journée",
	"Optional times this habit is planned for — once or several times a day. Shown on the habit's card.":
		"Heures facultatives prévues pour cette habitude — une ou plusieurs fois par jour. Affichées sur la carte de l'habitude.",
	"Add time": "Ajouter une heure",
	"Remove time": "Supprimer l'heure",
	"Every N days": "Tous les N jours",
	"Repeat every": "Répéter tous les",
	"Day of month": "Jour du mois",
	"The weekdays this habit is due on. Pick as many as you need.":
		"Les jours de la semaine où cette habitude est due. Choisissez-en autant que nécessaire.",
	"Number of days between due dates, counted from the habit's start date. Use 2 for an alternate-day schedule.":
		"Nombre de jours entre les échéances, compté à partir de la date de début de l'habitude. Utilisez 2 pour un rythme d'un jour sur deux.",
	"The day of the month this habit is due. In shorter months it falls due on the last day, so 31 always lands on the final day of the month.":
		"Le jour du mois où cette habitude est due. Les mois plus courts la placent le dernier jour, donc 31 tombe toujours en fin de mois.",
	"Every {day}": "Chaque {day}",
	"Monthly · day {day}": "Mensuel · jour {day}",
	"Every other day": "Un jour sur deux",
	"Every {n} days": "Tous les {n} jours",
	"No habits are due on this day.":
		"Aucune habitude n'est due ce jour-là.",
	"Nothing due today.": "Rien à faire aujourd'hui.",
	"Weekly activity": "Activité hebdomadaire",
	"Monthly activity": "Activité mensuelle",
	"Activity on due days": "Activité aux jours d'échéance",
	"Completion rate over {n} due days":
		"Taux de réussite sur {n} jours d'échéance",
	"Weeks completed": "Semaines accomplies",
	"Months completed": "Mois accomplis",
	"Recent rate": "Taux récent",
	"{n}-week completion rate": "Taux de réussite sur {n} semaines",
	"{n}-month completion rate": "Taux de réussite sur {n} mois",

	// AI summaries
	"AI summaries": "Résumés par IA",
	"AI summary": "Résumé par IA",
	"Show an AI-generated summary with feedback and advice on the stats page tabs. Uses an OpenAI-compatible service you configure below; your habit stats are sent to it only when you press the generate button.":
		"Affiche un résumé généré par IA avec retours et conseils dans les onglets de la page de statistiques. Utilise un service compatible OpenAI que vous configurez ci-dessous ; vos statistiques d'habitudes ne lui sont envoyées que lorsque vous appuyez sur le bouton de génération.",
	"AI base URL": "URL de base de l'IA",
	"Base URL of an OpenAI-compatible API. Works with OpenAI, OpenRouter, or local servers like Ollama (http://localhost:11434/v1).":
		"URL de base d'une API compatible OpenAI. Fonctionne avec OpenAI, OpenRouter ou des serveurs locaux comme Ollama (http://localhost:11434/v1).",
	"AI API key": "Clé d'API IA",
	"Stored locally in this vault's plugin data. Leave blank for local servers that need no key.":
		"Stockée localement dans les données du plugin de ce coffre. Laissez vide pour les serveurs locaux sans clé.",
	"AI model": "Modèle d'IA",
	"Model name the service should use.":
		"Nom du modèle que le service doit utiliser.",
	"Generate summary": "Générer le résumé",
	Regenerate: "Régénérer",
	"Get feedback and advice on your habits for this period. Your stats are sent to the AI service you configured only when you press the button.":
		"Recevez des retours et des conseils sur vos habitudes pour cette période. Vos statistiques ne sont envoyées au service d'IA configuré que lorsque vous appuyez sur le bouton.",
	"Thinking…": "Réflexion…",
	"Could not generate a summary: {message}":
		"Impossible de générer le résumé : {message}",
	"Adds an AI-generated overview with feedback and advice. Your habit stats are sent to your configured AI service.":
		"Ajoute un aperçu généré par IA avec retours et conseils. Vos statistiques d'habitudes sont envoyées au service d'IA configuré.",
	"Generating AI summary…": "Génération du résumé par IA…",
	"The AI summary will be generated when you export.":
		"Le résumé par IA sera généré lors de l'export.",

	// Custom stats range
	Custom: "Personnalisé",
	"Start date": "Date de début",
	"End date": "Date de fin",

	// Heatmap start markers
	"not tracked yet": "pas encore suivi",
	"started tracking on {date}": "suivi commencé le {date}",

	// Stats carousel
	"Stats rows per page": "Lignes de statistiques par page",
	"How many habits each stats page shows.":
		"Combien d'habitudes chaque page de statistiques affiche.",
	// Note habits
	'"{name}" uses Templater syntax, but the Templater plugin is not installed — the template was copied as plain text.':
		"« {name} » utilise la syntaxe Templater, mais le plugin Templater n'est pas installé — le modèle a été copié en texte brut.",
	"Binary is done or not done. Repetition counts towards a target. Timed tracks minutes. Note is completed by writing in a per-day note.":
		"Binaire : fait ou non fait. Répétition : compte vers un objectif. Chronométré : enregistre des minutes. Note : se complète en écrivant dans une note quotidienne.",
	"Character count is reached": "Un nombre de caractères est atteint",
	"Character goal": "Objectif de caractères",
	"Completed when": "Complété quand",
	"Every task is checked": "Toutes les tâches sont cochées",
	"Filename format": "Format du nom de fichier",
	"Folder each day's note is created in. Leave blank for a dedicated subfolder named after this habit.":
		"Dossier où la note de chaque jour est créée. Laissez vide pour un sous-dossier dédié portant le nom de cette habitude.",
	"Moment.js format used to name each day's note, e.g. {example}. May include / for date-based subfolders.":
		"Format Moment.js utilisé pour nommer la note de chaque jour, p. ex. {example}. Peut inclure / pour des sous-dossiers basés sur la date.",
	Note: "Note",
	"Note habits": "Habitudes en note",
	"Notes folder": "Dossier des notes",
	"Open this day's note": "Ouvrir la note de ce jour",
	"Open today's note": "Ouvrir la note d'aujourd'hui",
	"Optional template note used when a day's note is created. Expanded through the Templater plugin when it is installed, otherwise copied as plain text.":
		"Note modèle optionnelle utilisée lors de la création de la note d'un jour. Développée via le plugin Templater lorsqu'il est installé, sinon copiée en texte brut.",
	Template: "Modèle",
	"Track a habit by writing in a per-day note instead of logging a value by hand. A day is complete once the note reaches a character count or every task in it is checked. Works with the Templater plugin to create each day's note from a template.":
		"Suivez une habitude en écrivant dans une note quotidienne plutôt qu'en enregistrant une valeur à la main. Un jour est complet une fois que la note atteint un nombre de caractères ou que toutes ses tâches sont cochées. Fonctionne avec le plugin Templater pour créer la note de chaque jour à partir d'un modèle.",
	Write: "Écrire",
	"Write this day's note": "Écrire la note de ce jour",
	"Write today's note": "Écrire la note d'aujourd'hui",
	"e.g. Journal": "p. ex. Journal",
	"e.g. Templates/Journal.md": "p. ex. Templates/Journal.md",

	// Flexible frequency (any day)
	"How many times (or, for counted and timed habits, how much in total) this needs to happen somewhere in the period.":
		"Combien de fois (ou, pour les habitudes comptées ou chronométrées, quelle quantité au total) cela doit se produire dans la période.",
	'How often this habit is due. Weekly and monthly habits only appear on their due date; the "any day" options appear every day until their quota is met.':
		"La fréquence à laquelle cette habitude est due. Les habitudes hebdomadaires et mensuelles n'apparaissent qu'à leur date d'échéance ; les options « n'importe quel jour » apparaissent chaque jour jusqu'à ce que le quota soit atteint.",
	"Monthly (any day)": "Mensuel (n'importe quel jour)",
	"Times per month": "Fois par mois",
	"Times per week": "Fois par semaine",
	"Weekly (any day)": "Hebdomadaire (n'importe quel jour)",
	"this month": "ce mois-ci",
	"this week": "cette semaine",
	"{completed}/{days} months": "{completed}/{days} mois",
	"{completed}/{days} weeks": "{completed}/{days} semaines",
	"{n}× a month · any day": "{n}× par mois · n'importe quel jour",
	"{n}× a week · any day": "{n}× par semaine · n'importe quel jour",

	// Commands
	"Insert habits heatmap": "Insérer la carte de chaleur des habitudes",

	// Habit metrics: heatmap tabs
	Charts: "Graphiques",
	Month: "Mois",
	History: "Historique",
	"{month} heatmap": "Carte de chaleur de {month}",
	"Last {n} weeks": "{n} dernières semaines",

	// Heatmap cell states and tooltips
	Upcoming: "À venir",
	"Not tracked yet": "Pas encore suivi",
	"Not due": "Non prévu",
	"Outside this month": "Hors de ce mois",
	Complete: "Terminé",
	"Over limit": "Dépassement de limite",
	"Not logged": "Non enregistré",

	// Whole-vault heatmap block
	"Add a habit to see its heatmap here.":
		"Ajoutez une habitude pour voir sa carte de chaleur ici.",
	"No habits in the \"{group}\" group.":
		"Aucune habitude dans le groupe « {group} ».",
	"No habits due": "Aucune habitude prévue",
	"Perfect day": "Journée parfaite",
	"{completed}/{considered} habits · {pct}%":
		"{completed}/{considered} habitudes · {pct} %",
	"This year": "Cette année",
	"Past 6 months": "6 derniers mois",
	"{year} heatmap": "Carte de chaleur de {year}",

	// Note habits: checklist requirement and fail keyword
	"Both are true": "Les deux sont vraies",
	"Checklist requirement is met": "L'exigence de la liste de tâches est remplie",
	"Checklist requirement": "Exigence de la liste de tâches",
	"Require every task to be checked, or just some — useful for a list of alternatives where doing any one of them counts (e.g. \"Cardio\" / \"Weights\" / \"Rest day\").":
		"Exigez que toutes les tâches soient cochées, ou seulement certaines — utile pour une liste d'alternatives où faire l'une d'elles suffit (par ex. « Cardio » / « Musculation » / « Jour de repos »).",
	"At least this many are checked": "Au moins ce nombre est coché",
	"Tasks required": "Tâches requises",
	"Fail keyword": "Mot-clé d'échec",
	"Optional. Checking a task whose text contains this word forces the day to fail, whatever else is checked — e.g. \"Slipped\" as one of several checklist options. Leave blank to turn this off.":
		"Facultatif. Cocher une tâche dont le texte contient ce mot force la journée à échouer, quoi que vous ayez coché par ailleurs — par exemple « Raté » comme l'une des options de la liste. Laissez vide pour désactiver.",
	"e.g. Slipped": "p. ex. Raté",
	"Reach a character count, meet a checklist requirement, or require both.":
		"Atteignez un nombre de caractères, remplissez une exigence de liste de tâches, ou exigez les deux.",

	// Tags (cross-plugin compatibility)
	Tags: "Étiquettes",
	"e.g. task": "p. ex. task",
	"Optional Obsidian tags for this note, separated by commas or spaces. Useful for making this habit recognisable to another plugin's own tag-based rules — for example TaskNotes' task tag.":
		"Tags Obsidian optionnels pour cette note, séparés par des virgules ou des espaces. Utile pour rendre cette habitude reconnaissable par les règles basées sur les tags d'un autre plugin — par exemple le tag « task » de TaskNotes.",

	// Advanced settings: frontmatter key remapping
	Advanced: "Avancé",
	Apply: "Appliquer",
	"Apply key changes": "Appliquer les changements de clés",
	"Rename the frontmatter properties habit notes use. Useful for avoiding collisions with another plugin's own properties in the same note (for example TaskNotes).":
		"Renommez les propriétés de frontmatter utilisées par les notes d'habitude. Utile pour éviter les collisions avec les propriétés d'un autre plugin dans la même note (par exemple TaskNotes).",
	"\"{a}\" and \"{b}\" can't use the same property key (\"{value}\").":
		"« {a} » et « {b} » ne peuvent pas utiliser la même clé de propriété (« {value} »).",
	"Property keys can't be empty.":
		"Les clés de propriété ne peuvent pas être vides.",
	"This renames {summary} in every note in your habits folder ({count} habit(s) currently). Existing values are moved, not discarded. Continue?":
		"Cette opération renomme {summary} dans toutes les notes de votre dossier d'habitudes ({count} habitude(s) actuellement). Les valeurs existantes sont déplacées, pas supprimées. Continuer ?",
	"Updated the frontmatter keys in {count} note(s).":
		"Clés de frontmatter mises à jour dans {count} note(s).",
	"Renaming this away from the default also changes how binary habits log a day: instead of {\"2026-08-25\": 1}, a completed day becomes a bare date, like [\"2026-08-25\"] — the shape TaskNotes uses for complete_instances. Repetition and timed habits are unaffected either way; they always need a value, never just a date.":
		"Renommer cette clé par rapport à sa valeur par défaut change aussi la façon dont les habitudes binaires enregistrent un jour : au lieu de {\"2026-08-25\": 1}, un jour terminé devient une simple date, comme [\"2026-08-25\"] — le format que TaskNotes utilise pour complete_instances. Les habitudes à répétitions et chronométrées ne sont pas concernées dans tous les cas ; elles ont toujours besoin d'une valeur, jamais d'une simple date.",
	Identity: "Identité",
	Legacy: "Hérité",
	Lifecycle: "Cycle de vie",
	Presentation: "Présentation",
	"Note habit": "Habitude de note",
	"Habit type key": "Clé du type d'habitude",
	"Completion records key": "Clé des enregistrements",
	"Frequency key": "Clé de fréquence",
	"Weekday key": "Clé du jour de la semaine",
	"Month day key": "Clé du jour du mois",
	"Interval days key": "Clé des jours d'intervalle",
	"Planned time key": "Clé de l'heure prévue",
	"Goal direction key": "Clé du sens de l'objectif",
	"Target key": "Clé de l'objectif",
	"Unit key": "Clé de l'unité",
	"Step size key": "Clé du pas",
	"Weekly target key": "Clé de l'objectif hebdomadaire",
	"Monthly target key": "Clé de l'objectif mensuel",
	"Weekly perfect key": "Clé de la semaine parfaite",
	"Monthly perfect key": "Clé du mois parfait",
	"Start date key": "Clé de la date de début",
	"Pauses key": "Clé des pauses",
	"Stopped key": "Clé de l'arrêt",
	"Stop date key": "Clé de la date d'arrêt",
	"Icon key": "Clé de l'icône",
	"Color key": "Clé de la couleur",
	"Group key": "Clé du groupe",
	"Use group color key": "Clé « utiliser la couleur du groupe »",
	"Note folder key": "Clé du dossier des notes",
	"Note filename format key": "Clé du format de nom de fichier",
	"Template path key": "Clé du chemin du modèle",
	"Note completion mode key": "Clé du mode d'achèvement",
	"Note checklist requirement key": "Clé de l'exigence de la liste de tâches",
	"Note checklist minimum key": "Clé du minimum de la liste de tâches",
	"Note fail keyword key": "Clé du mot-clé d'échec",
	"Legacy comments key": "Clé des commentaires hérités",

	// PDF export (read via docT() in export-modal.ts, which falls back to English for zh — jsPDF's built-in fonts can't render CJK)
	"Completion trend": "Tendance de réussite",
	"(paused)": "(en pause)",
	"{rate}% · {total} · streak {current} (best {best})":
		"{rate} % · {total} · série {current} (record {best})",
	"Goal: {completed}/{goal} days met":
		"Objectif : {completed}/{goal} jours atteints",
	"{range} · exported {date}": "{range} · exporté le {date}",
	"+{n} more": "+{n} de plus",

	// Back-dating a missed day
	Back: "Retour",

	// Rescheduling missed habits (experimental)
	"1 missed habit": "1 habitude manquée",
	"Add a notification button to the dashboard and sidebar panel when a habit's been missed, opening a review of missed days you can move onto a different one (never a day that habit is already due, so nothing doubles up).":
		"Ajoute un bouton de notification au tableau de bord et au panneau latéral lorsqu'une habitude a été manquée, ouvrant une revue des jours manqués que vous pouvez déplacer vers un autre jour (jamais un jour où cette habitude est déjà due, pour qu'il n'y ait jamais de doublon).",
	"Missed habits": "Habitudes manquées",
	"Move this missed day onto a different one":
		"Déplacer ce jour manqué vers un autre",
	"Move to": "Déplacer vers",
	"Nothing missed right now.": "Rien de manqué pour l'instant.",
	"Pick a habit to move it onto a different day.":
		"Choisissez une habitude à déplacer vers un autre jour.",
	Reschedule: "Replanifier",
	"Reschedule missed habits": "Replanifier les habitudes manquées",
	"Rescheduled \"{name}\" to {date}.": "« {name} » a été replanifiée au {date}.",
	"Rescheduled from {date}": "Reporté depuis {date}",
	"Reschedules key": "Clé des replanifications",
	"Failed days key": "Clé des jours échoués",
	"Skipped days key": "Clé des jours passés",
	"Rescheduling \"{name}\" — missed {date}.":
		"Replanification de « {name} » — manqué le {date}.",
	"That day no longer works — pick another.":
		"Ce jour ne fonctionne plus — choisissez-en un autre.",
	"That day won't work — it's either already due for this habit or already claimed by another reschedule.":
		"Ce jour ne convient pas — soit cette habitude y est déjà due, soit un autre déplacement l'a déjà pris.",
	"{count} missed habits": "{count} habitudes manquées",
};
