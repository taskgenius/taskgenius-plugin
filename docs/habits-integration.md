# Habits in Task Genius

This integrates the complete Habits 1.12.1 implementation (MIT, James Clifford Spratt, commit `38c44bc`) into Task Genius's existing Habit view and legacy settings navigation. Vendored code and license are in `src/integrations/habits/`; no zm4341 fork code is used.

## Supported features

- Binary, repetition (including decimals), timed and note-backed habits; minimum targets and maximum limits.
- Daily, selected weekdays, monthly dates, fixed intervals, flexible weekly/monthly quotas, planned times, weekly/monthly goals.
- An additional completion-based interval mode: overdue habits remain actionable; completing one restarts the interval from that date. Maximum limits retain fixed scheduling.
- Carousel/grid/vertical/compact dashboards, sidebar panel, grouping, manual sorting, comments with tags/links, animations and mobile layouts.
- Individual metrics and comparisons, monthly/history views, vault heatmaps, weekly/monthly/custom statistics and trends.
- Pause/resume, fail/skip/undo, snooze, stop/resume tracking, missed-instance review and rescheduling.
- PDF export, opt-in AI summaries, Reminder bidirectional checkboxes, note-habit completion and Templater integration. The original experimental switches remain available.
- All original configurable frontmatter keys, plus `intervalMode`; Chinese and English string/placeholder coverage checks.

## Data and compatibility

Every habit is a Markdown note in the configurable **Habits folder**. Existing Habits notes are read directly. Changing the folder changes the data source; it does not move or delete files. First initialization reads the standalone plugin's compatible settings; API credentials and automatic Reminder writes are not imported.

Task Genius's original daily-note-based cards and settings remain under **Existing Task Genius habits**. **Import existing records** previews the note count and destination, then creates notes through Obsidian's vault API. Every note includes a full `taskGeniusLegacy.source` snapshot; originals are untouched. Repeating an import skips matching identities, including renamed imports. Conflicting files are never overwritten. A scheduled habit becomes one binary note per event; mapping habits retain numeric values and their complete original mapping in the snapshot. Import is a snapshot, not continuous synchronization with old daily-note properties: continue recording in one system after importing.

The new settings live under `habitsIntegration` in Task Genius's existing settings file. The embedded module never writes an independent plugin settings file.

## Coexistence

Task Genius always registers `tg-habits`, `tg-habit-metrics`, `tg-habits-table`, and `tg-habits-heatmap`. Its commands insert these prefixed blocks. Existing unprefixed languages are also registered if standalone Habits is disabled when Task Genius initializes. If disabling standalone Habits after Task Genius has loaded, reload Task Genius once to claim its old code blocks. Obsidian itself need not restart.

While standalone Habits is enabled, Task Genius does not perform automatic note-habit or Reminder synchronization. This prevents duplicate background writes; the dashboard still shares and edits the same Markdown notes. To use Task Genius as the sole replacement, disable standalone Habits and enable the desired integrations in Task Genius. AI requests require a deliberate action and configured endpoint; no real user data was sent during development.

## Validation

- `pnpm test:habits`: upstream compact/dashboard interaction and frequency tests, plus integration tests for rolling intervals, folder changes, legacy import, coexistence, disposal, reminders, note completion, comments, mocked AI requests, actual PDF creation and settings rendering in both languages.
- `pnpm check:i18n`: original settings coverage and all statically translated habit strings, including matching placeholders.
- `pnpm build:release`: workspace packages, TypeScript and production JavaScript/CSS.
- Full original Jest suite has existing failures. Compare failures against the unchanged legacy release under the same dependencies; do not suppress or mark those tests skipped.

Tests use isolated fixtures and a simulated browser document. Final interaction checks in a running Obsidian vault, canvas chart appearance, device-specific mobile rendering and real third-party plugin/network behavior remain manual acceptance checks. Development does not replace the installed plugin or alter live records.
