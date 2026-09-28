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
  &nbsp;·&nbsp;
  <a href="#开发">开发指南</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/djunmaster/KeystrokeVisualizer/issues">反馈问题</a>
</p>

## 实际效果

以下截图与 GIF 均来自 Windows 上实际运行的应用。按键演示由真实输入事件触发；设置截图展示较早版本，v1.0.1 的设置已调整为四个页面。

### 组合键、滚轮与淡出动画

按下 `Ctrl + C`、`Ctrl + Shift + K`，再向下、向上滚动鼠标：浮层实时显示操作，多条记录依次淡出。演示以应用设置窗口为背景。

![组合键与鼠标滚轮的真实运行演示](docs/media/keyboard-mouse.gif)

### 可视化位置编辑

在设置的屏幕预览中拖动标记，浮层位置和 X / Y 坐标同步更新；也可以直接输入坐标微调。

![拖动位置标记并实时更新坐标](docs/media/position-editor.gif)

<details>
<summary>查看中文设置与按键浮层截图</summary>

| 中文设置 | 按键浮层 |
| --- | --- |
| ![完整中文设置界面](docs/media/settings-zh.png) | ![Ctrl+C 按键浮层实际效果](docs/media/overlay-example.png) |

</details>

## 下载与安装

从 [GitHub Releases](https://github.com/djunmaster/KeystrokeVisualizer/releases/tag/v1.0.1) 下载 Windows x64 版本：

| 文件 | 用途 |
| --- | --- |
| [Keystroke.Visualizer.Setup.1.0.1.exe](https://github.com/djunmaster/KeystrokeVisualizer/releases/download/v1.0.1/Keystroke.Visualizer.Setup.1.0.1.exe) | 安装版，支持后续应用内更新，可选择安装目录并创建快捷方式 |
| [Keystroke.Visualizer.1.0.1.exe](https://github.com/djunmaster/KeystrokeVisualizer/releases/download/v1.0.1/Keystroke.Visualizer.1.0.1.exe) | 便携版，无需安装，后续版本需手动下载 |

首次运行后，应用会在系统托盘驻留。通过托盘菜单打开设置，可调整显示位置、动画、显示数量和界面语言。浮层可直接拖动；设置页也支持可视化编辑位置与实时预览。

本次仅提供 Windows x64 安装包。安装包未进行代码签名，Windows 可能显示“未知发布者”提示。

> v1.0.1 已修复 Windows 上浮层可能被其他窗口遮挡的问题。v1.0.0 用户需手动下载并安装一次 v1.0.1，之后 Windows 安装版即可使用应用内更新。

## 功能特性

- ⌨️ 实时按键显示（支持组合键）
- 长按持续高亮，松开后淡出；连续重复按键合并为次数
- 固定键盘面板：WASD / 方向键布局，包含 Shift、Space、Ctrl
- 自定义键盘布局：完整键盘模板、按键增删与排序、行编辑、键宽、标签和空白间隔，可保存多套布局
- 配置 JSON 导入与导出，包含主题、自定义 CSS、布局与显示参数，导入前显示确认摘要
- 键盘面板大小可在 60%–160% 间按 10% 调整，并实时预览
- 一键暂停与恢复：设置、托盘或全局快捷键
- 六套内置主题，以及可命名保存的自定义按键 CSS 样式
- Windows 安装版支持检查更新、下载进度与安装后重启
- 🖱️ 滚轮方向与鼠标中键显示
- 🔊 音量增大、减小与静音键显示
- 🎯 可拖拽的显示位置
- 🖥️ 设置内可视化编辑位置并实时预览
- 🖥️ 自动检测多屏幕，支持切换目标屏幕并适配不同分辨率与缩放比例
- ⏱️ 可调节的淡出动画
- 🚀 开机自启动支持
- 🌐 设置界面支持简体中文 / English 切换
- 🖥️ 提供 Windows 安装版与便携版；源码包含 macOS / Linux 打包配置

## 多屏幕使用

1. 打开设置，在“位置 → 目标屏幕”中选择显示器。
2. 在所选屏幕上选择位置预设，或拖动屏幕预览中的标记；X / Y 坐标会同步更新。
3. 屏幕切换时保留浮层的相对位置。屏幕拔出后自动回到主屏；分辨率、旋转或缩放变化时，位置与预览自动更新。

界面中的“逻辑分辨率”和 X / Y 使用系统逻辑坐标，缩放比例单独显示；它们可能与显示器的物理像素数不同。浮层保持在所选屏幕的工作区内，避开任务栏。小屏幕容纳不下设定的全部记录时，会优先显示最新记录。

多屏幕功能从 v1.0.1 起包含在下载包中。

## 按键显示与暂停

在设置的“显示模式”中选择“按键记录”或“键盘面板”。记录模式下，按住的键保持高亮，松开后按设定时间淡出；800ms 内连续按下相同组合会合并为 `×N`，长按产生的系统重复事件也会合并。固定面板可选择 WASD 或方向键布局，按下、松开时实时更新高亮。

设置分为“显示、位置、样式、应用”四页。“显示”页集中管理启用、暂停和显示模式，并只展示当前模式的设置。选择键盘面板后可调整布局和大小，比例从 60% 到 160%，每档 10%；预览随设置更新。“位置”页的屏幕预览与浮层窗口会使用同一比例，放大时会尽量保持原有的靠右、靠下位置。键盘面板比例不会改变按键记录模式的大小。

启用显示后，点击设置或托盘中的“暂停显示”可隐藏浮层并停止输入监听。“恢复显示”会重新开始监听，不重放暂停期间的输入。Windows / Linux 快捷键为 `Ctrl+Shift+F9`，macOS 为 `Cmd+Shift+F9`。快捷键注册状态会显示在设置中；快捷键不可用时仍可使用按钮或托盘。暂停状态保存在配置中，重新启动应用后仍保持暂停。

这些功能从 v1.0.1 起包含在下载包中。

## 自定义键盘布局与配置备份

在“显示 → 键盘面板 → 按键布局”中点击“编辑布局”。可从 WASD、方向键或完整键盘开始，编辑行和按键顺序，调整键宽与显示名称，也可以选择“空白间隔”。方向按钮分别调整行或选中按键的位置。字母、数字、F1–F12、方向键、导航键、数字小键盘及左右修饰键均可选择；显示名称只改变键帽文字，不改变监听的物理按键。

“保存并使用”会保存并切换到当前布局，“另存为”保留原布局并新建一套。草稿只影响预览，切换设置页时保留；保存后重启仍可使用。最多保存 20 套布局，每套 1–8 行，每行最多 20 个键，键宽为 0.5–8 个标准键宽，每档 0.25。窗口尺寸、屏幕位置预览及按键高亮同步适配布局；屏幕容纳不下时按比例缩小。

在“应用 → 配置管理”中导出 JSON 备份，或选择之前导出的文件进行导入。备份包含显示模式、布局、大小、主题、自定义 CSS、语言与记录参数。导出会等待正在进行的设置保存完成；未保存的布局或 CSS 草稿不包含在备份中。

导入先校验格式、版本、布局与 CSS，再显示当前设置和导入设置的对比；点击“应用配置”后才保存。导入会替换已保存的布局与样式列表，建议先导出当前配置。目标屏幕、开机启动、启用与暂停状态使用本机设置；勾选“同时恢复显示位置”可恢复坐标，超出本机屏幕范围时自动调整。导入文件最大 2 MB，当前备份格式版本为 1。

这两项功能目前包含在源码和本地构建中，尚未加入已发布的 v1.0.1 下载包。

## 主题与自定义样式

设置中的“按键样式”提供经典磨砂、纸白键帽、薄荷终端、霓虹电竞、高对比教学、极简描边六套主题，按键记录与固定键盘面板共用主题。

选择基础主题后可以编辑 CSS，预览会实时显示草稿效果；填写名称并保存后，样式进入自定义列表，可再次选择、修改或另存。草稿不会自动覆盖已保存样式，CSS 出错时预览保留最后一次有效样式。保存后重启应用仍可使用；最多保存 20 套，每套 CSS 最长 16000 个字符。

可用选择器：`.kv-key`（键帽）、`.kv-row`（按键记录行）、`.kv-panel`（键盘面板）、`.kv-plus`（组合键分隔符）、`.kv-count`（重复次数）。按键元素提供 `data-key`、`data-held` 和 `data-role` 属性，例如：

```css
.kv-key {
  border-radius: 6px;
  font-weight: 600;
}

.kv-key[data-held="true"] {
  background: #69e0a5;
  color: #102619;
}

.kv-key[data-key="Space"] {
  border-color: #69e0a5;
}
```

自定义 CSS 限定在按键显示区域内，支持普通规则、`@media` 与 `@supports`；不支持资源加载规则、`url()`、CSS 嵌套及全局动画定义。固定浮层的尺寸仍由显示模式和屏幕工作区确定，超出窗口的样式会裁剪；字体、边框和阴影可在预览中检查。

## 应用内更新

Windows 安装版会在启动约 15 秒后检查 GitHub Releases，此后每 6 小时检查一次；也可在“应用 → 版本更新”中手动检查。发现新版时会显示系统通知，设置页可查看版本、下载进度，并在下载完成后点击“安装并重启”。下载和安装不会自动打断正在使用的应用。开发版、便携版及当前未配置安装更新的其他平台会在设置中显示不可用原因。

此功能从 v1.0.1 起提供；已发布的 v1.0.0 没有更新客户端，也缺少 `latest.yml`，因此需要手动安装一次 v1.0.1。以后发布 Windows 新版时，先递增 `package.json` 版本，再构建并将 `Keystroke.Visualizer.Setup.<version>.exe`、对应 `.blockmap` 和 `latest.yml` 上传到同一个 `v<version>` GitHub Release。`latest.yml` 与安装包的文件名和校验值必须保持一致；便携版文件可一起发布供手动下载。带 `GH_TOKEN` 的发布流程也可使用 `electron-builder --win --publish always` 上传这些文件。

## 技术栈

- **框架**: Electron 28+
- **前端**: React 18 + TypeScript
- **样式**: Tailwind CSS
- **键盘监听**: uiohook-napi
- **配置存储**: electron-store
- **构建工具**: Vite
- **打包工具**: electron-builder

## 开发

### 安装依赖

```bash
npm ci
```

### 启动开发服务器

```bash
npm run electron:dev
```

### 构建 Windows 安装包

```bash
npm run build:win
```

### 开发验证

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## 项目结构

```
keystroke-visualizer/
├── src/
│   ├── main/           # Electron 主进程
│   ├── renderer/       # 前端渲染进程
│   │   ├── overlay/    # 按键显示窗口
│   │   ├── settings/   # 设置窗口
│   │   └── shared/     # 共享代码
│   └── preload/        # 预加载脚本
├── resources/          # 托盘图标等资源
└── docs/               # 文档
```

## 许可证

[MIT](LICENSE)
