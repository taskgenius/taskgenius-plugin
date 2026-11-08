# Native check-in, points, and project management

## Points and rewards

The main Points and rewards view and the settings tab use the same native component. The four tabs are Daily check-in, Bonuses and rewards, Points history, and Points rules.

The existing Markdown points file remains the data source. `manualPointRecords`, `examplePropertyLeft`, `examplePropertyRight`, `defaultPointRule`, and `pointRules` are retained. Habit notes continue to own their `records` and `bravoPoints` fields. The default legacy file is discovered automatically; the data path can be changed under Points rules.

Habit points are calculated from the notes whenever records or rules change. No historical habit points are copied into a second ledger. The precedence is a habit's `bravoPoints`, an explicit panel rule, then the default rule. Negative rates preserve the existing daily, weekly, or monthly allowance calculation. Manual additions and reward redemptions use the Markdown ledger. Existing task point transactions remain available alongside that ledger.

Task points default to zero. A task can carry its own points value, or a default can be set explicitly. The former random-reward form is replaced; its stored configuration is retained for compatibility. Only rewards with an explicit point cost appear in the new catalog.

## Habit schedules

- **Every two days with catch-up:** choose Every N days, interval 2, From actual completion. A missed occurrence remains actionable; the next interval follows the actual completion.
- **Three active days in four:** choose Every N days, interval 4, Work and rest cycle, active days 3. The first three days each require a separate check-in; the fourth is a rest day.
- **Weekly quota with daily completion:** choose Weekly (any day), period target 3, daily completion target 1. A single creation finishes that day's card while the weekly total continues to accumulate.
- **Restart a cycle:** edit the habit and choose Restart cycle on. The restart is stored separately from the original start date and records, so earlier history is retained.

The existing one-completion check-in window is a separate option from a work/rest cycle.

## Projects and project plans

Project notes are discovered by their `project` property, including notes in existing directories. New projects create Markdown notes in an existing `Tasks/Projects` folder, or otherwise in `Projects`.

Task creation, project reassignment, and quick capture route tasks into the project's note. Inline project ownership markers are removed during transfer. Parent tasks retain their children and indented notes. A legacy project's context menu can consolidate its tasks into a note. Saved display preferences cannot recreate a project that no longer has a task or note.

Project details can be edited from the sidebar and project overview. Name changes update the `project` property. Archive and restore are available through the project actions and archive manager. Archived project tasks are omitted from normal task views. Project plans uses the Gantt surface with one row per project note; clicking a row opens the note, and its context menu edits project dates or archives it.

Review is hidden and no longer initialized in the Fluent interface. Stored review routes continue to resolve to projects. The onboarding restart control is removed.

## Search and saved filters

Task search remains available in specialized views. Tables receive the final filtered task collection. Saved filters can be created, edited, removed, and selected from the quick-filter menu. The condition builder supports AND/OR combinations; advanced queries also support NOT, parentheses, fields, priorities, missing dates, and local-day relative dates such as `due:today`.

Points and habit pages provide their own search. The native points history also filters by today, earned points, and spent points.

## Verification

- Build, release-file consistency, and English/Chinese string checks pass.
- Habit integration: 54 tests pass.
- UI regression: 24 tests pass.
- Points, project transfers, project plans, query filters, and index notifications: 28 focused tests pass.
- The full Jest suite retains 39 failing suites and 147 failing tests, matching the previously observed baseline counts. It is not an all-green suite.

`scripts/audit-native-points.cjs` compares the native calculation against the original check-in page for a compatible legacy vault and can write a local report of source-file hashes. Test fixtures and the public layout preview use example data.

Installation replaces the plugin's code files after backup. Existing Markdown check-in data is read in place. A plugin reload is required to load the new code; an application restart is not required.
