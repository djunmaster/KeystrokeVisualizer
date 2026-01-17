# Keystroke Visualizer

按键可视化工具 - 实时显示键盘按键的跨平台桌面应用。

## 功能特性

- ⌨️ 实时按键显示（支持组合键）
- 🎯 可拖拽的显示位置
- ⏱️ 可调节的淡出动画
- 🚀 开机自启动支持
- 🖥️ 跨平台支持（Windows / macOS）

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
npm install
```

### 启动开发服务器

```bash
npm run electron:dev
```

### 构建应用

```bash
npm run electron:build
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
├── assets/             # 静态资源
└── docs/               # 文档
```

## 许可证

MIT
