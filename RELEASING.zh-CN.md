# 自行发布旧布局版本

本维护分支从官方 `9.13.1` 标签建立，保留旧设置布局。新 PR 合并目标是 `legacy/9.13.1`，与仓库原来的 `master` 分开。当前准备发布的插件版本是 **9.13.2**。

## 第一次发布：通过 GitHub 网页

1. 合并本 PR 到 `legacy/9.13.1`。
2. 打开仓库右侧的 **Releases**，点击 **Draft a new release**。
3. 在 **Choose a tag** 输入 `9.13.2`，选择创建新标签。在 **Target** 选择 `legacy/9.13.1`。标签与 `manifest.json` 中的版本号保持一致，不要加 `v`。
4. 标题填写 `9.13.2：旧布局设置中文完善`，说明中写本次改动。
5. 在附件区域上传构建生成的 **main.js、manifest.json、styles.css**。可以额外上传 `task-genius-9.13.2.zip`，但 BRAT 所需的三个文件仍应分别作为附件提供。
6. 自测版本可以勾选 **This is a pre-release**。确认可用、希望 BRAT 的 `latest` 自动获取时，发布正式版本并选择 **Set as latest release**。
7. 最后点击 **Publish release**。发布后检查附件列表是否真的有三个独立文件；GitHub 自动提供的 Source code 压缩包只是源码。

官方网页操作说明：https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository

## 怎样从源码生成附件

需要 Git、Node.js 20 及 pnpm 10.26.0。在终端执行：

```powershell
git clone --branch legacy/9.13.1 --recurse-submodules https://github.com/Platinum1154/taskgenius-plugin.git
cd taskgenius-plugin
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:release
node scripts/zip.mjs
```

三个发布文件和可选压缩包都在 `dist` 文件夹。`build:release` 会先构建工作区组件，再检查翻译、版本号与 TypeScript，最后生成插件文件。构建不负责发布，也不要求 GitHub token。

`packages/calendar` 已固定为官方仍可下载的提交；不要用空目录代替子模块，也不要从其他 fork 拷贝编译产物。

## 以后发布下一版

例如发布 `9.13.3`，先在维护分支修改：

- `package.json` 的 `version` 为 `9.13.3`。
- `manifest.json` 的 `version` 为 `9.13.3`。
- 在 `versions.json` 中添加 `"9.13.3": "0.15.2"`；最低 Obsidian 版本沿用 manifest 的实际值。

提交并推送这些更改，再重新构建。创建 Release 时也使用 `9.13.3`，上传这次新构建的附件。只改 Release 标题或标签，不会改变插件文件中的版本号。

标签推送还会运行仓库的 Release workflow；它会核对版本、构建并上传附件。网页上传仍可直接提供本地验证过的构建文件。CI 会保留原版完整测试的真实结果，不会为通过检查而跳过既有失败用例。

这条旧版维护分支没有更改默认分支。若通过 `release-it` 发布，原有脚本限制分支为 master；请按本指南的构建及网页发布步骤操作。
