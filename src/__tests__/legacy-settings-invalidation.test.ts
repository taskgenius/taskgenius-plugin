import { DataflowOrchestrator } from "@/dataflow/Orchestrator";
import { snapshotIndexSettings } from "@/dataflow/settings-signature";

describe("legacy settings invalidation", () => {
 function harness() {
  const settings = { projectConfig: { metadataConfig: { metadataKey: "project" } }, taskStatuses: { completed: "x" }, showProgress: true };
  const orchestrator: any = Object.create(DataflowOrchestrator.prototype);
  Object.assign(orchestrator, {
   indexSettingsSignature: snapshotIndexSettings(settings), settingsUpdateQueue: Promise.resolve(),
   app: { workspace: { trigger: jest.fn() } }, plugin: { settings },
   augmentor: { updateSettings: jest.fn() }, projectResolver: { updateOptions: jest.fn() },
   workerOrchestrator: { setWorkerProcessingEnabled: jest.fn() }, onSettingsChange: jest.fn().mockResolvedValue(undefined),
  });
  return { settings, orchestrator };
 }
 it("detects nested edits to the same settings object and invalidates only once", async () => {
  const { settings, orchestrator } = harness(); settings.projectConfig.metadataConfig.metadataKey = "project_name";
  await orchestrator.updateSettings(settings); await orchestrator.updateSettings(settings);
  expect(orchestrator.onSettingsChange).toHaveBeenCalledTimes(1);
  expect(orchestrator.onSettingsChange).toHaveBeenCalledWith(["parser", "augment", "project"]);
 });
 it("does not rebuild the index for display-only changes", async () => {
  const { settings, orchestrator } = harness(); settings.showProgress = false;
  await orchestrator.updateSettings(settings); expect(orchestrator.onSettingsChange).not.toHaveBeenCalled();
 });
 it("retries failed invalidation instead of recording the change as completed", async () => {
  const { settings, orchestrator } = harness(); settings.taskStatuses.completed = "X";
  orchestrator.onSettingsChange.mockRejectedValueOnce(new Error("temporary failure"));
  await expect(orchestrator.updateSettings(settings)).rejects.toThrow("temporary failure");
  await orchestrator.updateSettings(settings); expect(orchestrator.onSettingsChange).toHaveBeenCalledTimes(2);
 });
 it("serializes a newer change while an earlier rebuild is pending", async () => {
  const { settings, orchestrator } = harness(); let finish!: () => void; let entered!: () => void; const started = new Promise<void>(resolve => { entered = resolve; });
  orchestrator.onSettingsChange.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; entered(); }));
  settings.taskStatuses.completed = "X"; const first = orchestrator.updateSettings(settings); await started;
  settings.taskStatuses.completed = "*"; const second = orchestrator.updateSettings(settings); finish();
  await Promise.all([first, second]); expect(orchestrator.onSettingsChange).toHaveBeenCalledTimes(2);
  expect(orchestrator.indexSettingsSignature).toBe(snapshotIndexSettings(settings));
 });
});
