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

  // Listen for key press events
  onKeyPressed: (callback: (event: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, keyEvent: unknown) => callback(keyEvent);
    ipcRenderer.on(IPC_CHANNELS.KEY_PRESSED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.KEY_PRESSED, handler);
  },

  // Get current preset name for a position
  getPresetName: (position: { x: number; y: number }) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_PRESET_NAME, position);
  },

  // Save current window position to config
  savePosition: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.UPDATE_POSITION);
  },

  // Set mouse pass-through
  setMousePassThrough: (enabled: boolean) => {
    return ipcRenderer.invoke(IPC_CHANNELS.SET_MOUSE_PASSTHROUGH, enabled);
  },
});
