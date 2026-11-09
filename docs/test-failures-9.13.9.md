# 9.13.9 既有测试失败核对

本报告读取保存的完整 Jest 报告，没有重新运行测试，没有修改插件或用户数据。

- 总计 1559 个测试：1414 个通过，145 个失败。
- 130 个测试套件：91 个通过，39 个失败；其中 3 个套件未能加载，不计入上述 145 个失败用例。
- 逐项对照 9.13.8 报告的测试文件与用例名，本次没有新增失败用例。
- “既有”仅指此前 9.13.8 已失败；不代表已证明来自上游原版，也不代表不影响实际使用。
- 本报告按功能归类。失败原因仍需逐项复现，不能仅凭日志全部判定为测试过时或真实缺陷。

| 范围 | 失败用例数 |
| --- | ---: |
| 状态切换、父任务联动和日期标记 | 25 |
| 项目识别、属性和日期继承 | 32 |
| 任务操作、Canvas 和工作流 | 43 |
| 文件过滤、索引和缓存 | 30 |
| 时间解析和时间格式 | 7 |
| 性能阈值 | 2 |
| 自动补全和设置迁移 | 4 |
| ICS 日历解析和超时 | 2 |

## 可以从日志明确看到的情况

- 文件过滤的 18 个失败：测试环境中的 Obsidian normalizePath 不存在，未能验证实际过滤行为。
- 索引的 8 个失败：测试对象没有 workspace.onLayoutReady。
- 项目工作线程的 4 个失败：测试 vault 没有 getFileByPath。
- Markdown 归档的 5 个失败：测试变量 mockDate 在初始化前被读取。
- 上述合计 35 个用例存在明确的测试环境或测试代码问题，不能用它们证明相应功能已通过。
- 其他失败包括项目识别结果不符、状态切换没有产生预期操作、时间解析时差或格式不符、Canvas 操作失败等，需要继续排查真实代码与测试预期。
- 性能阈值失败包括中文标签解析超过 100 毫秒，以及重复时间解析未达到预期加速比例；单次结果受运行负载影响。

## GitHub 远端检查补充

远端 Ubuntu 检查（提交 de456d0，运行 42577368516）：安装、生产构建、64 项习惯测试和 78 项界面测试通过。完整 Jest 为 1409 通过、150 失败，40 个套件失败；不能把本地 145 项失败的逐项对比结论直接套用于远端。CLA 检查另因缺少权限而失败，未代签 CLA、未关闭检查或修改分支保护。

## 逐项清单

### 状态切换、父任务联动和日期标记

**cycleCompleteStatus.test.ts：12 项**

1. handleCycleCompleteStatusTransaction (Integration) should cycle from [ ] to [/] based on default settings
   - 报错摘要：Error: expect(received).not.toBe(expected) // Object.is equality Expected: not {"annotation": [Function mockConstructor], "changes": {}, "docChanged": true, "effects": [], "isUserEvent": [Function mockConstructor], "newDoc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "newSelection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "reconfigured": false, "scrollIntoView": false, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "startState": {"_fields": Map {}, "doc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}}, "state": {}}

2. handleCycleCompleteStatusTransaction (Integration) should cycle from [/] to [x] based on default settings
   - 报错摘要：Error: expect(received).not.toBe(expected) // Object.is equality Expected: not {"annotation": [Function mockConstructor], "changes": {}, "docChanged": true, "effects": [], "isUserEvent": [Function mockConstructor], "newDoc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "newSelection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "reconfigured": false, "scrollIntoView": false, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "startState": {"_fields": Map {}, "doc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}}, "state": {}}

3. handleCycleCompleteStatusTransaction (Integration) should cycle from [x] back to [ ] based on default settings
   - 报错摘要：Error: expect(received).not.toBe(expected) // Object.is equality Expected: not {"annotation": [Function mockConstructor], "changes": {}, "docChanged": true, "effects": [], "isUserEvent": [Function mockConstructor], "newDoc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "newSelection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "reconfigured": false, "scrollIntoView": false, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "startState": {"_fields": Map {}, "doc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}}, "state": {}}

4. handleCycleCompleteStatusTransaction (Integration) should respect custom cycle and marks
   - 报错摘要：Error: expect(received).not.toBe(expected) // Object.is equality Expected: not {"annotation": [Function mockConstructor], "changes": {}, "docChanged": true, "effects": [], "isUserEvent": [Function mockConstructor], "newDoc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "newSelection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "reconfigured": false, "scrollIntoView": false, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "startState": {"_fields": Map {}, "doc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}}, "state": {}}

