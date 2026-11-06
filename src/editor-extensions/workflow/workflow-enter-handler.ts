import { EditorView } from "@codemirror/view";
import { App, Editor, editorInfoField, Menu } from "obsidian";
import TaskProgressBarPlugin from "@/index";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import {
	extractWorkflowInfo,
	resolveWorkflowInfo,
	determineNextStage,
	generateWorkflowTaskText,
	createWorkflowStageTransition,
	type WorkflowInfo,
} from "@/editor-extensions/workflow/workflow-handler";
import type { WorkflowStage } from "@/common/setting-definition";
import { t } from "@/translations/helper";
import { buildIndentString } from "@/utils";
import { taskStatusChangeAnnotation } from "@/editor-extensions/task-operations/status-switcher";

const TASK_REGEX = /^(\s*)([-*+]|\d+\.)\s+\[(.)]/;
const TASK_PREFIX = "- [ ] ";
type WorkflowSubStage = NonNullable<WorkflowStage["subStages"]>[number];

function getIndentation(text: string): string {
	const match = text.match(/^(\s*)/);
	return match ? match[1] : "";
}

function getEditorFromView(view: EditorView): Editor | null {
	return view.state.field(editorInfoField)?.editor ?? null;
}

function cursorAfterTaskPrefix(lineEnd: number, indentation: string): number {
	return lineEnd + 1 + indentation.length + TASK_PREFIX.length;
}

/**
 * Show workflow menu at cursor position
 * @param view The editor view
 * @param app The Obsidian app instance
 * @param plugin The plugin instance
 * @param lineNumber The line number where the menu should appear
 * @param workflowInfo The workflow information for the current line
 */
