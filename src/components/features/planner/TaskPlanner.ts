import { Component, Notice } from "obsidian";
import type TaskProgressBarPlugin from "@/index";
import type { Task } from "@/types/task";
import { TaskDetailsModal } from "../task/edit/TaskDetailsModal";
import { formatOptionalDateTime, parseOptionalDateTime } from "@/utils/date/optional-date-time";
import { t } from "@/translations/helper";
import "@/styles/task-planner.css";

/** Drag tasks from the unscheduled list or between calendar days. */
export class TaskPlanner extends Component {
	readonly containerEl: HTMLElement;
	private tasks: Task[] = [];
	private query = "";
	private month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
	private events?: Component;
	private pending = new Set<string>();
	constructor(private plugin: TaskProgressBarPlugin, root: HTMLElement) { super(); this.containerEl = root.createDiv({ cls: "tg-task-planner" }); }
	onload(): void { this.render(); }
	setTasks(tasks: Task[]): void { this.tasks = tasks.filter(task => !task.completed && !task.metadata?.projectPlan && task.metadata?.source !== "file-source" && !(task as any).isFileTask && task.filePath.toLowerCase().endsWith(".md")); this.render(); }
	setSearchQuery(value: string): void { this.query = value.toLocaleLowerCase().trim(); this.render(); }
	private render(): void {
		if (this.events) this.removeChild(this.events); this.events = this.addChild(new Component()); this.containerEl.empty();
		const nav = this.containerEl.createDiv({ cls: "tg-planner-nav" });
		for (const [label, action] of [["Previous month",()=>{this.month=new Date(this.month.getFullYear(),this.month.getMonth()-1,1);this.render();}], ["Today",()=>{this.month=new Date(new Date().getFullYear(),new Date().getMonth(),1);this.render();}], ["Next month",()=>{this.month=new Date(this.month.getFullYear(),this.month.getMonth()+1,1);this.render();}]] as const) {
			const button = nav.createEl("button", { text: t(label) }); this.events.registerDomEvent(button,"click",action);
		}
		nav.createEl("strong",{text:this.month.toLocaleDateString(undefined,{year:"numeric",month:"long"})});
		const layout = this.containerEl.createDiv({ cls:"tg-planner-layout" });
		const unscheduled = layout.createDiv({cls:"tg-planner-unscheduled"}); unscheduled.createEl("h3",{text:t("Unscheduled tasks")}); this.dropTarget(unscheduled, null);
		const tasks = this.tasks.filter(task=>!this.query || `${task.content} ${task.filePath}`.toLocaleLowerCase().includes(this.query));
		for (const task of tasks.filter(task=>!task.metadata.scheduledDate)) this.card(unscheduled,task);
		const grid=layout.createDiv({cls:"tg-planner-calendar"});
		for(let weekday=0;weekday<7;weekday++) grid.createDiv({cls:"tg-planner-weekday",text:new Date(2024,0,1+weekday).toLocaleDateString(undefined,{weekday:"short"})});
		const first=new Date(this.month);first.setDate(first.getDate()-(first.getDay()+6)%7);
		for(let i=0;i<42;i++){
			const date=new Date(first);date.setDate(first.getDate()+i);const key=formatOptionalDateTime(date,"date");
			const day=grid.createDiv({cls:"tg-planner-day",attr:{"data-date":key}});day.toggleClass("is-other-month",date.getMonth()!==this.month.getMonth());day.toggleClass("is-today",key===formatOptionalDateTime(new Date(),"date"));day.createDiv({text:String(date.getDate()),cls:"tg-planner-day-label"});this.dropTarget(day,key);
			for(const task of tasks.filter(task=>task.metadata.scheduledDate && formatOptionalDateTime(task.metadata.scheduledDate,"date")===key))this.card(day,task);
		}
	}
	private card(root: HTMLElement,task:Task):void{
		const card=root.createDiv({cls:"tg-planner-card",text:task.content||t("Task"),attr:{draggable: String(!this.pending.has(task.id)),"data-task-id":task.id}});
		this.events!.registerDomEvent(card,"dragstart",event=>{event.dataTransfer?.setData("application/x-task-genius",task.id);event.dataTransfer?.setData("text/plain",task.id);if(event.dataTransfer)event.dataTransfer.effectAllowed="move";});
		this.events!.registerDomEvent(card,"click",()=>new TaskDetailsModal(this.plugin.app,this.plugin,task).open());
	}
	private dropTarget(root:HTMLElement,date:string|null):void{
		this.events!.registerDomEvent(root,"dragover",event=>{if(event.dataTransfer?.types.includes("application/x-task-genius")){event.preventDefault();event.dataTransfer.dropEffect="move";}});
		this.events!.registerDomEvent(root,"drop",event=>{event.preventDefault();event.stopPropagation();const id=event.dataTransfer?.getData("application/x-task-genius");if(id)void this.schedule(id,date);});
	}
	async schedule(id:string,day:string|null):Promise<void>{
		const task=this.tasks.find(task=>task.id===id);if(!task||this.pending.has(id))return;this.pending.add(id);
		try{
			const parsed=day ? parseOptionalDateTime(day) : null;if(day&&!parsed)throw new Error(t("Enter a valid date, optionally followed by HH:mm."));
			let scheduledDate=parsed?.timestamp;
			if(scheduledDate!=null && task.metadata.scheduledDate && task.metadata.datePrecision?.scheduledDate!=="date"){
				const old=new Date(task.metadata.scheduledDate),next=new Date(scheduledDate);next.setHours(old.getHours(),old.getMinutes(),0,0);scheduledDate=next.getTime();
			}
			if(!this.plugin.writeAPI)throw new Error(t("Task writer is unavailable"));
			const updated={...task,metadata:{...task.metadata,scheduledDate,datePrecision:{...task.metadata.datePrecision,scheduledDate: day ? task.metadata.scheduledDate ? task.metadata.datePrecision?.scheduledDate || (new Date(task.metadata.scheduledDate).getHours() || new Date(task.metadata.scheduledDate).getMinutes() ? "datetime" as const : "date" as const) : "date" as const : undefined}}};
			const result=await this.plugin.writeAPI.updateTask({taskId:id,updates:{metadata:updated.metadata}});if(!result.success)throw new Error(result.error||t("Failed to update task"));
			this.tasks=this.tasks.map(task=>task.id===id?result.task||updated:task);
		}catch(error){new Notice(String(error));}finally{this.pending.delete(id);this.render();}
	}
}
