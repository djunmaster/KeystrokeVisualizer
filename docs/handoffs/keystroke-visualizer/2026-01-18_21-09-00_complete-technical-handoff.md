---
date: 2026-01-18T13:09:00Z
session_name: keystroke-visualizer
git_commit: 6838f71e8131347c06c8787ae7356bd05e54b0e5
branch: master
repository: local
topic: "Keystroke Visualizer - Complete Technical Handoff Document"
tags: [implementation, electron, react, typescript, uiohook, tailwindcss, complete-handoff]
status: complete
outcome: SUCCESS
---

# Keystroke Visualizer - 完整技术交接文档

## 项目概述

Keystroke Visualizer 是一个桌面级按键可视化工具，用于实时显示用户的键盘输入。适用于录屏、直播、教程制作等场景。

### 核心功能

1. **实时按键显示** - 捕获全局键盘输入并在屏幕上显示
2. **组合键支持** - 正确显示 Ctrl+C、Alt+Tab 等组合键
3. **可配置位置** - 支持6个预设位置（四角+上下中）
4. **拖拽移动** - 可通过拖拽手柄移动overlay窗口
5. **淡出动画** - 按键显示后自动淡出
6. **系统托盘** - 最小化到托盘运行
7. **开机自启** - 可选开机自动启动

---

## 技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **运行时** | Electron | ^28.0.0 | 跨平台桌面应用框架 |
| **前端框架** | React | ^18.2.0 | UI组件库 |
| **语言** | TypeScript | ^5.3.3 | 类型安全 |
| **构建工具** | Vite | ^5.0.10 | 开发服务器和打包 |
| **样式** | TailwindCSS | ^3.4.0 | 原子化CSS |
| **键盘监听** | uiohook-napi | ^1.5.4 | 全局键盘钩子 |
| **配置存储** | electron-store | ^8.1.0 | 持久化配置 |
| **打包** | electron-builder | ^24.9.1 | 应用打包分发 |

### 关键依赖说明

#### uiohook-napi
- 原生Node.js模块，用于全局键盘监听
- **重要**：键码是非连续的，必须显式映射每个键
- 支持Windows/macOS/Linux

#### electron-store
- 基于JSON的配置持久化
- 自动处理配置迁移（通过与DEFAULT_CONFIG合并）

---

## 项目结构

```
demo-按键可视化工具/
├── src/
│   ├── main/                    # Electron主进程
│   │   ├── index.ts             # 入口点，应用生命周期
│   │   ├── ConfigStore.ts       # 配置管理
│   │   ├── WindowManager.ts     # 窗口管理
│   │   ├── TrayManager.ts       # 系统托盘
│   │   ├── KeyListener.ts       # 键盘监听
│   │   └── ipc-handlers.ts      # IPC通道处理
│   │
│   ├── preload/                 # Preload脚本（安全桥接）
│   │   ├── overlay.ts           # Overlay窗口API
│   │   └── settings.ts          # Settings窗口API
│   │
│   └── renderer/                # 渲染进程（React）
│       ├── overlay/             # Overlay窗口
│       │   ├── App.tsx          # 主组件
│       │   ├── components/
│       │   │   ├── KeyDisplay.tsx   # 按键列表显示
│       │   │   ├── KeyItem.tsx      # 单个按键块
│       │   │   └── DragHandle.tsx   # 拖拽手柄
│       │   ├── index.html
│       │   └── main.tsx
│       │
│       ├── settings/            # Settings窗口
│       │   ├── App.tsx          # 设置页面
│       │   ├── components/
│       │   │   ├── PositionSetting.tsx      # 位置设置
│       │   │   ├── AnimationSetting.tsx     # 动画设置
│       │   │   ├── DisplayCountSetting.tsx  # 显示数量设置
│       │   │   └── StartupSetting.tsx       # 启动设置
│       │   ├── index.html
│       │   └── main.tsx
│       │
│       └── shared/              # 共享代码
│           ├── types/index.ts   # 类型定义和常量
│           └── styles/global.css # 全局样式
│
├── resources/                   # 资源文件
│   └── tray-icons/              # 托盘图标
│
├── docs/
│   ├── plans/                   # 设计文档
│   └── handoffs/                # 交接文档
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── electron-builder.yml
```

