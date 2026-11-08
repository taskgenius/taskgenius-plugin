jest.mock("@/components/features/quick-capture/modals/QuickCaptureModalWithSwitch", () => ({ QuickCaptureModal: class {} }));
jest.mock("@/components/features/task/view/details", () => ({ createTaskCheckbox: jest.fn() }));
jest.mock("@/components/ui/modals/ConfirmModal", () => ({ ConfirmModal: class {} }));
jest.mock("@/components/ui/date-picker/DatePickerModal", () => ({ DatePickerModal: class {} }));
jest.mock("@/components/ui/modals/TextPromptModal", () => ({ TextPromptModal: class {} }));
const mockMenuItems: any[] = [];
jest.mock("obsidian", () => {
	const original = jest.requireActual("obsidian");
	class TestMenu {
		addItem(callback: (item: any) => void) {
			const item: any = { label: "", callback: undefined };
			item.titleEl = { createEl: (_tag: string, options: any) => { if (options?.text) item.label = options.text; return item.titleEl; } };
			const proxy = new Proxy(item, { get(target, name) {
				if (name in target) return target[name];
				if (name === "setSubmenu") return () => new TestMenu();
				if (name === "setTitle") return (text: string) => { target.label = text; return proxy; };
				if (name === "onClick") return (fn: any) => { target.callback = fn; return proxy; };
				return () => proxy;
			} });
			callback(proxy); mockMenuItems.push(item); return this;
		}
		addSeparator() { return this; }
		showAtMouseEvent() {}
	}
	return { ...original, Menu: TestMenu };
});
import { FluentActionHandlers } from "@/components/features/fluent/managers/FluentActionHandlers";
import type { Task } from "@/types/task";

const marks = { "Not Started": " ", Planned: "?", "In Progress": "/", Completed: "x", Paused: "=", Abandoned: "-" };
function harness() {
	mockMenuItems.length = 0;
	const plugin: any = { settings: { taskStatuses: { completed: "x", inProgress: "/", abandoned: "-", notStarted: " ", planned: "?" }, statusCycles: [{ id: "default", name: "Default", enabled: true, priority: 0, cycle: Object.keys(marks), marks }] } };
	const handler: any = new FluentActionHandlers({} as any, plugin, () => "default", () => false);
	for (const method of ["addPriorityMenuItems", "addDateMenuItems", "addTimerMenuItems"]) handler[method] = jest.fn();
	const update = jest.spyOn(handler, "handleTaskUpdate").mockResolvedValue(undefined);
	const task = Object.freeze({ id: "one", content: "Write report", status: " ", completed: false, metadata: Object.freeze({ tags: [], children: [] }) }) as unknown as Task;
	handler.handleTaskContextMenu({} as MouseEvent, task);
	return { handler, update, task };
}
describe("Fluent status context menu", () => {
	for (const [name, mark] of Object.entries(marks).filter(([, mark]) => mark !== " ")) it(`writes the selected ${name} status using the original task`, async () => {
		const { update, task } = harness();
		const item = mockMenuItems.find(item => item.label === name);
		expect(item?.callback).toBeDefined(); await item.callback();
		expect(update).toHaveBeenCalledWith(task, expect.objectContaining({ status: mark, completed: mark === "x" }));
		expect(task.status).toBe(" "); expect(task.metadata.completedDate).toBeUndefined();
	});
	it("writes the next cycle status instead of comparing an already changed task", async () => {
		const { update, task } = harness();
		const item = mockMenuItems.find(item => item.label.includes("→") && item.label.includes("Planned"));
		expect(item?.callback).toBeDefined(); await item.callback();
		expect(update).toHaveBeenCalledWith(task, expect.objectContaining({ status: "?" }));
	});
});