function showWorkflowMenu(
	view: EditorView,
	app: App,
	plugin: TaskProgressBarPlugin,
	lineNumber: number,
	workflowInfo: WorkflowInfo,
): boolean {
	const menu = new Menu();
	const doc = view.state.doc;
	if (lineNumber < 1 || lineNumber > doc.lines) {
		return false;
	}
	const line = doc.line(lineNumber);
	const lineText = line.text;
	const resolvedInfo = resolveWorkflowInfo(lineText, doc, lineNumber, plugin);

	if (!resolvedInfo) {
		return false;
	}

	const { currentStage, currentSubStage, workflow, isRootTask } =
		resolvedInfo;

	if (workflowInfo.currentStage === "root" || isRootTask) {
		menu.addItem((item) => {
			item.setTitle(t("Start workflow"))
				.setIcon("play")
				.onClick(() => {
					startWorkflow(view, app, plugin, lineNumber);
				});
		});
	} else if (currentStage.type === "terminal") {
		menu.addItem((item) => {
			item.setTitle(t("Complete workflow"))
				.setIcon("check")
				.onClick(() => {
					completeWorkflow(view, plugin, lineNumber);
				});
		});
	} else {
		const { nextStageId, nextSubStageId } = determineNextStage(
			currentStage,
			workflow,
			currentSubStage,
		);

		if (nextStageId) {
			const nextStage = workflow.stages.find((s) => s.id === nextStageId);
			if (nextStage) {
				let menuTitle: string;

				if (
					nextStageId === currentStage.id &&
					nextSubStageId === currentSubStage?.id
				) {
					menuTitle = `${t("Continue")} ${nextStage.name}${
						nextSubStageId ? ` (${currentSubStage?.name})` : ""
					}`;
				} else if (nextStageId === currentStage.id && nextSubStageId) {
					const nextSubStage = nextStage.subStages?.find(
						(ss) => ss.id === nextSubStageId,
					);
					menuTitle = `${t("Move to")} ${nextStage.name} (${
						nextSubStage?.name || nextSubStageId
					})`;
				} else {
					menuTitle = `${t("Move to")} ${nextStage.name}`;
				}

				menu.addItem((item) => {
					item.setTitle(menuTitle)
						.setIcon("arrow-right")
						.onClick(() => {
							moveToNextStageWithSubStage(
								view,
								app,
								plugin,
								lineNumber,
								nextStage,
								false,
								nextSubStageId
									? nextStage.subStages?.find(
											(ss) => ss.id === nextSubStageId,
										)
									: undefined,
								currentSubStage,
							);
						});
				});
			}
		}

		if (currentSubStage && currentStage.type === "cycle") {
			const candidateStageIds = new Set<string>();

			if (currentStage.canProceedTo?.length) {
				currentStage.canProceedTo.forEach((id) =>
					candidateStageIds.add(id),
				);
			} else if (typeof currentStage.next === "string") {
				candidateStageIds.add(currentStage.next);
			} else if (
				Array.isArray(currentStage.next) &&
				currentStage.next.length > 0
			) {
				candidateStageIds.add(currentStage.next[0]);
			} else {
				const currentIndex = workflow.stages.findIndex(
					(s) => s.id === currentStage.id,
				);
				if (
					currentIndex >= 0 &&
					currentIndex < workflow.stages.length - 1
				) {
					candidateStageIds.add(workflow.stages[currentIndex + 1].id);
				}
			}

			candidateStageIds.forEach((nextStageCandidate) => {
				const nextMainStage = workflow.stages.find(
					(stage) => stage.id === nextStageCandidate,
				);
				if (!nextMainStage) {
					return;
				}

				menu.addItem((item) => {
					item.setTitle(
						`${t("Complete substage and move to")} ${
							nextMainStage.name
						}`,
					)
						.setIcon("skip-forward")
						.onClick(() => {
							completeSubstageAndMoveToNextMainStage(
								view,
								plugin,
								lineNumber,
								nextMainStage,
								currentSubStage,
							);
						});
				});
			});
		}

		menu.addSeparator();
		menu.addItem((item) => {
			item.setTitle(t("Add child task with same stage"))
				.setIcon("plus-circle")
				.onClick(() => {
					addChildTaskWithSameStage(
						view,
						app,
						plugin,
						lineNumber,
						currentStage,
						currentSubStage,
					);
				});
		});
	}

	menu.addSeparator();

	menu.addItem((item) => {
		item.setTitle(t("Add new task"))
			.setIcon("plus")
			.onClick(() => {
				addNewSiblingTask(view, lineNumber);
			});
	});

	// Add new sub-task option
	menu.addItem((item) => {
		item.setTitle(t("Add new sub-task"))
			.setIcon("plus-circle")
			.onClick(() => {
				addNewSubTask(view, app, lineNumber);
			});
	});

	const selection = view.state.selection.main;
	const coords = view.coordsAtPos(selection.head);

	if (coords) {
		menu.showAtPosition({ x: coords.left, y: coords.bottom });
	} else {
		menu.showAtMouseEvent(window.event as MouseEvent);
	}

	return true;
}

/**
 * Add a new sibling task after the current line (same indentation level)
 * @param view The editor view
 * @param lineNumber The current line number
 */
function addNewSiblingTask(view: EditorView, lineNumber: number): void {
	const line = view.state.doc.line(lineNumber);
	const indentation = getIndentation(line.text);

	const insert = `\n${indentation}${TASK_PREFIX}`;
	view.dispatch({
		changes: { from: line.to, to: line.to, insert },
		selection: {
			anchor: cursorAfterTaskPrefix(line.to, indentation),
		},
	});

	view.focus();
}

/**
 * Add a new sub-task after the current line (indented)
 * @param view The editor view
 * @param app The Obsidian app instance
 * @param lineNumber The current line number
 */