5. handleCycleCompleteStatusTransaction (Integration) should skip excluded marks in the cycle
   - 报错摘要：Error: expect(received).not.toBe(expected) // Object.is equality Expected: not {"annotation": [Function mockConstructor], "changes": {}, "docChanged": true, "effects": [], "isUserEvent": [Function mockConstructor], "newDoc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "newSelection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "reconfigured": false, "scrollIntoView": false, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "startState": {"_fields": Map {}, "doc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}}, "state": {}}

6. handleCycleCompleteStatusTransaction (Integration) should handle unknown starting mark by cycling to the first status
   - 报错摘要：Error: expect(received).not.toBe(expected) // Object.is equality Expected: not {"annotation": [Function mockConstructor], "changes": {}, "docChanged": true, "effects": [], "isUserEvent": [Function mockConstructor], "newDoc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "newSelection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "reconfigured": false, "scrollIntoView": false, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "startState": {"_fields": Map {}, "doc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}}, "state": {}}

7. handleCycleCompleteStatusTransaction (Integration) should NOT cycle if the inserted mark matches the next mark in sequence
   - 报错摘要：Error: expect(received).not.toBe(expected) // Object.is equality Expected: not {"annotation": [Function mockConstructor], "changes": {}, "docChanged": true, "effects": [], "isUserEvent": [Function mockConstructor], "newDoc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "newSelection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "reconfigured": false, "scrollIntoView": false, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "startState": {"_fields": Map {}, "doc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}}, "state": {}}

8. handleCycleCompleteStatusTransaction (Integration) should cycle task status when user selects and replaces the 'x' mark with any character
   - 报错摘要：Error: expect(received).not.toBe(expected) // Object.is equality Expected: not {"annotation": [Function mockConstructor], "changes": {}, "docChanged": true, "effects": [], "isUserEvent": [Function mockConstructor], "newDoc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "newSelection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "reconfigured": false, "scrollIntoView": false, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "startState": {"_fields": Map {}, "doc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}}, "state": {}}

9. handleCycleCompleteStatusTransaction (Integration) should cycle task status when user selects and replaces any mark with any character
   - 报错摘要：Error: expect(received).not.toBe(expected) // Object.is equality Expected: not {"annotation": [Function mockConstructor], "changes": {}, "docChanged": true, "effects": [], "isUserEvent": [Function mockConstructor], "newDoc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "newSelection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "reconfigured": false, "scrollIntoView": false, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}, "startState": {"_fields": Map {}, "doc": {"length": 10, "line": [Function mockConstructor], "lineAt": [Function mockConstructor], "lines": 1, "sliceString": [Function mockConstructor], "toString": [Function toString]}, "selection": {"anchor": 0, "empty": true, "from": 0, "head": 0, "to": 0}}, "state": {}}

10. handleCycleCompleteStatusTransaction (Integration) should correctly detect the original mark in replacement operations
   - 报错摘要：Error: expect(received).toHaveLength(expected) Expected length: 1 Received length: 0 Received array: []

11. handleCycleCompleteStatusTransaction (Integration) should handle replacement operations where fromA != toA
   - 报错摘要：Error: expect(received).toHaveLength(expected) Expected length: 1 Received length: 0 Received array: []

12. handleCycleCompleteStatusTransaction (Integration) should test different replacement scenarios to identify the trigger
   - 报错摘要：Error: expect(received).toHaveLength(expected) Expected length: 1 Received length: 0 Received array: []

**autoCompleteParent.test.ts：5 项**

13. handleParentTaskUpdateTransaction (Integration) should mark parent as in progress when a child is unchecked (if setting enabled)
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality - Expected - 6 + Received + 1 Array [ - Object { - "type": Object { - "of": [Function mockConstructor], - }, - "value": "autoCompleteParent.IN_PROGRESS", - }, + "autoCompleteParent.IN_PROGRESS", ]

14. handleParentTaskUpdateTransaction (Integration) should mark parent as in progress when first child gets a status (if setting enabled)
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality - Expected - 6 + Received + 1 Array [ - Object { - "type": Object { - "of": [Function mockConstructor], - }, - "value": "autoCompleteParent.IN_PROGRESS", - }, + "autoCompleteParent.IN_PROGRESS", ]

