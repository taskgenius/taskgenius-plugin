import { QueryAPI } from "../QueryAPI";
const deferred = () => { let resolve!: (value: any) => void, reject!: (reason: unknown) => void; const promise=new Promise<any>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject}; };
test("a snapshot read retries when the repository changed while the read was pending",async()=>{
 const old=deferred();let revision=0;const api=Object.create(QueryAPI.prototype) as any;
 api.repository={getRevision:()=>revision,all:jest.fn().mockImplementationOnce(()=>old.promise).mockResolvedValue([{id:"new"}])};
 const read=api.getAllTasks();revision=1;old.resolve([{id:"old"}]);expect(await read).toEqual([{id:"new"}]);expect(api.taskCache).toEqual([{id:"new"}]);expect(api.repository.all).toHaveBeenCalledTimes(2);
});
test("a fresh view read bypasses an older pending read, and the old request cannot clear the new pending read",async()=>{
 const a=deferred(),b=deferred();const api=Object.create(QueryAPI.prototype) as any;api.repository={getRevision:()=>0,all:jest.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)};
 const old=api.getAllTasks().catch(()=>{}),fresh=api.getAllTasks(true);a.reject(new Error("old failure"));await old;
 const shared=api.getAllTasks();expect(api.repository.all).toHaveBeenCalledTimes(2);b.resolve([{id:"new"}]);expect(await shared).toEqual([{id:"new"}]);expect(await fresh).toEqual([{id:"new"}]);
});
