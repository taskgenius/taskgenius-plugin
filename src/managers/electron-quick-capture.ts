import { App, Notice, moment } from "obsidian";
import TaskProgressBarPlugin from "../index";
import { t } from "../translations/helper";
import { formatDate as formatDateSmart } from "@/utils/date/date-utils";

export class ElectronQuickCapture {
	private captureWindow: any = null;
	private plugin: TaskProgressBarPlugin;
	private app: App;
	private ipcRenderer: any = null;
	private ipcMain: any = null;
	private BrowserWindow: any = null;
	// private ownerWindow: any = null; // Removed - no longer using parent window
	private captureResolve: ((value: any) => void) | null = null;
	private captureReject: ((reason?: any) => void) | null = null;
	private isClosingNormally = false;

	constructor(plugin: TaskProgressBarPlugin) {
		this.plugin = plugin;
		this.app = plugin.app;
		this.initializeElectron();
	}

	private getElectron(): any | null {
		try {
			const injected =
				(window as any).electron || (globalThis as any).electron;
			if (injected) return injected;
			const req = (window as any).require || (globalThis as any).require;
			return req ? req("electron") : null;
		} catch {
			return null;
		}
	}

	private initializeElectron(): boolean {
		const electron = this.getElectron();
		if (!electron) return false;

		this.BrowserWindow =
			electron.remote?.BrowserWindow || electron.BrowserWindow;
		this.ipcRenderer = electron.ipcRenderer;
		this.ipcMain = electron.remote?.ipcMain || electron.ipcMain;

		// No longer getting owner window since we don't use parent

		return !!(this.BrowserWindow && this.ipcRenderer);
	}

