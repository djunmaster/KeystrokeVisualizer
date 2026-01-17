# 按键可视化工具 (Keystroke Visualizer) 设计文档

> 创建日期: 2025-01-17
> 状态: 已批准
> 版本: V1

---

## 1. 概述

### 1.1 产品描述

按键可视化工具是一款桌面应用程序，用于实时显示用户按下的键盘按键。主要面向录屏、直播、演示和个人使用等多种场景。

### 1.2 目标平台

- Windows 10+
- macOS

### 1.3 技术栈

| 类别 | 技术 |
|------|------|
| 核心框架 | Electron 28+ |
| 前端框架 | React 18+ |
| 类型系统 | TypeScript 5+ |
| 样式框架 | Tailwind CSS |
| 键盘监听 | uiohook-napi |
| 配置存储 | electron-store |
| 应用打包 | electron-builder |
| 构建工具 | Vite |

---

## 2. V1 功能范围

| 序号 | 功能 | 描述 |
|------|------|------|
| 1 | 基础按键显示 | 支持单键和组合键显示 |
| 2 | 系统托盘 | 托盘图标 + 右键菜单（开启/关闭） |
| 3 | 位置可拖拽 | 用户可拖动显示位置到任意位置 |
| 4 | 淡出动画 | 按键显示后自动淡出，可设置持续时间 |
| 5 | 开机自启动 | 可选是否开机自动启动 |
| 6 | 设置界面 | 统一的配置入口 |

---

## 3. 架构设计

### 3.1 整体架构（双窗口分离模式）

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Process                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ TrayManager  │  │ KeyListener  │  │ ConfigStore          │   │
│  │ - 托盘图标    │  │ - 全局键盘钩子│  │ - electron-store     │   │
│  │ - 右键菜单    │  │ - 按键事件    │  │ - 持久化配置         │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│         │                  │                    │                │
│         │                  │     IPC 通信       │                │
│         ▼                  ▼                    ▼                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   WindowManager                          │    │
│  │   管理 Overlay 窗口 和 Settings 窗口的生命周期            │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                    │                           │
                    ▼                           ▼
     ┌──────────────────────────┐    ┌──────────────────────────┐
     │     Overlay Window       │    │    Settings Window       │
     │  - 透明无边框窗口         │    │  - 常规设置窗口           │
     │  - 按键显示组件           │    │  - 配置界面              │
     │  - 拖拽控制              │    │                          │
     └──────────────────────────┘    └──────────────────────────┘