15. handleParentTaskUpdateTransaction (Integration) should ignore changes triggered by its own annotation (complete)
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality - Expected - 40 + Received + 10 Object { - "annotation": [Function mockConstructor], - "changes": Object {}, - "docChanged": true, - "effects": Array [], - "isUserEvent": [Function mockConstructor], - "newDoc": Object { - "length": 25, - "line": [Function mockConstructor], - "lineAt": [Function mockConstructor], - "lines": 2, - "sliceString": [Function mockConstructor], - "toString": [Function toString], + "annotations": Array [ + "autoCompleteParent.DONE", + ], + "changes": Array [ + Object {}, + Object { + "from": 3, + "insert": "x", + "to": 4, }, - "newSelection": Object { - "anchor": 0, - "empty": true, - "from": 0, - "head": 0, - "to": 0, - }, - "reconfigured": false, - "scrollIntoView": false, - "selection": Object { - "anchor": 0, - "empty": true, - "from": 0, - "head": 0, - "to": 0, - }, - "startState": EditorState { - "_fields": Map {}, - "doc": Object { - "length": 25, - "line": [Function mockConstructor], - "lineAt": [Function mockConstructor], - "lines": 2, - "sliceString": [Function mockConstructor], - "toStrin

16. handleParentTaskUpdateTransaction (Integration) should ignore changes triggered by its own annotation (in progress)
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality - Expected - 40 + Received + 10 Object { - "annotation": [Function mockConstructor], - "changes": Object {}, - "docChanged": true, - "effects": Array [], - "isUserEvent": [Function mockConstructor], - "newDoc": Object { - "length": 25, - "line": [Function mockConstructor], - "lineAt": [Function mockConstructor], - "lines": 2, - "sliceString": [Function mockConstructor], - "toString": [Function toString], + "annotations": Array [ + "autoCompleteParent.IN_PROGRESS", + ], + "changes": Array [ + Object {}, + Object { + "from": 3, + "insert": "/", + "to": 4, }, - "newSelection": Object { - "anchor": 0, - "empty": true, - "from": 0, - "head": 0, - "to": 0, - }, - "reconfigured": false, - "scrollIntoView": false, - "selection": Object { - "anchor": 0, - "empty": true, - "from": 0, - "head": 0, - "to": 0, - }, - "startState": EditorState { - "_fields": Map {}, - "doc": Object { - "length": 25, - "line": [Function mockConstructor], - "lineAt": [Function mockConstructor], - "lines": 2, - "sliceString": [Function mockConstructor], - "

17. handleParentTaskUpdateTransaction (Integration) should mark parent as in progress when one child is completed but others remain incomplete
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality - Expected - 6 + Received + 1 Array [ - Object { - "type": Object { - "of": [Function mockConstructor], - }, - "value": "autoCompleteParent.IN_PROGRESS", - }, + "autoCompleteParent.IN_PROGRESS", ]

**autoDateManager.improved.test.ts：2 项**

18. Improved Date Insertion Logic Metadata Positioning should insert cancelled date after start date
   - 报错摘要：Error: expect(received).toBeGreaterThan(expected) Expected: > 24 Received: 24

19. Improved Date Insertion Logic Edge Cases should handle task with only spaces
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: 6 Received: 9

**autoDateManager.integration.test.ts：1 项**

20. autoDateManager - Integration Test should handle cancelled date insertion with real transaction
   - 报错摘要：Error: No status change found

**autoDateManager.pause-conflict.test.ts：3 项**

21. autoDateManager - Pause Timer Conflict should identify conflict when pausing timer changes status to abandoned
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: "abandoned" Received: "inProgress"

22. autoDateManager - Pause Timer Conflict should show that '-' marker is ambiguous (used for both pause and abandoned)
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: "abandoned" Received: "inProgress"

23. autoDateManager - Pause Timer Conflict should demonstrate the specific user scenario
   - 报错摘要：Error: expect(received).toContainEqual(expected) // deep equality Expected value: {"dateType": "cancelled", "format": "YYYY-MM-DD", "type": "add"} Received array: []

**autoDateManager.realworld.test.ts：2 项**

24. autoDateManager - Real World Test should handle user's exact case
   - 报错摘要：Error: DEBUG INFO: - Line: - [-] 交流交底 🚀 2025-07-30 [stage::disclosure_communication] 🛫 2025-04-20 ^timer-161940-4775 - Position: 72 - Text before: "- [-] 交流交底 🚀 2025-07-30 [stage::disclosure_communication] 🛫 2025-04-20" - Text after: " ^timer-161940-4775" - Character at position: " " - Block ref index: 73

25. autoDateManager - Real World Test should test with debugging enabled
   - 报错摘要：Error: expect(received).toBeGreaterThan(expected) Expected: > 24 Received: 24

### 项目识别、属性和日期继承

**TaskParsingService.integration.test.ts：3 项**

26. TaskParsingService Integration Enhanced project parsing should parse tasks with config file-based projects
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality - Expected - 2 + Received + 2 Object { "name": "Research Project", "readonly": true, - "source": "project.md", - "type": "config", + "source": "project", + "type": "metadata", }

27. TaskParsingService Integration Metadata mappings should inherit project-level attributes to tasks
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality - Expected - 2 + Received + 2 Object { "name": "Test Project", "readonly": true, - "source": "project.md", - "type": "config", + "source": "project", + "type": "metadata", }

28. TaskParsingService Integration Priority order integration should prioritize path mappings over metadata and config
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality - Expected - 3 + Received + 3 Object { - "name": "Path Priority Project", + "name": "Metadata Project", "readonly": true, - "source": "Priority", - "type": "path", + "source": "project", + "type": "metadata", }

**ProjectConfigManager.test.ts：12 项**

29. ProjectConfigManager Metadata-based project detection should detect project from file frontmatter
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality Expected: {"name": "My Project", "readonly": true, "source": "project", "type": "metadata"} Received: undefined

30. ProjectConfigManager Metadata-based project detection should use custom metadata key
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality Expected: {"name": "Custom Project", "readonly": true, "source": "proj", "type": "metadata"} Received: undefined

31. ProjectConfigManager Config file-based project detection should detect project from config file
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality Expected: {"name": "Config Project", "readonly": true, "source": "project.md", "type": "config"} Received: undefined

32. ProjectConfigManager Config file-based project detection should parse project from config file content
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality Expected: {"name": "Content Project", "readonly": true, "source": "project.md", "type": "config"} Received: undefined

33. ProjectConfigManager Metadata mappings should apply metadata mappings
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality - Expected - 7 + Received + 1 - Object { - "due": 1704038400000, - "due_date": "2024-01-01", - "other": "value", - "proj": "Mapped Project", - "project": "Mapped Project", - } + Object {}

34. ProjectConfigManager Metadata mappings should ignore disabled mappings
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality - Expected - 3 + Received + 1 - Object { - "proj": "Should Not Map", - } + Object {}

35. ProjectConfigManager Default project naming should use metadata value as project name
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality Expected: {"name": "Global Project", "readonly": true, "source": "metadata", "type": "default"} Received: undefined

36. ProjectConfigManager Priority order should prioritize metadata over config file
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality Expected: {"name": "Metadata Project", "readonly": true, "source": "project", "type": "metadata"} Received: undefined

37. ProjectConfigManager Priority order should prioritize config file over default naming
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality - Expected - 3 + Received + 3 Object { - "name": "Config Project", + "name": "task", "readonly": true, - "source": "project.md", - "type": "config", + "source": "filename", + "type": "default", }

38. ProjectConfigManager Caching should cache project config data
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: "Cached Project" Received: undefined

39. ProjectConfigManager Caching should clear cache when options change
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: "Original Project" Received: undefined

40. ProjectConfigManager Enhanced project feature flag should allow enabling/disabling enhanced project features
   - 报错摘要：Error: expect(received).toEqual(expected) // deep equality Expected: {"project": "Test Project"} Received: null

**ProjectDataWorkerManager.test.ts：4 项**

41. ProjectDataWorkerManager Project Data Computation should get project data using cache first
   - 报错摘要：TypeError: this.vault.getFileByPath is not a function

42. ProjectDataWorkerManager Project Data Computation should handle batch project data requests
   - 报错摘要：TypeError: this.vault.getFileByPath is not a function

43. ProjectDataWorkerManager Project Data Computation should fallback to sync computation when workers fail
   - 报错摘要：TypeError: this.vault.getFileByPath is not a function

44. ProjectDataWorkerManager Cache Management should handle file events
   - 报错摘要：TypeError: this.vault.getFileByPath is not a function

**FileMetadataInheritanceDebug.test.ts：1 项**

45. Debug File Metadata Inheritance should debug inheritance process
   - 报错摘要：Error: Debug detailed info: Config enabled: true File metadata keys: priority, testField File metadata values: {"priority":"high","testField":"testValue"} Task metadata keys: tags, priority, startDate, dueDate, scheduledDate, completedDate, createdDate, cancelledDate, recurrence, project, context, area, id, dependsOn, onCompletion, children, heading, parent, tgProject Task metadata: {"tags":[],"priority":4,"children":[],"heading":[]} Task priority: 4 (type: number) Task testField: undefined (exists: false) Priority inherited: true TestField inherited: false

**TagsInheritanceInvestigation.test.ts：1 项**

46. Tags Inheritance Investigation should investigate what fields are being inherited incorrectly
   - 报错摘要：Error: expect(received).toContain(expected) // indexOf Expected value: "mobility" Received array: ["#mobility"]

**ProjectDetectionFixes.test.ts：6 项**

47. Project Detection Fixes Metadata Detection Enable/Disable should detect project from frontmatter when metadata detection is enabled
   - 报错摘要：Error: expect(received).toBeDefined() Received: undefined

48. Project Detection Fixes Metadata Detection Enable/Disable should respect different metadata keys
   - 报错摘要：Error: expect(received).toBeDefined() Received: undefined

49. Project Detection Fixes Config File Detection Enable/Disable should detect project from config file when config file detection is enabled
   - 报错摘要：Error: expect(received).toBeDefined() Received: undefined

50. Project Detection Fixes Search Recursively Setting should search parent directories when searchRecursively is true
   - 报错摘要：Error: expect(received).toBeDefined() Received: undefined

51. Project Detection Fixes Detection Method Priority and Independence should fall back to metadata when path mapping is disabled
   - 报错摘要：Error: expect(received).toBeDefined() Received: undefined

52. Project Detection Fixes Detection Method Priority and Independence should fall back to config file when both path and metadata are disabled
   - 报错摘要：Error: expect(received).toBeDefined() Received: undefined

**DateInheritanceService.test.ts：1 项**

53. DateInheritanceService metadata date parsing should handle invalid metadata dates gracefully
   - 报错摘要：Error: expect(received).toBeNull() Received: undefined

**DateInheritanceIntegration.test.ts：4 项**

54. DateInheritanceService Integration file metadata parsing should handle invalid metadata gracefully
   - 报错摘要：Error: expect(received).toBeNull() Received: undefined

55. DateInheritanceService Integration integration scenarios should handle complex folder structures
   - 报错摘要：Error: expect(received).toBeNull() Received: undefined

56. DateInheritanceService Integration integration scenarios should handle files without dates gracefully
   - 报错摘要：Error: expect(received).toBeNull() Received: undefined

57. DateInheritanceService Integration integration scenarios should handle missing files gracefully
   - 报错摘要：Error: expect(received).toBeNull() Received: undefined

### 任务操作、Canvas 和工作流

**CompleteActionExecutor.test.ts：9 项**

58. CompleteActionExecutor Task Completion should complete related tasks successfully
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

59. CompleteActionExecutor Task Completion should skip already completed tasks
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

60. CompleteActionExecutor Task Completion should handle task not found
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

61. CompleteActionExecutor Task Completion should handle task update error
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

62. CompleteActionExecutor Task Completion should handle no task manager available
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: "Task manager not available" Received: "Failed: Task not found: related-task-1, Task not found: related-task-2"

63. CompleteActionExecutor Task Completion should preserve existing task metadata
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

64. CompleteActionExecutor Error Handling should handle general execution error
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: "Failed: task1: Unexpected error" Received: "Failed: Task not found: task1"

65. CompleteActionExecutor Edge Cases should handle single task completion
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

66. CompleteActionExecutor Edge Cases should handle large number of tasks
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

**ArchiveActionExecutor.canvas.test.ts：9 项**

67. ArchiveActionExecutor - Canvas Tasks Canvas Task Archiving should successfully archive Canvas task to default archive file
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

68. ArchiveActionExecutor - Canvas Tasks Canvas Task Archiving should successfully archive Canvas task to custom archive file
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

69. ArchiveActionExecutor - Canvas Tasks Canvas Task Archiving should create archive file if it does not exist
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

70. ArchiveActionExecutor - Canvas Tasks Canvas Task Archiving should handle Canvas deletion failure after successful archive
   - 报错摘要：Error: expect(received).toContain(expected) // indexOf Expected substring: "Task archived successfully to Archive/Completed Tasks.md, but failed to remove from Canvas: Canvas node not found" Received string: "Error archiving Canvas task: Cannot read properties of undefined (reading 'deleteCanvasTask')"

71. ArchiveActionExecutor - Canvas Tasks Canvas Task Archiving should create new section if section does not exist
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

72. ArchiveActionExecutor - Canvas Tasks OnCompletion Metadata Cleanup should remove onCompletion metadata when archiving Canvas task
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

73. ArchiveActionExecutor - Canvas Tasks OnCompletion Metadata Cleanup should remove onCompletion metadata in JSON format when archiving
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

74. ArchiveActionExecutor - Canvas Tasks OnCompletion Metadata Cleanup should ensure task is marked as completed when archiving
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

75. ArchiveActionExecutor - Canvas Tasks OnCompletion Metadata Cleanup should remove dataview format onCompletion when archiving
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

**MoveActionExecutor.canvas.test.ts：5 项**

76. MoveActionExecutor - Canvas Tasks Canvas to Canvas Movement should successfully move Canvas task to another Canvas file
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

77. MoveActionExecutor - Canvas Tasks Canvas to Canvas Movement should handle Canvas to Canvas move failure
   - 报错摘要：Error: expect(received).toContain(expected) // indexOf Expected substring: "Target Canvas file not found" Received string: "Error moving Canvas task: Cannot read properties of undefined (reading 'moveCanvasTask')"

78. MoveActionExecutor - Canvas Tasks Canvas to Markdown Movement should successfully move Canvas task to Markdown file
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

79. MoveActionExecutor - Canvas Tasks Canvas to Markdown Movement should create target Markdown file if it does not exist
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

80. MoveActionExecutor - Canvas Tasks Canvas to Markdown Movement should handle Canvas deletion failure after successful move
   - 报错摘要：Error: expect(received).toContain(expected) // indexOf Expected substring: "Task moved successfully to target.md, but failed to remove from Canvas: Canvas node not found" Received string: "Failed to move Canvas task to Markdown: Cannot read properties of undefined (reading 'deleteCanvasTask')"

**DeleteActionExecutor.canvas.test.ts：4 项**

81. DeleteActionExecutor - Canvas Tasks Canvas Task Deletion should successfully delete a Canvas task
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

82. DeleteActionExecutor - Canvas Tasks Canvas Task Deletion should handle Canvas task deletion failure
   - 报错摘要：Error: expect(received).toContain(expected) // indexOf Expected substring: "Canvas node not found" Received string: "Error deleting Canvas task: Cannot read properties of undefined (reading 'deleteCanvasTask')"

83. DeleteActionExecutor - Canvas Tasks Canvas Task Deletion should handle Canvas task updater exceptions
   - 报错摘要：Error: expect(received).toContain(expected) // indexOf Expected substring: "Error deleting Canvas task: Network error" Received string: "Error deleting Canvas task: Cannot read properties of undefined (reading 'deleteCanvasTask')"

84. DeleteActionExecutor - Canvas Tasks Canvas Task Deletion should correctly identify Canvas tasks
   - 报错摘要：Error: expect(jest.fn()).toHaveBeenCalled() Expected number of calls: >= 1 Received number of calls: 0

**CanvasTaskUpdater.test.ts：1 项**

85. CanvasTaskUpdater updateCanvasTask should handle tasks with identical names and metadata correctly
   - 报错摘要：Error: expect(received).toContain(expected) // indexOf Expected substring: "- [ ] Task In Canvas 📅 2025-06-21" Received string: "# Tasks with Same Names· - [x] Task In Canvas #SO/旅行 - [ ] Task In Canvas 🛫 2025-06-21 - [ ] Task In Canvas #SO/旅行 - [ ] Task In Canvas - [ ] A new day"

**ArchiveActionExecutor.markdown.test.ts：5 项**

86. ArchiveActionExecutor - Markdown Tasks Markdown Task Archiving should successfully archive Markdown task with onCompletion metadata cleanup
   - 报错摘要：ReferenceError: Cannot access 'mockDate' before initialization

87. ArchiveActionExecutor - Markdown Tasks Markdown Task Archiving should ensure incomplete Markdown task is marked as completed when archived
   - 报错摘要：ReferenceError: Cannot access 'mockDate' before initialization

88. ArchiveActionExecutor - Markdown Tasks Markdown Task Archiving should remove dataview format onCompletion from Markdown task
   - 报错摘要：ReferenceError: Cannot access 'mockDate' before initialization

89. ArchiveActionExecutor - Markdown Tasks Markdown Task Archiving should remove JSON format onCompletion from Markdown task
   - 报错摘要：ReferenceError: Cannot access 'mockDate' before initialization

90. ArchiveActionExecutor - Markdown Tasks Error Handling should handle source file not found
   - 报错摘要：ReferenceError: Cannot access 'mockDate' before initialization

**DuplicateActionExecutor.canvas.test.ts：3 项**

91. DuplicateActionExecutor - Canvas Tasks Canvas to Canvas Duplication should successfully duplicate Canvas task within same file
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

92. DuplicateActionExecutor - Canvas Tasks Canvas to Canvas Duplication should successfully duplicate Canvas task to different Canvas file
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: true Received: false

93. DuplicateActionExecutor - Canvas Tasks Canvas to Canvas Duplication should handle Canvas duplication failure
   - 报错摘要：Error: expect(received).toContain(expected) // indexOf Expected substring: "Target Canvas file not found" Received string: "Error duplicating Canvas task: Cannot read properties of undefined (reading 'duplicateCanvasTask')"

**workflow.test.ts：7 项**

94. Workflow Functionality processTimestampAndCalculateTime should calculate spent time and remove timestamp
   - 报错摘要：TypeError: startTime.isValid is not a function

95. Workflow Functionality processTimestampAndCalculateTime should calculate total time for final stage
   - 报错摘要：TypeError: startTime.isValid is not a function

96. Workflow Functionality determineTaskInsertionPoint should return line end when no child tasks
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: 50 Received: 17

97. Workflow Functionality Time Calculation Edge Cases should handle invalid timestamp format
   - 报错摘要：TypeError: startTime.isValid is not a function

98. Workflow Functionality Time Calculation Edge Cases should handle missing workflow definition during time calculation
   - 报错摘要：TypeError: startTime.isValid is not a function

99. Workflow Functionality Workflow Settings Integration should respect calculateSpentTime setting
   - 报错摘要：TypeError: startTime.isValid is not a function

100. Workflow Functionality Complex Document Structure Tests should handle workflow tasks with time tracking
   - 报错摘要：TypeError: startTime.isValid is not a function

### 文件过滤、索引和缓存

**FileFilterManager.test.ts：10 项**

101. FileFilterManager Basic Filtering should allow all files when disabled
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

102. FileFilterManager Basic Filtering should filter files in blacklist mode
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

103. FileFilterManager Basic Filtering should filter files in whitelist mode
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

104. FileFilterManager Pattern Matching should match wildcard patterns
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

105. FileFilterManager Folder Hierarchy should match nested folders
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

106. FileFilterManager Rule Management should respect disabled rules
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

107. FileFilterManager Rule Management should update configuration dynamically
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

108. FileFilterManager Performance and Caching should cache filter results
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

109. FileFilterManager Performance and Caching should clear cache when configuration changes
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

110. FileFilterManager Statistics should provide accurate statistics
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

**FileFilterIntegration.test.ts：8 项**

111. File Filter Integration Tests End-to-End Filtering Scenarios should handle typical vault structure with system folders excluded
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

112. File Filter Integration Tests End-to-End Filtering Scenarios should handle whitelist mode for focused project work
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

113. File Filter Integration Tests End-to-End Filtering Scenarios should handle complex pattern matching scenarios
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

114. File Filter Integration Tests Performance and Caching should demonstrate caching performance benefits
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

115. File Filter Integration Tests Performance and Caching should handle large numbers of files efficiently
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

116. File Filter Integration Tests Configuration Updates should handle dynamic configuration changes correctly
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

117. File Filter Integration Tests Edge Cases and Error Handling should handle empty and invalid paths gracefully
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

118. File Filter Integration Tests Edge Cases and Error Handling should handle disabled rules correctly
   - 报错摘要：TypeError: (0 , obsidian_1.normalizePath) is not a function

**TaskIndexer.mtime.test.ts：8 项**

119. TaskIndexer mtime functionality mtime comparison should detect file changes when mtime is newer
   - 报错摘要：TypeError: Cannot read properties of undefined (reading 'onLayoutReady')

120. TaskIndexer mtime functionality mtime comparison should not detect changes when mtime is same
   - 报错摘要：TypeError: Cannot read properties of undefined (reading 'onLayoutReady')

121. TaskIndexer mtime functionality mtime comparison should detect changes for unknown files
   - 报错摘要：TypeError: Cannot read properties of undefined (reading 'onLayoutReady')

122. TaskIndexer mtime functionality cache validation should have valid cache when file hasn't changed and has tasks
   - 报错摘要：TypeError: Cannot read properties of undefined (reading 'onLayoutReady')

123. TaskIndexer mtime functionality cache validation should not have valid cache when file has changed
   - 报错摘要：TypeError: Cannot read properties of undefined (reading 'onLayoutReady')

124. TaskIndexer mtime functionality cache validation should not have valid cache when no tasks exist
   - 报错摘要：TypeError: Cannot read properties of undefined (reading 'onLayoutReady')

125. TaskIndexer mtime functionality cache cleanup should clean up file cache properly
   - 报错摘要：TypeError: Cannot read properties of undefined (reading 'onLayoutReady')

126. TaskIndexer mtime functionality cache consistency should validate and fix cache consistency
   - 报错摘要：TypeError: Cannot read properties of undefined (reading 'onLayoutReady')

**TaskWorkerManager.mtime.test.ts：4 项**

127. TaskWorkerManager mtime optimization cache optimization should skip processing files with valid cache
   - 报错摘要：TypeError: indexer.updateIndexWithTasks is not a function

128. TaskWorkerManager mtime optimization cache optimization should process files when cache is invalid
   - 报错摘要：TypeError: indexer.updateIndexWithTasks is not a function

129. TaskWorkerManager mtime optimization cache optimization should optimize batch processing
   - 报错摘要：TypeError: indexer.updateIndexWithTasks is not a function

130. TaskWorkerManager mtime optimization configuration should respect mtime optimization setting
   - 报错摘要：TypeError: indexer.updateIndexWithTasks is not a function

### 时间解析和时间格式

**TimeParsingService.test.ts：2 项**

131. TimeParsingService Chinese Time Expressions should parse "后天"
   - 报错摘要：Error: expect(received).toBeLessThanOrEqual(expected) Expected: <= 2 Received: 5

132. TimeParsingService Multiple Date Types should parse multiple different date types
   - 报错摘要：Error: expect(received).toBeGreaterThan(expected) Expected: > 1 Received: 1

**EnhancedTimeParsingEdgeCases.test.ts：2 项**

133. Enhanced Time Parsing Edge Cases Edge Cases with Context should handle time expressions at start of text
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: 14 Received: undefined

134. Enhanced Time Parsing Edge Cases Edge Cases with Context should handle multiple time expressions in one text
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: 14 Received: 16

**EnhancedTimeParsingIntegration.test.ts：1 项**

135. Enhanced Time Parsing Integration Tests ICS Event Integration with Enhanced Time Parsing should handle ICS all-day events with time parsing from description
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: 9 Received: 17

**TaskMetadataUtils.test.ts：2 项**

136. TaskMetadataUtils timestampToTimeComponent should convert timestamp to time component correctly
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: "14:30" Received: "14:30:45"

137. TaskMetadataUtils timestampToTimeComponent should handle midnight correctly
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: 0 Received: undefined

### 性能阈值

**chinese-tag-performance.test.ts：1 项**

138. Chinese Tag Parsing Performance should efficiently parse large number of Chinese nested tags
   - 报错摘要：Error: expect(received).toBeLessThan(expected) Expected: < 100 Received: 397.0059999999994

**EnhancedTimeParsingPerformance.test.ts：1 项**

139. Enhanced Time Parsing Performance Tests Time Parsing Performance Impact should benefit from caching on repeated parsing
   - 报错摘要：Error: expect(received).toBeLessThan(expected) Expected: < 1.6149500000001353 Received: 2.8995999999997366

### 自动补全和设置迁移

**SuggestBackwardCompatibility.test.ts：3 项**

140. Backward Compatibility Tests should provide fallback suggestions when new system returns empty
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: 4 Received: 0

141. Backward Compatibility Tests should handle selectSuggestion with both new and legacy actions
   - 报错摘要：Error: expect(jest.fn()).toHaveBeenCalledWith(...expected) - Expected + Received Object { - "ch": 4, + "ch": 3, "line": 0, }, Number of calls: 1

142. Backward Compatibility Tests should handle legacy modal-based actions
   - 报错摘要：Error: expect(jest.fn()).toHaveBeenCalled() Expected number of calls: >= 1 Received number of calls: 0

**SettingsMigration.test.ts：1 项**

143. Settings Migration runAllMigrations should not run cleanup if migration fails
   - 报错摘要：Error: expect(received).toBe(expected) // Object.is equality Expected: false Received: true

### ICS 日历解析和超时

**ics-parser.test.ts：1 项**

144. ICS Parser Date Parsing should handle current year events
   - 报错摘要：Error: expect(received).toBeGreaterThan(expected) Expected: > 0 Received: 0

**ics-timeout-fix.test.ts：1 项**

145. ICS Timeout Fix Network Timeout should categorize timeout errors correctly
   - 报错摘要：Error: expect(received).toContain(expected) // indexOf Expected substring: "timeout" Received string: "cannot read properties of undefined (reading 'status')"

## 另外 3 个未能加载的测试套件

- **TimelineSidebarView.test.ts**：● Test suite failed to run Cannot find module '../components/MarkdownRenderer' from 'src/__tests__/TimelineSidebarView.test.ts' 56 | })); 57 | > 58 | jest.mock('../components/MarkdownRenderer', () => ({ | ^ 59 | MarkdownRendererComponent: class MockMarkdownRendererComponent {}, 60 | })); 61 | at Resolver._throwModNotFoundError (node_modules/.pnpm/jest-resolve@29.7.0/node_modules/jest-resolve/build/resolver.js:427:11) at Object.<anonymous> (src/__tests__/TimelineSidebarView.test.ts:58:6)

- **QuickCaptureModal.integration.test.ts**：● Test suite failed to run Cannot find module '../components/AutoComplete' from 'src/__tests__/QuickCaptureModal.integration.test.ts' 119 | })); 120 | > 121 | jest.mock("../components/AutoComplete", () => ({ | ^ 122 | FileSuggest: jest.fn(), 123 | ContextSuggest: jest.fn(), 124 | ProjectSuggest: jest.fn(), at Resolver._throwModNotFoundError (node_modules/.pnpm/jest-resolve@29.7.0/node_modules/jest-resolve/build/resolver.js:427:11) at Object.<anonymous> (src/__tests__/QuickCaptureModal.integration.test.ts:121:6)

- **dateTemplates.test.ts**：● Test suite failed to run TypeError: Class extends value undefined is not a constructor or null 282 | } 283 | > 284 | export class ProjectCreateModal extends Modal { | ^ 285 | constructor(app: App, private manager: ProjectFileManager, private onSave: () => void) { super(app); } 286 | onOpen() { 287 | this.setTitle(t("New project")); const folder = projectFolderPicker(this.contentEl, this.manager, ""); let name = "", description = "", color = "#5985b1"; at Object.<anonymous> (src/managers/project-file-manager.ts:284:41) at Object.<anonymous> (src/utils/file/file-operations.ts:4:1) at Object.<anonymous> (src/__tests__/dateTemplates.test.ts:1:1)

