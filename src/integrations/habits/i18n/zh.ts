/** Simplified Chinese translations, keyed by the English source string. */
export const zh: Record<string, string> = {
	"Check-in window": "签到窗口",
	"You can complete this habit on any of these days in each interval. Missed windows do not shift the next fixed cycle.": "每个周期中的任意一天都可完成；错过窗口不会改变下一个固定周期。",
	"Restart cycle from today": "从今天重新开始周期",
	"Keep past records and start a new interval cycle today.": "保留过去的记录，从今天开始新的间隔周期。",
	"Interval window days key": "间隔签到窗口天数属性名",
	"Interval schedule key": "间隔排期方式属性名",
	"This note is managed by Task Genius.": "此笔记由 Task Genius 管理。",
	// Commands and ribbon
	"Create habit": "创建习惯",
	"Insert dashboard": "插入习惯面板",
	"Insert habit metrics": "插入习惯指标",
	"Insert habits table": "插入习惯表格",
	"Open panel": "打开侧边栏面板",
	"Open habits panel": "打开习惯侧边栏",
	Habits: "习惯",

	// Settings
	"Habits folder": "习惯文件夹",
	"Folder where each habit is stored as its own note. It is created automatically if it does not exist.":
		"每个习惯都以独立笔记的形式存放在此文件夹中。如果不存在会自动创建。",
	"Follow daily note date": "跟随日记日期",
	"When a dashboard is embedded in a daily note (a note whose name contains a date like 2026-07-01), open it on that note's date instead of today.":
		"当习惯面板嵌入到日记中（笔记名称包含类似 2026-07-01 的日期）时，面板会显示该笔记日期的记录，而不是今天。",
	"Daily note date format": "日记日期格式",
	"Moment.js format used to read the date from a daily note's name, such as YYYY-MM-DD or YYYYMMDD.":
		"用于从日记名称中读取日期的 Moment.js 格式，例如 YYYY-MM-DD 或 YYYYMMDD。",

	// Sorting
	"Sort habits by": "习惯排序方式",
	"The base order of habit cards in the dashboard and side panel.":
		"仪表盘和侧边面板中习惯卡片的基本顺序。",
	"Name (A–Z)": "名称(A–Z)",
	Color: "颜色",
	"Last logged": "最近记录",
	"Planned time": "计划时间",
	Manual: "手动",
	"Manual order": "手动排序",
	"Drag the cards into the order you want. New habits join the end of the list.":
		"拖动卡片调整顺序。新习惯会添加到列表末尾。",
	"Move completed cards to the end": "将已完成的卡片移到末尾",
	"Completed habits drift to the end of the queue and paused ones park behind them. Turn this off to keep every card in its sorted position.":
		"已完成的习惯会移到队列末尾,暂停的习惯排在其后。关闭后,所有卡片保持排序位置不变。",
	Group: "分组",
	Ungrouped: "未分组",
	"Optional group used to build dashboard sections — for example an area of responsibility.":
		"用于在仪表盘中创建分区的可选分组 — 例如某个职责领域。",
	"e.g. Health": "例如:健康",
	"Group color": "分组颜色",
	"Optional color shared by every habit in this group.": "该分组中所有习惯共享的可选颜色。",
	"Group icon": "分组图标",
	"Shown in the group lip on cards and in section headers.":
		"显示在卡片的分组条和分区标题中。",
	"Use group color for this card": "此卡片使用分组颜色",
	"Show this card in the group color instead of its own.":
		"以分组颜色而非自身颜色显示此卡片。",
	General: "常规",
	Sorting: "排序",
	Groups: "分组",
	"How to move through your habit cards: a paged carousel with arrows, a grid that wraps onto new rows, or a fixed-height grid that scrolls vertically. The stats page follows the same choice.":
		"浏览习惯卡片的方式:带箭头的分页轮播、自动换行的网格,或固定高度、垂直滚动的网格。统计页面遵循相同设置。",
	"Enable groups": "启用分组",
	"Show habits in sections by their group, with a group lip on each card.":
		"按分组分区显示习惯,并在每张卡片上显示分组条。",
	"Group order": "分组顺序",
	"Drag the groups into the order you want. Sections follow the same order.":
		"拖动分组以调整顺序。分区遵循相同顺序。",
	"Completion animations": "完成动画",
	"Play the check swoosh, card departure, and perfect-day confetti when habits are completed. Turn off for instant, quiet updates.":
		"完成习惯时播放对勾划入、卡片退场和完美一天的彩纸动画。关闭后立即静默更新。",
	"Reminders": "提醒",
	"Write reminders for due habits": "为当日应做的习惯写入提醒",
	"Each day, write one reminder checklist line per planned time of every habit due that day, in the format the Reminder plugin picks up. The lines live in a marked block and refresh as you log habits.":
		"每天为当日应做的每个习惯的每个计划时间写入一行提醒清单，格式可被 Reminder 插件识别。这些行位于带标记的块中，并随打卡自动刷新。",
	"Where to write reminders": "提醒写入位置",
	"The daily note follows the Daily notes core plugin's folder and date format; the block is added once the note exists. A fixed note is created automatically.":
		"每日笔记遵循核心“每日笔记”插件的文件夹和日期格式；笔记存在后即会添加该块。固定笔记会自动创建。",
	"Today's daily note": "今天的每日笔记",
	"A fixed note": "固定笔记",
	"Reminder note path": "提醒笔记路径",
	"Vault path of the note that holds the reminder block.": "存放提醒块的笔记在库中的路径。",
	"Manage groups": "管理分组",
	"See every habit by group and drag cards between groups.":
		"按分组查看所有习惯,并在分组间拖动卡片。",
	Open: "打开",
	"New group": "新建分组",
	Add: "添加",
	"Drag habits between groups to reassign them, or within a group to reorder them.":
		"在分组之间拖动习惯以重新分配,或在分组内拖动以调整顺序。",
	"No habits": "没有习惯",
	"Edit group style": "编辑分组样式",
	"Delete group": "删除分组",
	'Delete "{name}"? Its habits are kept and become ungrouped.':
		"删除“{name}”?其习惯将保留并变为未分组。",
	Delete: "删除",
	"Dashboard layout": "仪表盘布局",
	Carousel: "轮播",
	Grid: "网格",
	"Vertical scroll": "垂直滚动",
	"Cards per view": "每页卡片数",
	"How many habit cards fit side by side on wider screens.":
		"宽屏上并排显示多少张习惯卡片。",
	"Cards per view on mobile": "移动端每页卡片数",
	"How many habit cards fit side by side on phone-sized screens.":
		"手机屏幕上并排显示多少张习惯卡片。",

	// Confirm dialog defaults
	Cancel: "取消",
	Confirm: "确认",

	// Store notices
	'Could not find the note for "{name}".': "找不到“{name}”的笔记。",
	"Please enter a valid habit name.": "请输入有效的习惯名称。",
	'A habit called "{name}" already exists.':
		"名为“{name}”的习惯已存在。",
	'Created habit "{name}".': "已创建习惯“{name}”。",
	'Updated "{name}".': "已更新“{name}”。",
	'Paused "{name}".': "已暂停“{name}”。",
	'Resumed "{name}".': "已恢复“{name}”。",
	'Stopped tracking "{name}". Its history is kept in the note.':
		"已停止跟踪“{name}”。其历史记录保留在笔记中。",
	'Resumed tracking "{name}".': "已恢复跟踪“{name}”。",
	'Removed "{name}".': "已删除“{name}”。",
	"Habit added to the dashboard.": "习惯已添加到面板。",

	// Dashboard
	"Back to habits": "返回习惯",
	"View stats": "查看统计",
	"Export stats": "导出统计",
	Weekly: "每周",
	Monthly: "每月",
	"Previous day": "前一天",
	"Next day": "后一天",
	"Choose a date": "选择日期",
	"Add habit": "添加习惯",
	"No habits yet. Create your first habit to get started.":
		"还没有习惯。创建你的第一个习惯开始吧。",
	Previous: "上一页",
	Next: "下一页",
	"Go to position {n}": "跳到第 {n} 页",
	"Right-click or long-press for more options":
		"右键或长按查看更多选项",
	"Open habit note": "打开习惯笔记",
	"Open the note for {name}": "打开 {name} 的笔记",
	Paused: "已暂停",
	Stopped: "已停止追踪",
	"Failed": "已失败",
	"Skipped": "已跳过",
	"Snoozed": "已暂缓",
	"Snoozed until {time}": "暂缓至 {time}",
	"Undo fail": "撤销失败",
	"Undo skip": "撤销跳过",
	"End snooze": "结束暂缓",
	"Fail for today": "今天标记为失败",
	"Fail this day": "将这一天标记为失败",
	"Marked \"{name}\" as failed.": "已将“{name}”标记为失败。",
	"Skip for today": "今天跳过",
	"Skip this day": "跳过这一天",
	"Skipped \"{name}\".": "已跳过“{name}”。",
	"Snooze…": "暂缓…",
	"Snooze \"{name}\"": "暂缓“{name}”",
	"It leaves today's lists and comes back on its own. Snoozing never counts for or against the habit.": "它会离开今天的列表并在到时后自动回来。暂缓不会计入习惯的成功或失败。",
	"Snooze for": "暂缓时长",
	"30 minutes": "30 分钟",
	"1 hour": "1 小时",
	"3 hours": "3 小时",
	"Snooze until": "暂缓至",
	"Snooze": "暂缓",
	"Pick a time later today.": "请选择今天稍后的时间。",
	"Snoozed \"{name}\" until {time}.": "已将“{name}”暂缓至 {time}。",
	"1 hidden for today": "今天隐藏了 1 个",
	"{count} hidden for today": "今天隐藏了 {count} 个",
	"1 hidden for this day": "这一天隐藏了 1 个",
	"{count} hidden for this day": "这一天隐藏了 {count} 个",
	"Undo": "撤销",
	"Click to undo": "点击撤销",
	"Nothing left on this day's list.": "这一天的列表已清空。",
	"Nothing left on today's list.": "今天的列表已清空。",
	"At least: reach a target for habits you are building, like drinking 1.5 litres of water. At most: stay within a limit for habits you are cutting down, like no more than 2 coffees.": "至少：为正在养成的习惯达成目标，例如喝 1.5 升水。至多：为正在减少的习惯保持在限额内，例如不超过 2 杯咖啡。",
	"At least (reach a target)": "至少（达成目标）",
	"At most (stay within a limit)": "至多（不超过限额）",
	"Step size": "步长",
	"How much each + and − press adds or removes. Use a decimal such as 0.25 for amounts like litres.": "每次按 + 或 − 增加或减少的数量。对于升等数量，可使用 0.25 这样的小数。",
	"Decrease by {n}": "减少 {n}",
	"4 weeks": "4 周",
	"12 weeks": "12 周",
	"6 months": "6 个月",
	"1 year": "1 年",
	"Completion rate": "完成率",
	"Monthly completion rate": "每月完成率",
	"Daily activity": "每日活动",
	"Week of {date}": "{date} 当周",
	"Since {date} · right-click to resume":
		"自 {date} 起 · 右键恢复",
	"Paused on this day": "当天已暂停",
	"Mark as done": "标记为已完成",
	"Mark as not done": "标记为未完成",
	Done: "已完成",
	"Not done": "未完成",
	"Edit value": "编辑数值",
	Value: "数值",
	"Decrease by 1": "减少 1",
	"Compact list": "紧凑列表",
	"Choose a carousel, grid, vertical scroll, or compact list for your habits dashboard.": "选择轮播、网格、垂直滚动或紧凑列表作为习惯仪表盘样式。",
	"Could not save habit record.": "无法保存习惯记录。",
	"Increase by 1": "增加 1",
	"Increase by {n}": "增加 {n}",
	"Edit habit": "编辑习惯",
	"Pause habit": "暂停习惯",
	"Resume habit": "恢复习惯",
	"Stop tracking": "停止跟踪",
	"Remove habit": "删除习惯",
	'Stop tracking "{name}"? It leaves the dashboard and stats, but its note and full history are kept. You can resume tracking any time from the note\'s metrics view.':
		"停止跟踪“{name}”？它将从面板和统计中移除，但其笔记和全部历史记录会保留。你随时可以在笔记的指标视图中恢复跟踪。",
	'Remove "{name}"? Its note will be moved to the trash.':
		"删除“{name}”？其笔记将被移入回收站。",
	Remove: "删除",
	"Perfect!": "完美！",
	Today: "今天",
	Yesterday: "昨天",
	Tomorrow: "明天",
	"Last 7 days": "最近 7 天",
	"Last 30 days": "最近 30 天",
	"This week": "本周",
	"This month": "本月",

	// Sidebar panel
	"Habits completed today": "今日已完成的习惯",
	"No habits yet.": "还没有习惯。",
	"Click to type a value": "点击输入数值",
	"Open note": "打开笔记",

	// Stats view
	"No habits to show stats for yet.": "还没有可统计的习惯。",
	Completion: "完成率",
	"Best streak": "最长连击",
	"Perfect days": "完美天数",
	Completions: "完成次数",
	"Goals met": "达成目标",
	"{completed}/{days} days": "{completed}/{days} 天",
	"{total} total": "共 {total}",
	best: "最佳",
	"perfect week": "完美一周",
	"perfect month": "完美一月",
	"weekly goal": "周目标",
	"monthly goal": "月目标",
	"{progress}/{goal} days · {label} · {pct}%":
		"{progress}/{goal} 天 · {label} · {pct}%",

	// Habit metrics block
	'Place this block inside a habit note, or point it at one with "habit: <name>".':
		"请将此代码块放入习惯笔记中，或用“habit: <名称>”指定一个习惯。",
	'No habit called "{name}" was found.': "找不到名为“{name}”的习惯。",
	"No longer tracked since {date}. All history is kept.":
		"自 {date} 起已停止跟踪。所有历史记录均已保留。",
	"No longer tracked. All history is kept.":
		"已停止跟踪。所有历史记录均已保留。",
	"Resume tracking": "恢复跟踪",
	"Paused since {date}. Paused days don't count against streaks or stats.":
		"自 {date} 起暂停。暂停的日子不会影响连击或统计。",
	"Paused. Paused days don't count against streaks or stats.":
		"已暂停。暂停的日子不会影响连击或统计。",
	"Current streak": "当前连击",
	"Days completed": "完成天数",
	"30-day rate": "30 天完成率",
	"Weekly completion rate": "每周完成率",
	Logged: "已记录",
	Target: "目标",

	// Export modal
	Title: "标题",
	"Habits report": "习惯报告",
	"Date range": "日期范围",
	"Custom range": "自定义范围",
	From: "从",
	To: "到",
	"Up to {n} days.": "最多 {n} 天。",
	Content: "内容",
	"Summary tiles": "摘要卡片",
	"Completion trend chart": "完成趋势图",
	"Daily grids": "每日网格",
	"Goal progress": "目标进度",
	Layout: "布局",
	Orientation: "方向",
	Portrait: "纵向",
	Landscape: "横向",
	Density: "密度",
	Comfortable: "宽松",
	Compact: "紧凑",
	Monochrome: "黑白",
	"Ink-friendly greys instead of accent colours.":
		"使用省墨的灰色代替强调色。",
	"Export PDF": "导出 PDF",
	"No habits to export yet.": "还没有可导出的习惯。",
	'Exported to "{path}" in your vault.':
		"已导出到仓库中的“{path}”。",

	// Habit modal
	"New habit": "新习惯",
	Name: "名称",
	Type: "类型",
	"Binary is done or not done. Repetition counts towards a target. Timed tracks minutes.":
		"二元型：完成或未完成。重复型：向目标计数。计时型：记录分钟数。",
	Binary: "二元",
	Repetition: "重复",
	Timed: "计时",
	"Daily target (minutes)": "每日目标（分钟）",
	"Daily target": "每日目标",
	Unit: "单位",
	"Optional label shown next to the count.":
		"显示在计数旁边的可选标签。",
	Icon: "图标",
	"Choose a Lucide icon or an emoji to represent this habit.":
		"选择一个 Lucide 图标或 emoji 来代表这个习惯。",
	Emoji: "表情符号",
	"Choose an emoji": "选择表情符号",
	"Clear icon": "清除图标",
	"Choose icon": "选择图标",
	"Save changes": "保存更改",
	"Targets (optional)": "目标（可选）",
	"Set an optional weekly or monthly goal for how many days you complete this habit. For example, hitting your daily goal on all 7 days is a weekly target of 7. Turn on a perfect toggle to aim for every day of the period automatically, whatever its length.":
		"设置可选的每周或每月目标，规定完成该习惯的天数。例如，7 天全部达成每日目标即为周目标 7。开启“完美”开关可自动以该周期的每一天为目标，无论周期多长。",
	"Perfect week": "完美一周",
	"Aim to complete this habit every day of the week.":
		"力争一周中的每一天都完成这个习惯。",
	"Weekly target": "周目标",
	"Optional. Days to complete per week (max 7).":
		"可选。每周需完成的天数（最多 7 天）。",
	None: "无",
	"Perfect month": "完美一月",
	"Aim to complete this habit every day of the month.":
		"力争一个月中的每一天都完成这个习惯。",
	"Monthly target": "月目标",
	"Optional. Days to complete per month.":
		"可选。每月需完成的天数。",
	Colour: "颜色",
	"Pick a colour from your theme, or choose a custom one.":
		"从主题中选择颜色，或自定义一个。",
	"Your habit": "你的习惯",

	// Icon and colour pickers
	"Search icons…": "搜索图标…",
	"Search emojis…": "搜索表情符号…",

	// Comments
	"Comments on cards": "卡片评论",
	"Show a comment flap on dashboard cards for jotting a note about any day.":
		"在面板卡片上显示评论翻页，可为任意一天记录备注。",
	"Add comment": "添加评论",
	"Flip back": "翻回正面",
	"Edit comment": "编辑评论",
	"Move day comments into note bodies": "将每日评论移入笔记正文",
	"No comments left to move.": "没有需要移动的评论。",
	"Moved comments in 1 note.": "已移动 1 篇笔记中的评论。",
	"Moved comments in {n} notes.": "已移动 {n} 篇笔记中的评论。",
	"Add a comment for this day…": "为这一天添加评论…",
	Comments: "评论",

	// Limit habits (experimental)
	Experimental: "实验性功能",
	"These features are still being tested and may change before they become permanent. Turning one off only hides it from menus — anything you created with it keeps working.":
		"这些功能仍在测试中，在正式发布前可能会有变化。关闭某项功能只会将其从菜单中隐藏——你用它创建的内容会继续正常工作。",
	"Break bad habits": "戒除坏习惯",
	"Track habits you want to reduce or avoid by staying under a daily limit — for example at most 2 hours of gaming, or no smoking at all.":
		"通过保持在每日限额以下来跟踪你想减少或戒除的习惯——例如每天最多玩 2 小时游戏，或完全不吸烟。",
	Goal: "目标",
	"Reach a target for habits you are building. Stay under a limit for habits you are cutting down or giving up.":
		"要养成的习惯选择达成目标。要减少或戒除的习惯选择保持在限额以下。",
	"Reach a target": "达成目标",
	"Stay under a limit": "保持在限额以下",
	"Binary means avoiding it entirely. Repetition counts against a daily limit. Timed tracks minutes against a daily limit.":
		"二元表示完全避免。重复按每日限额计数。计时按每日限额记录分钟数。",
	"Daily limit": "每日限额",
	"Weekly limit": "每周限额",
	"Weekly total limit · any day": "每周累计限额 · 任意日期",
	"Monthly total limit · any day": "每月累计限额 · 任意日期",
	"Monthly limit": "每月限额",
	"Limit per due day": "每个计划日的限额",
	"Limit in minutes. 0 means none at all.": "限额以分钟计，0 表示完全不允许。",
	"Choose the days this limit applies, or a weekly/monthly total limit that can be logged on any day.": "选择限制适用的日期，或选择可在任意日期记录的每周／每月累计限额。",
	"Binary means avoiding it entirely. Repetition counts against a limit. Timed tracks minutes against a limit. Frequency determines when the limit applies.": "二元类型表示完全避免；计数和计时类型分别按次数和分钟判断是否超限。频率决定限制适用的日期或周期。",
	"Daily limit (minutes)": "每日限额（分钟）",
	"0 means none at all.": "0 表示完全不做。",
	"Set an optional weekly or monthly goal for how many days you stay within your limit. Turn on a perfect toggle to aim for every day of the period automatically, whatever its length.":
		"设置一个可选的每周或每月目标，即有多少天保持在限额以内。打开完美开关即可自动以该时段的每一天为目标，无论其长短。",
	Clean: "未破戒",
	Slipped: "破戒",
	"Mark as clean": "标记为未破戒",
	"Mark as slipped": "标记为破戒",
	"Days within limit": "限额内天数",
	Limit: "限额",

	// Frequencies and per-note metrics
	Frequency: "频率",
	Daily: "每天",
	"Days of week": "星期几",
	Habit: "习惯",
	Schedule: "计划",
	"Time of day": "时间",
	"Optional times this habit is planned for — once or several times a day. Shown on the habit's card.":
		"此习惯计划进行的时间（可选）——每天一次或多次。显示在习惯卡片上。",
	"Add time": "添加时间",
	"Remove time": "移除时间",
	"Every N days": "每 N 天",
	"Repeat every": "重复间隔",
	"Day of month": "每月日期",
	"The weekdays this habit is due on. Pick as many as you need.":
		"此习惯到期的星期几。可选择多个。",
	"Number of days between due dates, counted from the habit's start date. Use 2 for an alternate-day schedule.":
		"两次到期之间的天数，从习惯的开始日期算起。填 2 表示隔天一次。",
	"The day of the month this habit is due. In shorter months it falls due on the last day, so 31 always lands on the final day of the month.":
		"此习惯每月的到期日。在较短的月份中落在最后一天，因此 31 总是落在当月最后一天。",
	"Every {day}": "每{day}",
	"Monthly · day {day}": "每月 · 第 {day} 天",
	"Every other day": "隔天一次",
	"Every {n} days": "每 {n} 天",
	"No habits are due on this day.": "这一天没有到期的习惯。",
	"Nothing due today.": "今天没有到期的习惯。",
	"Weekly activity": "每周活动",
	"Monthly activity": "每月活动",
	"Activity on due days": "到期日活动",
	"Completion rate over {n} due days": "最近 {n} 个到期日的完成率",
	"Weeks completed": "已完成周数",
	"Months completed": "已完成月数",
	"Recent rate": "近期完成率",
	"{n}-week completion rate": "{n} 周完成率",
	"{n}-month completion rate": "{n} 个月完成率",

	// AI summaries
	"AI summaries": "AI 摘要",
	"AI summary": "AI 摘要",
	"Show an AI-generated summary with feedback and advice on the stats page tabs. Uses an OpenAI-compatible service you configure below; your habit stats are sent to it only when you press the generate button.":
		"在统计页的标签页中显示由 AI 生成的摘要，包含反馈和建议。使用下方配置的 OpenAI 兼容服务；只有按下生成按钮时，习惯统计数据才会发送给它。",
	"AI base URL": "AI 基础 URL",
	"Base URL of an OpenAI-compatible API. Works with OpenAI, OpenRouter, or local servers like Ollama (http://localhost:11434/v1).":
		"OpenAI 兼容 API 的基础 URL。适用于 OpenAI、OpenRouter 或本地服务器（如 Ollama：http://localhost:11434/v1）。",
	"AI API key": "AI API 密钥",
	"Stored locally in this vault's plugin data. Leave blank for local servers that need no key.":
		"保存在此仓库的插件数据中（仅限本地）。本地服务器无需密钥时可留空。",
	"AI model": "AI 模型",
	"Model name the service should use.": "服务应使用的模型名称。",
	"Generate summary": "生成摘要",
	Regenerate: "重新生成",
	"Get feedback and advice on your habits for this period. Your stats are sent to the AI service you configured only when you press the button.":
		"获取本时段习惯的反馈和建议。只有按下按钮时，统计数据才会发送到所配置的 AI 服务。",
	"Thinking…": "思考中…",
	"Could not generate a summary: {message}": "无法生成摘要：{message}",
	"Adds an AI-generated overview with feedback and advice. Your habit stats are sent to your configured AI service.":
		"添加由 AI 生成的概览，包含反馈和建议。习惯统计数据会发送到所配置的 AI 服务。",
	"Generating AI summary…": "正在生成 AI 摘要…",
	"The AI summary will be generated when you export.":
		"导出时将生成 AI 摘要。",

	// Custom stats range
	Custom: "自定义",
	"Start date": "开始日期",
	"End date": "结束日期",

	// Heatmap start markers
	"not tracked yet": "尚未跟踪",
	"started tracking on {date}": "自 {date} 开始跟踪",

	// Stats carousel
	"Stats rows per page": "每页统计行数",
	"How many habits each stats page shows.": "每页统计显示多少个习惯。",
	// Note habits
	'"{name}" uses Templater syntax, but the Templater plugin is not installed — the template was copied as plain text.':
		'"{name}" 使用了 Templater 语法，但未安装 Templater 插件——模板已作为纯文本复制。',
	"Binary is done or not done. Repetition counts towards a target. Timed tracks minutes. Note is completed by writing in a per-day note.":
		"二元型：完成或未完成。重复型：向目标计数。计时型：记录分钟数。笔记型：通过在每日笔记中写作来完成。",
	"Character count is reached": "达到字数",
	"Character goal": "字数目标",
	"Completed when": "完成条件",
	"Every task is checked": "勾选所有任务",
	"Filename format": "文件名格式",
	"Folder each day's note is created in. Leave blank for a dedicated subfolder named after this habit.":
		"每日笔记的创建文件夹。留空则使用以此习惯命名的专用子文件夹。",
	"Moment.js format used to name each day's note, e.g. {example}. May include / for date-based subfolders.":
		"用于命名每日笔记的 Moment.js 格式，例如 {example}。可包含 / 以创建按日期划分的子文件夹。",
	Note: "笔记",
	"Note habits": "笔记习惯",
	"Notes folder": "笔记文件夹",
	"Open this day's note": "打开这一天的笔记",
	"Open today's note": "打开今天的笔记",
	"Optional template note used when a day's note is created. Expanded through the Templater plugin when it is installed, otherwise copied as plain text.":
		"创建每日笔记时使用的可选模板笔记。安装 Templater 插件后会展开其语法，否则将作为纯文本复制。",
	Template: "模板",
	"Track a habit by writing in a per-day note instead of logging a value by hand. A day is complete once the note reaches a character count or every task in it is checked. Works with the Templater plugin to create each day's note from a template.":
		"通过在每日笔记中写作来追踪习惯，而不是手动记录数值。当笔记达到字数或其中所有任务都被勾选时，这一天即算完成。可与 Templater 插件配合，从模板创建每日笔记。",
	Write: "写作",
	"Write this day's note": "写这一天的笔记",
	"Write today's note": "写今天的笔记",
	"e.g. Journal": "例如：日记",
	"e.g. Templates/Journal.md": "例如：Templates/Journal.md",

	// Flexible frequency (any day)
	"How many times (or, for counted and timed habits, how much in total) this needs to happen somewhere in the period.":
		"需要在该周期内的某个时刻发生多少次（对于计数型或计时型习惯，则是总量）。",
	'How often this habit is due. Weekly and monthly habits only appear on their due date; the "any day" options appear every day until their quota is met.':
		'此习惯的到期频率。每周和每月习惯只在到期日显示；"任意日"选项每天都会显示，直到达到配额。',
	"Monthly (any day)": "每月（任意日）",
	"Times per month": "每月次数",
	"Times per week": "每周次数",
	"Weekly (any day)": "每周（任意日）",
	"this month": "本月",
	"this week": "本周",
	"{completed}/{days} months": "{completed}/{days} 个月",
	"{completed}/{days} weeks": "{completed}/{days} 周",
	"{n}× a month · any day": "每月 {n} 次 · 任意日",
	"{n}× a week · any day": "每周 {n} 次 · 任意日",

	// Commands
	"Insert habits heatmap": "插入习惯热力图",

	// Habit metrics: heatmap tabs
	Charts: "图表",
	Month: "月",
	History: "历史",
	"{month} heatmap": "{month}热力图",
	"Last {n} weeks": "最近 {n} 周",

	// Heatmap cell states and tooltips
	Upcoming: "未到",
	"Not tracked yet": "尚未开始记录",
	"Not due": "不适用",
	"Outside this month": "不在本月内",
	Complete: "已完成",
	"Over limit": "超出限制",
	"Not logged": "未记录",

	// Whole-vault heatmap block
	"Add a habit to see its heatmap here.": "添加一个习惯即可在此查看其热力图。",
	"No habits in the \"{group}\" group.": "“{group}”分组中没有习惯。",
	"No habits due": "当天没有到期习惯",
	"Perfect day": "完美的一天",
	"{completed}/{considered} habits · {pct}%":
		"{completed}/{considered} 个习惯 · {pct}%",
	"This year": "今年",
	"Past 6 months": "过去 6 个月",
	"{year} heatmap": "{year} 年热力图",

	// Note habits: checklist requirement and fail keyword
	"Both are true": "两者均满足",
	"Checklist requirement is met": "满足清单要求",
	"Checklist requirement": "清单要求",
	"Require every task to be checked, or just some — useful for a list of alternatives where doing any one of them counts (e.g. \"Cardio\" / \"Weights\" / \"Rest day\").":
		"要求勾选所有任务，或只需勾选其中一部分——适用于一组可任选其一即可的备选项（例如“有氧”/“力量训练”/“休息日”）。",
	"At least this many are checked": "至少勾选这么多项",
	"Tasks required": "所需任务数",
	"Fail keyword": "失败关键词",
	"Optional. Checking a task whose text contains this word forces the day to fail, whatever else is checked — e.g. \"Slipped\" as one of several checklist options. Leave blank to turn this off.":
		"可选。勾选文本中包含该词的任务，会强制当天判定为失败，无论其他项是否勾选——例如把“破功”设为清单中的一个选项。留空可关闭此功能。",
	"e.g. Slipped": "例如：破功",
	"Reach a character count, meet a checklist requirement, or require both.":
		"达到字数目标、满足清单要求，或两者都要求。",

	// Tags (cross-plugin compatibility)
	Tags: "标签",
	"e.g. task": "例如：task",
	"Optional Obsidian tags for this note, separated by commas or spaces. Useful for making this habit recognisable to another plugin's own tag-based rules — for example TaskNotes' task tag.":
		"此笔记的可选 Obsidian 标签，用逗号或空格分隔。可用于让其他插件通过自己基于标签的规则识别这个习惯——例如 TaskNotes 的 task 标签。",

	// Advanced settings: frontmatter key remapping
	Advanced: "高级",
	Apply: "应用",
	"Apply key changes": "应用键更改",
	"Rename the frontmatter properties habit notes use. Useful for avoiding collisions with another plugin's own properties in the same note (for example TaskNotes).":
		"重命名习惯笔记使用的 frontmatter 属性。可用于避免与同一笔记中另一个插件自身属性发生冲突（例如 TaskNotes）。",
	"\"{a}\" and \"{b}\" can't use the same property key (\"{value}\").":
		"“{a}”和“{b}”不能使用相同的属性键（“{value}”）。",
	"Property keys can't be empty.": "属性键不能为空。",
	"This renames {summary} in every note in your habits folder ({count} habit(s) currently). Existing values are moved, not discarded. Continue?":
		"这将重命名习惯文件夹中每篇笔记的 {summary}（当前共 {count} 个习惯）。已有的值会被迁移，不会丢弃。是否继续？",
	"Updated the frontmatter keys in {count} note(s).":
		"已在 {count} 篇笔记中更新 frontmatter 键。",
	"Renaming this away from the default also changes how binary habits log a day: instead of {\"2026-08-25\": 1}, a completed day becomes a bare date, like [\"2026-08-25\"] — the shape TaskNotes uses for complete_instances. Repetition and timed habits are unaffected either way; they always need a value, never just a date.":
		'把这个键改成默认值以外的名称，也会改变二元习惯记录当天的方式：不再是 {"2026-08-25": 1}，已完成的一天会变成一个纯日期，如 ["2026-08-25"] —— 这正是 TaskNotes 用于 complete_instances 的格式。计数和计时习惯不受影响，它们始终需要一个数值，而不仅仅是日期。',
	Identity: "标识",
	Legacy: "遗留",
	Lifecycle: "生命周期",
	Presentation: "外观",
	"Note habit": "笔记习惯",
	"Habit type key": "习惯类型键",
	"Completion records key": "完成记录键",
	"Frequency key": "频率键",
	"Weekday key": "星期键",
	"Month day key": "月内日期键",
	"Interval days key": "间隔天数键",
	"Planned time key": "计划时间键",
	"Goal direction key": "目标方向键",
	"Target key": "目标键",
	"Unit key": "单位键",
	"Step size key": "步长键",
	"Weekly target key": "周目标键",
	"Monthly target key": "月目标键",
	"Weekly perfect key": "完美一周键",
	"Monthly perfect key": "完美一月键",
	"Start date key": "开始日期键",
	"Pauses key": "暂停记录键",
	"Stopped key": "停止状态键",
	"Stop date key": "停止日期键",
	"Icon key": "图标键",
	"Color key": "颜色键",
	"Group key": "分组键",
	"Use group color key": "使用分组颜色键",
	"Note folder key": "笔记文件夹键",
	"Note filename format key": "笔记文件名格式键",
	"Template path key": "模板路径键",
	"Note completion mode key": "笔记完成模式键",
	"Note checklist requirement key": "笔记清单要求键",
	"Note checklist minimum key": "笔记清单最少数量键",
	"Note fail keyword key": "笔记失败关键词键",
	"Legacy comments key": "旧版评论键",

	// PDF export (read via docT() in export-modal.ts, which falls back to English for zh — jsPDF's built-in fonts can't render CJK)
	"Completion trend": "完成趋势",
	"(paused)": "（已暂停）",
	"{rate}% · {total} · streak {current} (best {best})":
		"{rate}% · {total} · 连击 {current}（最佳 {best}）",
	"Goal: {completed}/{goal} days met":
		"目标：已达成 {completed}/{goal} 天",
	"{range} · exported {date}": "{range} · 导出于 {date}",
	"+{n} more": "还有 {n} 条",

	// Back-dating a missed day
	Back: "返回",

	// Rescheduling missed habits (experimental)
	"1 missed habit": "1 个错过的习惯",
	"Add a notification button to the dashboard and sidebar panel when a habit's been missed, opening a review of missed days you can move onto a different one (never a day that habit is already due, so nothing doubles up).":
		"当习惯被错过时，在仪表盘和侧边栏面板上添加一个通知按钮，点击可查看错过的日子，并将其移到另一天（绝不会是该习惯本来就到期的日子，避免重复记录）。",
	"Missed habits": "错过的习惯",
	"Move this missed day onto a different one": "将这个错过的日子移到另一天",
	"Move to": "移到",
	"Nothing missed right now.": "目前没有错过任何内容。",
	"Pick a habit to move it onto a different day.": "选择一个习惯，将其移到另一天。",
	"Move a missed habit to an open day or record it on its original date.": "可将漏打卡移到空闲日期，或在原日期补记。",
	"Backfill": "补记",
	"Record on the original date": "在原日期补记",
	"This habit changed. Reopen the habit and try again.": "这条习惯记录已变化。请重新打开习惯后再试。",
	Reschedule: "改期",
	"Reschedule missed habits": "重新安排错过的习惯",
	"Rescheduled \"{name}\" to {date}.": '已将"{name}"改期到 {date}。',
	"Rescheduled from {date}": "从 {date} 改期而来",
	"Reschedules key": "改期记录键",
	"Failed days key": "失败日期键",
	"Skipped days key": "跳过日期键",
	"Rescheduling \"{name}\" — missed {date}.": '正在为"{name}"改期——错过了 {date}。',
	"That day no longer works — pick another.": "那一天已经不可用了——请选择另一天。",
	"That day won't work — it's either already due for this habit or already claimed by another reschedule.":
		"那一天不行——要么这个习惯当天本来就到期，要么已经被另一次改期占用。",
	"{count} missed habits": "{count} 个错过的习惯",
	"Interval schedule": "间隔排期方式",
	"Fixed schedules follow the start date. Completion schedules stay due when missed and restart the interval after you complete the habit. Maximum limits keep a fixed schedule.": "固定排期从开始日期计算。按完成日期排期时，漏做的习惯会一直待办，完成后重新计算间隔。上限目标仍使用固定排期。",
	"From start date": "从开始日期计算",
	"From actual completion": "从实际完成日期计算",
	"Existing Task Genius habits": "原有 Task Genius 习惯",
	"Original daily-note records remain available below. Import creates habit notes with a complete source snapshot and never changes the original records.": "下方保留原有日记记录。导入会创建独立习惯笔记，并保存完整来源快照，不修改原始记录。",
	"Import existing records": "导入原有记录",
	"No records available to import.": "暂无可导入的记录。",
	"Create {n} habit notes in {folder}? Existing notes and daily records will be preserved.": "将在 {folder} 中创建 {n} 个习惯笔记。现有笔记和日记记录都会保留，是否继续？",
	"Imported {created} habits; skipped {skipped} existing imports.": "已导入 {created} 个习惯，跳过 {skipped} 个已导入习惯。",
	"Habit import failed. Existing files have been preserved.": "习惯导入失败。现有文件已保留，可重试以继续导入。",
	"Unable to load habits. Check the console for details.": "无法加载习惯，详细信息请查看控制台。",
	"Work and rest cycle": "工作与休息循环",
	"Active days at the start of each cycle": "每个循环开始时的签到天数",
	"For a four-day cycle with three active days, check in separately on days 1, 2, and 3; day 4 is a rest day.": "例如每 4 天一个循环、前 3 天签到：第 1、2、3 天分别打卡，第 4 天休息。",
	"Daily completion target": "每日完成目标",
	"Finish today's card after this amount; the weekly or monthly quota is tracked separately. Use 0 to track only the period quota.": "当天达到这个数量就算完成；每周或每月总目标单独累计。设为 0 则只判断周期总目标。",
	"Restart cycle on": "从指定日期重新开始循环",
	"Choose a new cycle start date. Existing records and earlier schedules are preserved.": "选择新循环的开始日期，已有记录和此前的排期都会保留。",
	"{active} active days / {days}-day cycle": "每 {days} 天循环，前 {active} 天签到",
	"Date": "日期",
	"More actions": "更多操作",
	"Check in": "签到",
	"Decrease": "减少",
	"Increase": "增加",
	"Period progress": "本周期进度",
	"Task Genius habit layout": "习惯页面布局",
	"Choose the page layout. Habit goals, schedules and records stay the same.": "只改变页面布局，目标、周期、限额及记录仍按 Habits 设置执行。",
	"Task Genius cards": "原生卡片布局",
	"No activity": "未记录",
	"Below target": "已记录，未达标",
	"Target met": "已达标",
	"Double target": "达到两倍目标",
	"At most": "限额",
	"At least": "目标",
	"Daily goal": "每日目标",
	"Habit columns": "习惯列数",
	"Choose a fixed column count or fit cards to the available space.": "选择一至四列，或根据页面宽度自动排列。",
	"Automatic": "自适应",
	"Ignore": "忽略",
	"Habit note not found.": "找不到对应的习惯笔记。",
	"That day is already due or has a record. Choose another day.": "这一天已有计划、记录或改期安排，请选择另一天。",
	"This habit is already due every day. Ignore this miss or record it on its original day.": "这个习惯每天都有计划。可忽略本次漏记，或在原日期补记。",
	"Close": "关闭",
};
