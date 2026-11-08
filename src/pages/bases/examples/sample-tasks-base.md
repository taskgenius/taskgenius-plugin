---
bases:
  properties:
    - name: text
    - description: text
    - status: checkbox
    - priority: select
      options: ["1", "2", "3", "4", "5"]
    - project: text
    - tags: list
    - due_date: date
    - start_date: date
    - completed_date: date
    - context: text
    - assignee: text
    - estimated_hours: number
---

# Sample Tasks Base for Task Genius Integration

This file demonstrates how to use Task Genius views with Bases plugin queries.

## Example Queries

### 1. Kanban Board View
```base
view: task-genius-kanban
from: "Tasks"
where: status != "x"
config:
  taskContent: name
  taskStatus: status
  taskPriority: priority
  taskProject: project
  taskTags: tags
  taskDueDate: due_date
```

### 2. Calendar View
```base
view: task-genius-calendar
from: "Tasks"
where: due_date != null
config:
  taskContent: name
  taskDueDate: due_date
  taskStatus: status
```

### 3. Gantt Chart View
```base
view: task-genius-gantt
from: "Tasks"
where: start_date != null AND due_date != null
config:
  taskContent: name
  taskStartDate: start_date
  taskDueDate: due_date
  taskStatus: status
  taskProject: project
```

### 4. Project View with Tree Structure
```base
view: task-genius-projects
from: "Tasks"
where: project != null
sort: project asc, priority desc
config:
  taskContent: name
  taskProject: project
  taskStatus: status
  taskPriority: priority
```

### 5. Inbox View for Unprocessed Tasks
```base
view: task-genius-inbox
from: "Tasks"
where: status = " " AND project = null
sort: created desc
config:
  taskContent: name
  taskStatus: status
  taskPriority: priority
  taskTags: tags
```

### 6. Project View for Active Tasks
```base
view: task-genius-projects
from: "Tasks"
where: status != "x" AND (due_date <= date("today") OR priority >= 3)
config:
  taskContent: name
  taskStatus: status
  taskPriority: priority
  taskDueDate: due_date
  taskProject: project
```

### 7. Unified View with Custom Configuration
```base
view: task-genius-unified
from: "Tasks"
config:
  viewMode: "forecast"
  taskContent: name
  taskStatus: status
  taskPriority: priority
  taskProject: project
  taskTags: tags
  taskDueDate: due_date
  taskStartDate: start_date
  taskContext: context
```

## Sample Task Entries

| name | description | status | priority | project | tags | due_date | start_date | context | assignee |
|------|-------------|--------|----------|---------|------|----------|------------|---------|----------|
| Write documentation | Create comprehensive docs for new feature | [ ] | 3 | Development/Docs | documentation, high-priority | 2024-02-15 | 2024-02-10 | @work | John |
| Review PR #123 | Code review for authentication changes | [ ] | 4 | Development/Backend | review, urgent | 2024-02-12 | | @work | Sarah |
| Plan Q2 roadmap | Define goals and milestones for Q2 | [ ] | 5 | Planning | planning, strategic | 2024-03-01 | 2024-02-20 | @office | Team Lead |
| Fix login bug | Users can't login with special characters | [ ] | 5 | Development/Frontend | bug, critical | 2024-02-11 | | @urgent | Alex |
| Update dependencies | Upgrade all npm packages to latest versions | [x] | 2 | Development/Maintenance | maintenance | 2024-02-10 | 2024-02-09 | @work | DevOps |
| Design new logo | Create brand refresh proposal | [ ] | 3 | Design/Branding | design, creative | 2024-02-28 | 2024-02-15 | @creative | Designer |
| Customer interview | Interview key customer about new features | [ ] | 4 | Research | research, customer | 2024-02-13 | | @calls | PM |
| Write blog post | Technical blog about new architecture | [ ] | 2 | Marketing/Content | content, blog | 2024-02-25 | 2024-02-18 | @writing | Tech Writer |
| Setup monitoring | Configure APM for production | [ ] | 4 | DevOps/Infrastructure | monitoring, setup | 2024-02-14 | 2024-02-12 | @technical | SRE |
| Team retrospective | Monthly team retrospective meeting | [ ] | 3 | Team/Meetings | meeting, team | 2024-02-16 | | @meetings | Scrum Master |

## Configuration Notes

### Property Mappings
- **taskContent**: Maps to the main task text (usually 'name' or 'title')
- **taskStatus**: Maps to completion status (checkbox or status text)
- **taskPriority**: Maps to priority level (1-5, where 5 is highest)
- **taskProject**: Maps to project assignment (supports nested projects with '/')
- **taskTags**: Maps to tags (can be list or comma-separated text)
- **taskDueDate**: Maps to due date field
- **taskStartDate**: Maps to start date field
- **taskCompletedDate**: Maps to completion date field
- **taskContext**: Maps to context (@context format)

### View Modes
Each view type has specific features:
- **Inbox**: Simple task list with filtering
- **Forecast**: Timeline-based view
- **Projects**: Hierarchical project organization
- **Tags**: Tag-based grouping
- **Calendar**: Monthly/weekly calendar
- **Kanban**: Drag-and-drop board by status
- **Gantt**: Project timeline visualization
- **Review**: Task processing workflow
- **Habits**: Recurring task tracking
- **Flagged**: High-priority task focus

### Advanced Features
1. **Live Filtering**: Use the filter button in any view
2. **Quick Capture**: Add tasks quickly with the capture button
3. **Details Panel**: Click tasks to see/edit details
4. **Status Switching**: Right-click for status options
5. **Drag & Drop**: Supported in Kanban and some other views
6. **Keyboard Shortcuts**: Various shortcuts for task operations

## Tips for Best Results

1. **Consistent Property Names**: Use consistent property names across your bases
2. **Status Values**: Use standard status marks (space for not started, 'x' for completed)
3. **Project Hierarchy**: Use '/' to create nested projects (e.g., "Development/Frontend/Components")
4. **Date Formats**: Use ISO format (YYYY-MM-DD) for dates
5. **Priority Scale**: Use 1-5 scale where 5 is highest priority
6. **Tags Format**: Use comma-separated values or list format for tags
7. **Context Format**: Use @context format for contexts (e.g., "@work", "@home")

## Troubleshooting

If views don't appear:
1. Ensure Bases plugin is installed and enabled
2. Restart Obsidian after installing Task Genius
3. Check console for any error messages
4. Verify property mappings match your base schema
5. Ensure query syntax is correct

For more information, see the Task Genius documentation.