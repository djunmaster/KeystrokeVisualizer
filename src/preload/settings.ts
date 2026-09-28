import { contextBridge, ipcRenderer } from 'electron';
import { ConfigState, IPC_CHANNELS, KeyboardPanelSize } from '../renderer/shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  // Get current config
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG),

  getPauseShortcutStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PAUSE_SHORTCUT_STATUS),

  getUpdateStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_UPDATE_STATUS),
  checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.CHECK_FOR_UPDATES),
  downloadUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_UPDATE),
  installUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.INSTALL_UPDATE),
  onUpdateStatusChanged: (callback: (status: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown) => callback(status);
    ipcRenderer.on(IPC_CHANNELS.UPDATE_STATUS_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_STATUS_CHANGED, handler);
  },

  // Listen for config changes
  onConfigChanged: (callback: (config: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, config: unknown) => callback(config);
    ipcRenderer.on(IPC_CHANNELS.CONFIG_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CONFIG_CHANGED, handler);
  },

  // Update config
  updateConfig: (partial: unknown) => {
    return ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CONFIG, partial);
  },

  // Get preset position (calculated in main process with Electron screen API)
  getPresetPosition: (preset: string, displayId?: number) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_PRESET_POSITION, preset, displayId);
  },

  // Get current preset name for a position
  getPresetName: (position: { x: number; y: number }, displayId?: number) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_PRESET_NAME, position, displayId);
  },
  exportConfig: () => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_CONFIG),
  previewConfigImport: () => ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_CONFIG_IMPORT),
  applyConfigImport: (token: string, includePosition: boolean) => ipcRenderer.invoke(IPC_CHANNELS.APPLY_CONFIG_IMPORT, token, includePosition),

  getPositionPreview: (position: { x: number; y: number }, maxDisplayCount: number, displayId?: number,
    displayMode?: ConfigState['displayMode'], keyboardScale?: number, keyboardSize?: KeyboardPanelSize) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_POSITION_PREVIEW, position, maxDisplayCount, displayId, displayMode, keyboardScale, keyboardSize);
  },

  getDisplays: () => ipcRenderer.invoke(IPC_CHANNELS.GET_DISPLAYS),

  onDisplaysChanged: (callback: (displays: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, displays: unknown) => callback(displays);
    ipcRenderer.on(IPC_CHANNELS.DISPLAYS_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DISPLAYS_CHANGED, handler);
  },
});