function addNewSubTask(view: EditorView, app: App, lineNumber: number): void {
	const line = view.state.doc.line(lineNumber);
	const indentation = getIndentation(line.text);
	const defaultIndentation = buildIndentString(app);
	const newTaskIndentation = indentation + defaultIndentation;

	const insert = `\n${newTaskIndentation}${TASK_PREFIX}`;
	view.dispatch({
		changes: { from: line.to, to: line.to, insert },
		selection: {
			anchor: cursorAfterTaskPrefix(line.to, newTaskIndentation),
		},
	});

	view.focus();
}

/**
 * Start the workflow by creating the first stage task
 * @param view The editor view
 * @param app The Obsidian app instance
 * @param plugin The plugin instance
 * @param lineNumber The current line number
 */
function startWorkflow(
	view: EditorView,
	app: App,
	plugin: TaskProgressBarPlugin,
	lineNumber: number,
): void {
	const doc = view.state.doc;
	if (lineNumber < 1 || lineNumber > doc.lines) {
		return;
	}
	const line = doc.line(lineNumber);
	const lineText = line.text;

	const workflowInfo = extractWorkflowInfo(lineText);
	if (!workflowInfo) {
		return;
	}

	// Resolve complete workflow information
	const resolvedInfo = resolveWorkflowInfo(
		lineText,
		view.state.doc,
		lineNumber,
		plugin,
	);

	if (!resolvedInfo || !resolvedInfo.workflow.stages.length) {
		return;
	}

	const { workflow } = resolvedInfo;
	const firstStage = workflow.stages[0];

	const indentation = getIndentation(lineText);
	const newTaskIndentation = indentation + buildIndentString(app);
	const newTaskText = generateWorkflowTaskText(
		firstStage,
		newTaskIndentation,
		plugin,
		true,
	);
	const insertText = `\n${newTaskText}`;
	const cursorPosition = cursorAfterTaskPrefix(line.to, newTaskIndentation);

	view.dispatch({
		changes: {
			from: line.to,
			to: line.to,
			insert: insertText,
		},
		selection: {
			anchor: cursorPosition,
		},
	});

	view.focus();
}

/**
 * Creates an editor extension that handles Enter key for workflow root tasks
 * @param app The Obsidian app instance
 * @param plugin The plugin instance
 * @returns An editor extension that can be registered with the plugin
 */
export function workflowRootEnterHandlerExtension(
	app: App,
	plugin: TaskProgressBarPlugin,
) {
	// Don't enable if workflow feature is disabled
	if (!plugin.settings.workflow.enableWorkflow) {
		return [];
	}

	const keymapExtension = Prec.high(
		keymap.of([
			{
				key: "Enter",
				run: (view: EditorView) => {
					// Get current cursor position
					const selection = view.state.selection.main;
					const line = view.state.doc.lineAt(selection.head);
					const lineText = line.text;

					// Check if this is a workflow root task
					const taskMatch = lineText.match(TASK_REGEX);

					if (!taskMatch) {
						return false; // Not a task, allow default behavior
					}

					// Check if this task has a workflow tag or stage marker
					const workflowInfo = extractWorkflowInfo(lineText);
					if (!workflowInfo) {
						return false; // Not a workflow task, allow default behavior
					}

					// Check if cursor is at the end of the line
					if (selection.head !== line.to) {
						return false; // Not at end of line, allow default behavior
					}

					// Show the workflow menu
					return showWorkflowMenu(
						view,
						app,
						plugin,
						line.number,
						workflowInfo,
					);
				},
			},
		]),
	);

	return [keymapExtension];
}

/**
 * Move to the next stage in workflow with substage support
 * @param view The editor view
 * @param app The Obsidian app instance
 * @param plugin The plugin instance
 * @param lineNumber The current line number
 * @param nextStage The next stage to move to
 * @param isRootTask Whether this is a root task
 * @param nextSubStage The next substage to move to
 * @param currentSubStage The current substage
 */
