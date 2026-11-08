/** Japanese translations, keyed by the English source string. */
export const ja: Record<string, string> = {
	// Commands and ribbon
	"Create habit": "習慣を作成",
	"Insert dashboard": "ダッシュボードを挿入",
	"Insert habit metrics": "習慣メトリクスを挿入",
	"Insert habits table": "習慣テーブルを挿入",
	"Open panel": "パネルを開く",
	"Open habits panel": "習慣パネルを開く",
	Habits: "習慣",

	// Settings
	"Habits folder": "習慣フォルダー",
	"Folder where each habit is stored as its own note. It is created automatically if it does not exist.":
		"各習慣を個別のノートとして保存するフォルダー。存在しない場合は自動的に作成されます。",
	"Follow daily note date": "デイリーノートの日付に従う",
	"When a dashboard is embedded in a daily note (a note whose name contains a date like 2026-07-01), open it on that note's date instead of today.":
		"ダッシュボードがデイリーノート（2026-07-01 のような日付を名前に含むノート）に埋め込まれている場合、今日ではなくそのノートの日付で開きます。",
	"Daily note date format": "デイリーノートの日付形式",
	"Moment.js format used to read the date from a daily note's name, such as YYYY-MM-DD or YYYYMMDD.":
		"デイリーノート名から日付を読み取るための Moment.js 形式。例：YYYY-MM-DD、YYYYMMDD。",

	// Sorting
	"Sort habits by": "習慣の並び順",
	"The base order of habit cards in the dashboard and side panel.":
		"ダッシュボードとサイドパネルでのカードの基本的な並び順。",
	"Name (A–Z)": "名前(A–Z)",
	Color: "色",
	"Last logged": "最終記録",
	"Planned time": "予定時刻",
	Manual: "手動",
	"Manual order": "手動の順序",
	"Drag the cards into the order you want. New habits join the end of the list.":
		"カードをドラッグして好きな順序に並べます。新しい習慣はリストの最後に追加されます。",
	"Move completed cards to the end": "完了したカードを最後に移動",
	"Completed habits drift to the end of the queue and paused ones park behind them. Turn this off to keep every card in its sorted position.":
		"完了した習慣はキューの最後へ移動し、一時停止中の習慣はその後ろに並びます。オフにすると、すべてのカードが並び順の位置に留まります。",
	Group: "グループ",
	Ungrouped: "グループなし",
	"Optional group used to build dashboard sections — for example an area of responsibility.":
		"ダッシュボードのセクションを作るための任意のグループ — 例えば責任範囲など。",
	"e.g. Health": "例:健康",
	"Group color": "グループの色",
	"Optional color shared by every habit in this group.":
		"このグループのすべての習慣で共有される任意の色。",
	"Group icon": "グループのアイコン",
	"Shown in the group lip on cards and in section headers.":
		"カードのグループバーとセクション見出しに表示されます。",
	"Use group color for this card": "このカードにグループの色を使う",
	"Show this card in the group color instead of its own.":
		"このカードを自身の色ではなくグループの色で表示します。",
	General: "一般",
	Sorting: "並べ替え",
	Groups: "グループ",
	"How to move through your habit cards: a paged carousel with arrows, a grid that wraps onto new rows, or a fixed-height grid that scrolls vertically. The stats page follows the same choice.":
		"カードの表示方法:矢印で切り替えるカルーセル、行を折り返すグリッド、または高さ固定で縦にスクロールするグリッド。統計ページも同じ設定に従います。",
	"Enable groups": "グループを有効にする",
	"Show habits in sections by their group, with a group lip on each card.":
		"習慣をグループごとのセクションで表示し、各カードにグループバーを付けます。",
	"Group order": "グループの順序",
	"Drag the groups into the order you want. Sections follow the same order.":
		"グループを好きな順序にドラッグします。セクションも同じ順序に従います。",
	"Completion animations": "完了アニメーション",
	"Play the check swoosh, card departure, and perfect-day confetti when habits are completed. Turn off for instant, quiet updates.":
		"習慣の完了時にチェックのスウッシュ、カードの退場、パーフェクトデーの紙吹雪を再生します。オフにすると即座に静かに更新されます。",
	"Reminders": "リマインダー",
	"Write reminders for due habits": "当日実施予定の習慣のリマインダーを書き込む",
	"Each day, write one reminder checklist line per planned time of every habit due that day, in the format the Reminder plugin picks up. The lines live in a marked block and refresh as you log habits.":
		"毎日、その日に実施予定の各習慣の予定時刻ごとにリマインダー行を書き込みます。形式は Reminder プラグインが認識するものです。行はマーカー付きブロック内にあり、記録に応じて更新されます。",
	"Where to write reminders": "リマインダーの書き込み先",
	"The daily note follows the Daily notes core plugin's folder and date format; the block is added once the note exists. A fixed note is created automatically.":
		"デイリーノートはコアプラグイン「デイリーノート」のフォルダーと日付形式に従い、ノートが存在すればブロックが追加されます。固定ノートは自動的に作成されます。",
	"Today's daily note": "今日のデイリーノート",
	"A fixed note": "固定ノート",
	"Reminder note path": "リマインダーノートのパス",
	"Vault path of the note that holds the reminder block.":
		"リマインダーブロックを保持するノートの保管庫内パス。",
	"Manage groups": "グループを管理",
	"See every habit by group and drag cards between groups.":
		"グループごとに習慣を確認し、カードをグループ間でドラッグできます。",
	Open: "開く",
	"New group": "新しいグループ",
	Add: "追加",
	"Drag habits between groups to reassign them, or within a group to reorder them.":
		"習慣をグループ間でドラッグして割り当て直すか、グループ内でドラッグして並べ替えます。",
	"No habits": "習慣なし",
	"Edit group style": "グループのスタイルを編集",
	"Delete group": "グループを削除",
	'Delete "{name}"? Its habits are kept and become ungrouped.':
		"「{name}」を削除しますか?習慣は保持され、グループなしになります。",
	Delete: "削除",
	"Dashboard layout": "ダッシュボードのレイアウト",
	Carousel: "カルーセル",
	Grid: "グリッド",
	"Vertical scroll": "縦スクロール",
	"Cards per view": "1画面あたりのカード数",
	"How many habit cards fit side by side on wider screens.":
		"広い画面で横に並べるカードの数。",
	"Cards per view on mobile": "モバイルでの1画面あたりのカード数",
	"How many habit cards fit side by side on phone-sized screens.":
		"スマートフォンの画面で横に並べるカードの数。",

	// Confirm dialog defaults
	Cancel: "キャンセル",
	Confirm: "確認",

	// Store notices
	'Could not find the note for "{name}".':
		"「{name}」のノートが見つかりませんでした。",
	"Please enter a valid habit name.": "有効な習慣名を入力してください。",
	'A habit called "{name}" already exists.':
		"「{name}」という習慣はすでに存在します。",
	'Created habit "{name}".': "習慣「{name}」を作成しました。",
	'Updated "{name}".': "「{name}」を更新しました。",
	'Paused "{name}".': "「{name}」を一時停止しました。",
	'Resumed "{name}".': "「{name}」を再開しました。",
	'Stopped tracking "{name}". Its history is kept in the note.':
		"「{name}」のトラッキングを停止しました。履歴はノートに保存されています。",
	'Resumed tracking "{name}".': "「{name}」のトラッキングを再開しました。",
	'Removed "{name}".': "「{name}」を削除しました。",
	"Habit added to the dashboard.": "習慣をダッシュボードに追加しました。",

	// Dashboard
	"Back to habits": "習慣に戻る",
	"View stats": "統計を表示",
	"Export stats": "統計をエクスポート",
	Weekly: "週間",
	Monthly: "月間",
	"Previous day": "前の日",
	"Next day": "次の日",
	"Choose a date": "日付を選択",
	"Add habit": "習慣を追加",
	"No habits yet. Create your first habit to get started.":
		"まだ習慣がありません。最初の習慣を作成して始めましょう。",
	Previous: "前へ",
	Next: "次へ",
	"Go to position {n}": "位置 {n} へ移動",
	"Right-click or long-press for more options":
		"右クリックまたは長押しでその他のオプション",
	"Open habit note": "習慣のノートを開く",
	"Open the note for {name}": "{name} のノートを開く",
	Paused: "一時停止中",
	Stopped: "記録停止",
	"Failed": "失敗",
	"Skipped": "スキップ",
	"Snoozed": "スヌーズ中",
	"Snoozed until {time}": "{time} までスヌーズ中",
	"Undo fail": "失敗を取り消す",
	"Undo skip": "スキップを取り消す",
	"End snooze": "スヌーズを終了",
	"Fail for today": "今日は失敗にする",
	"Fail this day": "この日を失敗にする",
	"Marked \"{name}\" as failed.": "「{name}」を失敗にしました。",
	"Skip for today": "今日はスキップ",
	"Skip this day": "この日をスキップ",
	"Skipped \"{name}\".": "「{name}」をスキップしました。",
	"Snooze…": "スヌーズ…",
	"Snooze \"{name}\"": "「{name}」をスヌーズ",
	"It leaves today's lists and comes back on its own. Snoozing never counts for or against the habit.": "今日のリストから外れ、時間になると戻ってきます。スヌーズは習慣の記録に影響しません。",
	"Snooze for": "スヌーズする時間",
	"30 minutes": "30分",
	"1 hour": "1時間",
	"3 hours": "3時間",
	"Snooze until": "スヌーズの終了時刻",
	"Snooze": "スヌーズ",
	"Pick a time later today.": "今日のこれより後の時刻を選んでください。",
	"Snoozed \"{name}\" until {time}.": "「{name}」を {time} までスヌーズしました。",
	"1 hidden for today": "今日は1件非表示",
	"{count} hidden for today": "今日は{count}件非表示",
	"1 hidden for this day": "この日は1件非表示",
	"{count} hidden for this day": "この日は{count}件非表示",
	"Undo": "元に戻す",
	"Click to undo": "クリックで元に戻す",
	"Nothing left on this day's list.": "この日のリストには何も残っていません。",
	"Nothing left on today's list.": "今日のリストには何も残っていません。",
	"At least: reach a target for habits you are building, like drinking 1.5 litres of water. At most: stay within a limit for habits you are cutting down, like no more than 2 coffees.": "以上：身につけたい習慣の目標を達成します（例：水を1.5リットル飲む）。以下：減らしたい習慣を上限内に収めます（例：コーヒーは2杯まで）。",
	"At least (reach a target)": "以上（目標を達成）",
	"At most (stay within a limit)": "以下（上限内に収める）",
	"Step size": "増減の単位",
	"How much each + and − press adds or removes. Use a decimal such as 0.25 for amounts like litres.": "+ と − を1回押したときに増減する量です。リットルなどの量には 0.25 のような小数を使えます。",
	"Decrease by {n}": "{n} 減らす",
	"4 weeks": "4週間",
	"12 weeks": "12週間",
	"6 months": "6か月",
	"1 year": "1年",
	"Completion rate": "達成率",
	"Monthly completion rate": "月間達成率",
	"Daily activity": "日別アクティビティ",
	"Week of {date}": "{date}の週",
	"Since {date} · right-click to resume":
		"{date} から · 右クリックで再開",
	"Paused on this day": "この日は一時停止中",
	"Mark as done": "完了にする",
	"Mark as not done": "未完了にする",
	Done: "完了",
	"Not done": "未完了",
	"Edit value": "値を編集",
	Value: "値",
	"Decrease by 1": "1 減らす",
	"Increase by 1": "1 増やす",
	"Increase by {n}": "{n} 増やす",
	"Edit habit": "習慣を編集",
	"Pause habit": "習慣を一時停止",
	"Resume habit": "習慣を再開",
	"Stop tracking": "トラッキングを停止",
	"Remove habit": "習慣を削除",
	'Stop tracking "{name}"? It leaves the dashboard and stats, but its note and full history are kept. You can resume tracking any time from the note\'s metrics view.':
		"「{name}」のトラッキングを停止しますか？ダッシュボードと統計から消えますが、ノートと履歴はすべて保存されます。ノートのメトリクス表示からいつでも再開できます。",
	'Remove "{name}"? Its note will be moved to the trash.':
		"「{name}」を削除しますか？ノートはゴミ箱に移動されます。",
	Remove: "削除",
	"Perfect!": "パーフェクト！",
	Today: "今日",
	Yesterday: "昨日",
	Tomorrow: "明日",
	"Last 7 days": "過去7日間",
	"Last 30 days": "過去30日間",
	"This week": "今週",
	"This month": "今月",

	// Sidebar panel
	"Habits completed today": "今日完了した習慣",
	"No habits yet.": "まだ習慣がありません。",
	"Click to type a value": "クリックして値を入力",
	"Open note": "ノートを開く",

	// Stats view
	"No habits to show stats for yet.":
		"統計を表示できる習慣がまだありません。",
	Completion: "達成率",
	"Best streak": "最長ストリーク",
	"Perfect days": "パーフェクトな日",
	Completions: "達成回数",
	"Goals met": "達成した目標",
	"{completed}/{days} days": "{completed}/{days} 日",
	"{total} total": "合計 {total}",
	best: "最高",
	"perfect week": "パーフェクトな週",
	"perfect month": "パーフェクトな月",
	"weekly goal": "週間目標",
	"monthly goal": "月間目標",
	"{progress}/{goal} days · {label} · {pct}%":
		"{progress}/{goal} 日 · {label} · {pct}%",

	// Habit metrics block
	'Place this block inside a habit note, or point it at one with "habit: <name>".':
		"このブロックは習慣ノート内に置くか、「habit: <名前>」で習慣を指定してください。",
	'No habit called "{name}" was found.':
		"「{name}」という習慣は見つかりませんでした。",
	"No longer tracked since {date}. All history is kept.":
		"{date} 以降トラッキングされていません。履歴はすべて保存されています。",
	"No longer tracked. All history is kept.":
		"トラッキングされていません。履歴はすべて保存されています。",
	"Resume tracking": "トラッキングを再開",
	"Paused since {date}. Paused days don't count against streaks or stats.":
		"{date} から一時停止中。一時停止した日はストリークや統計に影響しません。",
	"Paused. Paused days don't count against streaks or stats.":
		"一時停止中。一時停止した日はストリークや統計に影響しません。",
	"Current streak": "現在のストリーク",
	"Days completed": "完了した日数",
	"30-day rate": "30日間の達成率",
	"Weekly completion rate": "週間達成率",
	Logged: "記録",
	Target: "目標",

	// Export modal
	Title: "タイトル",
	"Habits report": "習慣レポート",
	"Date range": "期間",
	"Custom range": "カスタム期間",
	From: "開始",
	To: "終了",
	"Up to {n} days.": "最大 {n} 日。",
	Content: "内容",
	"Summary tiles": "サマリータイル",
	"Completion trend chart": "達成率トレンドのグラフ",
	"Daily grids": "日別グリッド",
	"Goal progress": "目標の進捗",
	Layout: "レイアウト",
	Orientation: "向き",
	Portrait: "縦",
	Landscape: "横",
	Density: "密度",
	Comfortable: "ゆったり",
	Compact: "コンパクト",
	Monochrome: "モノクロ",
	"Ink-friendly greys instead of accent colours.":
		"アクセントカラーの代わりにインクにやさしいグレーを使います。",
	"Export PDF": "PDF をエクスポート",
	"No habits to export yet.":
		"エクスポートできる習慣がまだありません。",
	'Exported to "{path}" in your vault.':
		"ボルト内の「{path}」にエクスポートしました。",

	// Habit modal
	"New habit": "新しい習慣",
	Name: "名前",
	Type: "タイプ",
	"Binary is done or not done. Repetition counts towards a target. Timed tracks minutes.":
		"バイナリは完了か未完了か。回数は目標に向けてカウント。時間は分を記録します。",
	Binary: "バイナリ",
	Repetition: "回数",
	Timed: "時間",
	"Daily target (minutes)": "1日の目標（分）",
	"Daily target": "1日の目標",
	Unit: "単位",
	"Optional label shown next to the count.":
		"カウントの横に表示される任意のラベル。",
	Icon: "アイコン",
	"Choose a Lucide icon or an emoji to represent this habit.":
		"この習慣を表す Lucide アイコンか絵文字を選んでください。",
	Emoji: "絵文字",
	"Choose an emoji": "絵文字を選択",
	"Clear icon": "アイコンをクリア",
	"Choose icon": "アイコンを選択",
	"Save changes": "変更を保存",
	"Targets (optional)": "目標（任意）",
	"Set an optional weekly or monthly goal for how many days you complete this habit. For example, hitting your daily goal on all 7 days is a weekly target of 7. Turn on a perfect toggle to aim for every day of the period automatically, whatever its length.":
		"この習慣を達成する日数について、週間または月間の目標を任意で設定できます。たとえば7日間すべてで1日の目標を達成すると週間目標は7です。パーフェクトのスイッチをオンにすると、期間の長さに関係なく毎日を自動的に目指します。",
	"Perfect week": "パーフェクトな週",
	"Aim to complete this habit every day of the week.":
		"この習慣を週の毎日達成することを目指します。",
	"Weekly target": "週間目標",
	"Optional. Days to complete per week (max 7).":
		"任意。1週間に達成する日数（最大7）。",
	None: "なし",
	"Perfect month": "パーフェクトな月",
	"Aim to complete this habit every day of the month.":
		"この習慣を月の毎日達成することを目指します。",
	"Monthly target": "月間目標",
	"Optional. Days to complete per month.":
		"任意。1か月に達成する日数。",
	Colour: "カラー",
	"Pick a colour from your theme, or choose a custom one.":
		"テーマのカラーから選ぶか、カスタムカラーを指定してください。",
	"Your habit": "あなたの習慣",

	// Icon and colour pickers
	"Search icons…": "アイコンを検索…",
	"Search emojis…": "絵文字を検索…",

	// Comments
	"Comments on cards": "カードのコメント",
	"Show a comment flap on dashboard cards for jotting a note about any day.":
		"ダッシュボードのカードにコメント用のフラップを表示し、その日のメモを書き留められます。",
	"Add comment": "コメントを追加",
	"Flip back": "表に戻す",
	"Edit comment": "コメントを編集",
	"Move day comments into note bodies": "日別コメントをノート本文へ移動",
	"No comments left to move.": "移動するコメントはありません。",
	"Moved comments in 1 note.": "1 件のノートのコメントを移動しました。",
	"Moved comments in {n} notes.": "{n} 件のノートのコメントを移動しました。",
	"Add a comment for this day…": "この日のコメントを追加…",
	Comments: "コメント",

	// Limit habits (experimental)
	Experimental: "実験的機能",
	"These features are still being tested and may change before they become permanent. Turning one off only hides it from menus — anything you created with it keeps working.":
		"これらの機能はまだテスト中で、正式版になる前に変更される可能性があります。オフにしてもメニューから隠れるだけで、作成したものはそのまま動き続けます。",
	"Break bad habits": "悪い習慣を断つ",
	"Track habits you want to reduce or avoid by staying under a daily limit — for example at most 2 hours of gaming, or no smoking at all.":
		"1日の上限内に収めることで、減らしたい・やめたい習慣をトラッキングします。たとえばゲームは1日2時間まで、喫煙はゼロなど。",
	Goal: "ゴール",
	"Reach a target for habits you are building. Stay under a limit for habits you are cutting down or giving up.":
		"身につけたい習慣は目標を達成し、減らしたい・やめたい習慣は上限内にとどめます。",
	"Reach a target": "目標を達成する",
	"Stay under a limit": "上限内にとどめる",
	"Binary means avoiding it entirely. Repetition counts against a daily limit. Timed tracks minutes against a daily limit.":
		"バイナリは完全に避けること。回数は1日の上限に対してカウント。時間は1日の上限に対して分を記録します。",
	"Daily limit": "1日の上限",
	"Daily limit (minutes)": "1日の上限（分）",
	"0 means none at all.": "0 は一切なしという意味です。",
	"Set an optional weekly or monthly goal for how many days you stay within your limit. Turn on a perfect toggle to aim for every day of the period automatically, whatever its length.":
		"上限内に収めた日数について、週間または月間の目標を任意で設定できます。パーフェクトのスイッチをオンにすると、期間の長さに関係なく毎日を自動的に目指します。",
	Clean: "クリーン",
	Slipped: "スリップ",
	"Mark as clean": "クリーンにする",
	"Mark as slipped": "スリップにする",
	"Days within limit": "上限内の日数",
	Limit: "上限",

	// Frequencies and per-note metrics
	Frequency: "頻度",
	Daily: "毎日",
	"Days of week": "曜日",
	Habit: "習慣",
	Schedule: "スケジュール",
	"Time of day": "時刻",
	"Optional times this habit is planned for — once or several times a day. Shown on the habit's card.":
		"この習慣を行う予定時刻（任意）。1日1回または複数回。習慣のカードに表示されます。",
	"Add time": "時刻を追加",
	"Remove time": "時刻を削除",
	"Every N days": "N日ごと",
	"Repeat every": "繰り返し間隔",
	"Day of month": "日にち",
	"The weekdays this habit is due on. Pick as many as you need.":
		"この習慣の期日となる曜日。複数選択できます。",
	"Number of days between due dates, counted from the habit's start date. Use 2 for an alternate-day schedule.":
		"期日と期日の間の日数。習慣の開始日から数えます。2にすると1日おきになります。",
	"The day of the month this habit is due. In shorter months it falls due on the last day, so 31 always lands on the final day of the month.":
		"この習慣の期日となる日。短い月では月末が期日になるため、31 は常にその月の最終日になります。",
	"Every {day}": "毎週 {day}",
	"Monthly · day {day}": "毎月 · {day} 日",
	"Every other day": "1日おき",
	"Every {n} days": "{n}日ごと",
	"No habits are due on this day.":
		"この日に期日の習慣はありません。",
	"Nothing due today.": "今日は期日のものがありません。",
	"Weekly activity": "週間アクティビティ",
	"Monthly activity": "月間アクティビティ",
	"Activity on due days": "期日の活動",
	"Completion rate over {n} due days": "直近{n}回の期日の達成率",
	"Weeks completed": "完了した週",
	"Months completed": "完了した月",
	"Recent rate": "最近の達成率",
	"{n}-week completion rate": "{n} 週間の達成率",
	"{n}-month completion rate": "{n} か月の達成率",

	// AI summaries
	"AI summaries": "AI サマリー",
	"AI summary": "AI サマリー",
	"Show an AI-generated summary with feedback and advice on the stats page tabs. Uses an OpenAI-compatible service you configure below; your habit stats are sent to it only when you press the generate button.":
		"統計ページのタブに、フィードバックとアドバイス付きの AI 生成サマリーを表示します。下で設定する OpenAI 互換サービスを使用し、習慣の統計は生成ボタンを押したときにのみ送信されます。",
	"AI base URL": "AI ベース URL",
	"Base URL of an OpenAI-compatible API. Works with OpenAI, OpenRouter, or local servers like Ollama (http://localhost:11434/v1).":
		"OpenAI 互換 API のベース URL。OpenAI、OpenRouter、Ollama（http://localhost:11434/v1）などのローカルサーバーで動作します。",
	"AI API key": "AI API キー",
	"Stored locally in this vault's plugin data. Leave blank for local servers that need no key.":
		"このボルトのプラグインデータにローカル保存されます。キー不要のローカルサーバーでは空欄のままにしてください。",
	"AI model": "AI モデル",
	"Model name the service should use.":
		"サービスが使用するモデル名。",
	"Generate summary": "サマリーを生成",
	Regenerate: "再生成",
	"Get feedback and advice on your habits for this period. Your stats are sent to the AI service you configured only when you press the button.":
		"この期間の習慣についてフィードバックとアドバイスを受け取ります。統計は、ボタンを押したときにのみ設定した AI サービスへ送信されます。",
	"Thinking…": "考え中…",
	"Could not generate a summary: {message}":
		"サマリーを生成できませんでした：{message}",
	"Adds an AI-generated overview with feedback and advice. Your habit stats are sent to your configured AI service.":
		"フィードバックとアドバイス付きの AI 生成概要を追加します。習慣の統計は設定した AI サービスへ送信されます。",
	"Generating AI summary…": "AI サマリーを生成中…",
	"The AI summary will be generated when you export.":
		"AI サマリーはエクスポート時に生成されます。",

	// Custom stats range
	Custom: "カスタム",
	"Start date": "開始日",
	"End date": "終了日",

	// Heatmap start markers
	"not tracked yet": "まだ記録なし",
	"started tracking on {date}": "{date} にトラッキング開始",

	// Stats carousel
	"Stats rows per page": "1ページあたりの統計行数",
	"How many habits each stats page shows.":
		"各統計ページに表示する習慣の数。",
	// Note habits
	'"{name}" uses Templater syntax, but the Templater plugin is not installed — the template was copied as plain text.':
		"「{name}」はTemplater構文を使用していますが、Templaterプラグインがインストールされていません — テンプレートはプレーンテキストとしてコピーされました。",
	"Binary is done or not done. Repetition counts towards a target. Timed tracks minutes. Note is completed by writing in a per-day note.":
		"バイナリは完了か未完了か。回数は目標に向けてカウント。時間は分を記録します。ノートは日ごとのノートに書き込むことで完了します。",
	"Character count is reached": "文字数に到達する",
	"Character goal": "文字数の目標",
	"Completed when": "完了の条件",
	"Every task is checked": "すべてのタスクにチェックが入る",
	"Filename format": "ファイル名の形式",
	"Folder each day's note is created in. Leave blank for a dedicated subfolder named after this habit.":
		"毎日のノートを作成するフォルダー。空欄のままにすると、この習慣の名前が付いた専用サブフォルダーが使われます。",
	"Moment.js format used to name each day's note, e.g. {example}. May include / for date-based subfolders.":
		"毎日のノートの名前に使うMoment.js形式。例：{example}。日付ごとのサブフォルダーには / を含めることができます。",
	Note: "ノート",
	"Note habits": "ノート習慣",
	"Notes folder": "ノートのフォルダー",
	"Open this day's note": "この日のノートを開く",
	"Open today's note": "今日のノートを開く",
	"Optional template note used when a day's note is created. Expanded through the Templater plugin when it is installed, otherwise copied as plain text.":
		"日ごとのノート作成時に使う任意のテンプレートノート。Templaterプラグインがインストールされていれば展開され、なければプレーンテキストとしてコピーされます。",
	Template: "テンプレート",
	"Track a habit by writing in a per-day note instead of logging a value by hand. A day is complete once the note reaches a character count or every task in it is checked. Works with the Templater plugin to create each day's note from a template.":
		"値を手動で記録する代わりに、日ごとのノートに書き込むことで習慣を記録します。ノートが文字数に到達するか、すべてのタスクにチェックが入ると、その日は完了になります。Templaterプラグインと連携し、テンプレートから毎日のノートを作成できます。",
	Write: "書く",
	"Write this day's note": "この日のノートを書く",
	"Write today's note": "今日のノートを書く",
	"e.g. Journal": "例: Journal",
	"e.g. Templates/Journal.md": "例: Templates/Journal.md",

	// Flexible frequency (any day)
	"How many times (or, for counted and timed habits, how much in total) this needs to happen somewhere in the period.":
		"期間内のどこかでこれが何回（カウントや時間の習慣では合計でどれだけ）必要かを指定します。",
	'How often this habit is due. Weekly and monthly habits only appear on their due date; the "any day" options appear every day until their quota is met.':
		"この習慣の頻度。週間・月間の習慣は期日にのみ表示されますが、「任意の日」オプションはノルマを達成するまで毎日表示されます。",
	"Monthly (any day)": "月間（任意の日）",
	"Times per month": "月あたりの回数",
	"Times per week": "週あたりの回数",
	"Weekly (any day)": "週間（任意の日）",
	"this month": "今月",
	"this week": "今週",
	"{completed}/{days} months": "{completed}/{days} か月",
	"{completed}/{days} weeks": "{completed}/{days} 週",
	"{n}× a month · any day": "月{n}回 · 任意の日",
	"{n}× a week · any day": "週{n}回 · 任意の日",

	// Commands
	"Insert habits heatmap": "習慣ヒートマップを挿入",

	// Habit metrics: heatmap tabs
	Charts: "グラフ",
	Month: "月",
	History: "履歴",
	"{month} heatmap": "{month}のヒートマップ",
	"Last {n} weeks": "直近{n}週間",

	// Heatmap cell states and tooltips
	Upcoming: "今後",
	"Not tracked yet": "まだ記録なし",
	"Not due": "対象外",
	"Outside this month": "今月の範囲外",
	Complete: "達成",
	"Over limit": "上限超過",
	"Not logged": "未記録",

	// Whole-vault heatmap block
	"Add a habit to see its heatmap here.": "習慣を追加すると、ここにヒートマップが表示されます。",
	"No habits in the \"{group}\" group.": "「{group}」グループに習慣がありません。",
	"No habits due": "予定されている習慣なし",
	"Perfect day": "パーフェクトな日",
	"{completed}/{considered} habits · {pct}%":
		"{completed}/{considered} 件の習慣 · {pct}%",
	"This year": "今年",
	"Past 6 months": "過去6か月",
	"{year} heatmap": "{year}年のヒートマップ",

	// Note habits: checklist requirement and fail keyword
	"Both are true": "両方とも満たす",
	"Checklist requirement is met": "チェックリストの条件を満たす",
	"Checklist requirement": "チェックリストの条件",
	"Require every task to be checked, or just some — useful for a list of alternatives where doing any one of them counts (e.g. \"Cardio\" / \"Weights\" / \"Rest day\").":
		"すべてのタスクにチェックを必須にするか、一部だけでもよいことにするか選べます — 「有酸素運動」「筋トレ」「休養日」のように、どれか一つで達成とみなしたい選択肢リストに便利です。",
	"At least this many are checked": "少なくともこの数だけチェックが入る",
	"Tasks required": "必要なタスク数",
	"Fail keyword": "失敗キーワード",
	"Optional. Checking a task whose text contains this word forces the day to fail, whatever else is checked — e.g. \"Slipped\" as one of several checklist options. Leave blank to turn this off.":
		"任意設定です。テキストにこの単語を含むタスクにチェックを入れると、他に何をチェックしていても、その日は強制的に失敗扱いになります — 例えば「失敗」をチェックリストの選択肢の一つにする、といった使い方です。空欄にするとオフになります。",
	"e.g. Slipped": "例: 失敗",
	"Reach a character count, meet a checklist requirement, or require both.":
		"文字数に到達する、チェックリストの条件を満たす、またはその両方を必須にする、から選べます。",

	// Tags (cross-plugin compatibility)
	Tags: "タグ",
	"e.g. task": "例: task",
	"Optional Obsidian tags for this note, separated by commas or spaces. Useful for making this habit recognisable to another plugin's own tag-based rules — for example TaskNotes' task tag.":
		"このノートの任意の Obsidian タグです。カンマまたはスペースで区切ります。別のプラグイン独自のタグルールにこの習慣を認識させるのに便利です — 例えば TaskNotes の task タグなど。",

	// Advanced settings: frontmatter key remapping
	Advanced: "詳細設定",
	Apply: "適用",
	"Apply key changes": "キーの変更を適用",
	"Rename the frontmatter properties habit notes use. Useful for avoiding collisions with another plugin's own properties in the same note (for example TaskNotes).":
		"習慣ノートが使用するフロントマターのプロパティ名を変更します。同じノート内で別のプラグイン（例: TaskNotes）独自のプロパティと衝突するのを避けるのに便利です。",
	"\"{a}\" and \"{b}\" can't use the same property key (\"{value}\").":
		"「{a}」と「{b}」に同じプロパティキー（「{value}」）は使用できません。",
	"Property keys can't be empty.": "プロパティキーを空にすることはできません。",
	"This renames {summary} in every note in your habits folder ({count} habit(s) currently). Existing values are moved, not discarded. Continue?":
		"これにより、習慣フォルダー内のすべてのノート（現在 {count} 件の習慣）で {summary} の名前が変更されます。既存の値は破棄されず移動します。続行しますか?",
	"Updated the frontmatter keys in {count} note(s).":
		"{count} 件のノートでフロントマターのキーを更新しました。",
	"Renaming this away from the default also changes how binary habits log a day: instead of {\"2026-08-25\": 1}, a completed day becomes a bare date, like [\"2026-08-25\"] — the shape TaskNotes uses for complete_instances. Repetition and timed habits are unaffected either way; they always need a value, never just a date.":
		'このキーを既定値から変更すると、バイナリ習慣が1日をどう記録するかも変わります。{"2026-08-25": 1} の代わりに、完了した日は ["2026-08-25"] のような単なる日付になります — これは TaskNotes が complete_instances に使う形式です。回数記録・時間記録の習慣はどちらの場合も影響を受けません。常に値が必要で、日付だけになることはありません。',
	Identity: "識別情報",
	Legacy: "レガシー",
	Lifecycle: "ライフサイクル",
	Presentation: "表示",
	"Note habit": "ノート習慣",
	"Habit type key": "習慣タイプキー",
	"Completion records key": "完了記録キー",
	"Frequency key": "頻度キー",
	"Weekday key": "曜日キー",
	"Month day key": "月内日キー",
	"Interval days key": "間隔日数キー",
	"Planned time key": "予定時刻キー",
	"Goal direction key": "目標の方向キー",
	"Target key": "目標キー",
	"Unit key": "単位キー",
	"Step size key": "増減単位キー",
	"Weekly target key": "週間目標キー",
	"Monthly target key": "月間目標キー",
	"Weekly perfect key": "パーフェクト週キー",
	"Monthly perfect key": "パーフェクト月キー",
	"Start date key": "開始日キー",
	"Pauses key": "一時停止記録キー",
	"Stopped key": "停止状態キー",
	"Stop date key": "停止日キー",
	"Icon key": "アイコンキー",
	"Color key": "色キー",
	"Group key": "グループキー",
	"Use group color key": "「グループの色を使用」キー",
	"Note folder key": "ノートフォルダーキー",
	"Note filename format key": "ノートのファイル名形式キー",
	"Template path key": "テンプレートパスキー",
	"Note completion mode key": "ノート完了モードキー",
	"Note checklist requirement key": "チェックリスト条件キー",
	"Note checklist minimum key": "チェックリスト最小数キー",
	"Note fail keyword key": "失敗ワードのキー",
	"Legacy comments key": "旧形式コメントキー",

	// PDF export (read via docT() in export-modal.ts, which falls back to English for zh — jsPDF's built-in fonts can't render CJK)
	"Completion trend": "達成率トレンド",
	"(paused)": "（一時停止中）",
	"{rate}% · {total} · streak {current} (best {best})":
		"{rate}% · {total} · ストリーク {current}（最高 {best}）",
	"Goal: {completed}/{goal} days met":
		"目標：{completed}/{goal} 日達成",
	"{range} · exported {date}": "{range} · {date} にエクスポート",
	"+{n} more": "他 {n} 件",

	// Back-dating a missed day
	Back: "戻る",

	// Rescheduling missed habits (experimental)
	"1 missed habit": "見逃した習慣が1件",
	"Add a notification button to the dashboard and sidebar panel when a habit's been missed, opening a review of missed days you can move onto a different one (never a day that habit is already due, so nothing doubles up).":
		"習慣を見逃したときに、ダッシュボードとサイドパネルに通知ボタンを追加します。見逃した日を確認し、別の日に移動できます（その習慣がもともと予定されている日には移動できないため、二重記録にはなりません）。",
	"Missed habits": "見逃した習慣",
	"Move this missed day onto a different one": "この見逃した日を別の日に移動",
	"Move to": "移動先",
	"Nothing missed right now.": "現在、見逃したものはありません。",
	"Pick a habit to move it onto a different day.": "別の日に移動する習慣を選んでください。",
	Reschedule: "リスケジュール",
	"Reschedule missed habits": "見逃した習慣をリスケジュール",
	"Rescheduled \"{name}\" to {date}.": "「{name}」を{date}にリスケジュールしました。",
	"Rescheduled from {date}": "{date}からリスケジュール",
	"Reschedules key": "リスケジュールキー",
	"Failed days key": "失敗した日のキー",
	"Skipped days key": "スキップした日のキー",
	"Rescheduling \"{name}\" — missed {date}.":
		"「{name}」をリスケジュール中 — {date}に見逃しました。",
	"That day no longer works — pick another.": "その日はもう使えません — 別の日を選んでください。",
	"That day won't work — it's either already due for this habit or already claimed by another reschedule.":
		"その日は使えません — その習慣がもともとその日に予定されているか、すでに別のリスケジュールで使われています。",
	"{count} missed habits": "見逃した習慣が{count}件",
};
