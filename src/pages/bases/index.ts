/**
 * Bases Plugin Integration for Task Genius
 *
 * This module provides complete integration between Task Genius and the Bases plugin,
 * allowing all Task Genius views to be used as Bases views with full data conversion
 * and view management capabilities.
 */

export { TaskBasesView, TaskBasesViewType } from './TaskBasesView';
export {
    registerTaskGeniusBasesViews
} from './registerBasesViews';

/**
 * Example usage in Bases:
 *
 * 1. Create a base file with task-related properties:
 * ```yaml
 * ---
 * bases:
 *   properties:
 *     - task_content: text
 *     - status: checkbox
 *     - priority: number
 *     - project: text
 *     - tags: list
 *     - due_date: date
 *     - context: text
 * ---
 * ```
 *
 * 2. Query your tasks:
 * ```base
 * view: task-genius-kanban
 * from: "Tasks"
 * where: status != "x"
 * sort: priority desc, due_date asc
 * ```
 *
 * 3. Available view types:
 * - task-genius-inbox: Inbox view for managing tasks
 * - task-genius-forecast: Timeline forecast view
 * - task-genius-projects: Project-based organization
 * - task-genius-tags: Tag-based browsing
 * - task-genius-calendar: Calendar layout
 * - task-genius-kanban: Kanban board
 * - task-genius-gantt: Gantt chart
 * * - task-genius-habits: Habit tracking
 * - task-genius-flagged: High-priority flagged tasks
 * - task-genius-unified: Configurable unified view
 * - task-genius-custom: Fully customizable view
 *
 * 4. Property mappings:
 * Map your base properties to Task Genius fields:
 * - taskContent: The main task text
 * - taskStatus: Completion status (checkbox or text)
 * - taskPriority: Priority level (1-5)
 * - taskProject: Project assignment
 * - taskTags: Tags (list or comma-separated)
 * - taskDueDate: Due date
 * - taskStartDate: Start date
 * - taskCompletedDate: Completion date
 * - taskContext: Task context (@context)
 *
 * 5. View-specific configurations (saved to view config):
 *
 * Kanban View:
 * - kanban.groupBy: Group tasks by (status, priority, tags, project, context, dueDate, startDate)
 * - kanban.hideEmptyColumns: Hide columns with no tasks
 * - kanban.defaultSortField: Default sort field (priority, dueDate, scheduledDate, startDate, createdDate)
 * - kanban.defaultSortOrder: Sort order (asc or desc)
 *
 * Calendar View:
 * - calendar.firstDayOfWeek: First day of week (0=Sunday, 1=Monday, etc.)
 * - calendar.hideWeekends: Hide weekend columns
 *
 * Gantt View:
 * - gantt.showTaskLabels: Show task labels on bars
 * - gantt.useMarkdownRenderer: Use markdown rendering for task names
 *
 * Forecast View:
 * - forecast.firstDayOfWeek: First day of week (0=Sunday, 1=Monday, etc.)
 * - forecast.hideWeekends: Hide weekend columns
 *
 * These configurations are saved directly to the .base file's frontmatter and are
 * specific to each view instance. They override plugin-level settings.
 */

/**
 * Integration Features:
 *
 * 1. Full View Support:
 *    - All Task Genius views available as Bases views
 *    - Seamless switching between view modes
 *    - Persistent configuration per view
 *
 * 2. Data Conversion:
 *    - Automatic conversion between Bases entries and Task format
 *    - Support for all task properties and metadata
 *    - Bi-directional sync when using WriteAPI
 *
 * 3. Filtering & Sorting:
 *    - Advanced task filtering system
 *    - Multiple sort criteria support
 *    - Live filter updates
 *
 * 4. Task Operations:
 *    - Complete/uncomplete tasks
 *    - Edit task properties
 *    - Status switching
 *    - Quick capture integration
 *
 * 5. Customization:
 *    - Configurable property mappings
 *    - View-specific settings
 *    - Theme-aware styling
 */