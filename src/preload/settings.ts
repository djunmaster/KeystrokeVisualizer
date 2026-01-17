// Preload script for Settings window
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

  // 更新配置
  updateConfig: (partial: unknown) => {
    ipcRenderer.send('update-config', partial)
  },

  // 切换启用状态
  toggleEnabled: (enabled: boolean) => {
    ipcRenderer.send('toggle-enabled', enabled)
  },
})
