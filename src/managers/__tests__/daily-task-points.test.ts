import { dailyTaskPoints } from "../daily-task-points";
import type { Task } from "@/types/task";
const date = "2026-11-01";
const task = (id: number, extra: any = {}): Task => ({ id: `task-${id}`, line: id, content: "Task", originalMarkdown: "- [x] Task", filePath: "Tasks.md", completed: true, status: "x", metadata: { tags: [], completedDate: new Date(`${date}T12:00:00`).getTime(), ...extra } });
const habits = [{ name: "Tasks", path: "Habits/Tasks.md", frontmatter: { habit: true, type: "repetition", bravoHabitMetricKey: "tasks", bravoPoints: 1, records: { [date]: 2 } } }];

test("existing daily task check-ins are preserved and only the unrecorded difference earns points", () => {
 const result = dailyTaskPoints([task(1),task(2),task(3)],habits,{},[]);
 expect(result.rate).toBe(1);expect(result.days[0]).toMatchObject({count:3,points:3,credited:2,supplement:1});
 expect(habits[0].frontmatter.records).toEqual({[date]:2});
 expect(dailyTaskPoints([task(1)],habits,{},[]).days[0].supplement).toBe(0);
});
test("legacy task award transactions offset the supplement and repeated calculation is idempotent", () => {
 const ledger=[{source:"task",delta:1,createdAt:new Date(`${date}T12:00:00`).getTime()}];
 const calculate=()=>dailyTaskPoints([task(1),task(2),task(3),task(4)],habits,{},ledger);
 expect(calculate().days[0].supplement).toBe(1);expect(calculate()).toEqual(calculate());expect(ledger).toHaveLength(1);
});
test("explicit task points, including zero, override the default rate", () => {
 const result=dailyTaskPoints([task(1,{points:0}),task(2,{points:5}),task(3)],[],{},[],{},2);
 expect(result.days[0].points).toBe(7);expect(result.rate).toBe(2);
});
test("uncompleted, undated, file tasks, project plans and duplicate index entries earn no extra points", () => {
 const source=task(1);const result=dailyTaskPoints([source,source,{...task(2),completed:false},task(3,{completedDate:undefined}),{...task(4),isFileTask:true} as any,task(5,{projectPlan:true}),task(6,{source:"file-source"}),task(7,{completedDate:NaN})],[],{},[]);
 expect(result.days).toHaveLength(1);expect(result.days[0]).toMatchObject({count:1,points:1,supplement:1});
});
test("undoing a completed task removes its derived supplement and keeps recorded points untouched", () => {
 expect(dailyTaskPoints([task(1)],[],{},[]).days[0].supplement).toBe(1);
 expect(dailyTaskPoints([{...task(1),completed:false}],[],{},[]).days).toEqual([]);
});
test("completion-day accounting never moves yesterday's points into today's history", () => {
 const result=dailyTaskPoints([task(1),task(2,{completedDate:new Date("2026-11-02T12:00:00").getTime()})],habits,{},[]);
 expect(result.days.map(day=>[day.date,day.supplement])).toEqual([["2026-11-02",1],[date,0]]);
});

test("backdated completions offset an old award using its completion day rather than its later save date", () => {
 const ledger=[{id:`task:task-1:${date}`,source:"task",delta:1,createdAt:new Date("2026-11-03T12:00:00").getTime()}];
 expect(dailyTaskPoints([task(1)],[],{},ledger).days[0]).toMatchObject({date,credited:1,supplement:0});
});