function moveToNextStageWithSubStage(
	view: EditorView,
	app: App,
	plugin: TaskProgressBarPlugin,
	lineNumber: number,
	nextStage: WorkflowStage,
	isRootTask: boolean,
	nextSubStage?: WorkflowSubStage,
	currentSubStage?: WorkflowSubStage,
): void {
	const doc = view.state.doc;
	if (lineNumber < 1 || lineNumber > doc.lines) {
		return;
	}
	const line = doc.line(lineNumber);
	const lineText = line.text;

	const editor = getEditorFromView(view);
	if (!editor) {
		return;
	}

	const changes = createWorkflowStageTransition(
		plugin,
		editor,
		lineText,
		lineNumber - 1, // Convert to 0-based line number for the function
		nextStage,
		isRootTask,
		nextSubStage,
		currentSubStage,
	);

	const indentation = getIndentation(lineText);
	const defaultIndentation = buildIndentString(app);
	const newTaskIndentation = isRootTask
		? indentation + defaultIndentation
		: indentation;
	const insertedTask = changes.some(
		(change) => change.insert && change.insert.includes(TASK_PREFIX),
	);
	const cursorPosition = insertedTask
		? cursorAfterTaskPrefix(line.to, newTaskIndentation)
		: line.to;

	view.dispatch({
		changes,
		selection: {
			anchor: cursorPosition,
		},
		annotations: taskStatusChangeAnnotation.of("workflowChange"),
	});

	view.focus();
}

/**
 * Move to the next stage in workflow
 * @param view The editor view
 * @param app The Obsidian app instance
 * @param plugin The plugin instance
 * @param lineNumber The current line number
 * @param nextStage The next stage to move to
 * @param isRootTask Whether this is a root task
 */
function moveToNextStage(
	view: EditorView,
	app: App,
	plugin: TaskProgressBarPlugin,
	lineNumber: number,
	nextStage: WorkflowStage,
	isRootTask: boolean,
): void {
	const doc = view.state.doc;
	if (lineNumber < 1 || lineNumber > doc.lines) {
		return;
	}
	const line = doc.line(lineNumber);
	const lineText = line.text;

	const editor = getEditorFromView(view);
	if (!editor) {
		return;
	}

	const changes = createWorkflowStageTransition(
		plugin,
		editor,
		lineText,
		lineNumber - 1, // Convert to 0-based line number for the function
		nextStage,
		isRootTask,
		undefined, // nextSubStage
		undefined, // currentSubStage
	);

	const indentation = getIndentation(lineText);
	const defaultIndentation = buildIndentString(app);
	const newTaskIndentation = isRootTask
		? indentation + defaultIndentation
		: indentation;
	const insertedTask = changes.some(
		(change) => change.insert && change.insert.includes(TASK_PREFIX),
	);
	const cursorPosition = insertedTask
		? cursorAfterTaskPrefix(line.to, newTaskIndentation)
		: line.to;

	view.dispatch({
		changes,
		selection: {
			anchor: cursorPosition,
		},
		annotations: taskStatusChangeAnnotation.of("workflowChange"),
	});

	view.focus();
}

/**
 * Complete the workflow
 * @param view The editor view
 * @param plugin The plugin instance
 * @param lineNumber The current line number
 */
function completeWorkflow(
	view: EditorView,
	plugin: TaskProgressBarPlugin,
	lineNumber: number,
): void {
	const doc = view.state.doc;
	if (lineNumber < 1 || lineNumber > doc.lines) {
		return;
	}
	const line = doc.line(lineNumber);
	const lineText = line.text;

	const editor = getEditorFromView(view);

	if (!editor) {
		return;
	}

	const resolvedInfo = resolveWorkflowInfo(lineText, doc, lineNumber, plugin);

	if (!resolvedInfo) {
		return;
	}

	const { currentStage, currentSubStage } = resolvedInfo;

	const changes = createWorkflowStageTransition(
		plugin,
		editor,
		lineText,
		lineNumber - 1, // Convert to 0-based line number for the function
		currentStage, // Pass the current stage as the "next" stage for terminal completion
		false, // Not a root task
		undefined, // No next substage
		currentSubStage,
	);

	view.dispatch({
		changes,
		annotations: taskStatusChangeAnnotation.of("workflowChange"),
	});

	view.focus();
}

