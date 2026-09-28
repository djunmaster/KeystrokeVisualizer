<p align="center">
  <img src="resources/icons/icon.png" alt="Keystroke Visualizer 应用 logo" width="112" height="112">
</p>

<h1 align="center">Keystroke Visualizer</h1>

<p align="center">
  <strong>实时显示键盘按键与鼠标操作的桌面工具</strong>
</p>

<p align="center">
  将组合键、鼠标滚轮和长按状态实时呈现在桌面浮层中。<br>
  适用于录屏教程、课堂演示和游戏操作展示，支持固定键盘面板、主题与自定义样式。
</p>

<p align="center">
  <a href="https://github.com/djunmaster/KeystrokeVisualizer/releases/latest">
    <img src="https://img.shields.io/github/v/release/djunmaster/KeystrokeVisualizer?label=version&amp;style=flat-square&amp;color=2563eb" alt="最新发布版本">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/djunmaster/KeystrokeVisualizer?style=flat-square" alt="MIT 许可证">
  </a>
  <a href="#下载与安装">
    <img src="https://img.shields.io/badge/Windows-x64-0078d4?style=flat-square" alt="Windows x64">
  </a>
</p>

<p align="center">
  <a href="https://github.com/djunmaster/KeystrokeVisualizer/releases/latest">下载最新版</a>
  &nbsp;·&nbsp;
  <a href="#实际效果">实际效果</a>
  &nbsp;·&nbsp;
  <a href="#功能特性">功能特性</a>
  <br>
  <a href="#开发">开发指南</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/djunmaster/KeystrokeVisualizer/issues">反馈问题</a>
</p>

## 实际效果

**按键记录**适合讲解快捷键与操作过程；**键盘面板**适合持续展示指定按键的状态。两种模式可以在设置中切换，共用主题与显示位置。

![V1.0.2 演示：组合键、重复次数、滚轮，以及 WASD、方向键和自定义完整键盘](docs/media/keyboard-mouse.gif)

<sub>基于 V1.0.2 的实际运行界面录制；演示使用独立配置与脚本化输入。</sub>

## 功能特性

| 功能 | 能力 |
| --- | --- |
| 按键记录 | 组合键、长按高亮、重复次数合并、松开后淡出；支持滚轮方向、中键与音量键 |
| 键盘面板 | WASD、方向键与自定义布局；按下和松开实时更新，支持 60%–160% 缩放 |
| 布局编辑 | 完整键盘起始模板，行与按键增删、排序、键宽、标签和空白间隔，可保存多套布局 |
| 主题与 CSS | 六套内置主题，自定义 CSS 实时预览、命名保存与切换 |
| 屏幕与位置 | 选择目标显示器、位置预设、拖动预览和坐标微调，适配屏幕边界 |
| 暂停与恢复 | 设置、托盘或全局快捷键；暂停时隐藏浮层并停止监听 |
| 配置备份 | JSON 导入与导出，导入前校验并展示对比，保留本机运行设置 |
| 应用管理 | 托盘驻留、开机启动、简体中文 / English；Windows 安装版支持应用内更新 |

## 下载与安装

