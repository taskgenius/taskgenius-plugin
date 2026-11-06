/**
 * Canvas task updater for modifying tasks within Canvas files
 */

import { Vault } from "obsidian";
import { Task, CanvasTaskMetadata } from "../types/task";
import { CanvasData, CanvasTextData } from "../types/canvas";
import type TaskProgressBarPlugin from "../index";
import { Events, emit } from "../dataflow/events/Events";
import { CanvasParser } from "../dataflow/core/CanvasParser";
import { formatDate as formatDateSmart } from "@/utils/date/date-utils";
import { getPrimaryCompletedStatusMark } from "@/modules/view-tasks/completedStatusPredicate";
import { isClosedStatusMark } from "@/modules/view-tasks/closedStatusPredicate";

/**
 * Result of a Canvas task update operation
 */
export interface CanvasTaskUpdateResult {
	success: boolean;
	error?: string;
	updatedContent?: string;
}

/**
 * Utility class for updating tasks within Canvas files
 */
export class CanvasTaskUpdater {
	constructor(
		private vault: Vault,
		private plugin: TaskProgressBarPlugin,
	) {}

	/**
	 * Update a task within a Canvas file
	 */
	public async updateCanvasTask(
		task: Task<CanvasTaskMetadata>,
		updatedTask: Task<CanvasTaskMetadata>,
	): Promise<CanvasTaskUpdateResult> {
		try {
			// Get the Canvas file
			const file = this.vault.getFileByPath(task.filePath);
			if (!file) {
				return {
					success: false,
					error: `Canvas file not found: ${task.filePath}`,
				};
			}

			// Read the Canvas file content
			const content = await this.vault.read(file);

			// Use CanvasParser utility to parse JSON
			const canvasData = CanvasParser.parseCanvasJSON(content);
			if (!canvasData) {
				return {
					success: false,
					error: "Failed to parse Canvas JSON",
				};
			}

			// Find the text node containing the task
			const nodeId = task.metadata.canvasNodeId;
			if (!nodeId) {
				return {
					success: false,
					error: "Task does not have a Canvas node ID",
				};
			}

			// Use CanvasParser utility to find the text node
			const textNode = CanvasParser.findTextNode(canvasData, nodeId);

			if (!textNode) {
				return {
					success: false,
					error: `Canvas text node not found: ${nodeId}`,
				};
			}

			// Update the task within the text node
			const updateResult = this.updateTaskInTextNode(
				textNode,
				task,
				updatedTask,
			);

			if (!updateResult.success) {
				return updateResult;
			}

			if (updatedTask.completed && !task.completed) {
				// Only trigger event if workspace is available (not in test environment)
				if (this.plugin.app?.workspace) {
					this.plugin.app.workspace.trigger(
						"task-genius:task-completed",
						updatedTask,
					);
				}
			}

			// Write the updated Canvas content back to the file
			const updatedContent = JSON.stringify(canvasData, null, 2);
			console.log("updatedContent", updatedContent);

			// Notify about write operation to trigger data flow update
			if (this.plugin.app) {
				emit(this.plugin.app, Events.WRITE_OPERATION_START, {
					path: file.path,
					taskId: task.id,
				});
			}

			await this.vault.modify(file, updatedContent);

			// Notify write operation complete
			if (this.plugin.app) {
				emit(this.plugin.app, Events.WRITE_OPERATION_COMPLETE, {
					path: file.path,
					taskId: task.id,
				});
			}

			return {
				success: true,
				updatedContent,
			};
		} catch (error) {
			return {
				success: false,
				error: `Error updating Canvas task: ${error.message}`,
			};
		}
	}

