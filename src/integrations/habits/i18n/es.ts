/** Spanish translations, keyed by the English source string. */
export const es: Record<string, string> = {
	// Commands and ribbon
	"Create habit": "Crear hábito",
	"Insert dashboard": "Insertar panel de hábitos",
	"Insert habit metrics": "Insertar métricas de hábito",
	"Insert habits table": "Insertar tabla de hábitos",
	"Open panel": "Abrir panel",
	"Open habits panel": "Abrir el panel de hábitos",
	Habits: "Hábitos",

	// Settings
	"Habits folder": "Carpeta de hábitos",
	"Folder where each habit is stored as its own note. It is created automatically if it does not exist.":
		"Carpeta donde cada hábito se guarda como una nota propia. Se crea automáticamente si no existe.",
	"Follow daily note date": "Seguir la fecha de la nota diaria",
	"When a dashboard is embedded in a daily note (a note whose name contains a date like 2026-07-01), open it on that note's date instead of today.":
		"Cuando un panel está insertado en una nota diaria (una nota cuyo nombre contiene una fecha como 2026-07-01), se abre en la fecha de esa nota en lugar de hoy.",
	"Daily note date format": "Formato de fecha de la nota diaria",
	"Moment.js format used to read the date from a daily note's name, such as YYYY-MM-DD or YYYYMMDD.":
		"Formato de Moment.js usado para leer la fecha del nombre de una nota diaria, por ejemplo YYYY-MM-DD o YYYYMMDD.",

	// Sorting
	"Sort habits by": "Ordenar hábitos por",
	"The base order of habit cards in the dashboard and side panel.":
		"El orden base de las tarjetas de hábitos en el panel principal y el panel lateral.",
	"Name (A–Z)": "Nombre (A–Z)",
	Color: "Color",
	"Last logged": "Último registro",
	"Planned time": "Hora prevista",
	Manual: "Manual",
	"Manual order": "Orden manual",
	"Drag the cards into the order you want. New habits join the end of the list.":
		"Arrastra las tarjetas en el orden que quieras. Los hábitos nuevos se añaden al final de la lista.",
	"Move completed cards to the end":
		"Mover las tarjetas completadas al final",
	"Completed habits drift to the end of the queue and paused ones park behind them. Turn this off to keep every card in its sorted position.":
		"Los hábitos completados se desplazan al final de la cola y los pausados quedan detrás. Desactívalo para que cada tarjeta mantenga su posición ordenada.",
	Group: "Grupo",
	Ungrouped: "Sin grupo",
	"Optional group used to build dashboard sections — for example an area of responsibility.":
		"Grupo opcional para crear secciones en el panel — por ejemplo, un área de responsabilidad.",
	"e.g. Health": "p. ej. Salud",
	"Group color": "Color del grupo",
	"Optional color shared by every habit in this group.":
		"Color opcional compartido por todos los hábitos de este grupo.",
	"Group icon": "Icono del grupo",
	"Shown in the group lip on cards and in section headers.":
		"Se muestra en la pestaña de grupo de las tarjetas y en los encabezados de sección.",
	"Use group color for this card":
		"Usar el color del grupo para esta tarjeta",
	"Show this card in the group color instead of its own.":
		"Muestra esta tarjeta con el color del grupo en lugar del suyo.",
	General: "General",
	Sorting: "Ordenación",
	Groups: "Grupos",
	"How to move through your habit cards: a paged carousel with arrows, a grid that wraps onto new rows, or a fixed-height grid that scrolls vertically. The stats page follows the same choice.":
		"Cómo navegar por tus tarjetas de hábitos: un carrusel paginado con flechas, una cuadrícula que salta a nuevas filas o una cuadrícula de altura fija con desplazamiento vertical. La página de estadísticas sigue la misma elección.",
	"Enable groups": "Activar grupos",
	"Show habits in sections by their group, with a group lip on each card.":
		"Muestra los hábitos en secciones según su grupo, con una pestaña de grupo en cada tarjeta.",
	"Group order": "Orden de los grupos",
	"Drag the groups into the order you want. Sections follow the same order.":
		"Arrastra los grupos en el orden que quieras. Las secciones siguen el mismo orden.",
	"Completion animations": "Animaciones de finalización",
	"Play the check swoosh, card departure, and perfect-day confetti when habits are completed. Turn off for instant, quiet updates.":
		"Reproduce el swoosh de la marca, la salida de la tarjeta y el confeti del día perfecto al completar hábitos. Desactívalo para actualizaciones instantáneas y silenciosas.",
	"Reminders": "Recordatorios",
	"Write reminders for due habits":
		"Escribir recordatorios para hábitos pendientes",
	"Each day, write one reminder checklist line per planned time of every habit due that day, in the format the Reminder plugin picks up. The lines live in a marked block and refresh as you log habits.":
		"Cada día escribe una línea de recordatorio por cada hora prevista de cada hábito que toque ese día, en el formato que reconoce el plugin Reminder. Las líneas viven en un bloque marcado y se actualizan al registrar hábitos.",
	"Where to write reminders": "Dónde escribir los recordatorios",
	"The daily note follows the Daily notes core plugin's folder and date format; the block is added once the note exists. A fixed note is created automatically.":
		"La nota diaria sigue la carpeta y el formato de fecha del plugin básico de notas diarias; el bloque se añade cuando la nota existe. Una nota fija se crea automáticamente.",
	"Today's daily note": "Nota diaria de hoy",
	"A fixed note": "Una nota fija",
	"Reminder note path": "Ruta de la nota de recordatorios",
	"Vault path of the note that holds the reminder block.":
		"Ruta en el vault de la nota que contiene el bloque de recordatorios.",
	"Manage groups": "Gestionar grupos",
	"See every habit by group and drag cards between groups.":
		"Ve todos los hábitos por grupo y arrastra tarjetas entre grupos.",
	Open: "Abrir",
	"New group": "Nuevo grupo",
	Add: "Añadir",
	"Drag habits between groups to reassign them, or within a group to reorder them.":
		"Arrastra hábitos entre grupos para reasignarlos, o dentro de un grupo para reordenarlos.",
	"No habits": "Sin hábitos",
	"Edit group style": "Editar estilo del grupo",
	"Delete group": "Eliminar grupo",
	'Delete "{name}"? Its habits are kept and become ungrouped.':
		'¿Eliminar "{name}"? Sus hábitos se conservan y quedan sin grupo.',
	Delete: "Eliminar",
	"Dashboard layout": "Diseño del panel",
	Carousel: "Carrusel",
	Grid: "Cuadrícula",
	"Vertical scroll": "Desplazamiento vertical",
	"Cards per view": "Tarjetas por vista",
	"How many habit cards fit side by side on wider screens.":
		"Cuántas tarjetas de hábitos caben una junto a otra en pantallas anchas.",
	"Cards per view on mobile": "Tarjetas por vista en el móvil",
	"How many habit cards fit side by side on phone-sized screens.":
		"Cuántas tarjetas de hábitos caben una junto a otra en pantallas de móvil.",

	// Confirm dialog defaults
	Cancel: "Cancelar",
	Confirm: "Confirmar",

	// Store notices
	'Could not find the note for "{name}".':
		'No se encontró la nota de "{name}".',
	"Please enter a valid habit name.":
		"Introduce un nombre de hábito válido.",
	'A habit called "{name}" already exists.':
		'Ya existe un hábito llamado "{name}".',
	'Created habit "{name}".': 'Hábito "{name}" creado.',
	'Updated "{name}".': '"{name}" actualizado.',
	'Paused "{name}".': '"{name}" pausado.',
	'Resumed "{name}".': '"{name}" reanudado.',
	'Stopped tracking "{name}". Its history is kept in the note.':
		'Se dejó de seguir "{name}". Su historial se conserva en la nota.',
	'Resumed tracking "{name}".': 'Se reanudó el seguimiento de "{name}".',
	'Removed "{name}".': '"{name}" eliminado.',
	"Habit added to the dashboard.": "Hábito añadido al panel.",

	// Dashboard
	"Back to habits": "Volver a los hábitos",
	"View stats": "Ver estadísticas",
	"Export stats": "Exportar estadísticas",
	Weekly: "Semanal",
	Monthly: "Mensual",
	"Previous day": "Día anterior",
	"Next day": "Día siguiente",
	"Choose a date": "Elegir una fecha",
	"Add habit": "Añadir hábito",
	"No habits yet. Create your first habit to get started.":
		"Aún no hay hábitos. Crea tu primer hábito para empezar.",
	Previous: "Anterior",
	Next: "Siguiente",
	"Go to position {n}": "Ir a la posición {n}",
	"Right-click or long-press for more options":
		"Clic derecho o pulsación larga para más opciones",
	"Open habit note": "Abrir la nota del hábito",
	"Open the note for {name}": "Abrir la nota de {name}",
	Paused: "Pausado",
	Stopped: "Detenido",
	"Failed": "Fallado",
	"Skipped": "Omitido",
	"Snoozed": "Pospuesto",
	"Snoozed until {time}": "Pospuesto hasta las {time}",
	"Undo fail": "Deshacer fallo",
	"Undo skip": "Deshacer omisión",
	"End snooze": "Terminar posposición",
	"Fail for today": "Fallar por hoy",
	"Fail this day": "Fallar este día",
	"Marked \"{name}\" as failed.": "«{name}» marcado como fallado.",
	"Skip for today": "Omitir por hoy",
	"Skip this day": "Omitir este día",
	"Skipped \"{name}\".": "«{name}» omitido.",
	"Snooze…": "Posponer…",
	"Snooze \"{name}\"": "Posponer «{name}»",
	"It leaves today's lists and comes back on its own. Snoozing never counts for or against the habit.": "Sale de las listas de hoy y vuelve por sí solo. Posponer nunca cuenta a favor ni en contra del hábito.",
	"Snooze for": "Posponer durante",
	"30 minutes": "30 minutos",
	"1 hour": "1 hora",
	"3 hours": "3 horas",
	"Snooze until": "Posponer hasta",
	"Snooze": "Posponer",
	"Pick a time later today.": "Elige una hora posterior de hoy.",
	"Snoozed \"{name}\" until {time}.": "«{name}» pospuesto hasta las {time}.",
	"1 hidden for today": "1 oculto por hoy",
	"{count} hidden for today": "{count} ocultos por hoy",
	"1 hidden for this day": "1 oculto en este día",
	"{count} hidden for this day": "{count} ocultos en este día",
	"Undo": "Deshacer",
	"Click to undo": "Haz clic para deshacer",
	"Nothing left on this day's list.": "No queda nada en la lista de este día.",
	"Nothing left on today's list.": "No queda nada en la lista de hoy.",
	"At least: reach a target for habits you are building, like drinking 1.5 litres of water. At most: stay within a limit for habits you are cutting down, like no more than 2 coffees.": "Al menos: alcanza una meta en los hábitos que estás creando, como beber 1,5 litros de agua. Como máximo: no superes un límite en los hábitos que estás reduciendo, como no más de 2 cafés.",
	"At least (reach a target)": "Al menos (alcanzar una meta)",
	"At most (stay within a limit)": "Como máximo (no superar un límite)",
	"Step size": "Tamaño del paso",
	"How much each + and − press adds or removes. Use a decimal such as 0.25 for amounts like litres.": "Cuánto suma o resta cada pulsación de + y −. Usa un decimal como 0.25 para cantidades como litros.",
	"Decrease by {n}": "Reducir en {n}",
	"4 weeks": "4 semanas",
	"12 weeks": "12 semanas",
	"6 months": "6 meses",
	"1 year": "1 año",
	"Completion rate": "Tasa de cumplimiento",
	"Monthly completion rate": "Tasa de cumplimiento mensual",
	"Daily activity": "Actividad diaria",
	"Week of {date}": "Semana del {date}",
	"Since {date} · right-click to resume":
		"Desde {date} · clic derecho para reanudar",
	"Paused on this day": "Pausado en este día",
	"Mark as done": "Marcar como hecho",
	"Mark as not done": "Marcar como no hecho",
	Done: "Hecho",
	"Not done": "Pendiente",
	"Edit value": "Editar valor",
	Value: "Valor",
	"Decrease by 1": "Reducir en 1",
	"Increase by 1": "Aumentar en 1",
	"Increase by {n}": "Aumentar en {n}",
	"Edit habit": "Editar hábito",
	"Pause habit": "Pausar hábito",
	"Resume habit": "Reanudar hábito",
	"Stop tracking": "Dejar de seguir",
	"Remove habit": "Eliminar hábito",
	'Stop tracking "{name}"? It leaves the dashboard and stats, but its note and full history are kept. You can resume tracking any time from the note\'s metrics view.':
		'¿Dejar de seguir "{name}"? Desaparece del panel y de las estadísticas, pero su nota y todo su historial se conservan. Puedes reanudar el seguimiento en cualquier momento desde la vista de métricas de la nota.',
	'Remove "{name}"? Its note will be moved to the trash.':
		'¿Eliminar "{name}"? Su nota se moverá a la papelera.',
	Remove: "Eliminar",
	"Perfect!": "¡Perfecto!",
	Today: "Hoy",
	Yesterday: "Ayer",
	Tomorrow: "Mañana",
	"Last 7 days": "Últimos 7 días",
	"Last 30 days": "Últimos 30 días",
	"This week": "Esta semana",
	"This month": "Este mes",

	// Sidebar panel
	"Habits completed today": "Hábitos completados hoy",
	"No habits yet.": "Aún no hay hábitos.",
	"Click to type a value": "Haz clic para escribir un valor",
	"Open note": "Abrir nota",

	// Stats view
	"No habits to show stats for yet.":
		"Aún no hay hábitos para mostrar estadísticas.",
	Completion: "Cumplimiento",
	"Best streak": "Mejor racha",
	"Perfect days": "Días perfectos",
	Completions: "Completados",
	"Goals met": "Metas logradas",
	"{completed}/{days} days": "{completed}/{days} días",
	"{total} total": "{total} en total",
	best: "mejor",
	"perfect week": "semana perfecta",
	"perfect month": "mes perfecto",
	"weekly goal": "meta semanal",
	"monthly goal": "meta mensual",
	"{progress}/{goal} days · {label} · {pct}%":
		"{progress}/{goal} días · {label} · {pct}%",

	// Habit metrics block
	'Place this block inside a habit note, or point it at one with "habit: <name>".':
		'Coloca este bloque dentro de una nota de hábito, o indícale uno con "habit: <nombre>".',
	'No habit called "{name}" was found.':
		'No se encontró ningún hábito llamado "{name}".',
	"No longer tracked since {date}. All history is kept.":
		"Sin seguimiento desde {date}. Todo el historial se conserva.",
	"No longer tracked. All history is kept.":
		"Sin seguimiento. Todo el historial se conserva.",
	"Resume tracking": "Reanudar seguimiento",
	"Paused since {date}. Paused days don't count against streaks or stats.":
		"Pausado desde {date}. Los días en pausa no afectan a las rachas ni a las estadísticas.",
	"Paused. Paused days don't count against streaks or stats.":
		"Pausado. Los días en pausa no afectan a las rachas ni a las estadísticas.",
	"Current streak": "Racha actual",
	"Days completed": "Días completados",
	"30-day rate": "Tasa de 30 días",
	"Weekly completion rate": "Tasa de cumplimiento semanal",
	Logged: "Registrado",
	Target: "Objetivo",

	// Export modal
	Title: "Título",
	"Habits report": "Informe de hábitos",
	"Date range": "Rango de fechas",
	"Custom range": "Rango personalizado",
	From: "Desde",
	To: "Hasta",
	"Up to {n} days.": "Hasta {n} días.",
	Content: "Contenido",
	"Summary tiles": "Mosaicos de resumen",
	"Completion trend chart": "Gráfico de tendencia de cumplimiento",
	"Daily grids": "Cuadrículas diarias",
	"Goal progress": "Progreso de metas",
	Layout: "Diseño",
	Orientation: "Orientación",
	Portrait: "Vertical",
	Landscape: "Horizontal",
	Density: "Densidad",
	Comfortable: "Cómodo",
	Compact: "Compacto",
	Monochrome: "Monocromo",
	"Ink-friendly greys instead of accent colours.":
		"Grises que ahorran tinta en lugar de colores de acento.",
	"Export PDF": "Exportar PDF",
	"No habits to export yet.": "Aún no hay hábitos para exportar.",
	'Exported to "{path}" in your vault.':
		'Exportado a "{path}" en tu bóveda.',

	// Habit modal
	"New habit": "Nuevo hábito",
	Name: "Nombre",
	Type: "Tipo",
	"Binary is done or not done. Repetition counts towards a target. Timed tracks minutes.":
		"Binario es hecho o no hecho. Repetición cuenta hacia un objetivo. Temporizado registra minutos.",
	Binary: "Binario",
	Repetition: "Repetición",
	Timed: "Temporizado",
	"Daily target (minutes)": "Objetivo diario (minutos)",
	"Daily target": "Objetivo diario",
	Unit: "Unidad",
	"Optional label shown next to the count.":
		"Etiqueta opcional que se muestra junto al recuento.",
	Icon: "Icono",
	"Choose a Lucide icon or an emoji to represent this habit.":
		"Elige un icono de Lucide o un emoji para representar este hábito.",
	Emoji: "Emoji",
	"Choose an emoji": "Elegir un emoji",
	"Clear icon": "Quitar icono",
	"Choose icon": "Elegir icono",
	"Save changes": "Guardar cambios",
	"Targets (optional)": "Metas (opcional)",
	"Set an optional weekly or monthly goal for how many days you complete this habit. For example, hitting your daily goal on all 7 days is a weekly target of 7. Turn on a perfect toggle to aim for every day of the period automatically, whatever its length.":
		"Establece una meta semanal o mensual opcional de cuántos días completas este hábito. Por ejemplo, lograr tu objetivo diario los 7 días es una meta semanal de 7. Activa un interruptor de perfección para aspirar automáticamente a todos los días del período, sea cual sea su duración.",
	"Perfect week": "Semana perfecta",
	"Aim to complete this habit every day of the week.":
		"Aspira a completar este hábito todos los días de la semana.",
	"Weekly target": "Meta semanal",
	"Optional. Days to complete per week (max 7).":
		"Opcional. Días a completar por semana (máx. 7).",
	None: "Ninguno",
	"Perfect month": "Mes perfecto",
	"Aim to complete this habit every day of the month.":
		"Aspira a completar este hábito todos los días del mes.",
	"Monthly target": "Meta mensual",
	"Optional. Days to complete per month.":
		"Opcional. Días a completar por mes.",
	Colour: "Color",
	"Pick a colour from your theme, or choose a custom one.":
		"Elige un color de tu tema o escoge uno personalizado.",
	"Your habit": "Tu hábito",

	// Icon and colour pickers
	"Search icons…": "Buscar iconos…",
	"Search emojis…": "Buscar emojis…",

	// Comments
	"Comments on cards": "Comentarios en las tarjetas",
	"Show a comment flap on dashboard cards for jotting a note about any day.":
		"Muestra una pestaña de comentarios en las tarjetas del panel para anotar cualquier día.",
	"Add comment": "Añadir comentario",
	"Flip back": "Volver a girar",
	"Edit comment": "Editar comentario",
	"Move day comments into note bodies":
		"Mover los comentarios diarios al cuerpo de las notas",
	"No comments left to move.": "No quedan comentarios por mover.",
	"Moved comments in 1 note.": "Comentarios movidos en 1 nota.",
	"Moved comments in {n} notes.":
		"Comentarios movidos en {n} notas.",
	"Add a comment for this day…": "Añade un comentario para este día…",
	Comments: "Comentarios",

	// Limit habits (experimental)
	Experimental: "Experimental",
	"These features are still being tested and may change before they become permanent. Turning one off only hides it from menus — anything you created with it keeps working.":
		"Estas funciones aún se están probando y pueden cambiar antes de ser permanentes. Desactivarlas solo las oculta de los menús: todo lo que hayas creado con ellas sigue funcionando.",
	"Break bad habits": "Romper malos hábitos",
	"Track habits you want to reduce or avoid by staying under a daily limit — for example at most 2 hours of gaming, or no smoking at all.":
		"Controla hábitos que quieres reducir o evitar manteniéndote por debajo de un límite diario — por ejemplo, como máximo 2 horas de videojuegos, o no fumar en absoluto.",
	Goal: "Objetivo",
	"Reach a target for habits you are building. Stay under a limit for habits you are cutting down or giving up.":
		"Alcanza una meta para hábitos que estás construyendo. Mantente bajo un límite para hábitos que estás reduciendo o dejando.",
	"Reach a target": "Alcanzar una meta",
	"Stay under a limit": "Mantenerse bajo un límite",
	"Binary means avoiding it entirely. Repetition counts against a daily limit. Timed tracks minutes against a daily limit.":
		"Binario significa evitarlo por completo. Repetición cuenta contra un límite diario. Cronometrado mide minutos contra un límite diario.",
	"Daily limit": "Límite diario",
	"Daily limit (minutes)": "Límite diario (minutos)",
	"0 means none at all.": "0 significa nada en absoluto.",
	"Set an optional weekly or monthly goal for how many days you stay within your limit. Turn on a perfect toggle to aim for every day of the period automatically, whatever its length.":
		"Establece una meta semanal o mensual opcional de cuántos días te mantienes dentro de tu límite. Activa un interruptor de perfección para aspirar automáticamente a todos los días del período, sea cual sea su duración.",
	Clean: "Limpio",
	Slipped: "Recaída",
	"Mark as clean": "Marcar como limpio",
	"Mark as slipped": "Marcar como recaída",
	"Days within limit": "Días dentro del límite",
	Limit: "Límite",

	// Frequencies and per-note metrics
	Frequency: "Frecuencia",
	Daily: "Diario",
	"Days of week": "Días de la semana",
	Habit: "Hábito",
	Schedule: "Programación",
	"Time of day": "Hora del día",
	"Optional times this habit is planned for — once or several times a day. Shown on the habit's card.":
		"Horas opcionales previstas para este hábito — una o varias veces al día. Se muestran en la tarjeta del hábito.",
	"Add time": "Añadir hora",
	"Remove time": "Quitar hora",
	"Every N days": "Cada N días",
	"Repeat every": "Repetir cada",
	"Day of month": "Día del mes",
	"The weekdays this habit is due on. Pick as many as you need.":
		"Los días de la semana en que vence este hábito. Elige tantos como necesites.",
	"Number of days between due dates, counted from the habit's start date. Use 2 for an alternate-day schedule.":
		"Número de días entre vencimientos, contado desde la fecha de inicio del hábito. Usa 2 para un esquema de días alternos.",
	"The day of the month this habit is due. In shorter months it falls due on the last day, so 31 always lands on the final day of the month.":
		"El día del mes en que vence este hábito. En meses más cortos vence el último día, así que 31 siempre cae en el último día del mes.",
	"Every {day}": "Cada {day}",
	"Monthly · day {day}": "Mensual · día {day}",
	"Every other day": "Cada dos días",
	"Every {n} days": "Cada {n} días",
	"No habits are due on this day.": "Ningún hábito vence este día.",
	"Nothing due today.": "Nada vence hoy.",
	"Weekly activity": "Actividad semanal",
	"Monthly activity": "Actividad mensual",
	"Activity on due days": "Actividad en días de vencimiento",
	"Completion rate over {n} due days":
		"Tasa de cumplimiento en {n} días de vencimiento",
	"Weeks completed": "Semanas completadas",
	"Months completed": "Meses completados",
	"Recent rate": "Tasa reciente",
	"{n}-week completion rate": "Tasa de cumplimiento de {n} semanas",
	"{n}-month completion rate": "Tasa de cumplimiento de {n} meses",

	// AI summaries
	"AI summaries": "Resúmenes con IA",
	"AI summary": "Resumen con IA",
	"Show an AI-generated summary with feedback and advice on the stats page tabs. Uses an OpenAI-compatible service you configure below; your habit stats are sent to it only when you press the generate button.":
		"Muestra un resumen generado por IA con comentarios y consejos en las pestañas de la página de estadísticas. Usa un servicio compatible con OpenAI que configuras abajo; tus estadísticas de hábitos se le envían solo cuando pulsas el botón de generar.",
	"AI base URL": "URL base de IA",
	"Base URL of an OpenAI-compatible API. Works with OpenAI, OpenRouter, or local servers like Ollama (http://localhost:11434/v1).":
		"URL base de una API compatible con OpenAI. Funciona con OpenAI, OpenRouter o servidores locales como Ollama (http://localhost:11434/v1).",
	"AI API key": "Clave de API de IA",
	"Stored locally in this vault's plugin data. Leave blank for local servers that need no key.":
		"Se guarda localmente en los datos del plugin de este vault. Déjala en blanco para servidores locales que no necesitan clave.",
	"AI model": "Modelo de IA",
	"Model name the service should use.":
		"Nombre del modelo que debe usar el servicio.",
	"Generate summary": "Generar resumen",
	Regenerate: "Regenerar",
	"Get feedback and advice on your habits for this period. Your stats are sent to the AI service you configured only when you press the button.":
		"Recibe comentarios y consejos sobre tus hábitos en este período. Tus estadísticas se envían al servicio de IA que configuraste solo cuando pulsas el botón.",
	"Thinking…": "Pensando…",
	"Could not generate a summary: {message}":
		"No se pudo generar el resumen: {message}",
	"Adds an AI-generated overview with feedback and advice. Your habit stats are sent to your configured AI service.":
		"Añade un resumen generado por IA con comentarios y consejos. Tus estadísticas de hábitos se envían al servicio de IA configurado.",
	"Generating AI summary…": "Generando resumen con IA…",
	"The AI summary will be generated when you export.":
		"El resumen con IA se generará al exportar.",

	// Custom stats range
	Custom: "Personalizado",
	"Start date": "Fecha de inicio",
	"End date": "Fecha de fin",

	// Heatmap start markers
	"not tracked yet": "aún sin seguimiento",
	"started tracking on {date}": "seguimiento iniciado el {date}",

	// Stats carousel
	"Stats rows per page": "Filas de estadísticas por página",
	"How many habits each stats page shows.":
		"Cuántos hábitos muestra cada página de estadísticas.",
	// Note habits
	'"{name}" uses Templater syntax, but the Templater plugin is not installed — the template was copied as plain text.':
		'"{name}" usa la sintaxis de Templater, pero el plugin Templater no está instalado — la plantilla se copió como texto sin formato.',
	"Binary is done or not done. Repetition counts towards a target. Timed tracks minutes. Note is completed by writing in a per-day note.":
		"Binario es hecho o no hecho. Repetición cuenta hacia un objetivo. Temporizado registra minutos. Nota se completa escribiendo en una nota diaria.",
	"Character count is reached": "Se alcanza un número de caracteres",
	"Character goal": "Meta de caracteres",
	"Completed when": "Completado cuando",
	"Every task is checked": "Se marcan todas las tareas",
	"Filename format": "Formato del nombre de archivo",
	"Folder each day's note is created in. Leave blank for a dedicated subfolder named after this habit.":
		"Carpeta donde se crea la nota de cada día. Déjalo en blanco para usar una subcarpeta dedicada con el nombre de este hábito.",
	"Moment.js format used to name each day's note, e.g. {example}. May include / for date-based subfolders.":
		"Formato de Moment.js usado para nombrar la nota de cada día, p. ej. {example}. Puede incluir / para subcarpetas basadas en fechas.",
	Note: "Nota",
	"Note habits": "Hábitos de notas",
	"Notes folder": "Carpeta de notas",
	"Open this day's note": "Abrir la nota de este día",
	"Open today's note": "Abrir la nota de hoy",
	"Optional template note used when a day's note is created. Expanded through the Templater plugin when it is installed, otherwise copied as plain text.":
		"Nota de plantilla opcional usada al crear la nota de un día. Se expande mediante el plugin Templater cuando está instalado; si no, se copia como texto sin formato.",
	Template: "Plantilla",
	"Track a habit by writing in a per-day note instead of logging a value by hand. A day is complete once the note reaches a character count or every task in it is checked. Works with the Templater plugin to create each day's note from a template.":
		"Sigue un hábito escribiendo en una nota diaria en lugar de registrar un valor a mano. Un día se completa cuando la nota alcanza un número de caracteres o se marcan todas sus tareas. Funciona con el plugin Templater para crear la nota de cada día a partir de una plantilla.",
	Write: "Escribir",
	"Write this day's note": "Escribir la nota de este día",
	"Write today's note": "Escribir la nota de hoy",
	"e.g. Journal": "p. ej. Diario",
	"e.g. Templates/Journal.md": "p. ej. Templates/Diario.md",

	// Flexible frequency (any day)
	"How many times (or, for counted and timed habits, how much in total) this needs to happen somewhere in the period.":
		"Cuántas veces (o, en hábitos contados o temporizados, cuánto en total) debe ocurrir esto en algún momento del período.",
	'How often this habit is due. Weekly and monthly habits only appear on their due date; the "any day" options appear every day until their quota is met.':
		'Con qué frecuencia vence este hábito. Los hábitos semanales y mensuales solo aparecen en su día de vencimiento; las opciones "cualquier día" aparecen todos los días hasta alcanzar su cuota.',
	"Monthly (any day)": "Mensual (cualquier día)",
	"Times per month": "Veces al mes",
	"Times per week": "Veces a la semana",
	"Weekly (any day)": "Semanal (cualquier día)",
	"this month": "este mes",
	"this week": "esta semana",
	"{completed}/{days} months": "{completed}/{days} meses",
	"{completed}/{days} weeks": "{completed}/{days} semanas",
	"{n}× a month · any day": "{n}× al mes · cualquier día",
	"{n}× a week · any day": "{n}× a la semana · cualquier día",

	// Commands
	"Insert habits heatmap": "Insertar mapa de calor de hábitos",

	// Habit metrics: heatmap tabs
	Charts: "Gráficos",
	Month: "Mes",
	History: "Historial",
	"{month} heatmap": "Mapa de calor de {month}",
	"Last {n} weeks": "Últimas {n} semanas",

	// Heatmap cell states and tooltips
	Upcoming: "Próximo",
	"Not tracked yet": "Aún sin seguimiento",
	"Not due": "No vence",
	"Outside this month": "Fuera de este mes",
	Complete: "Completado",
	"Over limit": "Por encima del límite",
	"Not logged": "Sin registrar",

	// Whole-vault heatmap block
	"Add a habit to see its heatmap here.":
		"Añade un hábito para ver aquí su mapa de calor.",
	"No habits in the \"{group}\" group.": 'No hay hábitos en el grupo "{group}".',
	"No habits due": "No había hábitos previstos",
	"Perfect day": "Día perfecto",
	"{completed}/{considered} habits · {pct}%":
		"{completed}/{considered} hábitos · {pct}%",
	"This year": "Este año",
	"Past 6 months": "Últimos 6 meses",
	"{year} heatmap": "Mapa de calor de {year}",

	// Note habits: checklist requirement and fail keyword
	"Both are true": "Se cumplen ambas",
	"Checklist requirement is met": "Se cumple el requisito de la lista de tareas",
	"Checklist requirement": "Requisito de la lista de tareas",
	"Require every task to be checked, or just some — useful for a list of alternatives where doing any one of them counts (e.g. \"Cardio\" / \"Weights\" / \"Rest day\").":
		'Exige marcar todas las tareas, o solo algunas — útil para una lista de alternativas en la que hacer cualquiera de ellas cuenta (p. ej. "Cardio" / "Pesas" / "Día de descanso").',
	"At least this many are checked": "Se marca al menos esta cantidad",
	"Tasks required": "Tareas requeridas",
	"Fail keyword": "Palabra clave de fallo",
	"Optional. Checking a task whose text contains this word forces the day to fail, whatever else is checked — e.g. \"Slipped\" as one of several checklist options. Leave blank to turn this off.":
		'Opcional. Marcar una tarea cuyo texto contenga esta palabra obliga a que el día falle, sea lo que sea lo demás que esté marcado — por ejemplo, "Fallé" como una más de las opciones de la lista. Déjalo en blanco para desactivarlo.',
	"e.g. Slipped": "p. ej. Fallé",
	"Reach a character count, meet a checklist requirement, or require both.":
		"Alcanza un número de caracteres, cumple un requisito de lista de tareas, o exige ambos.",

	// Tags (cross-plugin compatibility)
	Tags: "Etiquetas",
	"e.g. task": "p. ej. task",
	"Optional Obsidian tags for this note, separated by commas or spaces. Useful for making this habit recognisable to another plugin's own tag-based rules — for example TaskNotes' task tag.":
		'Etiquetas opcionales de Obsidian para esta nota, separadas por comas o espacios. Útil para que otro plugin reconozca este hábito mediante sus propias reglas basadas en etiquetas, por ejemplo la etiqueta "task" de TaskNotes.',

	// Advanced settings: frontmatter key remapping
	Advanced: "Avanzado",
	Apply: "Aplicar",
	"Apply key changes": "Aplicar cambios de claves",
	"Rename the frontmatter properties habit notes use. Useful for avoiding collisions with another plugin's own properties in the same note (for example TaskNotes).":
		"Cambia el nombre de las propiedades de frontmatter que usan las notas de hábito. Útil para evitar colisiones con las propiedades propias de otro plugin en la misma nota (por ejemplo, TaskNotes).",
	"\"{a}\" and \"{b}\" can't use the same property key (\"{value}\").":
		'"{a}" y "{b}" no pueden usar la misma clave de propiedad ("{value}").',
	"Property keys can't be empty.":
		"Las claves de propiedad no pueden estar vacías.",
	"This renames {summary} in every note in your habits folder ({count} habit(s) currently). Existing values are moved, not discarded. Continue?":
		"Esto renombrará {summary} en todas las notas de tu carpeta de hábitos ({count} hábito(s) actualmente). Los valores existentes se trasladan, no se descartan. ¿Continuar?",
	"Updated the frontmatter keys in {count} note(s).":
		"Se actualizaron las claves de frontmatter en {count} nota(s).",
	"Renaming this away from the default also changes how binary habits log a day: instead of {\"2026-08-25\": 1}, a completed day becomes a bare date, like [\"2026-08-25\"] — the shape TaskNotes uses for complete_instances. Repetition and timed habits are unaffected either way; they always need a value, never just a date.":
		'Cambiar esta clave del valor predeterminado también cambia cómo los hábitos binarios registran un día: en lugar de {"2026-08-25": 1}, un día completado se convierte en una fecha simple, como ["2026-08-25"] — la forma que usa TaskNotes para complete_instances. Los hábitos de repetición y de tiempo no se ven afectados de todos modos; siempre necesitan un valor, nunca solo una fecha.',
	Identity: "Identidad",
	Legacy: "Heredado",
	Lifecycle: "Ciclo de vida",
	Presentation: "Presentación",
	"Note habit": "Hábito de nota",
	"Habit type key": "Clave del tipo de hábito",
	"Completion records key": "Clave de los registros",
	"Frequency key": "Clave de la frecuencia",
	"Weekday key": "Clave del día de la semana",
	"Month day key": "Clave del día del mes",
	"Interval days key": "Clave de los días de intervalo",
	"Planned time key": "Clave de la hora prevista",
	"Goal direction key": "Clave de la dirección de la meta",
	"Target key": "Clave de la meta",
	"Unit key": "Clave de la unidad",
	"Step size key": "Clave del tamaño del paso",
	"Weekly target key": "Clave de la meta semanal",
	"Monthly target key": "Clave de la meta mensual",
	"Weekly perfect key": "Clave de semana perfecta",
	"Monthly perfect key": "Clave de mes perfecto",
	"Start date key": "Clave de la fecha de inicio",
	"Pauses key": "Clave de las pausas",
	"Stopped key": "Clave de detenido",
	"Stop date key": "Clave de la fecha de detención",
	"Icon key": "Clave del icono",
	"Color key": "Clave del color",
	"Group key": "Clave del grupo",
	"Use group color key": "Clave de «usar color de grupo»",
	"Note folder key": "Clave de la carpeta de notas",
	"Note filename format key": "Clave del formato de nombre de archivo",
	"Template path key": "Clave de la ruta de la plantilla",
	"Note completion mode key": "Clave del modo de finalización",
	"Note checklist requirement key": "Clave del requisito de la lista de tareas",
	"Note checklist minimum key": "Clave del mínimo de la lista de tareas",
	"Note fail keyword key": "Clave de la palabra clave de fallo",
	"Legacy comments key": "Clave de los comentarios heredados",

	// PDF export (read via docT() in export-modal.ts, which falls back to English for zh — jsPDF's built-in fonts can't render CJK)
	"Completion trend": "Tendencia de cumplimiento",
	"(paused)": "(pausado)",
	"{rate}% · {total} · streak {current} (best {best})":
		"{rate}% · {total} · racha {current} (mejor {best})",
	"Goal: {completed}/{goal} days met":
		"Meta: {completed}/{goal} días logrados",
	"{range} · exported {date}": "{range} · exportado el {date}",
	"+{n} more": "+{n} más",

	// Back-dating a missed day
	Back: "Atrás",

	// Rescheduling missed habits (experimental)
	"1 missed habit": "1 hábito omitido",
	"Add a notification button to the dashboard and sidebar panel when a habit's been missed, opening a review of missed days you can move onto a different one (never a day that habit is already due, so nothing doubles up).":
		"Añade un botón de notificación al panel principal y a la barra lateral cuando se ha omitido un hábito, que abre una revisión de los días omitidos para moverlos a otro día (nunca a un día en el que ese hábito ya venza, para que nada se duplique).",
	"Missed habits": "Hábitos omitidos",
	"Move this missed day onto a different one": "Mover este día omitido a otro",
	"Move to": "Mover a",
	"Nothing missed right now.": "No hay nada omitido por ahora.",
	"Pick a habit to move it onto a different day.":
		"Elige un hábito para moverlo a otro día.",
	Reschedule: "Reprogramar",
	"Reschedule missed habits": "Reprogramar hábitos omitidos",
	"Rescheduled \"{name}\" to {date}.": '"{name}" se reprogramó para {date}.',
	"Rescheduled from {date}": "Reprogramado desde {date}",
	"Reschedules key": "Clave de reprogramaciones",
	"Failed days key": "Clave de días fallados",
	"Skipped days key": "Clave de días omitidos",
	"Rescheduling \"{name}\" — missed {date}.":
		'Reprogramando "{name}" — se omitió el {date}.',
	"That day no longer works — pick another.":
		"Ese día ya no funciona — elige otro.",
	"That day won't work — it's either already due for this habit or already claimed by another reschedule.":
		"Ese día no sirve — o ya vence este hábito ese día, o ya lo ha reclamado otra reprogramación.",
	"{count} missed habits": "{count} hábitos omitidos",
};