---

## 核心模块详解

### 1. ConfigStore（配置存储）

**文件**: `src/main/ConfigStore.ts`

```typescript
interface ConfigState {
  isEnabled: boolean;        // 是否启用显示
  position: Position;        // 窗口位置 {x, y}
  fadeOutDuration: number;   // 淡出时间(ms)
  autoStart: boolean;        // 开机自启
  maxDisplayCount: number;   // 最大显示块数
}

const DEFAULT_CONFIG: ConfigState = {
  isEnabled: false,
  position: { x: -1, y: -1 },  // -1表示使用默认位置
  fadeOutDuration: 1000,
  autoStart: false,
  maxDisplayCount: 6,
};
```

**配置迁移机制**:
```typescript
getConfig(): ConfigState {
  // 与默认配置合并，确保新增字段有默认值
  return { ...DEFAULT_CONFIG, ...this.store.store };
}
```

### 2. WindowManager（窗口管理）

**文件**: `src/main/WindowManager.ts`

管理两个窗口：
- **Overlay窗口**: 透明、置顶、无边框、鼠标穿透
- **Settings窗口**: 标准窗口，关闭时隐藏而非销毁

**关键方法**:

| 方法 | 用途 |
|------|------|
| `createOverlayWindow(config)` | 创建Overlay窗口 |
| `createSettingsWindow()` | 创建Settings窗口 |
| `updateOverlayPosition(x, y)` | 更新窗口位置 |
| `updateOverlaySize(count)` | 根据显示数量调整窗口大小 |
| `validatePosition(x, y, count)` | 验证位置坐标 |
| `getPresetPosition(preset)` | 获取预设位置坐标 |
| `detectPresetFromPosition(pos)` | 从坐标检测预设名称 |
| `getOverlayDimensions(count)` | 计算窗口尺寸 |

**窗口尺寸计算**:
```typescript
private getOverlayDimensions(maxDisplayCount?: number) {
  const width = 400;
  const count = maxDisplayCount ?? 6;
  const itemHeight = 54;  // 每个按键块高度
  const gap = 8;          // 间距
  const padding = 16;     // 内边距
  const height = padding * 2 + count * itemHeight + (count - 1) * gap;
  return { width, height };
}
```

### 3. KeyListener（键盘监听）

**文件**: `src/main/KeyListener.ts`

使用uiohook-napi监听全局键盘事件。

**修饰键状态追踪**:
```typescript
private modifierState = {
  ctrl: false,
  shift: false,
  alt: false,
  meta: false,
};
```

**键码映射**（重要！）:
```typescript
// uiohook键码是非连续的，必须显式映射
this.keyNameMap.set(UiohookKey.A, 'A');
this.keyNameMap.set(UiohookKey.B, 'B');
// ... 不能用 UiohookKey.A + i 计算！
```

**事件发送**:
```typescript
private handleKeyDown(event: UiohookKeyboardEvent) {
  // 更新修饰键状态
  this.updateModifierState(keyCode, true);

  // 只发送非修饰键
  if (!this.isModifierKey(keyCode)) {
    const displayKeys = this.getDisplayKeys(keyCode);
    this.windowManager.sendToOverlay(IPC_CHANNELS.KEY_PRESSED, {
      keys: displayKeys,
      timestamp: Date.now(),
    });
  }
}
```

### 4. TrayManager（系统托盘）

**文件**: `src/main/TrayManager.ts`

功能：
- 托盘图标（启用/禁用状态不同图标）
- 右键菜单：启用切换、设置、退出
- Windows双击打开设置

**图标加载顺序**:
1. 尝试从resources目录加载
2. 尝试从extraResources加载（生产环境）
3. 使用程序生成的彩色方块作为fallback

