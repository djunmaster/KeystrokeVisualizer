import { app, Tray, Menu, nativeImage, NativeImage } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import { WindowManager } from './WindowManager';
import { ConfigStore } from './ConfigStore';
import { IPC_CHANNELS } from '../renderer/shared/types';

const labels = {
  'zh-CN': {
    appName: '按键可视化工具',
    enableDisplay: '显示按键',
    openSettings: '打开设置',
    quit: '退出',
  },
  'en-US': {
    appName: 'Keystroke Visualizer',
    enableDisplay: 'Enable Display',
    openSettings: 'Open Settings',
    quit: 'Quit',
  },
} as const;

/**
 * Tray icon manager.
 * Manages system tray icon and context menu.
 */
export class TrayManager {
  private tray: Tray | null = null;
  private subscribedToConfig = false;
  private windowManager: WindowManager;
  private configStore: ConfigStore;

  constructor(windowManager: WindowManager, configStore: ConfigStore) {
    this.windowManager = windowManager;
    this.configStore = configStore;
  }

  /**
   * Create and setup tray icon.
   */
  create(): void {
    if (this.tray) return;

    const icon = this.getTrayIcon();
    this.tray = new Tray(icon);

    this.tray.setToolTip(labels[this.configStore.get('language')].appName);

    // Double-click to open settings (Windows only)
    if (process.platform === 'win32') {
      this.tray.on('double-click', () => {
        this.windowManager.showSettings();
      });
    }

    // Build and set context menu
    this.updateContextMenu();

    // Listen for config changes to update menu
    if (!this.subscribedToConfig) {
      this.configStore.onDidChange((newConfig, oldConfig) => {
        const enabledChanged = oldConfig?.isEnabled !== newConfig.isEnabled;
        const languageChanged = oldConfig?.language !== newConfig.language;
        if (!enabledChanged && !languageChanged) return;
        if (languageChanged) this.tray?.setToolTip(labels[newConfig.language].appName);
        this.updateContextMenu();
        if (enabledChanged) this.updateIcon(newConfig.isEnabled);
      });
      this.subscribedToConfig = true;
    }
  }

  /**
   * Update context menu based on current state.
   */
  private updateContextMenu(): void {
    if (!this.tray) return;

    const isEnabled = this.configStore.get('isEnabled');
    const t = labels[this.configStore.get('language')];

    const contextMenu = Menu.buildFromTemplate([
      {
        label: t.enableDisplay,
        type: 'checkbox',
        checked: isEnabled,
        click: () => {
          const newState = this.configStore.toggleEnabled();
          // Broadcast config change to all windows
          this.windowManager.sendToAll(IPC_CHANNELS.CONFIG_CHANGED, this.configStore.getConfig());
          if (newState) {
            this.windowManager.showOverlay();
          } else {
            this.windowManager.hideOverlay();
          }
        },
      },
      {
        type: 'separator',
      },
      {
        label: t.openSettings,
        click: () => {
          this.windowManager.showSettings();
        },
      },
      {
        type: 'separator',
      },
      {
        label: t.quit,
        click: () => {
          this.windowManager.setQuitting(true);
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Update tray icon based on enabled state.
   */
  private updateIcon(isEnabled: boolean): void {
    if (!this.tray) return;

    const icon = this.getTrayIcon(isEnabled);
    this.tray.setImage(icon);
  }

  /**
   * Get tray icon based on platform and state.
   * Falls back to programmatically created icon if file not found.
   */
  private getTrayIcon(isEnabled?: boolean): NativeImage {
    const state = isEnabled ?? this.configStore.get('isEnabled');
    const iconPath = this.getTrayIconPath(state);

    // Try to load icon from file
    if (existsSync(iconPath)) {
      return nativeImage.createFromPath(iconPath);
    }

    // Fallback: create a simple colored icon programmatically
    return this.createFallbackIcon(state);
  }

  /**
   * Get tray icon file path based on platform and state.
   */
  private getTrayIconPath(isEnabled: boolean): string {
    const iconName = isEnabled ? 'tray-on' : 'tray-off';

    // Check multiple possible locations
    const possiblePaths = [
      // Development: relative to dist/main
      join(__dirname, `../../resources/tray-icons/${iconName}.png`),
      // Production: extraResources location
      join(process.resourcesPath || '', `tray-icons/${iconName}.png`),
    ];

    if (process.platform === 'darwin') {
      // macOS: prefer Template icons
      possiblePaths.unshift(
        join(__dirname, `../../resources/tray-icons/${iconName}Template.png`),
        join(process.resourcesPath || '', `tray-icons/${iconName}Template.png`)
      );
    } else if (process.platform === 'win32') {
      // Windows: prefer .ico format, fallback to .png
      possiblePaths.unshift(
        join(__dirname, `../../resources/tray-icons/${iconName}.ico`),
        join(process.resourcesPath || '', `tray-icons/${iconName}.ico`)
      );
    }

    // Return first existing path, or first path as fallback
    for (const p of possiblePaths) {
      if (existsSync(p)) {
        return p;
      }
    }
    return possiblePaths[0];
  }

  /**
   * Create a simple fallback icon programmatically.
   */
  private createFallbackIcon(isEnabled: boolean): NativeImage {
    const size = 16;
    const color = isEnabled ? { r: 76, g: 175, b: 80 } : { r: 158, g: 158, b: 158 };

    // Create a simple colored square icon
    const canvas = Buffer.alloc(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      canvas[i * 4] = color.r;     // R
      canvas[i * 4 + 1] = color.g; // G
      canvas[i * 4 + 2] = color.b; // B
      canvas[i * 4 + 3] = 255;     // A
    }

    return nativeImage.createFromBuffer(canvas, {
      width: size,
      height: size,
    });
  }

  /**
   * Destroy tray icon.
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
