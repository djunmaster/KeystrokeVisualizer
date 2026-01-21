import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../renderer/shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  // Get current config
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG),

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
  getPresetPosition: (preset: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_PRESET_POSITION, preset);
  },

  // Get current preset name for a position
  getPresetName: (position: { x: number; y: number }) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_PRESET_NAME, position);
  },
});