### 5. IPC通道

**文件**: `src/renderer/shared/types/index.ts`

```typescript
const IPC_CHANNELS = {
  // 键盘事件
  KEY_PRESSED: 'key-pressed',

  // 配置管理
  CONFIG_CHANGED: 'config-changed',
  UPDATE_CONFIG: 'update-config',
  GET_CONFIG: 'get-config',

  // 位置管理
  UPDATE_POSITION: 'update-position',
  GET_PRESET_POSITION: 'get-preset-position',
  GET_PRESET_NAME: 'get-preset-name',

  // 窗口控制
  TOGGLE_ENABLED: 'toggle-enabled',
  OPEN_SETTINGS: 'open-settings',
  SET_MOUSE_PASSTHROUGH: 'set-mouse-passthrough',
  // ...
};
```

---

## 数据流架构

### 配置变更流程

```
用户操作(Settings)
    ↓
Settings Renderer → IPC: UPDATE_CONFIG
    ↓
Main Process: ipc-handlers.ts
    ↓
ConfigStore.updateConfig() → 保存到磁盘
    ↓
WindowManager.sendToAll(CONFIG_CHANGED) → 广播
    ↓
├── Settings Renderer: onConfigChanged → 更新UI
└── Overlay Renderer: onConfigChanged → 更新显示
```

### 按键事件流程

```
用户按键
    ↓
uiohook-napi: keydown event
    ↓
KeyListener.handleKeyDown()
    ↓
├── 更新modifierState
└── 如果非修饰键:
        ↓
    构建displayKeys数组 [Ctrl, Shift, A]
        ↓
    WindowManager.sendToOverlay(KEY_PRESSED)
        ↓
    Overlay Renderer: onKeyPressed callback
        ↓
    KeyDisplay: 添加到keyPresses状态
        ↓
    React渲染 → KeyItem显示
```

### 位置同步流程

```
用户拖拽Overlay
    ↓
DragHandle: mouseup event
    ↓
IPC: UPDATE_POSITION
    ↓
Main: 获取窗口实际位置
    ↓
ConfigStore.set('position', {x, y})
    ↓
广播 CONFIG_CHANGED
    ↓
├── Settings: 更新下拉框（自动检测preset）
└── Overlay: 更新stackFrom/alignX
```

---

## 渲染器组件

### Overlay窗口

#### App.tsx
```typescript
// 根据位置决定显示方向
const stackFrom = preset.startsWith('top') ? 'top' : 'bottom';
const alignX = preset.includes('left') ? 'left'
             : preset.includes('center') ? 'center'
             : 'right';
```

#### KeyDisplay.tsx
```typescript
// 堆叠方向类
const stackClass = stackFrom === 'bottom' ? 'justify-end' : 'justify-start';
// 水平对齐类
const alignClass = alignX === 'left' ? 'items-start'
                 : alignX === 'center' ? 'items-center'
                 : 'items-end';
// 渲染顺序
const orderedKeyPresses = stackFrom === 'top'
  ? [...keyPresses].reverse()
  : keyPresses;
```

#### KeyItem.tsx
```typescript
// 淡出动画
useEffect(() => {
  const animate = () => {
    const elapsed = Date.now() - timestamp;
    const newOpacity = Math.max(0, 1 - elapsed / fadeOutDuration);
    setOpacity(newOpacity);
    if (newOpacity > 0) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}, []);
```

#### DragHandle.tsx
- 悬停时显示拖拽图标
- 拖拽时禁用鼠标穿透
- 释放时保存位置并恢复穿透

### Settings窗口

#### PositionSetting.tsx
- 6个预设位置（移除了Custom选项）
- 通过IPC获取主进程计算的预设坐标
- 位置变化时自动检测最近预设

#### DisplayCountSetting.tsx
- 滑块控件：1-12个块
- 实时更新Overlay窗口大小

---

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式
npm run electron:dev

# 类型检查
npm run typecheck

# 构建
npm run build

# 打包Windows版本
npm run build:win