	/**
	 * Update a task within a text node's content
	 */
	private updateTaskInTextNode(
		textNode: CanvasTextData,
		originalTask: Task,
		updatedTask: Task,
	): CanvasTaskUpdateResult {
		try {
			const lines = textNode.text.split("\n");
			let taskFound = false;
			const updatedLines = [...lines];

			// Find and update the task line. Prefer originalMarkdown matches, and
			// only use stripped-content fallback when it identifies a single line.
			const matchResult = this.findTaskLineMatch(lines, originalTask);
			if (matchResult.index === -1) {
				return {
					success: false,
					error:
						matchResult.error ||
						`Task not found in Canvas text node: ${originalTask.originalMarkdown}`,
				};
			}

			const line = lines[matchResult.index];
			const updatedLine = this.updateCompleteTaskLine(
				line,
				originalTask,
				updatedTask,
			);
			updatedLines[matchResult.index] = updatedLine;
			taskFound = true;

			if (!taskFound) {
				return {
					success: false,
					error: `Task not found in Canvas text node: ${originalTask.originalMarkdown}`,
				};
			}

			// Update the text node content
			textNode.text = updatedLines.join("\n");

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: `Error updating task in text node: ${error.message}`,
			};
		}
	}

	/**
	 * Check if a line is a task line
	 */
	private isTaskLine(line: string): boolean {
		return /^\s*[-*+]\s*\[[^\]]*\]\s*/.test(line);
	}

	/**
	 * Classify how a single line matches a task.
	 */
	private getTaskLineMatchKind(
		line: string,
		task: Task,
	): "exact" | "status" | "fallback" | "none" {
		if (task.originalMarkdown) {
			const normalizedLine = line.trim();
			const normalizedOriginal = task.originalMarkdown.trim();

			if (normalizedLine === normalizedOriginal) {
				return "exact";
			}

			const lineWithoutStatus = normalizedLine.replace(
				/^[-*+]\s*\[[^\]]*\]\s*/,
				"- [ ] ",
			);
			const originalWithoutStatus = normalizedOriginal.replace(
				/^[-*+]\s*\[[^\]]*\]\s*/,
				"- [ ] ",
			);

			if (lineWithoutStatus === originalWithoutStatus) {
				return "status";
			}
		}

		const lineContent = this.extractCoreTaskContent(line);
		const taskContent = this.extractCoreTaskContent(task.content);

		return lineContent === taskContent ? "fallback" : "none";
	}

	/**
	 * Find the best line for a task. Exact originalMarkdown matches win over
	 * status-only matches; metadata-stripped fallback is used only if unique.
	 */
	private findTaskLineMatch(
		lines: string[],
		task: Task,
	): { index: number; error?: string } {
		const matches: Record<"exact" | "status" | "fallback", number[]> = {
			exact: [],
			status: [],
			fallback: [],
		};

		for (let i = 0; i < lines.length; i++) {
			if (!this.isTaskLine(lines[i])) {
				continue;
			}

			const matchKind = this.getTaskLineMatchKind(lines[i], task);
			if (matchKind !== "none") {
				matches[matchKind].push(i);
			}
		}

		for (const matchKind of ["exact", "status"] as const) {
			if (matches[matchKind].length > 0) {
				return { index: matches[matchKind][0] };
			}
		}

		if (matches.fallback.length === 1) {
			return { index: matches.fallback[0] };
		}

		if (matches.fallback.length > 1) {
			return {
				index: -1,
				error: `Ambiguous Canvas task fallback match for: ${task.originalMarkdown || task.content}`,
			};
		}

		return { index: -1 };
	}

	/**
	 * Check if a line matches a specific task
	 */
	private lineMatchesTask(line: string, task: Task): boolean {
		return this.getTaskLineMatchKind(line, task) !== "none";
	}

	/**
	 * Extract the core task content, removing common metadata patterns
	 * This helps match tasks even when metadata has been added or changed
	 */
	private extractCoreTaskContent(content: string): string {
		let cleaned = content;

		// Remove checkbox if present
		cleaned = cleaned.replace(/^\s*[-*+]\s*\[[^\]]*\]\s*/, "");

		// Remove common metadata patterns
		// Remove emoji dates
		cleaned = cleaned.replace(/📅\s*\d{4}-\d{2}-\d{2}/g, "");
		cleaned = cleaned.replace(/🛫\s*\d{4}-\d{2}-\d{2}/g, "");
		cleaned = cleaned.replace(/⏳\s*\d{4}-\d{2}-\d{2}/g, "");
		cleaned = cleaned.replace(/✅\s*\d{4}-\d{2}-\d{2}/g, "");
		cleaned = cleaned.replace(/➕\s*\d{4}-\d{2}-\d{2}/g, "");

		// Remove emoji priority markers
		cleaned = cleaned.replace(/\s+(🔼|🔽|⏫|⏬|🔺)/g, "");

		// Remove emoji onCompletion and other metadata
		cleaned = cleaned.replace(/🏁\s*[^\s]+/g, ""); // Simple onCompletion
		cleaned = cleaned.replace(/🏁\s*\{[^}]*\}/g, ""); // JSON onCompletion
		cleaned = cleaned.replace(/🔁\s*[^\s]+/g, ""); // Recurrence
		cleaned = cleaned.replace(/🆔\s*[^\s]+/g, ""); // ID
		cleaned = cleaned.replace(/⛔\s*[^\s]+/g, ""); // Depends on

		// Remove dataview format metadata
		cleaned = cleaned.replace(/\[[^:]+::\s*[^\]]+\]/g, "");

		// Remove hashtags and context tags at the end
		cleaned = cleaned.replace(/#[^\s#]+/g, "");
		cleaned = cleaned.replace(/@[^\s@]+/g, "");

		// Clean up extra spaces and trim
		cleaned = cleaned.replace(/\s+/g, " ").trim();

		return cleaned;
	}

	/**
	 * Update the task status in a line
	 */
	private updateTaskStatusInLine(line: string, newStatus: string): string {
		return line.replace(/(\s*[-*+]\s*\[)[^\]]*(\]\s*)/, `$1${newStatus}$2`);
	}

	/**
	 * Update a complete task line with all metadata (comprehensive update)
	 * This method mirrors the logic from TaskManager.updateTask for consistency
	 */
	private updateCompleteTaskLine(
		taskLine: string,
		originalTask: Task,
		updatedTask: Task,
	): string {
		const useDataviewFormat =
			this.plugin.settings.preferMetadataFormat === "dataview";

		// Extract indentation
		const indentMatch = taskLine.match(/^(\s*)/);
		const indentation = indentMatch ? indentMatch[0] : "";
		let updatedLine = taskLine;

		// Update status if it exists in the updated task
		if (updatedTask.status) {
			updatedLine = updatedLine.replace(
				/(\s*[-*+]\s*\[)[^\]]*(\]\s*)/,
				`$1${updatedTask.status}$2`,
			);
		}
		// Otherwise, update completion status if it changed
		else if (originalTask.completed !== updatedTask.completed) {
			const statusMark = updatedTask.completed
				? getPrimaryCompletedStatusMark(
					this.plugin.settings.taskStatuses,
				)
				: " ";
			updatedLine = updatedLine.replace(
				/(\s*[-*+]\s*\[)[^\]]*(\]\s*)/,
				`$1${statusMark}$2`,
			);
		}

		// Extract the checkbox part and use the new content
		const checkboxMatch = updatedLine.match(/^(\s*[-*+]\s*\[[^\]]*\]\s*)/);
		const checkboxPart = checkboxMatch ? checkboxMatch[1] : "";

		// Start with the checkbox part + new content
		updatedLine = checkboxPart + updatedTask.content;

		// Remove existing metadata (both formats)
		updatedLine = this.removeExistingMetadata(updatedLine);

		// Clean up extra spaces
		updatedLine = updatedLine.replace(/\s+/g, " ").trim();

		// Add updated metadata
		const metadata = this.buildMetadataArray(
			updatedTask,
			originalTask,
			useDataviewFormat,
		);

		// Append all metadata to the line
		if (metadata.length > 0) {
			updatedLine = updatedLine.trim();
			updatedLine = `${updatedLine} ${metadata.join(" ")}`;
		}

		// Ensure indentation is preserved
		if (indentation && !updatedLine.startsWith(indentation)) {
			updatedLine = `${indentation}${updatedLine.trimStart()}`;
		}

		return updatedLine;
	}

	/**
	 * Build metadata array for a task
	 */
	private buildMetadataArray(
		updatedTask: Task,
		originalTask: Task,
		useDataviewFormat: boolean,
	): string[] {
		const metadata: string[] = [];

		// Helper function to format dates
		const formatDate = (date: number | undefined): string | undefined => {
			if (!date) return undefined;
			const formatted = formatDateSmart(date, { includeSeconds: false });
			return formatted || undefined;
		};

		const formattedDueDate = formatDate(updatedTask.metadata.dueDate);
		const formattedStartDate = formatDate(updatedTask.metadata.startDate);
		const formattedScheduledDate = formatDate(
			updatedTask.metadata.scheduledDate,
		);
		const formattedCompletedDate = formatDate(
			updatedTask.metadata.completedDate,
		);

		// Helper function to check if project is readonly
		const isProjectReadonly = (task: Task): boolean => {
			return task.metadata.tgProject?.readonly === true;
		};

		// 1. Add non-project/context tags first
		if (updatedTask.metadata.tags && updatedTask.metadata.tags.length > 0) {
			const projectPrefix =
				this.plugin.settings.projectTagPrefix[
					this.plugin.settings.preferMetadataFormat
				] || "project";
			const generalTags = updatedTask.metadata.tags.filter((tag) => {
				if (typeof tag !== "string") return false;
				if (tag.startsWith(`#${projectPrefix}/`)) return false;
				if (
					tag.startsWith("@") &&
					updatedTask.metadata.context &&
					tag === `@${updatedTask.metadata.context}`
				)
					return false;
				return true;
			});

			const uniqueGeneralTags = [...new Set(generalTags)]
				.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
				.filter((tag) => tag.length > 1);

			if (uniqueGeneralTags.length > 0) {
				metadata.push(...uniqueGeneralTags);
			}
		}

		// 2. Project - Only write project if it's not a read-only tgProject
		const shouldWriteProject =
			updatedTask.metadata.project && !isProjectReadonly(originalTask);
		if (shouldWriteProject) {
			if (useDataviewFormat) {
				const projectPrefix =
					this.plugin.settings.projectTagPrefix[
						this.plugin.settings.preferMetadataFormat
					] || "project";
				const projectField = `[${projectPrefix}:: ${updatedTask.metadata.project}]`;
				if (!metadata.includes(projectField)) {
					metadata.push(projectField);
				}
			} else {
				const projectPrefix =
					this.plugin.settings.projectTagPrefix[
						this.plugin.settings.preferMetadataFormat
					] || "project";
				const projectTag = `#${projectPrefix}/${updatedTask.metadata.project}`;
				if (!metadata.includes(projectTag)) {
					metadata.push(projectTag);
				}
			}
		}

		// 3. Context
		if (updatedTask.metadata.context) {
			if (useDataviewFormat) {
				const contextPrefix =
					this.plugin.settings.contextTagPrefix[
						this.plugin.settings.preferMetadataFormat
					] || "context";
				const contextField = `[${contextPrefix}:: ${updatedTask.metadata.context}]`;
				if (!metadata.includes(contextField)) {
					metadata.push(contextField);
				}
			} else {
				const contextTag = `@${updatedTask.metadata.context}`;
				if (!metadata.includes(contextTag)) {
					metadata.push(contextTag);
				}
			}
		}

		// 4. Priority
		if (updatedTask.metadata.priority) {
			if (useDataviewFormat) {
				let priorityValue: string | number;
				switch (updatedTask.metadata.priority) {
					case 5:
						priorityValue = "highest";
						break;
					case 4:
						priorityValue = "high";
						break;
					case 3:
						priorityValue = "medium";
						break;
					case 2:
						priorityValue = "low";
						break;
					case 1:
						priorityValue = "lowest";
						break;
					default:
						priorityValue = updatedTask.metadata.priority;
				}
				metadata.push(`[priority:: ${priorityValue}]`);
			} else {
				let priorityMarker = "";
				switch (updatedTask.metadata.priority) {
					case 5:
						priorityMarker = "🔺";
						break;
					case 4:
						priorityMarker = "⏫";
						break;
					case 3:
						priorityMarker = "🔼";
						break;
					case 2:
						priorityMarker = "🔽";
						break;
					case 1:
						priorityMarker = "⏬";
						break;
				}
				if (priorityMarker) metadata.push(priorityMarker);
			}
		}

		// 4.5 Depends On (only if non-empty)
		const dependsValue: any = (updatedTask.metadata as any).dependsOn;
		let dependsList: string[] | undefined;
		if (Array.isArray(dependsValue)) {
			dependsList = dependsValue.filter(
				(v) => typeof v === "string" && v.trim().length > 0,
			);
		} else if (typeof dependsValue === "string") {
			dependsList = dependsValue
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
		}
		if (dependsList && dependsList.length > 0) {
			const joined = dependsList.join(", ");
			metadata.push(
				useDataviewFormat ? `[dependsOn:: ${joined}]` : `⛔ ${joined}`,
			);
		}

		if (updatedTask.metadata.id) {
			metadata.push(
				useDataviewFormat
					? `[id:: ${updatedTask.metadata.id}]`
					: `🆔 ${updatedTask.metadata.id}`,
			);
		}

		if (updatedTask.metadata.onCompletion) {
			metadata.push(
				useDataviewFormat
					? `[onCompletion:: ${updatedTask.metadata.onCompletion}]`
					: `🏁 ${updatedTask.metadata.onCompletion}`,
			);
		}

		// 5. Recurrence
		if (updatedTask.metadata.recurrence) {
			metadata.push(
				useDataviewFormat
					? `[repeat:: ${updatedTask.metadata.recurrence}]`
					: `🔁 ${updatedTask.metadata.recurrence}`,
			);
		}

		// 6. Start Date
		if (formattedStartDate) {
			if (
				!(
					updatedTask.metadata.useAsDateType === "start" &&
					formatDate(originalTask.metadata.startDate) ===
						formattedStartDate
				)
			) {
				metadata.push(
					useDataviewFormat
						? `[start:: ${formattedStartDate}]`
						: `🛫 ${formattedStartDate}`,
				);
			}
		}

		// 7. Scheduled Date
		if (formattedScheduledDate) {
			if (
				!(
					updatedTask.metadata.useAsDateType === "scheduled" &&
					formatDate(originalTask.metadata.scheduledDate) ===
						formattedScheduledDate
				)
			) {
				metadata.push(
					useDataviewFormat
						? `[scheduled:: ${formattedScheduledDate}]`
						: `⏳ ${formattedScheduledDate}`,
				);
			}
		}

		// 8. Due Date
		if (formattedDueDate) {
			if (
				!(
					updatedTask.metadata.useAsDateType === "due" &&
					formatDate(originalTask.metadata.dueDate) ===
						formattedDueDate
				)
			) {
				metadata.push(
					useDataviewFormat
						? `[due:: ${formattedDueDate}]`
						: `📅 ${formattedDueDate}`,
				);
			}
		}

		// 9. Completion Date (only if completed)
		if (formattedCompletedDate && updatedTask.completed) {
			metadata.push(
				useDataviewFormat
					? `[completion:: ${formattedCompletedDate}]`
					: `✅ ${formattedCompletedDate}`,
			);
		}

		return metadata;
	}

	/**
	 * Remove existing metadata from a task line
	 */
	private removeExistingMetadata(line: string): string {
		let updatedLine = line;

		const dateWithOptionalTime =
			"\\d{4}-\\d{2}-\\d{2}(?:\\s+\\d{1,2}:\\d{2}(?::\\d{2})?)?";

		// Remove emoji dates
		["📅", "📆", "✅", "➕", "⏳"].forEach((emoji) => {
			updatedLine = updatedLine.replace(
				new RegExp(`${emoji}\\s*${dateWithOptionalTime}`, "g"),
				"",
			);
		});

		// Remove dataview dates (inline field format)
		const dataviewDatePatterns = [
			"(?:due|📅)",
			"(?:completion|✅)",
			"(?:created|➕)",
			"(?:start|🛫)",
			"(?:scheduled|⏳)",
		];

		dataviewDatePatterns.forEach((pattern) => {
			updatedLine = updatedLine.replace(
				new RegExp(
					`\\[${pattern}::\\s*${dateWithOptionalTime}\\]`,
					"gi",
				),
				"",
			);
		});

		// Remove emoji priority markers
		updatedLine = updatedLine.replace(
			/\s+(🔼|🔽|⏫|⏬|🔺|\[#[A-C]\])/g,
			"",
		);
		// Remove dataview priority
		updatedLine = updatedLine.replace(/\[priority::\s*\w+\]/gi, "");

		// Remove emoji recurrence
		updatedLine = updatedLine.replace(/🔁\s*[^\s]+/g, "");
		// Remove dataview recurrence
		updatedLine = updatedLine.replace(
			/\[(?:repeat|recurrence)::\s*[^\]]+\]/gi,
			"",
		);

		// Remove dataview project and context (using configurable prefixes)
		const projectPrefix =
			this.plugin.settings.projectTagPrefix[
				this.plugin.settings.preferMetadataFormat
			] || "project";
		const contextPrefix =
			this.plugin.settings.contextTagPrefix[
				this.plugin.settings.preferMetadataFormat
			] || "@";
		updatedLine = updatedLine.replace(
			new RegExp(`\\[${projectPrefix}::\\s*[^\\]]+\\]`, "gi"),
			"",
		);
		updatedLine = updatedLine.replace(
			new RegExp(`\\[${contextPrefix}::\\s*[^\\]]+\\]`, "gi"),
			"",
		);

		// Remove ALL existing tags to prevent duplication
		updatedLine = updatedLine.replace(
			/#[^\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,.:;<=>?@^`{|}~\[\]\\\s]+/g,
			"",
		);
		updatedLine = updatedLine.replace(/@[^\s@]+/g, "");

		return updatedLine;
	}

	/**
	 * Delete a task from a Canvas file
	 */
	public async deleteCanvasTask(
		task: Task<CanvasTaskMetadata>,
		deleteChildren = false,
	): Promise<CanvasTaskUpdateResult> {
		try {
			// Get the Canvas file
			const file = this.vault.getFileByPath(task.filePath);
			if (!file) {
				return {
					success: false,
					error: `Canvas file not found: ${task.filePath}`,
				};
			}

			// Read the Canvas file content
			const content = await this.vault.read(file);

			// Use CanvasParser utility to parse JSON
			const canvasData = CanvasParser.parseCanvasJSON(content);
			if (!canvasData) {
				return {
					success: false,
					error: "Failed to parse Canvas JSON",
				};
			}

			// Find the text node containing the task
			const nodeId = task.metadata.canvasNodeId;
			if (!nodeId) {
				return {
					success: false,
					error: "Task does not have a Canvas node ID",
				};
			}

			// Use CanvasParser utility to find the text node
			const textNode = CanvasParser.findTextNode(canvasData, nodeId);

			if (!textNode) {
				return {
					success: false,
					error: `Canvas text node not found: ${nodeId}`,
				};
			}

			// Delete the task from the text node
			const deleteResult = this.deleteTaskFromTextNode(
				textNode,
				task,
				deleteChildren,
			);

			if (!deleteResult.success) {
				return deleteResult;
			}

			// Write the updated Canvas content back to the file
			const updatedContent = JSON.stringify(canvasData, null, 2);
			await this.vault.modify(file, updatedContent);

			return {
				success: true,
				updatedContent,
			};
		} catch (error) {
			return {
				success: false,
				error: `Error deleting Canvas task: ${error.message}`,
			};
		}
	}

	/**
	 * Move a task from one Canvas location to another
	 */
	public async moveCanvasTask(
		task: Task<CanvasTaskMetadata>,
		targetFilePath: string,
		targetNodeId?: string,
		targetSection?: string,
	): Promise<CanvasTaskUpdateResult> {
		try {
			// First, get the task content before deletion
			const taskContent =
				task.originalMarkdown || this.formatTaskLine(task);

			// Delete from source
			const deleteResult = await this.deleteCanvasTask(task);
			if (!deleteResult.success) {
				return deleteResult;
			}

			// Add to target
			const addResult = await this.addTaskToCanvasNode(
				targetFilePath,
				taskContent,
				targetNodeId,
				targetSection,
			);

			return addResult;
		} catch (error) {
			return {
				success: false,
				error: `Error moving Canvas task: ${error.message}`,
			};
		}
	}

	/**
	 * Duplicate a task within a Canvas file
	 */
	public async duplicateCanvasTask(
		task: Task<CanvasTaskMetadata>,
		targetFilePath?: string,
		targetNodeId?: string,
		targetSection?: string,
		preserveMetadata = true,
	): Promise<CanvasTaskUpdateResult> {
		try {
			// Create duplicate task content
			let duplicateContent =
				task.originalMarkdown || this.formatTaskLine(task);

			// Reset closed completion status
			duplicateContent = duplicateContent.replace(
				/^(\s*[-*+]\s*\[)([^\]]*)(\])/,
				(match, prefix, statusMark, suffix) =>
					isClosedStatusMark(
						statusMark,
						this.plugin.settings.taskStatuses,
					)
						? prefix + " " + suffix
						: match,
			);

			if (!preserveMetadata) {
				// Remove completion-related metadata
				duplicateContent =
					this.removeCompletionMetadata(duplicateContent);
			}

			// Add duplicate indicator
			const timestamp = new Date().toISOString().split("T")[0];
			duplicateContent += ` (duplicated ${timestamp})`;

			// Add to target location
			const targetFile = targetFilePath || task.filePath;
			const addResult = await this.addTaskToCanvasNode(
				targetFile,
				duplicateContent,
				targetNodeId,
				targetSection,
			);

			return addResult;
		} catch (error) {
			return {
				success: false,
				error: `Error duplicating Canvas task: ${error.message}`,
			};
		}
	}

	/**
	 * Add a task to a Canvas text node
	 */
	public async addTaskToCanvasNode(
		filePath: string,
		taskContent: string,
		targetNodeId?: string,
		targetSection?: string,
	): Promise<CanvasTaskUpdateResult> {
		try {
			// Get the Canvas file
			const file = this.vault.getFileByPath(filePath);
			if (!file) {
				return {
					success: false,
					error: `Canvas file not found: ${filePath}`,
				};
			}

			// Read the Canvas file content
			const content = await this.vault.read(file);

			// Use CanvasParser utility to parse JSON
			const canvasData = CanvasParser.parseCanvasJSON(content);
			if (!canvasData) {
				return {
					success: false,
					error: "Failed to parse Canvas JSON",
				};
			}

			// Find or create target text node
			let targetNode: CanvasTextData;

			if (targetNodeId) {
				const existingNode = canvasData.nodes.find(
					(node): node is CanvasTextData =>
						node.type === "text" && node.id === targetNodeId,
				);

				if (!existingNode) {
					return {
						success: false,
						error: `Target Canvas text node not found: ${targetNodeId}`,
					};
				}

				targetNode = existingNode;
			} else {
				// Create a new text node if no target specified
				targetNode = this.createNewTextNode(canvasData);
				canvasData.nodes.push(targetNode);
			}

			// Add task to the text node
			const addResult = this.addTaskToTextNode(
				targetNode,
				taskContent,
				targetSection,
			);

			if (!addResult.success) {
				return addResult;
			}

			// Write the updated Canvas content back to the file
			const updatedContent = JSON.stringify(canvasData, null, 2);
			await this.vault.modify(file, updatedContent);

			return {
				success: true,
				updatedContent,
			};
		} catch (error) {
			return {
				success: false,
				error: `Error adding task to Canvas node: ${error.message}`,
			};
		}
	}

	/**
	 * Delete a task from a text node's content
	 */
	private deleteTaskFromTextNode(
		textNode: CanvasTextData,
		task: Task,
		deleteChildren = false,
	): CanvasTaskUpdateResult {
		try {
			const lines = textNode.text.split("\n");
			let taskFound = false;
			const updatedLines = [...lines];
			let taskIndex = -1;

			// Find the task line
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];

				// Check if this line contains the task to delete
				if (this.isTaskLine(line) && this.lineMatchesTask(line, task)) {
					taskIndex = i;
					taskFound = true;
					break;
				}
			}

			if (!taskFound) {
				return {
					success: false,
					error: `Task not found in Canvas text node: ${task.originalMarkdown}`,
				};
			}

			const linesToDelete: number[] = [taskIndex];

			if (deleteChildren) {
				// Calculate parent indentation
				const parentLine = lines[taskIndex];
				const parentIndent = this.getIndentLevel(parentLine);

				// Find all child tasks (lines with greater indentation following the parent)
				for (let i = taskIndex + 1; i < lines.length; i++) {
					const line = lines[i];
					const currentIndent = this.getIndentLevel(line);

					// Stop if we reach a task at the same or higher level
					if (
						this.isTaskLine(line) &&
						currentIndent <= parentIndent
					) {
						break;
					}

					// Add child task to delete list
					if (this.isTaskLine(line) && currentIndent > parentIndent) {
						linesToDelete.push(i);
					}
				}
			}

			// Sort in reverse order to delete from bottom to top
			linesToDelete.sort((a, b) => b - a);

			// Remove all marked lines
			for (const index of linesToDelete) {
				updatedLines.splice(index, 1);
			}

			// Update the text node content
			textNode.text = updatedLines.join("\n");

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: `Error deleting task from text node: ${error.message}`,
			};
		}
	}

	/**
	 * Get the indentation level of a line
	 */
	private getIndentLevel(line: string): number {
		const match = line.match(/^(\s*)/);
		return match ? match[1].length : 0;
	}

	/**
	 * Add a task to a text node's content
	 */
	private addTaskToTextNode(
		textNode: CanvasTextData,
		taskContent: string,
		targetSection?: string,
	): CanvasTaskUpdateResult {
		try {
			const lines = textNode.text.split("\n");

			if (targetSection) {
				// Find the target section and insert after it
				const sectionIndex = this.findSectionIndex(
					lines,
					targetSection,
				);
				if (sectionIndex >= 0) {
					lines.splice(sectionIndex + 1, 0, taskContent);
				} else {
					// Section not found, add at the end
					lines.push(taskContent);
				}
			} else {
				// Add at the end of the text node
				if (textNode.text.trim()) {
					lines.push(taskContent);
				} else {
					lines[0] = taskContent;
				}
			}

			// Update the text node content
			textNode.text = lines.join("\n");

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: `Error adding task to text node: ${error.message}`,
			};
		}
	}

	/**
	 * Create a new text node for Canvas
	 */
	private createNewTextNode(canvasData: CanvasData): CanvasTextData {
		// Generate a unique ID for the new node
		const nodeId = `task-node-${Date.now()}-${Math.random()
			.toString(36)
			.substr(2, 9)}`;

		// Find a good position for the new node (avoid overlaps)
		const existingNodes = canvasData.nodes;
		let x = 0;
		const y = 0;

		if (existingNodes.length > 0) {
			// Position new node to the right of existing nodes
			const maxX = Math.max(
				...existingNodes.map((node) => node.x + node.width),
			);
			x = maxX + 50;
		}

		return {
			type: "text",
			id: nodeId,
			x,
			y,
			width: 250,
			height: 60,
			text: "",
		};
	}

	/**
	 * Find section index in text lines
	 */
	private findSectionIndex(lines: string[], sectionName: string): number {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			// Check for markdown headings
			if (
				line.startsWith("#") &&
				line.toLowerCase().includes(sectionName.toLowerCase())
			) {
				return i;
			}
		}
		return -1;
	}

	/**
	 * Format a task as a markdown line
	 */
	private formatTaskLine(task: Task): string {
		const status = task.completed ? "x" : " ";
		return `- [${status}] ${task.content}`;
	}

	/**
	 * Remove completion-related metadata from task content
	 */
	private removeCompletionMetadata(content: string): string {
		let cleaned = content;

		// Remove completion date
		cleaned = cleaned.replace(/✅\s*\d{4}-\d{2}-\d{2}/g, "");
		cleaned = cleaned.replace(/\[completion::\s*\d{4}-\d{2}-\d{2}\]/gi, "");

		// Remove scheduled date if desired
		cleaned = cleaned.replace(/⏰\s*\d{4}-\d{2}-\d{2}/g, "");
		cleaned = cleaned.replace(/\[scheduled::\s*\d{4}-\d{2}-\d{2}\]/gi, "");

		// Clean up extra spaces
		cleaned = cleaned.replace(/\s+/g, " ").trim();

		return cleaned;
	}

	/**
	 * Check if a task is a Canvas task
	 */
	public static isCanvasTask(task: Task): task is Task<CanvasTaskMetadata> {
		return (task.metadata as any).sourceType === "canvas";
	}
}
