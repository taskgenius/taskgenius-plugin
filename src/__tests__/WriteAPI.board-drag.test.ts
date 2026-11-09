// Use the real local-time formatter; the shared mock formats midnight as UTC.
jest.mock("obsidian", () => ({ ...jest.requireActual("obsidian"), moment: jest.requireActual("moment/min/moment-with-locales") }));
import { App, MetadataCache, TFile } from "obsidian";
import { WriteAPI } from "@/dataflow/api/WriteAPI";
import { ConfigurableTaskParser } from "@/dataflow/core/ConfigurableTaskParser";

test("board moves survive writing and reindexing while keeping task deadlines and unrelated text", async () => {
 const app=new App() as any;
 const file=Object.assign(new TFile(),{path:"Tasks.md",name:"Tasks.md"});
 let text="- [ ] Keep this [[Reference]] #keep #urgent #important 📅 2026-11-10";
 const parser=new ConfigurableTaskParser({} as any);let task=parser.parseLegacy(text,file.path)[0];
 const vault:any={getAbstractFileByPath:()=>file,read:async()=>text,modify:async(_file:any,next:string)=>{text=next;}};
 app.vault=vault;app.workspace={trigger:jest.fn()};
 const metadata=new MetadataCache() as any;metadata.getFileCache=()=>({frontmatter:{}});
 const plugin:any={settings:{preferMetadataFormat:"tasks",projectTagPrefix:{tasks:"project",dataview:"project"},contextTagPrefix:{tasks:"@",dataview:"context"},taskStatuses:{completed:"x"},autoDateManager:{manageCompletedDate:true}}};
 const api=new WriteAPI(app,vault,metadata,plugin,async()=>task);
 const originalDeadline=task.metadata.dueDate;
 for(const quadrant of ["urgent-important","not-urgent-important","urgent-not-important","not-urgent-not-important"]){
  const tags=["#keep",`#quadrant/${quadrant}`];
  expect((await api.updateTask({taskId:task.id,updates:{metadata:{...task.metadata,tags}}})).success).toBe(true);
  task=parser.parseLegacy(text,file.path)[0];
  expect(task.metadata.tags).toContain(`#quadrant/${quadrant}`);expect(task.metadata.tags.filter(tag=>tag.includes("quadrant/"))).toHaveLength(1);
  expect(task.metadata.dueDate).toBe(originalDeadline);expect(text).toContain("[[Reference]]");expect(task.metadata.tags).toContain("#keep");
 }
 expect((await api.updateTask({taskId:task.id,updates:{status:"x",completed:true,metadata:{...task.metadata,completedDate:Date.now()}}})).success).toBe(true);
 task=parser.parseLegacy(text,file.path)[0];expect(task.completed).toBe(true);expect(task.metadata.completedDate).toBeDefined();expect(text).toMatch(/✅ \d{4}-\d{2}-\d{2}/);
});
