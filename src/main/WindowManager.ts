import { BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { ConfigState, DisplayInfo, IPC_CHANNELS, KEYBOARD_PANEL_HEIGHT, KEYBOARD_PANEL_WIDTH, Position, PositionPreview } from '../renderer/shared/types';
import { ConfigStore } from './ConfigStore';

const DISPLAY_CHANGE_DELAY_MS = 100;

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
  private displayChangeTimer: ReturnType<typeof setTimeout> | null = null;
  private displays: Electron.Display[];
  private applyingPosition = false;
  private readonly handleDisplaysChanged = () => {
    if (this.displayChangeTimer) clearTimeout(this.displayChangeTimer);
    this.displayChangeTimer = setTimeout(() => {
      this.displayChangeTimer = null;
      this.reconcileDisplays();
    }, DISPLAY_CHANGE_DELAY_MS);
  };

  constructor(configStore: ConfigStore) {
    this.configStore = configStore;
    this.displays = screen.getAllDisplays();
    screen.on('display-added', this.handleDisplaysChanged);
    screen.on('display-removed', this.handleDisplaysChanged);
    screen.on('display-metrics-changed', this.handleDisplaysChanged);
  }

  /**
   * Create Overlay window.
   */
  createOverlayWindow(config: ConfigState): BrowserWindow {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      if (config.isEnabled && !config.isPaused) this.overlayWindow.show();
      else this.overlayWindow.hide();
      return this.overlayWindow;
    }

    // Calculate initial position
    const display = this.resolveDisplay(config.displayId, config.position);
    const { x, y } = this.calculateOverlayPosition(config.position, config.maxDisplayCount, display.id, config.displayMode);
    this.configStore.updateConfig({ displayId: display.id, position: { x, y } });
    const { width, height } = this.getOverlayDimensions(config.maxDisplayCount, display, config.displayMode, config.keyboardScale);

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
      show: config.isEnabled && !config.isPaused,
      webPreferences: {
        preload: join(__dirname, '../preload/overlay.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const overlayWindow = this.overlayWindow;
    const saveOverlayPosition = () => this.saveOverlayPosition();

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
    this.setOverlayMousePassThrough(true);

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
      width: 520,
      height: 680,
      minWidth: 480,
      minHeight: 520,
      resizable: true,
      center: true,
      title: this.configStore.get('language') === 'zh-CN'
        ? '按键可视化工具 - 设置'
        : 'Keystroke Visualizer - Settings',
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
      this.applyingPosition = true;
      try {
        this.overlayWindow.setBounds({ ...validated, ...this.getOverlayDimensions() });
      } finally {
        this.applyingPosition = false;
      }
    }
  }

  saveOverlayPosition(): void {
    const window = this.overlayWindow;
    if (!window || window.isDestroyed() || this.applyingPosition || this.displayChangeTimer) return;
    const selectedId = this.configStore.get('displayId');
    const previousDisplay = this.displays.find((display) => display.id === selectedId);
    const selectedDisplay = screen.getAllDisplays().find((display) => display.id === selectedId);
    const geometryChanged = previousDisplay && selectedDisplay && (
      previousDisplay.scaleFactor !== selectedDisplay.scaleFactor ||
      (['x', 'y', 'width', 'height'] as const).some((key) => previousDisplay.workArea[key] !== selectedDisplay.workArea[key])
    );
    // Native moves can arrive before the display-change notification on Windows.
    if (selectedId !== null && (!selectedDisplay || geometryChanged)) {
      this.handleDisplaysChanged();
      return;
    }
    const [x, y] = window.getPosition();
    const saved = this.configStore.get('position');
    const display = this.getDisplayForWindow(window);
    if (x === saved.x && y === saved.y && display.id === this.configStore.get('displayId')) return;
    const position = this.validatePosition(x, y, undefined, display.id);
    this.configStore.updateConfig({ position, displayId: display.id });
    this.updateOverlayPosition(position.x, position.y);
    this.sendToAll(IPC_CHANNELS.CONFIG_CHANGED, this.configStore.getConfig());
  }

  /**
   * Update Overlay window size based on max display count.
   * Keeps the window anchored near its current top/bottom position.
   */
  updateOverlaySize(maxDisplayCount: number, displayMode = this.configStore.get('displayMode'),
    keyboardScale = this.configStore.get('keyboardScale')): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;

    const { width: newWidth, height: newHeight } = this.getOverlayDimensions(maxDisplayCount, this.getActiveDisplay(), displayMode, keyboardScale);
    const { x, y } = this.configStore.get('position');
    const [oldWidth, oldHeight] = this.overlayWindow.getSize();
    const display = this.getActiveDisplay();
    const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = display.workArea;

    // Use window bottom edge proximity to determine anchor (more reliable than center)
    // If window bottom is near screen bottom (within 50px), anchor to bottom
    const windowBottom = y + oldHeight;
    const isNearBottom = windowBottom >= areaY + areaHeight - 50;
    const anchor = isNearBottom ? 'bottom' : 'top';
    const nextY = anchor === 'bottom' ? y + oldHeight - newHeight : y;
    const nextX = x + oldWidth >= areaX + areaWidth - 50 ? x + oldWidth - newWidth : x;

    const validated = this.validatePosition(nextX, nextY, maxDisplayCount, this.configStore.get('displayId'), displayMode, keyboardScale);
    // Persist before setBounds so its native move event does not trigger a second write.
    const saved = this.configStore.get('position');
    if (saved.x !== validated.x || saved.y !== validated.y) {
      this.configStore.set('position', validated);
    }
    // setBounds also applies shrink requests to the non-resizable overlay.
    this.applyingPosition = true;
    try {
      this.overlayWindow.setBounds({ ...validated, width: newWidth, height: newHeight });
    } finally {
      this.applyingPosition = false;
    }
  }

  /**
   * Toggle mouse pass-through for Overlay window.
   */
  setOverlayMousePassThrough(enabled: boolean): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.setIgnoreMouseEvents(enabled, { forward: true });
      // Keep the transparent overlay above other windows when pass-through changes.
      this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
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
  validatePosition(x: number, y: number, maxDisplayCount?: number, displayId = this.configStore.get('displayId'),
    displayMode = this.configStore.get('displayMode'), keyboardScale = this.configStore.get('keyboardScale')): Position {
    const display = this.resolveDisplay(displayId, { x, y });
    // Reject invalid values (NaN, Infinity, etc.)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return this.getDefaultPosition(maxDisplayCount, display, displayMode, keyboardScale);
    }

    const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = display.workArea;
    const { width: windowWidth, height: windowHeight } = this.getOverlayDimensions(maxDisplayCount, display, displayMode, keyboardScale);

    const clampedX = Math.round(Math.max(areaX, Math.min(x, areaX + areaWidth - windowWidth)));
    const clampedY = Math.round(Math.max(areaY, Math.min(y, areaY + areaHeight - windowHeight)));

    return { x: clampedX, y: clampedY };
  }

  /**
   * Calculate Overlay window position based on config.
   * Returns default position (bottom-right) if config position is invalid.
   */
  private calculateOverlayPosition(
    position: { x: number; y: number },
    maxDisplayCount?: number,
    displayId = this.configStore.get('displayId'),
    displayMode = this.configStore.get('displayMode'), keyboardScale = this.configStore.get('keyboardScale')
  ): { x: number; y: number } {
    // Only (-1, -1) is the default-position sentinel; other negative coordinates
    // are valid on displays to the left or above the primary display.
    if (position.x !== -1 || position.y !== -1) {
      return this.validatePosition(position.x, position.y, maxDisplayCount, displayId, displayMode, keyboardScale);
    }

    // Default: bottom-right corner
    return this.getDefaultPosition(maxDisplayCount, this.resolveDisplay(displayId, position), displayMode, keyboardScale);
  }

  /**
   * Get default window position (bottom-right corner).
   */
  private getDefaultPosition(maxDisplayCount?: number, display = this.getActiveDisplay(),
    displayMode = this.configStore.get('displayMode'), keyboardScale = this.configStore.get('keyboardScale')): Position {
    const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = display.workArea;
    const { width: windowWidth, height: windowHeight } = this.getOverlayDimensions(maxDisplayCount, display, displayMode, keyboardScale);
    return {
      x: Math.max(areaX, areaX + areaWidth - (windowWidth + 20)),
      y: Math.max(areaY, areaY + areaHeight - (windowHeight + 20)),
    };
  }

  /**
   * Calculate preset position coordinates.
   * Uses Electron's screen API for accurate multi-monitor support.
   */
  getPresetPosition(preset: string, displayId = this.configStore.get('displayId')): Position {
    const display = this.resolveDisplay(displayId, this.configStore.get('position'));
    return this.getPresetPositionOnDisplay(preset, display);
  }

  getPositionPreview(position: Position, maxDisplayCount: number, displayId = this.configStore.get('displayId'),
    displayMode = this.configStore.get('displayMode'), keyboardScale = this.configStore.get('keyboardScale')): PositionPreview {
    const display = this.resolveDisplay(displayId, position);
    const resolved = this.calculateOverlayPosition(position, maxDisplayCount, display.id, displayMode, keyboardScale);
    return {
      displayId: display.id,
      workArea: { ...display.workArea },
      overlaySize: this.getOverlayDimensions(maxDisplayCount, display, displayMode, keyboardScale),
      position: resolved,
    };
  }

  /**
   * Detect the closest preset for a given position.
   */
  detectPresetFromPosition(position: Position, displayId = this.configStore.get('displayId')): string {
    if (
      (position.x === -1 && position.y === -1) ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    ) {
      return 'bottom-right';
    }

    const display = this.resolveDisplay(displayId, position);
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
   * Prefer the selected display, then fall back to the current window or cursor.
   */
  private getActiveDisplay(): Electron.Display {
    const selected = screen.getAllDisplays().find((display) => display.id === this.configStore.get('displayId'));
    if (selected) return selected;
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
   * Use the largest window intersection when dragging between displays.
   */
  private getDisplayForWindow(window: BrowserWindow): Electron.Display {
    return screen.getDisplayMatching(window.getBounds());
  }

  /**
   * Calculate preset position on a specific display.
   */
  private getPresetPositionOnDisplay(preset: string, display: Electron.Display): { x: number; y: number } {
    const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = display.workArea;
    const { width: windowWidth, height: windowHeight } = this.getOverlayDimensions(
      this.configStore.get('maxDisplayCount'), display
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
        return this.getDefaultPosition(this.configStore.get('maxDisplayCount'), display);
    }
  }

  /**
   * Compute overlay window dimensions based on max display count.
   */
  private getOverlayDimensions(maxDisplayCount?: number, display = this.getActiveDisplay(),
    displayMode = this.configStore.get('displayMode'), keyboardScale = this.configStore.get('keyboardScale')): { width: number; height: number } {
    const width = displayMode === 'keyboard' ? Math.round(KEYBOARD_PANEL_WIDTH * keyboardScale / 100) : KEYBOARD_PANEL_WIDTH;
    const count = Math.max(1, maxDisplayCount ?? this.configStore.get('maxDisplayCount') ?? 6);
    const itemHeight = 54; // Fits KeyItem with padding and text
    const gap = 8; // gap-2
    const padding = 16; // p-4
    const height = displayMode === 'keyboard'
      ? Math.round(KEYBOARD_PANEL_HEIGHT * keyboardScale / 100)
      : padding * 2 + count * itemHeight + (count - 1) * gap;
    return { width: Math.min(width, display.workArea.width), height: Math.min(height, display.workArea.height) };
  }

  getDisplays(): DisplayInfo[] {
    const primaryId = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((display) => ({
      id: display.id,
      label: display.label,
      isPrimary: display.id === primaryId,
      bounds: { ...display.bounds },
      workArea: { ...display.workArea },
      scaleFactor: display.scaleFactor,
    }));
  }

  getPositionOnDisplay(displayId: number, position: Position, maxDisplayCount: number,
    displayMode = this.configStore.get('displayMode'), keyboardScale = this.configStore.get('keyboardScale')): Position {
    const target = screen.getAllDisplays().find((display) => display.id === displayId);
    if (!target) throw new RangeError('Display is no longer available');
    const config = this.configStore.getConfig();
    const source = this.resolveDisplay(config.displayId, config.position);
    return this.mapPositionToDisplay(position, source, target, config.maxDisplayCount, maxDisplayCount,
      config.displayMode, displayMode, config.keyboardScale, keyboardScale);
  }

  private resolveDisplay(displayId: number | null, position: Position): Electron.Display {
    if (displayId !== null) {
      return screen.getAllDisplays().find((display) => display.id === displayId) ?? screen.getPrimaryDisplay();
    }
    if ((position.x === -1 && position.y === -1) || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      return screen.getPrimaryDisplay();
    }
    return screen.getDisplayNearestPoint(position);
  }

  private mapPositionToDisplay(position: Position, source: Electron.Display, target: Electron.Display,
    previousCount: number, nextCount = previousCount, previousMode = this.configStore.get('displayMode'),
    nextMode = previousMode, previousScale = this.configStore.get('keyboardScale'), nextScale = previousScale): Position {
    if (position.x === -1 && position.y === -1) return this.getDefaultPosition(nextCount, target, nextMode, nextScale);
    const oldSize = this.getOverlayDimensions(previousCount, source, previousMode, previousScale);
    const newSize = this.getOverlayDimensions(nextCount, target, nextMode, nextScale);
    const coordinate = (axis: 'x' | 'y', dimension: 'width' | 'height') => {
      const oldRange = source.workArea[dimension] - oldSize[dimension];
      const ratio = oldRange > 0 ? Math.max(0, Math.min(1, (position[axis] - source.workArea[axis]) / oldRange)) : 0;
      return Math.round(target.workArea[axis] + ratio * (target.workArea[dimension] - newSize[dimension]));
    };
    return { x: coordinate('x', 'width'), y: coordinate('y', 'height') };
  }

  private reconcileDisplays(): void {
    const config = this.configStore.getConfig();
    const oldDisplay = this.displays.find((display) => display.id === config.displayId);
    const nextDisplays = screen.getAllDisplays();
    const target = nextDisplays.find((display) => display.id === config.displayId) ?? screen.getPrimaryDisplay();
    const position = oldDisplay
      ? this.mapPositionToDisplay(config.position, oldDisplay, target, config.maxDisplayCount)
      : this.calculateOverlayPosition(config.position, config.maxDisplayCount, target.id);
    this.displays = nextDisplays;
    this.configStore.updateConfig({ displayId: target.id, position });
    this.updateOverlayPosition(position.x, position.y);
    this.sendToAll(IPC_CHANNELS.CONFIG_CHANGED, this.configStore.getConfig());
    this.sendToSettings(IPC_CHANNELS.DISPLAYS_CHANGED, this.getDisplays());
  }

  /**
   * Destroy all windows.
   */
  destroyAll(): void {
    screen.off('display-added', this.handleDisplaysChanged);
    screen.off('display-removed', this.handleDisplaysChanged);
    screen.off('display-metrics-changed', this.handleDisplaysChanged);
    if (this.displayChangeTimer) clearTimeout(this.displayChangeTimer);
    this.displayChangeTimer = null;
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.destroy();
    }
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.destroy();
    }
  }
}