# 打包macOS版本
npm run build:mac

# 打包Linux版本
npm run build:linux
```

---

## 关键学习点

### 成功经验

1. **配置迁移**: `{ ...DEFAULT_CONFIG, ...stored }` 确保新字段有默认值
2. **主进程计算坐标**: 使用Electron screen API确保多显示器准确
3. **显式键码映射**: uiohook键码非连续，必须逐个映射
4. **CSS全高度**: `html, body, #root { height: 100% }` 使flex布局生效

### 失败教训

1. **错误假设**: `UiohookKey.A + i` 不能计算字母键码
2. **toggle尺寸**: 初始translate-x-8/w-14导致溢出，需精确计算
3. **窗口高度**: 200px不够显示6个块，需动态计算

### 设计决策

1. **单显示器支持**: 简化预设位置计算
2. **移除Custom选项**: 自动检测最近预设，用户体验更好
3. **默认6个块**: 信息密度和可见性的平衡
4. **最大12个块**: 限制防止窗口过大

---

## 当前状态

### 已完成功能

- [x] 全局键盘监听
- [x] 组合键显示（Ctrl+Alt+Delete等）
- [x] 6个预设位置
- [x] 拖拽移动
- [x] 配置持久化
- [x] 系统托盘
- [x] 开机自启
- [x] 淡出动画
- [x] 可配置显示块数（1-12）
- [x] 动态窗口大小
- [x] 智能堆叠方向（top/bottom位置自动适配）
- [x] 水平对齐（left/center/right）

### 待实现功能（低优先级）

- [ ] 多显示器完整支持
- [ ] 自定义应用图标
- [ ] 国际化支持
- [ ] 主题自定义
- [ ] 按键过滤（忽略某些键）
- [ ] 鼠标点击显示

---

## 文件修改清单（当前会话）

### 主进程

| 文件 | 改动 |
|------|------|
| `src/main/WindowManager.ts` | 动态窗口尺寸；多显示器支持；detectPresetFromPosition |
| `src/main/ipc-handlers.ts` | 新增GET_PRESET_NAME；updateOverlaySize调用 |

### Preload

| 文件 | 改动 |
|------|------|
| `src/preload/overlay.ts` | 新增getPresetName API |
| `src/preload/settings.ts` | 新增getPresetName API |

### 渲染器

| 文件 | 改动 |
|------|------|
| `src/renderer/overlay/App.tsx` | stackFrom + alignX计算 |
| `src/renderer/overlay/components/KeyDisplay.tsx` | h-full；alignX支持；maxDisplayCount裁剪 |
| `src/renderer/settings/components/PositionSetting.tsx` | 移除Custom；使用主进程检测preset |
| `src/renderer/settings/components/DisplayCountSetting.tsx` | max从10改为12 |
| `src/renderer/shared/types/index.ts` | 新增GET_PRESET_NAME常量 |
| `src/renderer/shared/styles/global.css` | 添加html/body/root高度100% |

---

## 快速上手

### 1. 克隆并安装

```bash
git clone <repo>
cd demo-按键可视化工具
npm install
```

### 2. 开发模式运行

```bash
npm run electron:dev
```

### 3. 测试要点

1. 启动后检查托盘图标
2. 右键托盘 → Enable Display
3. 按键测试：单键、组合键、功能键
4. 设置界面：位置、淡出时间、显示数量
5. 拖拽Overlay窗口
6. 不同位置的堆叠方向

### 4. 构建发布

```bash
npm run build:win  # Windows
npm run build:mac  # macOS
npm run build:linux  # Linux
```

---

## 联系与支持

如有问题，请查阅：
- `docs/plans/2025-01-17-keystroke-visualizer-design.md` - 原始设计文档
- 之前的handoff文档 - 历史问题和解决方案

---

*Handoff created: 2026-01-18T13:09:00Z*
*Resume command: `/resume-handoff docs/handoffs/keystroke-visualizer/2026-01-18_21-09-00_complete-technical-handoff.md`*
