/** Korean translations, keyed by the English source string. */
export const ko: Record<string, string> = {
	// Commands and ribbon
	"Create habit": "습관 만들기",
	"Insert dashboard": "대시보드 삽입",
	"Insert habit metrics": "습관 지표 삽입",
	"Insert habits table": "습관 표 삽입",
	"Open panel": "패널 열기",
	"Open habits panel": "습관 패널 열기",
	Habits: "습관",

	// Settings
	"Habits folder": "습관 폴더",
	"Folder where each habit is stored as its own note. It is created automatically if it does not exist.":
		"각 습관이 개별 노트로 저장되는 폴더입니다. 없으면 자동으로 생성됩니다.",
	"Follow daily note date": "데일리 노트 날짜 따라가기",
	"When a dashboard is embedded in a daily note (a note whose name contains a date like 2026-07-01), open it on that note's date instead of today.":
		"대시보드가 데일리 노트(이름에 2026-07-01 같은 날짜가 포함된 노트)에 삽입된 경우, 오늘 대신 해당 노트의 날짜로 엽니다.",
	"Daily note date format": "데일리 노트 날짜 형식",
	"Moment.js format used to read the date from a daily note's name, such as YYYY-MM-DD or YYYYMMDD.":
		"데일리 노트 이름에서 날짜를 읽는 데 사용하는 Moment.js 형식입니다. 예: YYYY-MM-DD, YYYYMMDD.",

	// Sorting
	"Sort habits by": "습관 정렬 기준",
	"The base order of habit cards in the dashboard and side panel.":
		"대시보드와 사이드 패널에서 습관 카드의 기본 순서.",
	"Name (A–Z)": "이름(A–Z)",
	Color: "색상",
	"Last logged": "마지막 기록",
	"Planned time": "예정 시간",
	Manual: "수동",
	"Manual order": "수동 순서",
	"Drag the cards into the order you want. New habits join the end of the list.":
		"카드를 원하는 순서로 드래그하세요. 새 습관은 목록 끝에 추가됩니다.",
	"Move completed cards to the end": "완료된 카드를 끝으로 이동",
	"Completed habits drift to the end of the queue and paused ones park behind them. Turn this off to keep every card in its sorted position.":
		"완료된 습관은 대기열 끝으로 이동하고 일시정지된 습관은 그 뒤에 놓입니다. 끄면 모든 카드가 정렬된 위치를 유지합니다.",
	Group: "그룹",
	Ungrouped: "그룹 없음",
	"Optional group used to build dashboard sections — for example an area of responsibility.":
		"대시보드 섹션을 만들기 위한 선택적 그룹 — 예를 들어 책임 영역.",
	"e.g. Health": "예: 건강",
	"Group color": "그룹 색상",
	"Optional color shared by every habit in this group.":
		"이 그룹의 모든 습관이 공유하는 선택적 색상.",
	"Group icon": "그룹 아이콘",
	"Shown in the group lip on cards and in section headers.":
		"카드의 그룹 표시줄과 섹션 머리글에 표시됩니다.",
	"Use group color for this card": "이 카드에 그룹 색상 사용",
	"Show this card in the group color instead of its own.":
		"이 카드를 자체 색상 대신 그룹 색상으로 표시합니다.",
	General: "일반",
	Sorting: "정렬",
	Groups: "그룹",
	"How to move through your habit cards: a paged carousel with arrows, a grid that wraps onto new rows, or a fixed-height grid that scrolls vertically. The stats page follows the same choice.":
		"습관 카드 탐색 방식: 화살표로 넘기는 캐러셀, 새 줄로 이어지는 그리드, 또는 고정 높이에서 세로로 스크롤되는 그리드. 통계 페이지도 같은 설정을 따릅니다.",
	"Enable groups": "그룹 사용",
	"Show habits in sections by their group, with a group lip on each card.":
		"습관을 그룹별 섹션으로 표시하고 각 카드에 그룹 표시줄을 붙입니다.",
	"Group order": "그룹 순서",
	"Drag the groups into the order you want. Sections follow the same order.":
		"그룹을 원하는 순서로 드래그하세요. 섹션도 같은 순서를 따릅니다.",
	"Completion animations": "완료 애니메이션",
	"Play the check swoosh, card departure, and perfect-day confetti when habits are completed. Turn off for instant, quiet updates.":
		"습관을 완료할 때 체크 스우시, 카드 퇴장, 완벽한 하루 색종이를 재생합니다. 끄면 즉시 조용히 갱신됩니다.",
	"Reminders": "알림",
	"Write reminders for due habits": "오늘 해야 할 습관의 알림 작성",
	"Each day, write one reminder checklist line per planned time of every habit due that day, in the format the Reminder plugin picks up. The lines live in a marked block and refresh as you log habits.":
		"매일 그날 해야 할 각 습관의 예정 시간마다 알림 체크리스트 한 줄을 Reminder 플러그인이 인식하는 형식으로 작성합니다. 이 줄들은 표시된 블록 안에 있으며 기록에 따라 갱신됩니다.",
	"Where to write reminders": "알림을 작성할 위치",
	"The daily note follows the Daily notes core plugin's folder and date format; the block is added once the note exists. A fixed note is created automatically.":
		"데일리 노트는 코어 데일리 노트 플러그인의 폴더와 날짜 형식을 따르며, 노트가 존재하면 블록이 추가됩니다. 고정 노트는 자동으로 생성됩니다.",
	"Today's daily note": "오늘의 데일리 노트",
	"A fixed note": "고정 노트",
	"Reminder note path": "알림 노트 경로",
	"Vault path of the note that holds the reminder block.":
		"알림 블록을 담는 노트의 볼트 경로.",
	"Manage groups": "그룹 관리",
	"See every habit by group and drag cards between groups.":
		"그룹별로 습관을 보고 카드를 그룹 간에 드래그하세요.",
	Open: "열기",
	"New group": "새 그룹",
	Add: "추가",
	"Drag habits between groups to reassign them, or within a group to reorder them.":
		"습관을 그룹 간에 드래그하여 다시 지정하거나, 그룹 안에서 드래그하여 순서를 바꾸세요.",
	"No habits": "습관 없음",
	"Edit group style": "그룹 스타일 편집",
	"Delete group": "그룹 삭제",
	'Delete "{name}"? Its habits are kept and become ungrouped.':
		'"{name}"을(를) 삭제할까요? 습관은 유지되며 그룹 없음이 됩니다.',
	Delete: "삭제",
	"Dashboard layout": "대시보드 레이아웃",
	Carousel: "캐러셀",
	Grid: "그리드",
	"Vertical scroll": "세로 스크롤",
	"Cards per view": "한 화면당 카드 수",
	"How many habit cards fit side by side on wider screens.":
		"넓은 화면에서 나란히 표시할 습관 카드 수.",
	"Cards per view on mobile": "모바일 한 화면당 카드 수",
	"How many habit cards fit side by side on phone-sized screens.":
		"휴대폰 화면에서 나란히 표시할 습관 카드 수.",

	// Confirm dialog defaults
	Cancel: "취소",
	Confirm: "확인",

	// Store notices
	'Could not find the note for "{name}".':
		"“{name}”의 노트를 찾을 수 없습니다.",
	"Please enter a valid habit name.": "올바른 습관 이름을 입력하세요.",
	'A habit called "{name}" already exists.':
		"“{name}” 습관이 이미 있습니다.",
	'Created habit "{name}".': "습관 “{name}”을(를) 만들었습니다.",
	'Updated "{name}".': "“{name}”을(를) 업데이트했습니다.",
	'Paused "{name}".': "“{name}”을(를) 일시정지했습니다.",
	'Resumed "{name}".': "“{name}”을(를) 재개했습니다.",
	'Stopped tracking "{name}". Its history is kept in the note.':
		"“{name}” 추적을 중단했습니다. 기록은 노트에 보관됩니다.",
	'Resumed tracking "{name}".': "“{name}” 추적을 재개했습니다.",
	'Removed "{name}".': "“{name}”을(를) 삭제했습니다.",
	"Habit added to the dashboard.": "습관을 대시보드에 추가했습니다.",

	// Dashboard
	"Back to habits": "습관으로 돌아가기",
	"View stats": "통계 보기",
	"Export stats": "통계 내보내기",
	Weekly: "주간",
	Monthly: "월간",
	"Previous day": "이전 날",
	"Next day": "다음 날",
	"Choose a date": "날짜 선택",
	"Add habit": "습관 추가",
	"No habits yet. Create your first habit to get started.":
		"아직 습관이 없습니다. 첫 습관을 만들어 시작해 보세요.",
	Previous: "이전",
	Next: "다음",
	"Go to position {n}": "{n}번 위치로 이동",
	"Right-click or long-press for more options":
		"더 많은 옵션은 우클릭 또는 길게 누르기",
	"Open habit note": "습관 노트 열기",
	"Open the note for {name}": "{name} 노트 열기",
	Paused: "일시정지됨",
	Stopped: "추적 중지됨",
	"Failed": "실패",
	"Skipped": "건너뜀",
	"Snoozed": "다시 알림 대기",
	"Snoozed until {time}": "{time}까지 다시 알림 대기",
	"Undo fail": "실패 취소",
	"Undo skip": "건너뛰기 취소",
	"End snooze": "다시 알림 종료",
	"Fail for today": "오늘은 실패로 표시",
	"Fail this day": "이 날을 실패로 표시",
	"Marked \"{name}\" as failed.": "\"{name}\"을(를) 실패로 표시했습니다.",
	"Skip for today": "오늘은 건너뛰기",
	"Skip this day": "이 날 건너뛰기",
	"Skipped \"{name}\".": "\"{name}\"을(를) 건너뛰었습니다.",
	"Snooze…": "다시 알림…",
	"Snooze \"{name}\"": "\"{name}\" 다시 알림",
	"It leaves today's lists and comes back on its own. Snoozing never counts for or against the habit.": "오늘 목록에서 사라졌다가 저절로 돌아옵니다. 다시 알림은 습관 기록에 영향을 주지 않습니다.",
	"Snooze for": "다시 알림 시간",
	"30 minutes": "30분",
	"1 hour": "1시간",
	"3 hours": "3시간",
	"Snooze until": "다시 알림 종료 시각",
	"Snooze": "다시 알림",
	"Pick a time later today.": "오늘 이후의 시각을 선택하세요.",
	"Snoozed \"{name}\" until {time}.": "\"{name}\"을(를) {time}까지 다시 알림으로 설정했습니다.",
	"1 hidden for today": "오늘 1개 숨김",
	"{count} hidden for today": "오늘 {count}개 숨김",
	"1 hidden for this day": "이 날 1개 숨김",
	"{count} hidden for this day": "이 날 {count}개 숨김",
	"Undo": "실행 취소",
	"Click to undo": "클릭하여 실행 취소",
	"Nothing left on this day's list.": "이 날 목록에 남은 항목이 없습니다.",
	"Nothing left on today's list.": "오늘 목록에 남은 항목이 없습니다.",
	"At least: reach a target for habits you are building, like drinking 1.5 litres of water. At most: stay within a limit for habits you are cutting down, like no more than 2 coffees.": "이상: 만들고 싶은 습관의 목표를 달성합니다(예: 물 1.5리터 마시기). 이하: 줄이고 싶은 습관을 한도 안에서 유지합니다(예: 커피 2잔 이하).",
	"At least (reach a target)": "이상 (목표 달성)",
	"At most (stay within a limit)": "이하 (한도 유지)",
	"Step size": "증감 단위",
	"How much each + and − press adds or removes. Use a decimal such as 0.25 for amounts like litres.": "+ 와 − 를 한 번 누를 때 더하거나 빼는 양입니다. 리터 같은 양에는 0.25 같은 소수를 사용하세요.",
	"Decrease by {n}": "{n}만큼 줄이기",
	"4 weeks": "4주",
	"12 weeks": "12주",
	"6 months": "6개월",
	"1 year": "1년",
	"Completion rate": "달성률",
	"Monthly completion rate": "월간 달성률",
	"Daily activity": "일별 활동",
	"Week of {date}": "{date} 주",
	"Since {date} · right-click to resume":
		"{date}부터 · 우클릭으로 재개",
	"Paused on this day": "이 날은 일시정지됨",
	"Mark as done": "완료로 표시",
	"Mark as not done": "미완료로 표시",
	Done: "완료",
	"Not done": "미완료",
	"Edit value": "값 편집",
	Value: "값",
	"Decrease by 1": "1 줄이기",
	"Increase by 1": "1 늘리기",
	"Increase by {n}": "{n} 늘리기",
	"Edit habit": "습관 편집",
	"Pause habit": "습관 일시정지",
	"Resume habit": "습관 재개",
	"Stop tracking": "추적 중단",
	"Remove habit": "습관 삭제",
	'Stop tracking "{name}"? It leaves the dashboard and stats, but its note and full history are kept. You can resume tracking any time from the note\'s metrics view.':
		"“{name}” 추적을 중단할까요? 대시보드와 통계에서 사라지지만 노트와 전체 기록은 보관됩니다. 노트의 지표 화면에서 언제든지 다시 시작할 수 있습니다.",
	'Remove "{name}"? Its note will be moved to the trash.':
		"“{name}”을(를) 삭제할까요? 노트는 휴지통으로 이동합니다.",
	Remove: "삭제",
	"Perfect!": "퍼펙트!",
	Today: "오늘",
	Yesterday: "어제",
	Tomorrow: "내일",
	"Last 7 days": "지난 7일",
	"Last 30 days": "지난 30일",
	"This week": "이번 주",
	"This month": "이번 달",

	// Sidebar panel
	"Habits completed today": "오늘 완료한 습관",
	"No habits yet.": "아직 습관이 없습니다.",
	"Click to type a value": "클릭해서 값 입력",
	"Open note": "노트 열기",

	// Stats view
	"No habits to show stats for yet.":
		"아직 통계를 표시할 습관이 없습니다.",
	Completion: "달성률",
	"Best streak": "최고 연속 기록",
	"Perfect days": "퍼펙트한 날",
	Completions: "달성 횟수",
	"Goals met": "달성한 목표",
	"{completed}/{days} days": "{completed}/{days}일",
	"{total} total": "총 {total}",
	best: "최고",
	"perfect week": "퍼펙트한 주",
	"perfect month": "퍼펙트한 달",
	"weekly goal": "주간 목표",
	"monthly goal": "월간 목표",
	"{progress}/{goal} days · {label} · {pct}%":
		"{progress}/{goal}일 · {label} · {pct}%",

	// Habit metrics block
	'Place this block inside a habit note, or point it at one with "habit: <name>".':
		"이 블록을 습관 노트 안에 넣거나 “habit: <이름>”으로 습관을 지정하세요.",
	'No habit called "{name}" was found.':
		"“{name}” 습관을 찾을 수 없습니다.",
	"No longer tracked since {date}. All history is kept.":
		"{date}부터 더 이상 추적하지 않습니다. 모든 기록은 보관됩니다.",
	"No longer tracked. All history is kept.":
		"더 이상 추적하지 않습니다. 모든 기록은 보관됩니다.",
	"Resume tracking": "추적 재개",
	"Paused since {date}. Paused days don't count against streaks or stats.":
		"{date}부터 일시정지됨. 일시정지된 날은 연속 기록이나 통계에 영향을 주지 않습니다.",
	"Paused. Paused days don't count against streaks or stats.":
		"일시정지됨. 일시정지된 날은 연속 기록이나 통계에 영향을 주지 않습니다.",
	"Current streak": "현재 연속 기록",
	"Days completed": "완료한 일수",
	"30-day rate": "30일 달성률",
	"Weekly completion rate": "주간 달성률",
	Logged: "기록",
	Target: "목표",

	// Export modal
	Title: "제목",
	"Habits report": "습관 보고서",
	"Date range": "기간",
	"Custom range": "사용자 지정 기간",
	From: "시작",
	To: "끝",
	"Up to {n} days.": "최대 {n}일.",
	Content: "내용",
	"Summary tiles": "요약 타일",
	"Completion trend chart": "달성률 추이 차트",
	"Daily grids": "일별 그리드",
	"Goal progress": "목표 진행률",
	Layout: "레이아웃",
	Orientation: "방향",
	Portrait: "세로",
	Landscape: "가로",
	Density: "밀도",
	Comfortable: "여유",
	Compact: "간결",
	Monochrome: "흑백",
	"Ink-friendly greys instead of accent colours.":
		"강조 색 대신 잉크를 아끼는 회색을 사용합니다.",
	"Export PDF": "PDF 내보내기",
	"No habits to export yet.":
		"아직 내보낼 습관이 없습니다.",
	'Exported to "{path}" in your vault.':
		"보관소의 “{path}”에 내보냈습니다.",

	// Habit modal
	"New habit": "새 습관",
	Name: "이름",
	Type: "유형",
	"Binary is done or not done. Repetition counts towards a target. Timed tracks minutes.":
		"이진은 완료 여부만 기록합니다. 반복은 목표 횟수를 세고, 시간은 분을 기록합니다.",
	Binary: "이진",
	Repetition: "반복",
	Timed: "시간",
	"Daily target (minutes)": "일일 목표(분)",
	"Daily target": "일일 목표",
	Unit: "단위",
	"Optional label shown next to the count.":
		"횟수 옆에 표시되는 선택적 라벨입니다.",
	Icon: "아이콘",
	"Choose a Lucide icon or an emoji to represent this habit.":
		"이 습관을 나타낼 Lucide 아이콘이나 이모지를 선택하세요.",
	Emoji: "이모지",
	"Choose an emoji": "이모지 선택",
	"Clear icon": "아이콘 지우기",
	"Choose icon": "아이콘 선택",
	"Save changes": "변경 사항 저장",
	"Targets (optional)": "목표(선택)",
	"Set an optional weekly or monthly goal for how many days you complete this habit. For example, hitting your daily goal on all 7 days is a weekly target of 7. Turn on a perfect toggle to aim for every day of the period automatically, whatever its length.":
		"이 습관을 달성할 일수에 대한 주간 또는 월간 목표를 선택적으로 설정하세요. 예를 들어 7일 모두 일일 목표를 달성하면 주간 목표는 7입니다. 퍼펙트 토글을 켜면 기간 길이와 관계없이 자동으로 매일을 목표로 합니다.",
	"Perfect week": "퍼펙트한 주",
	"Aim to complete this habit every day of the week.":
		"이 습관을 일주일 내내 달성하는 것을 목표로 합니다.",
	"Weekly target": "주간 목표",
	"Optional. Days to complete per week (max 7).":
		"선택. 일주일에 달성할 일수(최대 7).",
	None: "없음",
	"Perfect month": "퍼펙트한 달",
	"Aim to complete this habit every day of the month.":
		"이 습관을 한 달 내내 달성하는 것을 목표로 합니다.",
	"Monthly target": "월간 목표",
	"Optional. Days to complete per month.":
		"선택. 한 달에 달성할 일수.",
	Colour: "색상",
	"Pick a colour from your theme, or choose a custom one.":
		"테마 색상 중에서 고르거나 사용자 지정 색상을 선택하세요.",
	"Your habit": "나의 습관",

	// Icon and colour pickers
	"Search icons…": "아이콘 검색…",
	"Search emojis…": "이모지 검색…",

	// Comments
	"Comments on cards": "카드 코멘트",
	"Show a comment flap on dashboard cards for jotting a note about any day.":
		"대시보드 카드에 코멘트 플랩을 표시해 그날에 대한 메모를 남길 수 있습니다.",
	"Add comment": "코멘트 추가",
	"Flip back": "앞면으로 돌리기",
	"Edit comment": "코멘트 편집",
	"Move day comments into note bodies": "일별 코멘트를 노트 본문으로 이동",
	"No comments left to move.": "이동할 코멘트가 없습니다.",
	"Moved comments in 1 note.": "노트 1개의 코멘트를 이동했습니다.",
	"Moved comments in {n} notes.": "노트 {n}개의 코멘트를 이동했습니다.",
	"Add a comment for this day…": "이 날에 대한 코멘트 추가…",
	Comments: "코멘트",

	// Limit habits (experimental)
	Experimental: "실험 기능",
	"These features are still being tested and may change before they become permanent. Turning one off only hides it from menus — anything you created with it keeps working.":
		"이 기능들은 아직 테스트 중이며 정식 기능이 되기 전에 바뀔 수 있습니다. 끄면 메뉴에서 숨겨질 뿐, 이미 만든 것은 계속 작동합니다.",
	"Break bad habits": "나쁜 습관 끊기",
	"Track habits you want to reduce or avoid by staying under a daily limit — for example at most 2 hours of gaming, or no smoking at all.":
		"하루 한도 안에 머무는 방식으로 줄이거나 피하고 싶은 습관을 추적합니다. 예: 게임 하루 최대 2시간, 금연.",
	Goal: "목표",
	"Reach a target for habits you are building. Stay under a limit for habits you are cutting down or giving up.":
		"만들고 싶은 습관은 목표를 달성하고, 줄이거나 끊고 싶은 습관은 한도 안에 머뭅니다.",
	"Reach a target": "목표 달성하기",
	"Stay under a limit": "한도 안에 머물기",
	"Binary means avoiding it entirely. Repetition counts against a daily limit. Timed tracks minutes against a daily limit.":
		"이진은 완전히 피하는 것을 뜻합니다. 반복은 하루 한도에 대해 횟수를 세고, 시간은 하루 한도에 대해 분을 기록합니다.",
	"Daily limit": "일일 한도",
	"Daily limit (minutes)": "일일 한도(분)",
	"0 means none at all.": "0은 전혀 하지 않음을 뜻합니다.",
	"Set an optional weekly or monthly goal for how many days you stay within your limit. Turn on a perfect toggle to aim for every day of the period automatically, whatever its length.":
		"한도 안에 머문 일수에 대한 주간 또는 월간 목표를 선택적으로 설정하세요. 퍼펙트 토글을 켜면 기간 길이와 관계없이 자동으로 매일을 목표로 합니다.",
	Clean: "클린",
	Slipped: "실수",
	"Mark as clean": "클린으로 표시",
	"Mark as slipped": "실수로 표시",
	"Days within limit": "한도 내 일수",
	Limit: "한도",

	// Frequencies and per-note metrics
	Frequency: "주기",
	Daily: "매일",
	"Days of week": "요일",
	Habit: "습관",
	Schedule: "일정",
	"Time of day": "시간",
	"Optional times this habit is planned for — once or several times a day. Shown on the habit's card.":
		"이 습관을 실행할 예정 시간(선택) — 하루 한 번 또는 여러 번. 습관 카드에 표시됩니다.",
	"Add time": "시간 추가",
	"Remove time": "시간 제거",
	"Every N days": "N일마다",
	"Repeat every": "반복 주기",
	"Day of month": "날짜(일)",
	"The weekdays this habit is due on. Pick as many as you need.":
		"이 습관이 예정된 요일입니다. 여러 개를 선택할 수 있습니다.",
	"Number of days between due dates, counted from the habit's start date. Use 2 for an alternate-day schedule.":
		"예정일 사이의 일수로, 습관 시작일부터 계산합니다. 격일로 하려면 2를 입력하세요.",
	"The day of the month this habit is due. In shorter months it falls due on the last day, so 31 always lands on the final day of the month.":
		"이 습관의 예정 일자입니다. 더 짧은 달에는 마지막 날로 넘어가므로 31은 항상 그 달의 마지막 날이 됩니다.",
	"Every {day}": "매주 {day}",
	"Monthly · day {day}": "매월 {day}일",
	"Every other day": "격일",
	"Every {n} days": "{n}일마다",
	"No habits are due on this day.":
		"이 날에 예정된 습관이 없습니다.",
	"Nothing due today.": "오늘은 예정된 것이 없습니다.",
	"Weekly activity": "주간 활동",
	"Monthly activity": "월간 활동",
	"Activity on due days": "예정일 활동",
	"Completion rate over {n} due days": "최근 예정일 {n}회 완료율",
	"Weeks completed": "완료한 주",
	"Months completed": "완료한 달",
	"Recent rate": "최근 달성률",
	"{n}-week completion rate": "{n}주 달성률",
	"{n}-month completion rate": "{n}개월 달성률",

	// AI summaries
	"AI summaries": "AI 요약",
	"AI summary": "AI 요약",
	"Show an AI-generated summary with feedback and advice on the stats page tabs. Uses an OpenAI-compatible service you configure below; your habit stats are sent to it only when you press the generate button.":
		"통계 페이지 탭에 피드백과 조언이 담긴 AI 생성 요약을 표시합니다. 아래에서 설정한 OpenAI 호환 서비스를 사용하며, 습관 통계는 생성 버튼을 눌렀을 때만 전송됩니다.",
	"AI base URL": "AI 기본 URL",
	"Base URL of an OpenAI-compatible API. Works with OpenAI, OpenRouter, or local servers like Ollama (http://localhost:11434/v1).":
		"OpenAI 호환 API의 기본 URL입니다. OpenAI, OpenRouter 또는 Ollama(http://localhost:11434/v1) 같은 로컬 서버에서 작동합니다.",
	"AI API key": "AI API 키",
	"Stored locally in this vault's plugin data. Leave blank for local servers that need no key.":
		"이 보관소의 플러그인 데이터에 로컬로 저장됩니다. 키가 필요 없는 로컬 서버라면 비워 두세요.",
	"AI model": "AI 모델",
	"Model name the service should use.":
		"서비스가 사용할 모델 이름입니다.",
	"Generate summary": "요약 생성",
	Regenerate: "다시 생성",
	"Get feedback and advice on your habits for this period. Your stats are sent to the AI service you configured only when you press the button.":
		"이 기간의 습관에 대한 피드백과 조언을 받습니다. 통계는 버튼을 눌렀을 때만 설정한 AI 서비스로 전송됩니다.",
	"Thinking…": "생각 중…",
	"Could not generate a summary: {message}":
		"요약을 생성하지 못했습니다: {message}",
	"Adds an AI-generated overview with feedback and advice. Your habit stats are sent to your configured AI service.":
		"피드백과 조언이 담긴 AI 생성 개요를 추가합니다. 습관 통계가 설정한 AI 서비스로 전송됩니다.",
	"Generating AI summary…": "AI 요약 생성 중…",
	"The AI summary will be generated when you export.":
		"AI 요약은 내보낼 때 생성됩니다.",

	// Custom stats range
	Custom: "사용자 지정",
	"Start date": "시작일",
	"End date": "종료일",

	// Heatmap start markers
	"not tracked yet": "아직 기록 없음",
	"started tracking on {date}": "{date}에 추적 시작",

	// Stats carousel
	"Stats rows per page": "페이지당 통계 행 수",
	"How many habits each stats page shows.":
		"각 통계 페이지에 표시할 습관 수입니다.",
	// Note habits
	'"{name}" uses Templater syntax, but the Templater plugin is not installed — the template was copied as plain text.':
		'"{name}"에는 Templater 문법이 사용되었지만 Templater 플러그인이 설치되어 있지 않아 서식 없는 텍스트로 복사되었습니다.',
	"Binary is done or not done. Repetition counts towards a target. Timed tracks minutes. Note is completed by writing in a per-day note.":
		"이진은 완료 여부만 기록합니다. 반복은 목표 횟수를 세고, 시간은 분을 기록합니다. 노트는 매일의 노트에 글을 써서 완료합니다.",
	"Character count is reached": "글자 수에 도달",
	"Character goal": "글자 수 목표",
	"Completed when": "완료 조건",
	"Every task is checked": "모든 할 일 체크",
	"Filename format": "파일명 형식",
	"Folder each day's note is created in. Leave blank for a dedicated subfolder named after this habit.":
		"매일의 노트가 생성될 폴더입니다. 비워두면 이 습관 이름을 딴 전용 하위 폴더가 사용됩니다.",
	"Moment.js format used to name each day's note, e.g. {example}. May include / for date-based subfolders.":
		"매일의 노트 이름에 사용할 Moment.js 형식입니다(예: {example}). 날짜별 하위 폴더를 만들려면 /를 포함할 수 있습니다.",
	Note: "노트",
	"Note habits": "노트 습관",
	"Notes folder": "노트 폴더",
	"Open this day's note": "이 날의 노트 열기",
	"Open today's note": "오늘의 노트 열기",
	"Optional template note used when a day's note is created. Expanded through the Templater plugin when it is installed, otherwise copied as plain text.":
		"하루의 노트를 만들 때 사용할 선택적 템플릿 노트입니다. Templater 플러그인이 설치되어 있으면 이를 통해 확장되고, 그렇지 않으면 서식 없는 텍스트로 복사됩니다.",
	Template: "템플릿",
	"Track a habit by writing in a per-day note instead of logging a value by hand. A day is complete once the note reaches a character count or every task in it is checked. Works with the Templater plugin to create each day's note from a template.":
		"값을 직접 기록하는 대신 매일의 노트에 글을 써서 습관을 기록합니다. 노트가 글자 수에 도달하거나 모든 할 일에 체크가 되면 그날은 완료로 처리됩니다. Templater 플러그인과 연동해 템플릿으로 매일의 노트를 만들 수 있습니다.",
	Write: "쓰기",
	"Write this day's note": "이 날의 노트 쓰기",
	"Write today's note": "오늘의 노트 쓰기",
	"e.g. Journal": "예: Journal",
	"e.g. Templates/Journal.md": "예: Templates/Journal.md",

	// Flexible frequency (any day)
	"How many times (or, for counted and timed habits, how much in total) this needs to happen somewhere in the period.":
		"이 기간 중 언제든 몇 번(횟수·시간 습관의 경우 총량) 발생해야 하는지입니다.",
	'How often this habit is due. Weekly and monthly habits only appear on their due date; the "any day" options appear every day until their quota is met.':
		'이 습관의 주기입니다. 주간·월간 습관은 예정일에만 표시되지만, "요일 무관" 옵션은 목표를 채울 때까지 매일 표시됩니다.',
	"Monthly (any day)": "월간 (요일 무관)",
	"Times per month": "월 횟수",
	"Times per week": "주 횟수",
	"Weekly (any day)": "주간 (요일 무관)",
	"this month": "이번 달",
	"this week": "이번 주",
	"{completed}/{days} months": "{completed}/{days}개월",
	"{completed}/{days} weeks": "{completed}/{days}주",
	"{n}× a month · any day": "월 {n}회 · 요일 무관",
	"{n}× a week · any day": "주 {n}회 · 요일 무관",

	// Commands
	"Insert habits heatmap": "습관 히트맵 삽입",

	// Habit metrics: heatmap tabs
	Charts: "차트",
	Month: "월",
	History: "기록",
	"{month} heatmap": "{month} 히트맵",
	"Last {n} weeks": "최근 {n}주",

	// Heatmap cell states and tooltips
	Upcoming: "예정",
	"Not tracked yet": "아직 추적 안 됨",
	"Not due": "해당 없음",
	"Outside this month": "이번 달 아님",
	Complete: "완료",
	"Over limit": "한도 초과",
	"Not logged": "기록 없음",

	// Whole-vault heatmap block
	"Add a habit to see its heatmap here.": "습관을 추가하면 여기에 히트맵이 표시됩니다.",
	"No habits in the \"{group}\" group.": '"{group}" 그룹에 습관이 없습니다.',
	"No habits due": "예정된 습관 없음",
	"Perfect day": "퍼펙트한 날",
	"{completed}/{considered} habits · {pct}%":
		"습관 {completed}/{considered} · {pct}%",
	"This year": "올해",
	"Past 6 months": "지난 6개월",
	"{year} heatmap": "{year}년 히트맵",

	// Note habits: checklist requirement and fail keyword
	"Both are true": "둘 다 충족",
	"Checklist requirement is met": "체크리스트 요건 충족",
	"Checklist requirement": "체크리스트 요건",
	"Require every task to be checked, or just some — useful for a list of alternatives where doing any one of them counts (e.g. \"Cardio\" / \"Weights\" / \"Rest day\").":
		'모든 할 일에 체크해야 하는지, 일부만 체크해도 되는지 정할 수 있습니다 — "유산소" / "웨이트" / "휴식일"처럼 그중 하나만 해도 되는 선택지 목록에 유용합니다.',
	"At least this many are checked": "최소한 이 개수만큼 체크됨",
	"Tasks required": "필요한 할 일 수",
	"Fail keyword": "실패 키워드",
	"Optional. Checking a task whose text contains this word forces the day to fail, whatever else is checked — e.g. \"Slipped\" as one of several checklist options. Leave blank to turn this off.":
		'선택 사항입니다. 텍스트에 이 단어가 포함된 할 일에 체크하면, 다른 항목을 체크했더라도 그날은 강제로 실패 처리됩니다 — 예를 들어 여러 체크리스트 항목 중 하나로 "실패"를 넣어두는 식입니다. 비워 두면 이 기능은 꺼집니다.',
	"e.g. Slipped": "예: 실패",
	"Reach a character count, meet a checklist requirement, or require both.":
		"글자 수 도달, 체크리스트 요건 충족, 또는 둘 다 요구하는 방식 중에서 선택할 수 있습니다.",

	// Tags (cross-plugin compatibility)
	Tags: "태그",
	"e.g. task": "예: task",
	"Optional Obsidian tags for this note, separated by commas or spaces. Useful for making this habit recognisable to another plugin's own tag-based rules — for example TaskNotes' task tag.":
		"이 노트에 대한 선택적 Obsidian 태그입니다. 쉼표나 공백으로 구분합니다. 다른 플러그인의 태그 기반 규칙이 이 습관을 인식하게 하는 데 유용합니다 — 예를 들어 TaskNotes의 task 태그입니다.",

	// Advanced settings: frontmatter key remapping
	Advanced: "고급",
	Apply: "적용",
	"Apply key changes": "키 변경 적용",
	"Rename the frontmatter properties habit notes use. Useful for avoiding collisions with another plugin's own properties in the same note (for example TaskNotes).":
		"습관 노트가 사용하는 프런트매터 속성 이름을 바꿉니다. 같은 노트에서 다른 플러그인(예: TaskNotes) 고유의 속성과 충돌하는 것을 피할 때 유용합니다.",
	"\"{a}\" and \"{b}\" can't use the same property key (\"{value}\").":
		'"{a}"와 "{b}"는 같은 속성 키("{value}")를 사용할 수 없습니다.',
	"Property keys can't be empty.": "속성 키는 비워 둘 수 없습니다.",
	"This renames {summary} in every note in your habits folder ({count} habit(s) currently). Existing values are moved, not discarded. Continue?":
		"이 작업은 습관 폴더에 있는 모든 노트(현재 {count}개 습관)에서 {summary}의 이름을 바꿉니다. 기존 값은 삭제되지 않고 이동됩니다. 계속할까요?",
	"Updated the frontmatter keys in {count} note(s).":
		"{count}개 노트에서 프런트매터 키를 업데이트했습니다.",
	"Renaming this away from the default also changes how binary habits log a day: instead of {\"2026-08-25\": 1}, a completed day becomes a bare date, like [\"2026-08-25\"] — the shape TaskNotes uses for complete_instances. Repetition and timed habits are unaffected either way; they always need a value, never just a date.":
		'이 키를 기본값에서 다른 이름으로 바꾸면 이진 습관이 하루를 기록하는 방식도 달라집니다. {"2026-08-25": 1} 대신, 완료한 날은 ["2026-08-25"]처럼 단순한 날짜가 됩니다 — 이는 TaskNotes가 complete_instances에 사용하는 형식입니다. 반복 및 시간 습관은 어느 경우든 영향을 받지 않습니다. 항상 값이 필요하며, 날짜만으로는 안 됩니다.',
	Identity: "식별 정보",
	Legacy: "레거시",
	Lifecycle: "라이프사이클",
	Presentation: "표시",
	"Note habit": "노트 습관",
	"Habit type key": "습관 유형 키",
	"Completion records key": "완료 기록 키",
	"Frequency key": "빈도 키",
	"Weekday key": "요일 키",
	"Month day key": "월중 날짜 키",
	"Interval days key": "간격 일수 키",
	"Planned time key": "예정 시간 키",
	"Goal direction key": "목표 방향 키",
	"Target key": "목표 키",
	"Unit key": "단위 키",
	"Step size key": "증감 단위 키",
	"Weekly target key": "주간 목표 키",
	"Monthly target key": "월간 목표 키",
	"Weekly perfect key": "퍼펙트 주 키",
	"Monthly perfect key": "퍼펙트 달 키",
	"Start date key": "시작일 키",
	"Pauses key": "일시중지 기록 키",
	"Stopped key": "중단 상태 키",
	"Stop date key": "중단일 키",
	"Icon key": "아이콘 키",
	"Color key": "색상 키",
	"Group key": "그룹 키",
	"Use group color key": "그룹 색상 사용 키",
	"Note folder key": "노트 폴더 키",
	"Note filename format key": "노트 파일명 형식 키",
	"Template path key": "템플릿 경로 키",
	"Note completion mode key": "노트 완료 모드 키",
	"Note checklist requirement key": "노트 체크리스트 요건 키",
	"Note checklist minimum key": "노트 체크리스트 최소 개수 키",
	"Note fail keyword key": "노트 실패 키워드 키",
	"Legacy comments key": "이전 코멘트 키",

	// PDF export (read via docT() in export-modal.ts, which falls back to English for zh — jsPDF's built-in fonts can't render CJK)
	"Completion trend": "달성률 추이",
	"(paused)": "(일시정지됨)",
	"{rate}% · {total} · streak {current} (best {best})":
		"{rate}% · {total} · 연속 {current} (최고 {best})",
	"Goal: {completed}/{goal} days met":
		"목표: {completed}/{goal}일 달성",
	"{range} · exported {date}": "{range} · {date} 내보냄",
	"+{n} more": "+{n}개 더",

	// Back-dating a missed day
	Back: "뒤로",

	// Rescheduling missed habits (experimental)
	"1 missed habit": "놓친 습관 1개",
	"Add a notification button to the dashboard and sidebar panel when a habit's been missed, opening a review of missed days you can move onto a different one (never a day that habit is already due, so nothing doubles up).":
		"습관을 놓쳤을 때 대시보드와 사이드바 패널에 알림 버튼을 추가합니다. 놓친 날을 검토하고 다른 날로 옮길 수 있습니다(그 습관이 원래 예정된 날로는 옮길 수 없어 중복 기록이 생기지 않습니다).",
	"Missed habits": "놓친 습관",
	"Move this missed day onto a different one": "이 놓친 날을 다른 날로 옮기기",
	"Move to": "옮길 날짜",
	"Nothing missed right now.": "지금은 놓친 것이 없습니다.",
	"Pick a habit to move it onto a different day.": "다른 날로 옮길 습관을 선택하세요.",
	Reschedule: "일정 변경",
	"Reschedule missed habits": "놓친 습관 일정 변경",
	"Rescheduled \"{name}\" to {date}.": '"{name}"의 일정을 {date}(으)로 변경했습니다.',
	"Rescheduled from {date}": "{date}에서 일정 변경됨",
	"Reschedules key": "일정 변경 키",
	"Failed days key": "실패한 날 키",
	"Skipped days key": "건너뛴 날 키",
	"Rescheduling \"{name}\" — missed {date}.":
		'"{name}" 일정 변경 중 — {date}에 놓쳤습니다.',
	"That day no longer works — pick another.":
		"그 날짜는 더 이상 사용할 수 없습니다 — 다른 날짜를 선택하세요.",
	"That day won't work — it's either already due for this habit or already claimed by another reschedule.":
		"그 날짜는 안 됩니다 — 이미 그 습관이 그 날짜에 예정되어 있거나, 다른 일정 변경에서 이미 사용 중입니다.",
	"{count} missed habits": "놓친 습관 {count}개",
};