```

### 3.2 核心模块职责

| 模块 | 职责 |
|------|------|
| TrayManager | 管理系统托盘图标，处理右键菜单事件 |
| KeyListener | 使用 uiohook-napi 监听全局键盘事件 |
| ConfigStore | 使用 electron-store 持久化用户配置 |
| WindowManager | 统一管理两个窗口的创建、显示、隐藏 |
| Overlay Window | 透明悬浮窗，显示按键 |
| Settings Window | 标准设置窗口，配置各项参数 |

---

## 4. 项目目录结构

```
keystroke-visualizer/
├── package.json
├── electron-builder.yml          # 打包配置
├── tsconfig.json
│
├── src/
│   ├── main/                     # Main Process (Electron 主进程)
│   │   ├── index.ts              # 入口文件
│   │   ├── tray.ts               # TrayManager - 托盘管理
│   │   ├── key-listener.ts       # KeyListener - 键盘监听
│   │   ├── config-store.ts       # ConfigStore - 配置存储
│   │   ├── window-manager.ts     # WindowManager - 窗口管理
│   │   └── ipc-handlers.ts       # IPC 通信处理
│   │
│   ├── renderer/                 # Renderer Process (前端)
│   │   ├── overlay/              # Overlay 窗口
│   │   │   ├── index.html
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   └── components/
│   │   │       ├── KeyDisplay.tsx       # 按键显示组件
│   │   │       ├── KeyItem.tsx          # 单个按键渲染
│   │   │       └── DragHandle.tsx       # 拖拽控制
│   │   │
│   │   ├── settings/             # Settings 窗口
│   │   │   ├── index.html
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   └── components/
│   │   │       ├── PositionSetting.tsx  # 位置设置
│   │   │       ├── AnimationSetting.tsx # 动画设置
│   │   │       └── StartupSetting.tsx   # 开机自启设置
│   │   │
│   │   └── shared/               # 共享代码
│   │       ├── styles/           # 共享样式
│   │       ├── hooks/            # 共享 React Hooks
│   │       └── types/            # TypeScript 类型定义
│   │
│   └── preload/                  # Preload 脚本 (安全桥接)
│       ├── overlay.ts
│       └── settings.ts
│
├── assets/                       # 静态资源
│   ├── icons/                    # 托盘图标
│   │   ├── tray-on.png           # 开启状态图标
│   │   ├── tray-off.png          # 关闭状态图标
│   │   ├── tray-on@2x.png        # macOS Retina
│   │   └── tray-off@2x.png
│   └── fonts/                    # 自定义字体(可选)
│
└── build/                        # 构建输出
```

---

## 5. 数据流与 IPC 通信

### 5.1 IPC 通道定义

| 通道名 | 方向 | 数据 | 用途 |
|--------|------|------|------|
| `key-pressed` | Main → Overlay | `{ keys: string[], timestamp: number }` | 传递按键事件 |
| `config-changed` | Main → All | `ConfigState` | 配置变更通知 |
| `update-config` | Settings → Main | `Partial<ConfigState>` | 更新配置请求 |
| `toggle-enabled` | Tray → Main | `boolean` | 切换开启/关闭 |
| `get-config` | Renderer → Main | - | 获取当前配置 |
| `update-position` | Overlay → Main | `{x, y}` | 更新窗口位置 |

### 5.2 配置状态结构

```typescript
interface ConfigState {
  isEnabled: boolean;      // 是否开启显示
  position: {x: number, y: number};  // 窗口位置
  fadeOutDuration: number; // 淡出时间(ms)
  autoStart: boolean;      // 开机自启动
}
```

### 5.3 实时配置更新机制

配置更新后，Main Process 通过 `config-changed` 通道广播给所有窗口，实现实时同步。

---

## 6. Overlay 窗口设计

### 6.1 窗口特性

| 特性 | 实现方式 | 说明 |
|------|----------|------|
| 透明背景 | `transparent: true` | 只显示按键内容 |
| 无边框 | `frame: false` | 去除标题栏和边框 |
| 始终置顶 | `alwaysOnTop: true` | 保持在所有窗口之上 |
| 鼠标穿透 | `setIgnoreMouseEvents(true, { forward: true })` | 默认穿透 |
| 跳过任务栏 | `skipTaskbar: true` | 不显示在任务栏 |

### 6.2 拖拽交互

| 状态 | 鼠标穿透 | 视觉反馈 |
|------|----------|----------|
| 正常显示 | ✅ 开启 | 仅显示按键 |
| 鼠标悬停在拖拽区 | ❌ 关闭 | 显示拖拽手柄图标 |
| 拖拽中 | ❌ 关闭 | 窗口跟随鼠标移动 |
| 拖拽结束 | ✅ 开启 | 保存新位置，恢复正常 |

---

## 7. Settings 窗口设计

### 7.1 窗口特性

| 特性 | 值 |
|------|-----|
| 窗口尺寸 | 480 × 400 px |
| 可调整大小 | 否 |
| 窗口位置 | 居中显示 |
| 关闭行为 | 隐藏而非退出 |

### 7.2 设置项

| 设置项 | 控件类型 | 默认值 | 范围 |
|--------|----------|--------|------|
| 启用按键显示 | Toggle 开关 | OFF | - |
| 显示位置 | 下拉菜单 | 右下角 | 预设位置 |
| 淡出时间 | 滑块 | 1000ms | 200-3000ms |
| 开机自启动 | 复选框 | OFF | - |

### 7.3 位置预设

- 右下角（默认）
- 右上角
- 左下角
- 左上角
- 底部居中
- 顶部居中
- 自定义（拖拽设置）

---

## 8. 系统托盘设计

### 8.1 图标状态

| 状态 | 图标 | 说明 |
|------|------|------|
| 关闭 | 灰色/暗淡 | 默认状态 |
| 开启 | 彩色/高亮 | 按键显示已启用 |

### 8.2 右键菜单

| 菜单项 | 行为 |
|--------|------|
| ✓ 开启显示 | 切换显示状态 |
| 打开设置 | 显示 Settings 窗口 |
| 退出 | 完全退出应用 |

### 8.3 双击行为

| 操作系统 | 行为 |
|----------|------|
| Windows | 打开设置窗口 |
| macOS | 不支持（系统限制） |

---

## 9. 平台特定处理

| 功能 | Windows | macOS |
|------|---------|-------|
| 开机自启动 | `app.setLoginItemSettings()` | `app.setLoginItemSettings()` |
| 托盘图标 | `.ico` 格式 | `.png` + @2x 适配 |
| 修饰键显示 | `Ctrl` / `Alt` / `Win` | `⌘` / `⌥` / `⌃` / `⇧` |
| 窗口圆角 | 系统默认 | 可选毛玻璃效果 |

---

## 10. 后续版本规划 (V2+)

| 功能 | 优先级 |
|------|--------|
| 多种主题/皮肤切换 | 高 |
| 鼠标点击可视化 | 高 |
| 全局快捷键切换 | 中 |
| 音效反馈 | 低 |
| OBS/直播集成 | 低 |