/**
 * Add a child task with the same stage
 * @param view The editor view
 * @param app The Obsidian app instance
 * @param plugin The plugin instance
 * @param lineNumber The current line number
 * @param currentStage The current stage
 * @param currentSubStage The current substage
 */
function addChildTaskWithSameStage(
	view: EditorView,
	app: App,
	plugin: TaskProgressBarPlugin,
	lineNumber: number,
	currentStage: WorkflowStage,
	currentSubStage?: WorkflowSubStage,
): void {
	const line = view.state.doc.line(lineNumber);
	const indentation = getIndentation(line.text);
	const defaultIndentation = buildIndentString(app);
	const newTaskIndentation = indentation + defaultIndentation;

	// Create task text with the same stage
	const newTaskText = generateWorkflowTaskText(
		currentStage,
		newTaskIndentation,
		plugin,
		false,
		currentSubStage,
	);

	// Insert the new task after the current line
	view.dispatch({
		changes: {
			from: line.to,
			to: line.to,
			insert: `\n${newTaskText}`,
		},
		selection: {
			anchor: cursorAfterTaskPrefix(line.to, newTaskIndentation),
		},
	});

	view.focus();
}

/**
 * Move to the next main stage and complete both current substage and parent stage
 * @param view The editor view
 * @param plugin The plugin instance
 * @param lineNumber The current line number
 * @param nextStage The next main stage to move to
 * @param currentSubStage The current substage
 */
function completeSubstageAndMoveToNextMainStage(
	view: EditorView,
	plugin: TaskProgressBarPlugin,
	lineNumber: number,
	nextStage: WorkflowStage,
	currentSubStage: WorkflowSubStage,
): void {
	const doc = view.state.doc;
	if (lineNumber < 1 || lineNumber > doc.lines) {
		return;
	}
	const line = doc.line(lineNumber);
	const lineText = line.text;

	const editor = getEditorFromView(view);

	if (!editor) {
		return;
	}

	const changes: { from: number; to: number; insert: string }[] = [];

	const currentIndent = getIndentation(lineText).length;

	for (let i = lineNumber - 1; i >= 1; i--) {
		const checkLine = doc.line(i);
		const checkIndent = getIndentation(checkLine.text).length;

		if (checkIndent < currentIndent) {
			const parentTaskMatch = checkLine.text.match(TASK_REGEX);
			if (parentTaskMatch) {
				if (checkLine.text.includes("[stage::")) {
					const parentTransitionChanges =
						createWorkflowStageTransition(
							plugin,
							editor,
							checkLine.text,
							i - 1, // Convert to 0-based line number for the function
							nextStage, // The next stage we're transitioning to
							false, // Not a root task
							undefined, // No next substage for parent
							undefined, // No current substage for parent
						);

					const parentCompletionChanges =
						parentTransitionChanges.filter(
							(change) =>
								!change.insert ||
								!change.insert.includes(TASK_PREFIX),
						);

					changes.push(...parentCompletionChanges);
					break; // Found and handled the parent, stop looking
				}
			}
		}
	}

	// 2. Use the existing createWorkflowStageTransition function to handle the current task and create the next stage
	// This will automatically complete the current substage task and create the next stage
	const transitionChanges = createWorkflowStageTransition(
		plugin,
		editor,
		lineText,
		lineNumber - 1, // Convert to 0-based line number for the function
		nextStage,
		false, // Not a root task
		undefined, // No next substage - moving to main stage
		currentSubStage,
	);

	// Combine all changes
	changes.push(...transitionChanges);

	view.dispatch({
		changes,
		annotations: taskStatusChangeAnnotation.of("workflowChange"),
	});

	view.focus();
}
