import { BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { ConfigState, IPC_CHANNELS } from '../renderer/shared/types';
import { ConfigStore } from './ConfigStore';

/**
 * Window lifecycle manager.
 * Manages Overlay and Settings windows.
 */
export class WindowManager {
  private overlayWindow: BrowserWindow | null = null;
  private settingsWindow: BrowserWindow | null = null;
  private configStore: ConfigStore;
  private isQuitting = false;
  private overlayMoveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(configStore: ConfigStore) {
    this.configStore = configStore;
  }

  /**
   * Create Overlay window.
   */
  createOverlayWindow(config: ConfigState): BrowserWindow {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.show();
      return this.overlayWindow;
    }

    // Calculate initial position
    const { x, y } = this.calculateOverlayPosition(config.position, config.maxDisplayCount);
    const { width, height } = this.getOverlayDimensions(config.maxDisplayCount);

    this.overlayWindow = new BrowserWindow({
      width,
      height,
      x,
      y,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      show: config.isEnabled,
      webPreferences: {
        preload: join(__dirname, '../preload/overlay.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const overlayWindow = this.overlayWindow;
    const saveOverlayPosition = () => {
      if (overlayWindow.isDestroyed()) return;
      const [nextX, nextY] = overlayWindow.getPosition();
      const { x: savedX, y: savedY } = this.configStore.get('position');
      if (nextX === savedX && nextY === savedY) return;
      this.configStore.set('position', { x: nextX, y: nextY });
      this.sendToAll(IPC_CHANNELS.CONFIG_CHANGED, this.configStore.getConfig());
    };

    if (process.platform === 'win32') {
      overlayWindow.on('moved', saveOverlayPosition);
    } else {
      overlayWindow.on('move', () => {
        if (this.overlayMoveTimer) clearTimeout(this.overlayMoveTimer);
        this.overlayMoveTimer = setTimeout(() => {
          this.overlayMoveTimer = null;
          saveOverlayPosition();
        }, 200);
      });
      overlayWindow.on('closed', () => {
        if (this.overlayMoveTimer) clearTimeout(this.overlayMoveTimer);
        this.overlayMoveTimer = null;
      });
    }

    // Enable mouse pass-through by default
    this.overlayWindow.setIgnoreMouseEvents(true, { forward: true });

    // Load Overlay page
    if (process.env.NODE_ENV === 'development') {
      this.overlayWindow.loadURL('http://localhost:5173/src/renderer/overlay/index.html');
    } else {
      this.overlayWindow.loadFile(join(__dirname, '../src/renderer/overlay/index.html'));
    }

    return this.overlayWindow;
  }

  /**
   * Create Settings window.
   */
  createSettingsWindow(): BrowserWindow {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.show();
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    this.settingsWindow = new BrowserWindow({
      width: 480,
      height: 520,
      resizable: false,
      center: true,
      title: 'Keystroke Visualizer - Settings',
      webPreferences: {
        preload: join(__dirname, '../preload/settings.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Load Settings page
    if (process.env.NODE_ENV === 'development') {
      this.settingsWindow.loadURL('http://localhost:5173/src/renderer/settings/index.html');
    } else {
      this.settingsWindow.loadFile(join(__dirname, '../src/renderer/settings/index.html'));
    }

    // Hide instead of close (unless app is quitting)
    this.settingsWindow.on('close', (event) => {
      if (!this.isQuitting && this.settingsWindow && !this.settingsWindow.isDestroyed()) {
        event.preventDefault();
        this.settingsWindow.hide();
      }
    });

    return this.settingsWindow;
  }

  /**
   * Show Overlay window.
   * Creates window if it doesn't exist.
   */
  showOverlay(): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      const config = this.configStore.getConfig();
      this.createOverlayWindow(config);
      // Force show regardless of config.isEnabled
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.show();
      }
    } else {
      this.overlayWindow.show();
    }
  }

  /**
   * Hide Overlay window.
   */
  hideOverlay(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.hide();
    }
  }

  /**
   * Show Settings window.
   */
  showSettings(): void {
    if (!this.settingsWindow || this.settingsWindow.isDestroyed()) {
      this.createSettingsWindow();
    } else {
      this.settingsWindow.show();
      this.settingsWindow.focus();
    }
  }

  /**
   * Hide Settings window.
   */
  hideSettings(): void {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.hide();
    }
  }

  /**
   * Update Overlay window position.
   * Validates coordinates before applying.
   */
  updateOverlayPosition(x: number, y: number): void {
    const validated = this.validatePosition(x, y, this.configStore.get('maxDisplayCount'));
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.setPosition(validated.x, validated.y);
    }
  }

  /**
   * Update Overlay window size based on max display count.
   * Keeps the window anchored near its current top/bottom position.
   */
  updateOverlaySize(maxDisplayCount: number): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;

    const { width: newWidth, height: newHeight } = this.getOverlayDimensions(maxDisplayCount);
    const [x, y] = this.overlayWindow.getPosition();
    const [, oldHeight] = this.overlayWindow.getSize();
    const display = this.getDisplayForWindow(this.overlayWindow);
    const { y: areaY, height: areaHeight } = display.workArea;

    // Use window bottom edge proximity to determine anchor (more reliable than center)
    // If window bottom is near screen bottom (within 50px), anchor to bottom
    const windowBottom = y + oldHeight;
    const isNearBottom = windowBottom >= areaY + areaHeight - 50;
    const anchor = isNearBottom ? 'bottom' : 'top';
    const nextY = anchor === 'bottom' ? y + oldHeight - newHeight : y;

    const validated = this.validatePosition(x, nextY, maxDisplayCount);
    // Persist before setBounds so its native move event does not trigger a second write.
    const saved = this.configStore.get('position');
    if (saved.x !== validated.x || saved.y !== validated.y) {
      this.configStore.set('position', validated);
    }
    // setBounds also applies shrink requests to the non-resizable overlay.
    this.overlayWindow.setBounds({ ...validated, width: newWidth, height: newHeight });
  }

  /**
   * Toggle mouse pass-through for Overlay window.
   */
  setOverlayMousePassThrough(enabled: boolean): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.setIgnoreMouseEvents(enabled, { forward: true });
    }
  }

  /**
   * Send message to Overlay window.
   */
  sendToOverlay(channel: string, data: unknown): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.webContents.send(channel, data);
    }
  }

  /**
   * Send message to Settings window.
   */
  sendToSettings(channel: string, data: unknown): void {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.webContents.send(channel, data);
    }
  }

  /**
   * Send message to all windows.
   */
  sendToAll(channel: string, data: unknown): void {
    this.sendToOverlay(channel, data);
    this.sendToSettings(channel, data);
  }

  /**
   * Get Overlay window reference.
   */
  getOverlayWindow(): BrowserWindow | null {
    return this.overlayWindow;
  }

  /**
   * Get Settings window reference.
   */
  getSettingsWindow(): BrowserWindow | null {
    return this.settingsWindow;
  }

  /**
   * Set quitting flag to allow windows to close.
   */
  setQuitting(quitting: boolean): void {
    this.isQuitting = quitting;
  }

  /**
   * Validate position coordinates.
   * Clamps to screen bounds and filters invalid values.
   * Public so IPC handlers can validate before saving to config.
   */
  validatePosition(x: number, y: number, maxDisplayCount?: number): { x: number; y: number } {
    // Reject invalid values (NaN, Infinity, etc.)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return this.getDefaultPosition(maxDisplayCount);
    }

    const display = screen.getDisplayNearestPoint({ x, y });
    const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = display.workArea;
    const { width: windowWidth, height: windowHeight } = this.getOverlayDimensions(maxDisplayCount);

    // Clamp to visible area (allow at least 50px of window visible)
    const clampedX = Math.max(areaX - windowWidth + 50, Math.min(x, areaX + areaWidth - 50));
    const clampedY = Math.max(areaY - windowHeight + 50, Math.min(y, areaY + areaHeight - 50));

    return { x: clampedX, y: clampedY };
  }

  /**
   * Calculate Overlay window position based on config.
   * Returns default position (bottom-right) if config position is invalid.
   */
  private calculateOverlayPosition(
    position: { x: number; y: number },
    maxDisplayCount?: number
  ): { x: number; y: number } {
    // Only (-1, -1) is the default-position sentinel; other negative coordinates
    // are valid on displays to the left or above the primary display.
    if (position.x !== -1 || position.y !== -1) {
      return this.validatePosition(position.x, position.y, maxDisplayCount);
    }

    // Default: bottom-right corner
    return this.getDefaultPosition(maxDisplayCount);
  }

  /**
   * Get default window position (bottom-right corner).
   */
  private getDefaultPosition(maxDisplayCount?: number): { x: number; y: number } {
    const display = this.getActiveDisplay();
    const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = display.workArea;
    const { width: windowWidth, height: windowHeight } = this.getOverlayDimensions(maxDisplayCount);
    return {
      x: areaX + areaWidth - (windowWidth + 20),
      y: areaY + areaHeight - (windowHeight + 20),
    };
  }

  /**
   * Calculate preset position coordinates.
   * Uses Electron's screen API for accurate multi-monitor support.
   */
  getPresetPosition(preset: string): { x: number; y: number } {
    const display = this.getActiveDisplay();
    return this.getPresetPositionOnDisplay(preset, display);
  }

  /**
   * Detect the closest preset for a given position.
   */
  detectPresetFromPosition(position: { x: number; y: number }): string {
    if (
      (position.x === -1 && position.y === -1) ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    ) {
      return 'bottom-right';
    }

    const display = screen.getDisplayNearestPoint({ x: position.x, y: position.y });
    const presets = [
      'bottom-right',
      'top-right',
      'bottom-left',
      'top-left',
      'bottom-center',
      'top-center',
    ];
    let closestPreset = presets[0];
    let closestDistance = Infinity;

    for (const preset of presets) {
      const candidate = this.getPresetPositionOnDisplay(preset, display);
      const distance = (position.x - candidate.x) ** 2 + (position.y - candidate.y) ** 2;
      if (distance < closestDistance) {
        closestPreset = preset;
        closestDistance = distance;
      }
    }

    return closestPreset;
  }

  /**
   * Pick the active display based on settings window, overlay position, or cursor.
   */
  private getActiveDisplay(): Electron.Display {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      return this.getDisplayForWindow(this.overlayWindow);
    }

    if (this.settingsWindow && !this.settingsWindow.isDestroyed() && this.settingsWindow.isVisible()) {
      return this.getDisplayForWindow(this.settingsWindow);
    }

    const cursor = screen.getCursorScreenPoint();
    return screen.getDisplayNearestPoint(cursor);
  }

  /**
   * Get display for a given BrowserWindow by its center point.
   */
  private getDisplayForWindow(window: BrowserWindow): Electron.Display {
    const [x, y] = window.getPosition();
    const [width, height] = window.getSize();
    return screen.getDisplayNearestPoint({ x: x + width / 2, y: y + height / 2 });
  }

  /**
   * Calculate preset position on a specific display.
   */
  private getPresetPositionOnDisplay(preset: string, display: Electron.Display): { x: number; y: number } {
    const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = display.workArea;
    const { width: windowWidth, height: windowHeight } = this.getOverlayDimensions(
      this.configStore.get('maxDisplayCount')
    );
    const MARGIN = 0;

    switch (preset) {
      case 'bottom-right':
        return { x: areaX + areaWidth - windowWidth - MARGIN, y: areaY + areaHeight - windowHeight - MARGIN };
      case 'bottom-left':
        return { x: areaX + MARGIN, y: areaY + areaHeight - windowHeight - MARGIN };
      case 'top-right':
        return { x: areaX + areaWidth - windowWidth - MARGIN, y: areaY + MARGIN };
      case 'top-left':
        return { x: areaX + MARGIN, y: areaY + MARGIN };
      case 'bottom-center':
        return {
          x: areaX + Math.round((areaWidth - windowWidth) / 2),
          y: areaY + areaHeight - windowHeight - MARGIN,
        };
      case 'top-center':
        return { x: areaX + Math.round((areaWidth - windowWidth) / 2), y: areaY + MARGIN };
      default:
        return this.getDefaultPosition(this.configStore.get('maxDisplayCount'));
    }
  }

  /**
   * Compute overlay window dimensions based on max display count.
   */
  private getOverlayDimensions(maxDisplayCount?: number): { width: number; height: number } {
    const width = 400;
    const count = Math.max(1, maxDisplayCount ?? this.configStore.get('maxDisplayCount') ?? 6);
    const itemHeight = 54; // Fits KeyItem with padding and text
    const gap = 8; // gap-2
    const padding = 16; // p-4
    const height = padding * 2 + count * itemHeight + (count - 1) * gap;
    return { width, height };
  }

  /**
   * Destroy all windows.
   */
  destroyAll(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.destroy();
    }
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.destroy();
    }
  }
}