从 [GitHub Releases](https://github.com/djunmaster/KeystrokeVisualizer/releases/latest) 下载 Windows x64 版本。推荐使用安装版：

| 版本 | 下载 | 更新方式 |
| --- | --- | --- |
| **安装版** | [V1.0.2 · Setup.exe](https://github.com/djunmaster/KeystrokeVisualizer/releases/download/v1.0.2/Keystroke.Visualizer.Setup.1.0.2.exe) | 应用内检查、下载、安装并重启 |
| 便携版 | [V1.0.2 · Portable.exe](https://github.com/djunmaster/KeystrokeVisualizer/releases/download/v1.0.2/Keystroke.Visualizer.1.0.2.exe) | 手动下载新版，无需安装 |

安装版可选择安装目录并创建快捷方式。应用自带运行所需组件。当前正式下载包和验证范围为 **Windows x64**；源码中的 macOS / Linux 打包配置尚未提供对应发布包。

安装包尚未进行代码签名，Windows 可能显示“未知发布者”提示。

> **V1.0.2** 新增自定义布局与配置备份，修复锁屏、解锁和休眠后的残留按下状态，并更新托盘图标。[查看完整更新说明](https://github.com/djunmaster/KeystrokeVisualizer/releases/tag/v1.0.2)

## 快速开始

1. **启动工具**：安装或运行便携版，在系统托盘菜单中打开“设置”。
2. **选择模式**：在“显示”页选择“按键记录”或“键盘面板”；面板模式下可选择布局与大小。
3. **调整画面**：在“位置”页选择目标屏幕和位置，在“样式”页选择主题。试按几个键后，再开始录屏或演示。

| 设置页 | 常用操作 |
| --- | --- |
| 显示 | 启用、暂停、显示模式、淡出时间、记录数量、键盘布局和大小 |
| 位置 | 目标显示器、位置预设、拖动屏幕预览、X / Y 坐标 |
| 样式 | 主题、自定义 CSS、效果预览、保存样式 |
| 应用 | 语言、开机启动、配置备份、版本更新 |

需要暂时隐藏按键时，使用 <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F9</kbd>，或点击设置 / 托盘中的“暂停显示”。恢复后只展示新输入。

## 主题预览

经典磨砂、纸白键帽、薄荷终端、霓虹电竞、高对比教学、极简描边。下图使用同一 WASD 布局，展示各主题在普通与按下状态下的实际效果：

![六套内置主题的实际键盘面板，W 键为按下状态](docs/media/overlay-example.png)

## 使用指南

<details>
<summary><strong>显示模式、长按与重复合并</strong></summary>

**按键记录**：按住时保持高亮，松开后按设定时间淡出。800 ms 内连续相同组合与长按产生的系统重复事件会合并为 `×N`。可显示 1–12 条记录，淡出时间为 200–3000 ms。鼠标展示仅包含滚轮方向与中键，不包含左键和右键点击。

**键盘面板**：只展示当前布局中物理按键的实时状态，不显示鼠标记录。大小可设为 60%–160%，每档 10%；超出所选屏幕工作区时自动等比缩小。面板缩放不会改变按键记录模式的大小。

暂停状态会保存，重启后仍保持暂停。快捷键被其他应用占用时，设置页会显示不可用状态，可继续通过按钮或托盘控制。禁用显示时，暂停快捷键不会重新启用浮层。

</details>

<details>
<summary><strong>自定义键盘布局</strong></summary>

在“显示 → 键盘面板 → 按键布局”中点击“编辑布局”，从 WASD、方向键或完整键盘模板开始。编辑器支持行和按键增删、排序、跨行移动、键宽、显示标签和空白间隔。完整键盘模板包含主键区与方向键；导航键和数字小键盘可自行添加。

“保存并使用”保存并切换当前布局，“另存为”创建新布局。草稿只影响预览，切换设置页时保留；已保存布局在重启后继续可用。显示标签只改变键帽文字，不改变监听的物理按键；左右修饰键可分别配置。

| 项目 | 范围 |
| --- | --- |
| 已保存布局 | 最多 20 套 |
| 行数与按键 | 每套 1–8 行，每行最多 20 个键 |
| 键宽 | 0.5–8 个标准键宽，每档 0.25；单行总宽另受限制 |
| 显示标签 | 最多 12 个字符 |

</details>

<details>
<summary><strong>位置调整与多显示器</strong></summary>

在“位置 → 目标屏幕”中选择显示器，通过位置预设、拖动预览标记或输入 X / Y 调整浮层。也可以直接拖动桌面浮层。预览中的标记和坐标实时同步：

![V1.0.2 位置设置：拖动屏幕预览标记并同步 X / Y 坐标](docs/media/position-editor.gif)

坐标使用系统逻辑像素，可能与屏幕物理像素不同。切换显示器时保留相对位置；屏幕移除后回到主屏，分辨率与缩放变化时重新适配。浮层保持在工作区内、避开任务栏；工作区过小时，记录模式优先显示最新记录，键盘面板等比缩小。

</details>

<details>
<summary><strong>自定义 CSS 与新版设置界面</strong></summary>

在“样式”页选择基础主题、编辑 CSS 并查看实时预览。填写名称后保存，可继续修改、另存或删除。草稿不会覆盖已保存样式；无效 CSS 会保留最后一次有效预览。最多保存 20 套样式，每套 CSS 最长 16000 个字符。

![V1.0.2 样式设置：主题选择、效果预览与自定义 CSS](docs/media/settings-zh.png)

| 选择器 | 对应元素 |
| --- | --- |
| `.kv-key` | 单个键帽 |
| `.kv-row` | 按键记录行 |
| `.kv-panel` | 键盘面板 |
| `.kv-plus` | 组合键分隔符 |
| `.kv-count` | 重复次数 |

键帽提供 `data-key`、`data-held` 与 `data-role` 属性。例如，给按下的按键添加绿色边框：

```css
.kv-key {
  border-radius: 6px;
  font-weight: 600;
}

.kv-key[data-held="true"] {
  border-color: #69e0a5;
  box-shadow: 0 0 0 1px #69e0a5;
}
```

CSS 仅作用于按键显示区域，支持普通规则、`@media` 和 `@supports`，不支持 `url()`、`@import`、`@font-face`、`@keyframes` 或 CSS 嵌套。超出浮层窗口的内容会裁剪，较大的字体和阴影需在预览中检查。

</details>

<details>
<summary><strong>配置导入与导出</strong></summary>

在“应用 → 配置管理”中导出 JSON 备份，或选择备份文件导入。文件包含主题、自定义 CSS、布局、显示参数和语言等已保存设置；未保存的布局与 CSS 草稿不包含在内。

导入先校验并显示当前设置与备份的对比，点击“应用配置”后才保存。**导入会替换已保存的布局与样式列表，并清空未保存草稿**，建议先导出当前配置。

目标显示器、开机启动、启用与暂停状态保留本机值。默认保留本机位置，布局尺寸变化时仍可能调整坐标以适配屏幕；勾选“同时恢复显示位置”可导入坐标，超出边界时自动调整。文件最大 2 MB，当前备份格式版本为 1。

</details>

<details>
<summary><strong>版本更新与旧版升级</strong></summary>

Windows 安装版在启动约 15 秒后检查 GitHub Releases，此后每 6 小时检查一次。也可在“应用 → 版本更新”中手动检查，查看下载进度，并在下载完成后点击“安装并重启”。下载与安装需要主动确认，不会自动打断演示。

V1.0.1 安装版可直接升级；V1.0.0 没有更新客户端，需要手动安装一次新版。便携版需手动下载更新；开发版和其他平台不支持应用内安装更新。

</details>

## 常见问题

<details>
<summary><strong>启动后为什么没有看到设置窗口？</strong></summary>

工具默认驻留在系统托盘。通过托盘菜单打开设置，再检查“显示”页是否已启用、是否处于暂停状态。如果浮层不在当前屏幕上，到“位置”页选择目标显示器并重置位置。

</details>

<details>
<summary><strong>为什么录屏中看不到按键浮层？</strong></summary>

浮层是独立的桌面窗口，仅捕获某个应用或游戏时可能不包含它。可先尝试录屏软件的显示器捕获方式；实际效果取决于录屏工具和捕获模式。目前未进行 OBS 各捕获模式的兼容测试。

</details>

<details>
<summary><strong>输入密码时会自动隐藏吗？</strong></summary>

当前没有密码框自动识别。输入密码、验证码或其他敏感内容前，请使用 `Ctrl+Shift+F9` 或托盘暂停显示。

</details>

<details>
<summary><strong>会保存或上传按键记录吗？</strong></summary>

当前实现将实时按键事件发送到本机浮层，显示记录在内存中淡出移除，持久化的是应用配置，不提供按键日志保存或上传功能。Windows 安装版会访问 GitHub 检查和下载更新。

</details>

<details>
<summary><strong>锁屏后还会一直显示某个键被按住吗？</strong></summary>

V1.0.2 会在锁屏与系统休眠前后清除残留按下状态，并在锁定期间忽略输入。记录模式中的已有记录仍按淡出时间移除；解锁后从后续输入继续更新状态。

</details>

## 开发

<details>
<summary><strong>环境、运行与构建</strong></summary>

技术栈：Electron 28、React 18、TypeScript、Tailwind CSS、Vite、uiohook-napi、electron-store、electron-updater 和 electron-builder。

开发与构建已在 Windows x64、Node.js 24 环境验证。项目使用 `package-lock.json` 锁定依赖。

```bash
npm ci
npm run electron:dev
```

构建 Windows 安装版与便携版：

```bash
npm run build:win
```

提交前验证：

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

项目结构：

```text
src/main/               Electron 主进程、监听、配置与窗口管理
src/preload/            隔离环境中的 IPC 桥接
src/renderer/overlay/   桌面按键浮层
src/renderer/settings/  设置界面
src/renderer/shared/    共享类型与样式
resources/              应用 logo 与托盘资源
docs/                   文档与演示素材
```

发布新版时递增项目版本，构建后将安装包、对应 `.blockmap` 与 `latest.yml` 上传到同一个 `v<version>` Release，确保文件名和校验值一致。便携版一起发布供手动下载；配置了发布凭据时可使用 `electron-builder --win --publish always`。演示素材变更无需重新打包应用。

</details>

## 参与项目

欢迎通过 [Issues](https://github.com/djunmaster/KeystrokeVisualizer/issues) 反馈问题或建议。报告问题时请附上应用版本、Windows 版本、显示模式、复现步骤，以及相关屏幕缩放 / 多显示器信息；截图前请移除敏感内容。

代码贡献请说明变更目的和验证方式，并运行上面的开发检查。

## 许可证

[MIT](LICENSE)
