import { Modal, ButtonComponent, ExtraButtonComponent } from "obsidian";
import TaskProgressBarPlugin from "@/index";
import { McpLogEntry } from "@/mcp/McpServer";
import "@/styles/modal.scss";
import { formatDate } from "@/utils/date/date-formatter";

/**
 * Modal for displaying MCP server logs
 */
export class McpLogModal extends Modal {
	private plugin: TaskProgressBarPlugin;
	private logs: McpLogEntry[];
	private logsContainerEl: HTMLElement;
	private searchInput: HTMLInputElement;
	private filteredLogs: McpLogEntry[];

	constructor(plugin: TaskProgressBarPlugin, logs: McpLogEntry[]) {
		super(plugin.app);
		this.plugin = plugin;
		this.logs = logs;
		this.filteredLogs = logs;
	}

	onOpen() {
		this.titleEl.setText("MCP Server Logs");
		this.modalEl.addClass("mcp-log-modal");

		// Header section with search and clear
		const headerEl = this.contentEl.createDiv({ cls: "mcp-log-header" });

		// Search input
		const searchContainer = headerEl.createDiv({
			cls: "mcp-log-search-container",
		});
		this.searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search logs...",
			cls: "mcp-log-search-input",
		});
		this.searchInput.addEventListener("input", () => this.filterLogs());

		// Clear logs button
		new ButtonComponent(headerEl)
			.setButtonText("Clear Logs")
			.setIcon("trash")
			.setWarning()
			.onClick(() => {
				if (this.plugin.mcpServerManager?.getServer()) {
					this.plugin.mcpServerManager.getServer()?.clearLogs();
					this.logs = [];
					this.filteredLogs = [];
					this.renderLogs();
				}
			});

		// Stats section
		const statsEl = this.contentEl.createDiv({ cls: "mcp-log-stats" });
		this.renderStats(statsEl);

		// Logs container with scrolling
		this.logsContainerEl = this.contentEl.createDiv({
			cls: "mcp-log-container",
		});
		this.renderLogs();

		// Footer buttons
		const footerEl = this.contentEl.createDiv({
			cls: "modal-button-container",
		});

		new ButtonComponent(footerEl).setButtonText("Refresh").onClick(() => {
			if (this.plugin.mcpServerManager?.getServer()) {
				this.logs =
					this.plugin.mcpServerManager.getServer()?.getLogs() || [];
				this.filterLogs();
			}
		});

		new ButtonComponent(footerEl).setButtonText("Close").onClick(() => {
			this.close();
		});
	}

	private filterLogs() {
		const query = this.searchInput.value.toLowerCase();
		if (!query) {
			this.filteredLogs = this.logs;
		} else {
			this.filteredLogs = this.logs.filter((log) => {
				return (
					log.toolName?.toLowerCase().includes(query) ||
					log.method.toLowerCase().includes(query) ||
					log.error?.toLowerCase().includes(query) ||
					JSON.stringify(log.arguments).toLowerCase().includes(query)
				);
			});
		}
		this.renderLogs();
	}

	private renderStats(container: HTMLElement) {
		container.empty();

		const totalLogs = this.logs.length;
		const errorCount = this.logs.filter((log) => log.error).length;
		const successCount = totalLogs - errorCount;

		const statsText = container.createDiv({ cls: "mcp-log-stats-text" });
		statsText.setText(
			`Total: ${totalLogs} | Success: ${successCount} | Errors: ${errorCount}`
		);
	}

	private renderLogs() {
		this.logsContainerEl.empty();

		if (this.filteredLogs.length === 0) {
			const emptyEl = this.logsContainerEl.createDiv({
				cls: "mcp-log-empty",
			});
			emptyEl.createEl("p", {
				text:
					this.logs.length === 0
						? "No logs yet. Tool calls will appear here."
						: "No logs match your search.",
			});
			return;
		}

		this.filteredLogs.forEach((log, index) => {
			const logEntry = this.logsContainerEl.createDiv({
				cls: `mcp-log-entry ${
					log.error ? "mcp-log-error" : "mcp-log-success"
				}`,
			});

			// Header row
			const headerRow = logEntry.createDiv({
				cls: "mcp-log-entry-header",
			});

			// Timestamp
			const timestamp = headerRow.createDiv({
				cls: "mcp-log-timestamp",
			});
			timestamp.setText(formatDate(log.timestamp));

			// Tool name or method
			const toolName = headerRow.createDiv({ cls: "mcp-log-tool-name" });
			toolName.setText(log.toolName || log.method);

			// Duration
			const duration = headerRow.createDiv({ cls: "mcp-log-duration" });
			duration.setText(`${log.duration}ms`);

			// Session ID (if available)
			if (log.sessionId) {
				const sessionId = headerRow.createDiv({
					cls: "mcp-log-session-id",
				});
				sessionId.setText(log.sessionId.substring(0, 12) + "...");
				sessionId.setAttribute("title", log.sessionId);
			}

			let isExpanded = false;
			// Toggle button for details
			new ExtraButtonComponent(headerRow)
				.setIcon("chevron-down")
				.onClick(() => {
					isExpanded = !isExpanded;
					detailsEl.toggle(isExpanded);
				});

			// Details section (collapsed by default)
			const detailsEl = logEntry.createDiv({
				cls: "mcp-log-details",
			});
			detailsEl.hide();

			// Arguments
			if (log.arguments && Object.keys(log.arguments).length > 0) {
				const argsSection = detailsEl.createDiv({
					cls: "mcp-log-section",
				});
				argsSection.createEl("div", {
					cls: "mcp-log-section-title",
					text: "Arguments:",
				});
				const argsContent = argsSection.createEl("pre", {
					cls: "mcp-log-section-content",
				});
				argsContent.setText(JSON.stringify(log.arguments, null, 2));
			}

			// Result or Error
			if (log.error) {
				const errorSection = detailsEl.createDiv({
					cls: "mcp-log-section",
				});
				errorSection.createEl("div", {
					cls: "mcp-log-section-title mcp-log-error-title",
					text: "Error:",
				});
				const errorContent = errorSection.createEl("pre", {
					cls: "mcp-log-section-content mcp-log-error-content",
				});
				errorContent.setText(log.error);
			} else if (log.result) {
				const resultSection = detailsEl.createDiv({
					cls: "mcp-log-section",
				});
				const resultTitle = resultSection.createEl("div", {
					cls: "mcp-log-section-title",
					text: "Result:",
				});

				if (log.truncated) {
					resultTitle.createEl("span", {
						cls: "mcp-log-truncated-badge",
						text: " (truncated)",
					});
				}

				const resultContent = resultSection.createEl("pre", {
					cls: "mcp-log-section-content",
				});
				resultContent.setText(JSON.stringify(log.result, null, 2));
			}

			// Toggle functionality
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}
