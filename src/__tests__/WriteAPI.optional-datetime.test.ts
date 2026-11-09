jest.mock("obsidian", () => ({ ...jest.requireActual("obsidian"), moment: jest.requireActual("moment/min/moment-with-locales") }));
import { App, MetadataCache, TFile } from "obsidian";
import { WriteAPI } from "@/dataflow/api/WriteAPI";
import { ConfigurableTaskParser } from "@/dataflow/core/ConfigurableTaskParser";
import { parseOptionalDateTime, formatOptionalDateTime, taskDatePrecisions } from "@/utils/date/optional-date-time";

test.each(["2026-11-12", "2026-11-12 09:35", "2026-11-12 00:00"])("date or datetime survives saving and reindexing: %s", async (value: string) => {
 const app=new App() as any,file=Object.assign(new TFile(),{path:"Task.md"});let text="- [ ] Test 📅 2026-12-01";
 const parser=new ConfigurableTaskParser();let task=parser.parseLegacy(text,file.path)[0];
 const vault:any={getAbstractFileByPath:()=>file,read:async()=>text,modify:async(_file:any,next:string)=>{text=next;}};app.vault=vault;app.workspace={trigger:jest.fn()};const cache=new MetadataCache() as any;cache.getFileCache=()=>({frontmatter:{}});
 const plugin:any={settings:{preferMetadataFormat:"tasks",taskStatuses:{completed:"x"},projectTagPrefix:{tasks:"project"},contextTagPrefix:{tasks:"@"}}};
 const api=new WriteAPI(app,vault,cache,plugin,async()=>task),date=parseOptionalDateTime(value)!;
 expect((await api.updateTask({taskId:task.id,updates:{metadata:{...task.metadata,scheduledDate:date.timestamp,datePrecision:{...task.metadata.datePrecision,scheduledDate:date.precision}}}})).success).toBe(true);
 expect(text).toContain(`⏳ ${value}`);expect(text).toContain("📅 2026-12-01");
 task=parser.parseLegacy(text,file.path)[0];expect(formatOptionalDateTime(task.metadata.scheduledDate,task.metadata.datePrecision?.scheduledDate)).toBe(value);
 // Editing an unrelated property must keep an explicit 00:00 as a time.
 expect((await api.updateTask({taskId:task.id,updates:{metadata:{...task.metadata,priority:3}}})).success).toBe(true);expect(text).toContain(`⏳ ${value}`);
});

test("raw Markdown date precision wins over legacy ambiguous timestamps",()=>{
 expect(taskDatePrecisions({originalMarkdown:"- [ ] Test 📅 2026-11-12 ⏳ 2026-11-13 00:00"})).toMatchObject({dueDate:"date",scheduledDate:"datetime"});
 expect(parseOptionalDateTime("2026-02-31")).toBeNull();expect(parseOptionalDateTime("2026-11-12 25:00")).toBeNull();
});
