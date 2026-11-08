<div align="center">
  <img src="media/task-genius.webp" alt="Task Genius Logo" width="100%">

  [![Version](https://img.shields.io/badge/version-8.9.0-blue.svg)](https://github.com/Quorafind/Obsidian-Task-Genius)
  [![Discord](https://img.shields.io/discord/1382008288706695229?color=7289da&label=Discord&logo=discord&logoColor=white)](https://discord.gg/ARR2rHHX6b)

  [Documentation](https://taskgenius.md) • [Installation](#installation) • [Discord Community](https://discord.gg/ARR2rHHX6b)
</div>

---

## Overview

Task Genius plugin transforms Obsidian into a powerful task management system with advanced features, beautiful visualizations, and seamless in-editor task management workflow - all while preserving Obsidian's philosophy of plain-text, future-proof note-taking.

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Task Views** | Visualize your tasks in different ways, including list, kanban, calendar, and gantt charts |
| **Date & Priority** | [View-based] Recurring tasks, multiple date types, and visual priority indicators |
| **Workflows** | [Editor-based] Multi-stage workflows with automatic timestamping, templates, and process tracking |
| **Habit Tracking** | [View-based] Daily habits, streak tracking, visual calendar, and progress analytics |
| **Quick Capture** | global commands, templates, and automated task creation |
| **Filtering & Search** | Advanced in-editor filtering, saved queries, and custom perspectives |
| **Gamification** | [View-based] Achievement rewards, custom milestones, and motivational feedback |

For detailed feature documentation, visit [taskgenius.md](https://taskgenius.md).

---

## Installation

### Community Plugin (Recommended)
1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Search for "Task Genius"
4. Click Install, then Enable

### Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/taskgenius/taskgenius-plugin/releases)
2. Extract files to `.obsidian/plugins/task-genius/`
3. Enable the plugin in Obsidian settings

---

## Quick Start

1. **Enable Plugin**: Activate Task Genius in your plugin settings
2. **Onboarding**: You will be guided through the setup process by the plugin

OR

1. **Open Task View**: Click the ribbon icon or use Command Palette to search `Open Task Genius View`.
2. **Create First Task**: Use the Quick Capture panel to create your first task.
3. **Explore Views**: Switch between different views to find your preferred workflow

---

## Community & Support

### Discord Community
Join our active community for help, tips, and feature discussions:
**[Task Genius Discord](https://discord.gg/ARR2rHHX6b)**

### Resources
- [Complete Documentation](https://taskgenius.md)
- [Issue Tracker](https://github.com/taskgenius/taskgenius-plugin/issues)
- [Feature Requests](https://github.com/taskgenius/taskgenius-plugin/discussions)

---

## License

[FSL-1.1-ALv2](./LICENSE)

Feel free to use any part in the `src/components`, such as the Inline Markdown Editor or the Kanban component.
## 旧布局维护分支

`legacy/9.13.1` 从官方 9.13.1 标签维护，保留原设置导航与布局。设置中文、状态菜单和索引刷新修复在此分支独立实现。

发布步骤见 [RELEASING.zh-CN.md](RELEASING.zh-CN.md)。使用 `pnpm build:release` 生成 `dist/main.js`、`dist/manifest.json`、`dist/styles.css`，随后由仓库所有者自行创建 GitHub Release。PR 或构建成功本身不会发布 Release。
