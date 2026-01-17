// Preload script for Overlay window
// TODO: 实现完整的 preload 逻辑

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 获取配置
  getConfig: () => ipcRenderer.invoke('get-config'),

  // 监听配置变更
  onConfigChanged: (callback: (config: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, config: unknown) => callback(config)
    ipcRenderer.on('config-changed', handler)
    return () => ipcRenderer.removeListener('config-changed', handler)
  },

  // 监听按键事件
  onKeyPressed: (callback: (event: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, keyEvent: unknown) => callback(keyEvent)
    ipcRenderer.on('key-pressed', handler)
    return () => ipcRenderer.removeListener('key-pressed', handler)
  },

  // 更新窗口位置
  updatePosition: (position: { x: number; y: number }) => {
    ipcRenderer.send('update-position', position)
  },

  // 设置鼠标穿透
  setIgnoreMouseEvents: (ignore: boolean) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore)
  },
})
