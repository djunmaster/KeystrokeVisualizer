// Main Process 入口文件
// TODO: 实现完整的主进程逻辑

import { app, BrowserWindow } from 'electron'
import { join } from 'path'

// 防止应用多开
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

let overlayWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 400,
    height: 200,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/overlay.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 设置鼠标穿透
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })

  // 加载 Overlay 页面
  if (process.env.NODE_ENV === 'development') {
    overlayWindow.loadURL('http://localhost:5173/src/renderer/overlay/index.html')
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/overlay/index.html'))
  }
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 400,
    resizable: false,
    center: true,
    title: '按键可视化工具 - 设置',
    webPreferences: {
      preload: join(__dirname, '../preload/settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 加载 Settings 页面
  if (process.env.NODE_ENV === 'development') {
    settingsWindow.loadURL('http://localhost:5173/src/renderer/settings/index.html')
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/settings/index.html'))
  }

  // 关闭时隐藏而非退出
  settingsWindow.on('close', (event) => {
    event.preventDefault()
    settingsWindow?.hide()
  })
}

app.whenReady().then(() => {
  createOverlayWindow()

  // TODO: 初始化 TrayManager
  // TODO: 初始化 KeyListener
  // TODO: 初始化 ConfigStore
  // TODO: 设置 IPC handlers
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createOverlayWindow()
  }
})

// 导出窗口引用供其他模块使用
export { overlayWindow, settingsWindow, createSettingsWindow }