	public async openCaptureWindow(): Promise<any> {
		if (!this.BrowserWindow) {
			new Notice(t("Electron not available for quick capture"));
			return null;
		}

		// If window already exists, focus it
		if (this.captureWindow && !this.captureWindow.isDestroyed()) {
			this.captureWindow.show();
			this.captureWindow.focus();
			return null;
		}

		return new Promise((resolve, reject) => {
			this.captureResolve = resolve;
			this.captureReject = reject;

			try {
				// Create window with optimal settings for quick capture
				this.captureWindow = new this.BrowserWindow({
					width: 600,
					height: 400,
					useContentSize: true, // Use content size for dimensions
					minWidth: 400,
					minHeight: 250,
					// parent: this.ownerWindow, // Remove parent to avoid bringing main window to front
					modal: false,
					show: false,
					frame: true,
					autoHideMenuBar: true,
					alwaysOnTop: true,
					resizable: true,
					minimizable: false,
					maximizable: false,
					fullscreenable: false,
					skipTaskbar: true,
					title: "Quick Capture - Task Genius",
					backgroundColor: this.getBackgroundColor(),
					webPreferences: {
						nodeIntegration: true,
						contextIsolation: false,
						webSecurity: false,
					},
				});

				// Generate and load the HTML content
				const html = this.generateCaptureHTML();
				this.captureWindow.loadURL(
					`data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
				);

				// Setup IPC handlers
				this.setupIPCHandlers();

				// Handle window events
				this.captureWindow.once("ready-to-show", () => {
					// Use showInactive on macOS to avoid bringing main window to front
					if (
						process.platform === "darwin" &&
						this.captureWindow?.showInactive
					) {
						this.captureWindow.showInactive();
					} else {
						this.captureWindow?.show();
					}
					// Only focus when necessary for keyboard input
					setTimeout(() => {
						this.captureWindow?.focus();
					}, 100);
					// Send initial data to window
					this.captureWindow.webContents.executeJavaScript(`
						window.postMessage({
							type: 'init',
							settings: ${JSON.stringify(this.getQuickCaptureSettings())}
						}, '*');
					`);
				});

				// Auto-adjust window size to content after loading
				this.captureWindow.webContents.once(
					"did-finish-load",
					async () => {
						try {
							const size =
								await this.captureWindow?.webContents.executeJavaScript(
									`({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight})`,
								);
							if (
								size &&
								this.captureWindow &&
								!this.captureWindow.isDestroyed()
							) {
								this.captureWindow.setContentSize(
									Math.max(500, Math.min(800, size.w)),
									Math.max(320, Math.min(600, size.h)),
									true,
								);
							}
						} catch (e) {
							console.log(
								"Could not auto-adjust window size:",
								e,
							);
						}
					},
				);

				this.captureWindow.on("closed", () => {
					this.captureWindow = null;
					this.cleanupIPCHandlers();
					// Only reject if not closing normally (e.g., user clicked X or pressed Escape)
					if (!this.isClosingNormally) {
						if (this.captureResolve) {
							// Resolve with null to indicate user cancelled
							this.captureResolve(null);
						}
					}
					// Reset state
					this.captureResolve = null;
					this.captureReject = null;
					this.isClosingNormally = false;
				});
			} catch (error) {
				console.error("Failed to create capture window:", error);
				new Notice(t("Failed to open quick capture window"));
				reject(error);
			}
		});
	}

	private setupIPCHandlers(): void {
		if (!this.captureWindow) return;

		console.log("[ElectronQuickCapture] Setting up IPC handlers");

		// Try to get ipcMain for handling messages
		const electron = this.getElectron();
		const ipcMain = electron?.ipcMain || electron?.remote?.ipcMain;

		if (ipcMain) {
			// Use ipcMain handlers (preferred method)
			try {
				// Remove existing handlers if any
				ipcMain.removeHandler("quick-capture-save");
				ipcMain.removeHandler("quick-capture-cancel");
				ipcMain.removeHandler("quick-capture-request-data");

				// Handle save
				ipcMain.handle(
					"quick-capture-save",
					async (event: any, data: any) => {
						console.log(
							"[ElectronQuickCapture] IPC received save:",
							data,
						);
						await this.handleSaveTask(data);
					},
				);

				// Handle cancel
				ipcMain.handle("quick-capture-cancel", async () => {
					console.log("[ElectronQuickCapture] IPC received cancel");
					this.closeCaptureWindow();
				});

				// Handle data requests
				ipcMain.handle(
					"quick-capture-request-data",
					async (event: any, type: string) => {
						console.log(
							"[ElectronQuickCapture] IPC requesting data:",
							type,
						);
						return await this.getDataForWindow(type);
					},
				);

				(this as any)._ipcHandlers = { ipcMain, registered: true };
				console.log(
					"[ElectronQuickCapture] IPC handlers registered with ipcMain.handle",
				);
			} catch (e) {
				console.warn(
					"[ElectronQuickCapture] Failed to set up ipcMain handlers:",
					e,
				);
			}
		}

		// Fallback: Listen for regular IPC messages
		this.captureWindow.webContents.on(
			"ipc-message",
			async (_event: any, channel: string, ...args: any[]) => {
				console.log(
					"[ElectronQuickCapture] Received ipc-message:",
					channel,
					args,
				);
				if (channel === "quick-capture-save") {
					await this.handleSaveTask(args[0]);
				} else if (channel === "quick-capture-cancel") {
					this.closeCaptureWindow();
				} else if (channel === "quick-capture-request-data") {
					const data = await this.getDataForWindow(args[0]);
					// Send data back to window
					this.captureWindow?.webContents?.executeJavaScript(`
					window.receiveSuggestions('${args[0]}', ${JSON.stringify(data)});
				`);
				}
			},
		);

		// Also listen for direct channel messages (for newer Electron versions)
		if (ipcMain) {
			ipcMain.on("quick-capture-save", async (event: any, data: any) => {
				console.log(
					"[ElectronQuickCapture] Direct IPC received save:",
					data,
				);
				await this.handleSaveTask(data);
			});

			ipcMain.on("quick-capture-cancel", () => {
				console.log(
					"[ElectronQuickCapture] Direct IPC received cancel",
				);
				this.closeCaptureWindow();
			});

			ipcMain.on(
				"quick-capture-request-data",
				async (event: any, type: string) => {
					console.log(
						"[ElectronQuickCapture] Direct IPC requesting data:",
						type,
					);
					const data = await this.getDataForWindow(type);
					event.reply("quick-capture-data-response", type, data);
				},
			);

			(this as any)._ipcHandlers = { ipcMain, registered: true };
		}
	}

	// Not currently used but kept for potential future use
	private injectWindowHandlers(): void {
		// Inject handlers directly into the window if IPC is not available
		if (!this.captureWindow) return;

		const handleSave = `
			window.handleQuickCaptureSave = async (data) => {
				return ${JSON.stringify({ handler: "save" })};
			};
		`;

		const handleCancel = `
			window.handleQuickCaptureCancel = () => {
				window.close();
			};
		`;

		this.captureWindow.webContents.executeJavaScript(handleSave);
		this.captureWindow.webContents.executeJavaScript(handleCancel);

		// Set up message passing through window.postMessage
		this.captureWindow.webContents.on(
			"ipc-message",
			async (_event: any, channel: string, ...args: any[]) => {
				if (channel === "quick-capture-save") {
					await this.handleSaveTask(args[0]);
				} else if (channel === "quick-capture-cancel") {
					this.closeCaptureWindow();
				}
			},
		);
	}

	private cleanupIPCHandlers(): void {
		if (!(this as any)._ipcHandlers) return;

		const { ipcMain } = (this as any)._ipcHandlers;
		if (ipcMain) {
			// Remove IPC handlers
			try {
				// Remove handle-based handlers
				ipcMain.removeHandler("quick-capture-save");
				ipcMain.removeHandler("quick-capture-cancel");
				ipcMain.removeHandler("quick-capture-request-data");

				// Remove event-based listeners
				ipcMain.removeAllListeners("quick-capture-save");
				ipcMain.removeAllListeners("quick-capture-cancel");
				ipcMain.removeAllListeners("quick-capture-request-data");
			} catch {
				// Ignore errors during cleanup
			}
		}

		delete (this as any)._ipcHandlers;
	}

	private async handleSaveTask(data: any): Promise<void> {
		try {
			console.log(
				"[ElectronQuickCapture] handleSaveTask called with data:",
				data,
			);
			// Parse the task content and metadata
			const { content, project, context, dueDate, priority, tags } = data;

			if (!content?.trim()) {
				this.captureWindow?.webContents?.executeJavaScript(`
					showError('Task content cannot be empty');
				`);
				return;
			}

			// Prepare task creation arguments
			const taskArgs: any = {
				content: content.trim(),
			};

			// Add optional metadata
			if (project) taskArgs.project = project;
			if (context) taskArgs.context = context;
			if (priority) taskArgs.priority = priority;
			if (tags && tags.length > 0) taskArgs.tags = tags;

			// Parse due date if provided
			if (dueDate) {
				const parsedDate = this.parseDueDate(dueDate);
				if (parsedDate) {
					taskArgs.dueDate = parsedDate;
				}
			}

			// Create the task using the write API
			console.log(
				"[ElectronQuickCapture] Calling createTask with args:",
				taskArgs,
			);
			const result = await this.createTask(taskArgs);

			if (result.success) {
				new Notice(t("Task captured successfully"));
				// Mark as normal closing before closing the window
				this.isClosingNormally = true;
				if (this.captureResolve) {
					this.captureResolve(result.task);
					this.captureResolve = null;
					this.captureReject = null;
				}
				this.closeCaptureWindow();
			} else {
				throw new Error(result.error || "Failed to create task");
			}
		} catch (error: any) {
			console.error("Failed to save task:", error);
			const errorMsg = error.message || "Failed to save task";
			this.captureWindow?.webContents?.executeJavaScript(`
				showError('${errorMsg.replace(/'/g, "\\'")}');
			`);
		}
	}

	private async createTask(args: any): Promise<any> {
		// Use the plugin's write API to create the task
		if (!this.plugin.writeAPI) {
			console.error("[ElectronQuickCapture] WriteAPI not available");
			return { success: false, error: "Write API not available" };
		}

		console.log("[ElectronQuickCapture] Creating task with args:", args);

		// Determine target based on quick capture settings
		const qc = this.plugin.settings.quickCapture;
		const targetType = qc?.targetType || "daily-note";

		try {
			let result;
			if (targetType === "daily-note") {
				// Create in daily note
				console.log(
					"[ElectronQuickCapture] Creating task in daily note",
				);
				result = await this.plugin.writeAPI.createTaskInDailyNote(args);
			} else if (targetType === "fixed" && qc?.targetFile) {
				// Create in fixed file
				console.log(
					"[ElectronQuickCapture] Creating task in fixed file:",
					qc.targetFile,
				);
				args.filePath = qc.targetFile;
				result = await this.plugin.writeAPI.createTask(args);
			} else {
				// Default to daily note
				console.log(
					"[ElectronQuickCapture] Creating task in daily note (default)",
				);
				result = await this.plugin.writeAPI.createTaskInDailyNote(args);
			}
			console.log("[ElectronQuickCapture] Task creation result:", result);
			return result;
		} catch (error) {
			console.error("[ElectronQuickCapture] Error creating task:", error);
			return {
				success: false,
				error: error.message || "Failed to create task",
			};
		}
	}

	private parseDueDate(dateStr: string): string | undefined {
		if (!dateStr) return undefined;

		const trimmed = dateStr.trim();
		const normalize = (value: moment.Moment): string | undefined => {
			if (!value || !value.isValid()) return undefined;
			return formatDateSmart(value.toDate(), { includeSeconds: false });
		};

		try {
			// Try natural language parsing first
			const naturalParsers = [
				{ pattern: /^today$/i, offset: 0 },
				{ pattern: /^tomorrow$/i, offset: 1 },
				{ pattern: /^next week$/i, offset: 7 },
				{ pattern: /^in (\d+) days?$/i, offsetMatch: 1 },
			];

			for (const parser of naturalParsers) {
				const match = trimmed.match(parser.pattern);
				if (match) {
					const offset = parser.offsetMatch
						? parseInt(match[parser.offsetMatch])
						: parser.offset;
					const date = moment().add(offset, "days");
					const formatted = normalize(date);
					if (formatted) return formatted;
				}
			}

			// Try parsing with strict formats (supporting date and datetime)
			const parsed = moment(
				trimmed,
				[
					moment.ISO_8601,
					"YYYY-MM-DD HH:mm",
					"YYYY-MM-DDTHH:mm",
					"YYYY-MM-DD",
				],
				true,
			);
			const strictFormatted = normalize(parsed);
			if (strictFormatted) return strictFormatted;

			// Fallback to loose parsing
			const fallback = moment(trimmed);
			return normalize(fallback);
		} catch {
			// Ignore parsing errors
			return undefined;
		}
	}

	private async getDataForWindow(type: string): Promise<any> {
		switch (type) {
			case "projects":
				return await this.getProjects();
			case "contexts":
				return await this.getContexts();
			case "tags":
				return await this.getTags();
			default:
				return [];
		}
	}

	private async getProjects(): Promise<string[]> {
		try {
			const queryAPI = (
				this.plugin as any
			).dataflowOrchestrator?.getQueryAPI?.();
			if (!queryAPI) return [];
			const allTasks = await queryAPI.getAllTasks();
			const projects = new Set<string>();
			for (const task of allTasks) {
				if (task.metadata?.project) {
					projects.add(task.metadata.project);
				}
			}
			return Array.from(projects).sort();
		} catch {
			return [];
		}
	}

	private async getContexts(): Promise<string[]> {
		try {
			const queryAPI = (
				this.plugin as any
			).dataflowOrchestrator?.getQueryAPI?.();
			if (!queryAPI) return [];
			const allTasks = await queryAPI.getAllTasks();
			const contexts = new Set<string>();
			for (const task of allTasks) {
				if (task.metadata?.context) {
					contexts.add(task.metadata.context);
				}
			}
			return Array.from(contexts).sort();
		} catch {
			return [];
		}
	}

	private async getTags(): Promise<string[]> {
		try {
			const queryAPI = (
				this.plugin as any
			).dataflowOrchestrator?.getQueryAPI?.();
			if (!queryAPI) return [];
			const allTasks = await queryAPI.getAllTasks();
			const tags = new Set<string>();
			for (const task of allTasks) {
				if (task.metadata?.tags && Array.isArray(task.metadata.tags)) {
					task.metadata.tags.forEach((tag: string) => tags.add(tag));
				}
			}
			return Array.from(tags).sort();
		} catch {
			return [];
		}
	}

	private closeCaptureWindow(): void {
		if (this.captureWindow && !this.captureWindow.isDestroyed()) {
			// Set flag if not already set (for cancel operations)
			if (!this.isClosingNormally) {
				this.isClosingNormally = true;
			}
			this.captureWindow.close();
		}
		this.captureWindow = null;
	}

	private getBackgroundColor(): string {
		try {
			const isDark = this.isDarkTheme();
			return isDark ? "#202020" : "#ffffff";
		} catch {
			return "#ffffff";
		}
	}

	private isDarkTheme(): boolean {
		try {
			const electron = this.getElectron();
			const nativeTheme =
				electron?.nativeTheme || electron?.remote?.nativeTheme;
			if (
				nativeTheme &&
				typeof nativeTheme.shouldUseDarkColors === "boolean"
			) {
				return nativeTheme.shouldUseDarkColors;
			}
			return window.matchMedia("(prefers-color-scheme: dark)").matches;
		} catch {
			return false;
		}
	}

	private getQuickCaptureSettings(): any {
		const qc = this.plugin.settings.quickCapture || {};
		// Return all metadata fields as visible by default
		// since there are no specific show/hide settings for them
		return {
			targetType: qc.targetType || "daily-note",
			showProject: true,
			showContext: true,
			showDueDate: true,
			showPriority: true,
			showTags: true,
		};
	}

	private generateCaptureHTML(): string {
		const isDark = this.isDarkTheme();

		// Define Obsidian-like CSS variables for consistent styling
		const cssVars = `
		:root {
			--background-primary: ${isDark ? "#202020" : "#ffffff"};
			--background-primary-alt: ${isDark ? "#1a1a1a" : "#fafafa"};
			--background-secondary: ${isDark ? "#2a2a2a" : "#f5f5f5"};
			--background-secondary-alt: ${isDark ? "#333333" : "#e3e3e3"};
			--background-modifier-border: ${isDark ? "#404040" : "#d0d0d0"};
			--background-modifier-hover: ${isDark ? "#353535" : "#ebebeb"};
			--text-normal: ${isDark ? "#e0e0e0" : "#333333"};
			--text-muted: ${isDark ? "#a0a0a0" : "#666666"};
			--text-faint: ${isDark ? "#808080" : "#999999"};
			--text-on-accent: #ffffff;
			--interactive-normal: ${isDark ? "#2a2a2a" : "#f5f5f5"};
			--interactive-hover: ${isDark ? "#3a3a3a" : "#e8e8e8"};
			--interactive-accent: #7c3aed;
			--interactive-accent-hover: #6d28d9;
			--radius-s: 6px;
			--radius-m: 8px;
		}
		`;

		return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>Quick Capture - Task Genius</title>
	<style>
		${cssVars}

		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		html, body {
			height: 100%;
			width: 100%;
		}

		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
			background-color: var(--background-primary);
			color: var(--text-normal);
			padding: 12px;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}

		.container {
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 16px;
			overflow-y: auto;
			padding: 8px;
		}

		.title {
			font-size: 18px;
			font-weight: 600;
			margin-bottom: 8px;
		}

		.input-group {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		label {
			font-size: 12px;
			font-weight: 500;
			color: var(--text-muted);
		}

		input[type="text"],
		textarea,
		select {
			width: 100%;
			padding: 8px 12px;
			background-color: var(--background-secondary);
			color: var(--text-normal);
			border: 1px solid var(--background-modifier-border);
			border-radius: var(--radius-s);
			font-size: 14px;
			outline: none;
			transition: all 0.2s;
		}

		input[type="text"]:focus,
		textarea:focus,
		select:focus {
			border-color: var(--interactive-accent);
			box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2);
		}

		textarea {
			resize: none;
			min-height: 80px;
			max-height: 300px;
			font-family: inherit;
			line-height: 1.5;
			overflow-y: auto;
		}

		.metadata {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 12px;
		}

		.metadata-item {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		.buttons {
			display: flex;
			justify-content: flex-end;
			gap: 12px;
			margin-top: auto;
			padding: 12px;
			border-top: 1px solid var(--background-modifier-border);
			background: var(--background-primary);
		}

		button {
			padding: 8px 20px;
			border: none;
			border-radius: var(--radius-s);
			font-size: 14px;
			font-weight: 500;
			cursor: pointer;
			transition: all 0.2s;
		}

		.btn-primary {
			background-color: var(--interactive-accent);
			color: var(--text-on-accent);
		}

		.btn-primary:hover {
			background-color: var(--interactive-accent-hover);
			transform: translateY(-1px);
		}

		.btn-secondary {
			background-color: var(--background-secondary);
			color: var(--text-normal);
			border: 1px solid var(--background-modifier-border);
		}

		.btn-secondary:hover {
			background-color: var(--background-modifier-hover);
		}

		.error-message {
			color: #ef4444;
			font-size: 12px;
			margin-top: 4px;
			display: none;
		}

		.error-message.show {
			display: block;
		}

		.help-text {
			font-size: 11px;
			color: var(--text-faint);
			margin-top: 2px;
		}

		.priority-select {
			display: flex;
			gap: 8px;
		}

		.priority-btn {
			flex: 1;
			padding: 6px;
			text-align: center;
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.2s;
			background-color: var(--background-secondary);
		}

		.priority-btn:hover {
			background-color: rgba(124, 58, 237, 0.1);
			border-color: var(--interactive-accent);
		}

		.priority-btn.selected {
			background-color: var(--interactive-accent);
			color: var(--text-on-accent);
			border-color: var(--interactive-accent);
		}

		.date-input-wrapper {
			display: flex;
			gap: 8px;
			align-items: center;
		}

		.date-picker, .date-text {
			flex: 1;
		}

		.date-toggle {
			width: 32px;
			height: 32px;
			padding: 4px;
			background: var(--background-secondary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			cursor: pointer;
			font-size: 16px;
			transition: all 0.2s;
		}

		.date-toggle:hover {
			background: rgba(124, 58, 237, 0.1);
			border-color: var(--interactive-accent);
		}

		@media (max-width: 500px) {
			.metadata {
				grid-template-columns: 1fr;
			}
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="title">Quick Capture</div>

		<div class="input-group">
			<textarea
				id="task-content"
				placeholder="Enter your task..."
				autofocus
			></textarea>
			<div class="error-message" id="content-error"></div>
		</div>

		<div class="metadata" id="metadata-section">
			<div class="metadata-item">
				<label>Project</label>
				<input type="text" id="project" list="project-list" placeholder="e.g., Work, Personal">
				<datalist id="project-list"></datalist>
			</div>

			<div class="metadata-item">
				<label>Context</label>
				<input type="text" id="context" list="context-list" placeholder="e.g., @home, @office">
				<datalist id="context-list"></datalist>
			</div>

			<div class="metadata-item">
				<label>Start Date</label>
				<div class="date-input-wrapper">
					<input type="datetime-local" id="start-date-picker" class="date-picker">
					<input type="text" id="start-date-text" placeholder="today, tomorrow" class="date-text" style="display:none">
					<button type="button" class="date-toggle" data-date-type="start" title="Toggle input type">🛫</button>
				</div>
			</div>

			<div class="metadata-item">
				<label>Due Date</label>
				<div class="date-input-wrapper">
					<input type="datetime-local" id="due-date-picker" class="date-picker">
					<input type="text" id="due-date-text" placeholder="tomorrow, next week" class="date-text" style="display:none">
					<button type="button" class="date-toggle" data-date-type="due" title="Toggle input type">📅</button>
				</div>
			</div>

			<div class="metadata-item">
				<label>Scheduled Date</label>
				<div class="date-input-wrapper">
					<input type="datetime-local" id="scheduled-date-picker" class="date-picker">
					<input type="text" id="scheduled-date-text" placeholder="next monday" class="date-text" style="display:none">
					<button type="button" class="date-toggle" data-date-type="scheduled" title="Toggle input type">⏳</button>
				</div>
			</div>

			<div class="metadata-item">
				<label>Priority</label>
				<div class="priority-select">
					<div class="priority-btn" data-priority="1">1</div>
					<div class="priority-btn" data-priority="2">2</div>
					<div class="priority-btn" data-priority="3">3</div>
					<div class="priority-btn" data-priority="4">4</div>
					<div class="priority-btn" data-priority="5">5</div>
				</div>
			</div>

			<div class="metadata-item">
				<label>Tags</label>
				<input type="text" id="tags" list="tags-list" placeholder="e.g., important, urgent">
				<datalist id="tags-list"></datalist>
				<div class="help-text">Comma separated</div>
			</div>
		</div>

		<div class="buttons">
			<button class="btn-secondary" onclick="cancel()">
				Cancel (Esc)
			</button>
			<button class="btn-primary" onclick="save()">
				Save (Enter)
			</button>
		</div>
	</div>

	<script>
		// Use a bridge approach for IPC communication
		let selectedPriority = null;
		let bridge = null;
		let dateInputModes = {
			start: 'picker',
			due: 'picker',
			scheduled: 'picker'
		}; // Track mode for each date field

		// Set up communication bridge
		try {
			// Try to get ipcRenderer from various sources
			const electron = window.require ? window.require('electron') : null;
			const ipcRenderer = electron?.ipcRenderer;

			if (ipcRenderer) {
				console.log('IPC bridge established');
				bridge = {
					save: (data) => {
						console.log('Sending save via IPC:', data);
						// Try both old and new IPC methods
						ipcRenderer.send('quick-capture-save', data);
						return Promise.resolve();
					},
					cancel: () => {
						console.log('Sending cancel via IPC');
						ipcRenderer.send('quick-capture-cancel');
						return Promise.resolve();
					},
					requestData: (type) => {
						return new Promise((resolve) => {
							// Set up receiver for suggestions
							window.receiveSuggestions = (dataType, items) => {
								if (dataType === type) {
									resolve(items);
									delete window.receiveSuggestions;
								}
							};
							ipcRenderer.send('quick-capture-request-data', type);
							// Timeout after 2 seconds
							setTimeout(() => resolve([]), 2000);
						});
					}
				};
			} else {
				console.log('IPC not available - no ipcRenderer');
			}
		} catch (e) {
			console.log('IPC not available - error:', e);
		}

		// Auto-resize textarea
		function autoResizeTextarea(textarea) {
			if (!textarea) return;

			// Reset height to measure content
			textarea.style.height = 'auto';

			// Calculate new height based on scroll height
			const newHeight = Math.min(textarea.scrollHeight, 300);
			textarea.style.height = newHeight + 'px';

			// Don't resize the window - let the container handle overflow
			// The window size should remain stable
		}

		// Initialize
		document.addEventListener('DOMContentLoaded', () => {
			const taskContent = document.getElementById('task-content');

			// Focus on task content
			if (taskContent) {
				taskContent.focus();

				// Auto-resize on input
				taskContent.addEventListener('input', () => {
					autoResizeTextarea(taskContent);
				});

				// Initial resize
				setTimeout(() => autoResizeTextarea(taskContent), 0);
			}

			// Load suggestions
			loadSuggestions();

			// Date input toggles
			document.querySelectorAll('.date-toggle').forEach(btn => {
				btn.addEventListener('click', (e) => {
					const dateType = e.target.dataset.dateType;
					if (dateType) {
						toggleDateInput(dateType);
					}
				});
			});

			// Handle date picker changes for all date fields
			['start', 'due', 'scheduled'].forEach(dateType => {
				const picker = document.getElementById(dateType + '-date-picker');
				const text = document.getElementById(dateType + '-date-text');

				if (picker) {
					picker.addEventListener('change', (e) => {
						// Sync to text field
						if (text) text.value = e.target.value;
					});
				}

				// Handle natural language date input
				if (text) {
					text.addEventListener('blur', (e) => {
						const parsed = parseNaturalDate(e.target.value);
						if (parsed && parsed !== e.target.value) {
							e.target.value = parsed;
							if (picker) picker.value = parsed;
						}
					});
				}
			})

			// Handle priority buttons
			document.querySelectorAll('.priority-btn').forEach(btn => {
				btn.addEventListener('click', () => {
					document.querySelectorAll('.priority-btn').forEach(b =>
						b.classList.remove('selected')
					);
					btn.classList.add('selected');
					selectedPriority = parseInt(btn.dataset.priority);
				});
			});

			// Keyboard shortcuts
			document.addEventListener('keydown', (e) => {
				if (e.key === 'Escape') {
					e.preventDefault();
					cancel();
				} else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
					e.preventDefault();
					save();
				} else if (e.key === 'Tab' && e.target.id === 'task-content') {
					// Allow Tab in textarea to insert tabs
					if (!e.shiftKey) {
						e.preventDefault();
						const textarea = e.target;
						const start = textarea.selectionStart;
						const end = textarea.selectionEnd;
						const value = textarea.value;
						textarea.value = value.substring(0, start) + '\t' + value.substring(end);
						textarea.selectionStart = textarea.selectionEnd = start + 1;
						autoResizeTextarea(textarea);
					}
				} else if ((e.key >= '1' && e.key <= '5') && e.altKey) {
					// Alt+1 through Alt+5 for priority
					e.preventDefault();
					const priority = parseInt(e.key);
					document.querySelectorAll('.priority-btn').forEach(btn => {
						btn.classList.remove('selected');
						if (parseInt(btn.dataset.priority) === priority) {
							btn.classList.add('selected');
							selectedPriority = priority;
						}
					});
				}
			});

			// Handle settings from main process
			window.addEventListener('message', (event) => {
				if (event.data.type === 'init' && event.data.settings) {
					applySettings(event.data.settings);
				}
			});
		});

		// Toggle date input between picker and text for specific date type
		function toggleDateInput(dateType) {
			const picker = document.getElementById(dateType + '-date-picker');
			const text = document.getElementById(dateType + '-date-text');

			if (!picker || !text) return;

			if (dateInputModes[dateType] === 'picker') {
				picker.style.display = 'none';
				text.style.display = 'block';
				text.focus();
				dateInputModes[dateType] = 'text';
			} else {
				text.style.display = 'none';
				picker.style.display = 'block';
				picker.focus();
				dateInputModes[dateType] = 'picker';
			}
		}

		// Load auto-complete suggestions
		async function loadSuggestions() {
			if (bridge && bridge.requestData) {
				try {
					// Request and populate projects
					const projects = await bridge.requestData('projects');
					populateDatalist('project-list', projects || []);

					// Request and populate contexts
					const contexts = await bridge.requestData('contexts');
					populateDatalist('context-list', contexts || []);

					// Request and populate tags
					const tags = await bridge.requestData('tags');
					populateDatalist('tags-list', tags || []);
				} catch (e) {
					console.error('Failed to load suggestions:', e);
				}
			}
		}

		// Populate datalist with items
		function populateDatalist(listId, items) {
			const datalist = document.getElementById(listId);
			if (!datalist || !items) return;

			datalist.innerHTML = '';
			items.forEach(item => {
				const option = document.createElement('option');
				option.value = item;
				datalist.appendChild(option);
			});
		}

		function applySettings(settings) {
			// Show/hide metadata fields based on settings
			const metadata = document.getElementById('metadata-section');
			if (!settings.showProject && !settings.showContext &&
				!settings.showDueDate && !settings.showPriority) {
				metadata.style.display = 'none';
			} else {
				// Hide individual fields based on settings
				if (!settings.showProject) {
					const projectEl = document.getElementById('project');
					if (projectEl && projectEl.parentElement) {
						projectEl.parentElement.style.display = 'none';
					}
				}
				if (!settings.showContext) {
					const contextEl = document.getElementById('context');
					if (contextEl && contextEl.parentElement) {
						contextEl.parentElement.style.display = 'none';
					}
				}
				if (!settings.showDueDate) {
					const dueDatePicker = document.getElementById('due-date-picker');
					if (dueDatePicker && dueDatePicker.parentElement && dueDatePicker.parentElement.parentElement) {
						dueDatePicker.parentElement.parentElement.style.display = 'none';
					}
				}
				if (!settings.showPriority) {
					const priorityEls = document.querySelectorAll('.priority-btn');
					if (priorityEls.length > 0 && priorityEls[0].parentElement) {
						priorityEls[0].parentElement.parentElement.style.display = 'none';
					}
				}
			}
		}

		async function save() {
			const content = document.getElementById('task-content').value;

			if (!content.trim()) {
				showError('Task content cannot be empty');
				return;
			}

			// Get date values from either picker or text input for each date type
			function getDateValue(dateType) {
				const pickerValue = document.getElementById(dateType + '-date-picker').value;
				const textValue = document.getElementById(dateType + '-date-text').value;
				const dateValue = pickerValue || textValue;
				return dateValue ? parseNaturalDate(dateValue) : '';
			}

			const startDate = getDateValue('start');
			const dueDate = getDateValue('due');
			const scheduledDate = getDateValue('scheduled');

			// Get tags and split by comma
			const tagsInput = document.getElementById('tags').value.trim();
			const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

			// Process content to convert to task format if needed
			const processedContent = processTaskContent(content.trim());

			const data = {
				content: processedContent,
				project: document.getElementById('project').value.trim(),
				context: document.getElementById('context').value.trim(),
				startDate: startDate ? startDate.trim() : '',
				dueDate: dueDate ? dueDate.trim() : '',
				scheduledDate: scheduledDate ? scheduledDate.trim() : '',
				priority: selectedPriority,
				tags: tags
			};

			if (bridge) {
				try {
					await bridge.save(data);
					window.close();
				} catch (error) {
					console.error('Failed to save:', error);
					showError('Failed to save task');
				}
			} else {
				// Fallback: try to communicate through parent window
				if (window.opener) {
					window.opener.postMessage({ type: 'quick-capture-save', data }, '*');
					window.close();
				} else {
					console.log('Would save:', data);
					showError('Communication bridge not available');
				}
			}
		}

		async function cancel() {
			if (bridge) {
				try {
					await bridge.cancel();
				} catch {}
			}
			window.close();
		}

		function showError(message) {
			const errorEl = document.getElementById('content-error');
			errorEl.textContent = message;
			errorEl.classList.add('show');
			setTimeout(() => {
				errorEl.classList.remove('show');
			}, 3000);
		}

		// Process content to ensure it's in task format
		function processTaskContent(content) {
			if (!content) return '';

			const lines = content.split('\\n');
			const processedLines = [];

			for (let line of lines) {
				if (!line.trim()) {
					processedLines.push(line);
					continue;
				}

				// Check if line starts with a task marker
				const taskRegex = /^[\\s]*[-*+\\d+.]\\s*(\\[[^\\]]*\\])?/;
				if (taskRegex.test(line)) {
					// Already a task or list item
					processedLines.push(line);
				} else {
					// Convert to task
					processedLines.push('- [ ] ' + line.trim());
				}
			}

			return processedLines.join('\\n');
		}

		// Parse natural language dates
		function parseNaturalDate(input) {
			if (!input) return '';

			const trimmed = input.trim();
			const lower = trimmed.toLowerCase();
			const today = new Date();

			// Natural language patterns
			if (lower === 'today' || lower === 'tod') {
				return formatDate(today);
			}
			if (lower === 'tomorrow' || lower === 'tom' || lower === 'tmr') {
				const tomorrow = new Date(today);
				tomorrow.setDate(tomorrow.getDate() + 1);
				return formatDate(tomorrow);
			}
			if (lower === 'yesterday') {
				const yesterday = new Date(today);
				yesterday.setDate(yesterday.getDate() - 1);
				return formatDate(yesterday);
			}
			if (lower === 'next week' || lower === 'nw') {
				const nextWeek = new Date(today);
				nextWeek.setDate(nextWeek.getDate() + 7);
				return formatDate(nextWeek);
			}
			if (lower === 'next month' || lower === 'nm') {
				const nextMonth = new Date(today);
				nextMonth.setMonth(nextMonth.getMonth() + 1);
				return formatDate(nextMonth);
			}

			// Weekday names
			const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
			const weekdayIndex = weekdays.indexOf(lower);
			if (weekdayIndex >= 0) {
				const currentDay = today.getDay();
				let daysUntil = weekdayIndex - currentDay;
				if (daysUntil <= 0) daysUntil += 7; // Next occurrence
				const targetDate = new Date(today);
				targetDate.setDate(targetDate.getDate() + daysUntil);
				return formatDate(targetDate);
			}

			// "next" + weekday
			const nextWeekdayMatch = lower.match(/^next (\\w+)$/);
			if (nextWeekdayMatch) {
				const weekdayName = nextWeekdayMatch[1];
				const idx = weekdays.indexOf(weekdayName);
				if (idx >= 0) {
					const currentDay = today.getDay();
					let daysUntil = idx - currentDay;
					if (daysUntil <= 0) daysUntil += 7;
					daysUntil += 7; // "next" means skip this week
					const targetDate = new Date(today);
					targetDate.setDate(targetDate.getDate() + daysUntil);
					return formatDate(targetDate);
				}
			}

			// Match patterns like "in X days"
			const inDaysMatch = lower.match(/^in (\\d+) days?$/);
			if (inDaysMatch) {
				const days = parseInt(inDaysMatch[1]);
				const future = new Date(today);
				future.setDate(future.getDate() + days);
				return formatDate(future);
			}

			// Match patterns like "X days"
			const daysMatch = lower.match(/^(\\d+) days?$/);
			if (daysMatch) {
				const days = parseInt(daysMatch[1]);
				const future = new Date(today);
				future.setDate(future.getDate() + days);
				return formatDate(future);
			}

			// Try to parse as a regular date
			try {
				const parsed = new Date(trimmed);
				if (!isNaN(parsed.getTime())) {
					return formatDate(parsed);
				}
			} catch {}

			// If not a natural language pattern, return original
			return trimmed;
		}

		function formatDate(date) {
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const hasTime =
				date.getHours() !== 0 ||
				date.getMinutes() !== 0 ||
				date.getSeconds() !== 0 ||
				date.getMilliseconds() !== 0;
			if (!hasTime) {
				return year + '-' + month + '-' + day;
			}
			const hours = String(date.getHours()).padStart(2, '0');
			const minutes = String(date.getMinutes()).padStart(2, '0');
			return (
				year +
				'-' +
				month +
				'-' +
				day +
				' ' +
				hours +
				':' +
				minutes
			);
		}
	</script>
</body>
</html>`;
	}

	public destroy(): void {
		this.closeCaptureWindow();
		this.cleanupIPCHandlers();
	}
}
