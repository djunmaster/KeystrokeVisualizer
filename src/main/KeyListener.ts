import { uIOhook, UiohookKey, UiohookKeyboardEvent, UiohookMouseEvent, UiohookWheelEvent, WheelDirection } from 'uiohook-napi';
import { WindowManager } from './WindowManager';
import { ConfigStore } from './ConfigStore';
import { ConfigState, IPC_CHANNELS, KeyPressEvent, KeyStateEvent } from '../renderer/shared/types';

const WHEEL_DISPLAY_INTERVAL_MS = 100;

const mouseLabels = {
  'zh-CN': { up: '滚轮向上', down: '滚轮向下', left: '滚轮向左', right: '滚轮向右', middle: '鼠标中键' },
  'en-US': { up: 'Wheel Up', down: 'Wheel Down', left: 'Wheel Left', right: 'Wheel Right', middle: 'Middle Click' },
} as const;

const volumeKeyCodes = {
  mute: 0xE020,
  down: 0xE02E,
  up: 0xE030,
} as const;

const volumeLabels: Record<ConfigState['language'], Record<number, string>> = {
  'zh-CN': { [volumeKeyCodes.mute]: '静音', [volumeKeyCodes.down]: '音量减小', [volumeKeyCodes.up]: '音量增大' },
  'en-US': { [volumeKeyCodes.mute]: 'Mute', [volumeKeyCodes.down]: 'Volume Down', [volumeKeyCodes.up]: 'Volume Up' },
};

/**
 * Keyboard listener using uiohook-napi.
 * Tracks keyboard events and modifier key states.
 */
export class KeyListener {
  private windowManager: WindowManager;
  private language: ConfigState['language'];
  private isListening = false;
  private pauseShortcutRegistered = false;
  private pressedKeys = new Set<number>();
  private lastWheelLabel = '';
  private lastWheelTime = 0;

  // Modifier key state tracking
  private modifierState = {
    ctrl: false,
    shift: false,
    alt: false,
    meta: false, // Windows key / Command key
  };

  // Key code to display name mapping
  private keyNameMap: Map<number, string> = new Map();

  // Event handler references for cleanup
  private keyDownHandler: (event: UiohookKeyboardEvent) => void;
  private keyUpHandler: (event: UiohookKeyboardEvent) => void;
  private wheelHandler: (event: UiohookWheelEvent) => void;
  private mouseDownHandler: (event: UiohookMouseEvent) => void;

  constructor(windowManager: WindowManager, configStore: ConfigStore) {
    this.windowManager = windowManager;
    this.language = configStore.get('language');
    configStore.onDidChange((newConfig) => {
      this.language = newConfig.language;
    });
    this.initializeKeyNameMap();

    // Bind handlers once
    this.keyDownHandler = this.handleKeyDown.bind(this);
    this.keyUpHandler = this.handleKeyUp.bind(this);
    this.wheelHandler = this.handleWheel.bind(this);
    this.mouseDownHandler = this.handleMouseDown.bind(this);
  }

  /**
   * Start listening to keyboard events.
   */
  start(): void {
    if (this.isListening) return;

    uIOhook.on('keydown', this.keyDownHandler);
    uIOhook.on('keyup', this.keyUpHandler);
    uIOhook.on('wheel', this.wheelHandler);
    uIOhook.on('mousedown', this.mouseDownHandler);

    try {
      uIOhook.start();
      this.isListening = true;
    } catch (error) {
      uIOhook.off('keydown', this.keyDownHandler);
      uIOhook.off('keyup', this.keyUpHandler);
      uIOhook.off('wheel', this.wheelHandler);
      uIOhook.off('mousedown', this.mouseDownHandler);
      throw error;
    }
  }

  /**
   * Stop listening to keyboard events.
   */
  stop(): void {
    if (!this.isListening) return;

    // Remove event listeners
    uIOhook.off('keydown', this.keyDownHandler);
    uIOhook.off('keyup', this.keyUpHandler);
    uIOhook.off('wheel', this.wheelHandler);
    uIOhook.off('mousedown', this.mouseDownHandler);

    this.isListening = false;
    try {
      uIOhook.stop();
    } finally {
      this.resetKeyState();
      this.lastWheelLabel = '';
      this.lastWheelTime = 0;
      this.sendKeyState();
    }
  }

  getKeyState(): KeyStateEvent {
    return { keyCodes: [...this.pressedKeys], timestamp: Date.now() };
  }

  setPauseShortcutRegistered(registered: boolean): void {
    this.pauseShortcutRegistered = registered;
  }

  private sendKeyState(): void {
    this.windowManager.sendToOverlay(IPC_CHANNELS.KEY_STATE_CHANGED, this.getKeyState());
  }

  /**
   * Handle keydown event.
   */
  private handleKeyDown(event: UiohookKeyboardEvent): void {
    const keyCode = event.keycode;
    const repeat = this.pressedKeys.has(keyCode);
    this.pressedKeys.add(keyCode);

    this.updateModifierState(keyCode);
    if (!repeat) this.sendKeyState();

    // Don't send event if only modifier key is pressed (no main key)
    if (this.isModifierKey(keyCode)) {
      return;
    }

    // Get display keys (modifiers + current key)
    const displayKeys = this.getDisplayKeys(keyCode, event);
    if (this.isPauseShortcut(keyCode, event)) return;

    this.sendKeys(displayKeys, { keyCode, repeat });
  }

  private handleWheel(event: UiohookWheelEvent): void {
    if (event.rotation === 0) return;

    const labels = mouseLabels[this.language];
    const label = event.direction === WheelDirection.VERTICAL
      ? (event.rotation < 0 ? labels.up : labels.down)
      : event.direction === WheelDirection.HORIZONTAL
        ? (event.rotation < 0 ? labels.left : labels.right)
        : null;
    if (!label) return;

    const now = Date.now();
    const keys = this.getMouseDisplayKeys(event, label);
    const signature = keys.join('+');
    if (signature === this.lastWheelLabel && now - this.lastWheelTime < WHEEL_DISPLAY_INTERVAL_MS) return;
    this.lastWheelLabel = signature;
    this.lastWheelTime = now;
    this.sendKeys(keys);
  }

  private handleMouseDown(event: UiohookMouseEvent): void {
    if (event.button !== 3) return;
    const label = mouseLabels[this.language].middle;
    this.sendKeys(this.getMouseDisplayKeys(event, label));
  }

  private getMouseDisplayKeys(event: UiohookMouseEvent | UiohookWheelEvent, label: string): string[] {
    const keys: string[] = [];
    if (event.ctrlKey) keys.push(this.getModifierDisplayName('ctrl'));
    if (event.altKey) keys.push(this.getModifierDisplayName('alt'));
    if (event.shiftKey) keys.push(this.getModifierDisplayName('shift'));
    if (event.metaKey) keys.push(this.getModifierDisplayName('meta'));
    keys.push(label);
    return keys;
  }

  private sendKeys(keys: string[], keyboard?: Pick<KeyPressEvent, 'keyCode' | 'repeat'>): void {
    const keyEvent: KeyPressEvent = { keys, timestamp: Date.now(), ...keyboard };
    this.windowManager.sendToOverlay(IPC_CHANNELS.KEY_PRESSED, keyEvent);
  }

  /**
   * Handle keyup event.
   */
  private handleKeyUp(event: UiohookKeyboardEvent): void {
    const keyCode = event.keycode;
    if (!this.pressedKeys.delete(keyCode)) return;
    this.updateModifierState(keyCode);
    this.sendKeyState();
  }

  /**
   * Update modifier key state.
   */
  private updateModifierState(keyCode: number): void {
    if (!this.isModifierKey(keyCode)) return;

    switch (keyCode) {
      case UiohookKey.Ctrl:
      case UiohookKey.CtrlRight:
        this.modifierState.ctrl = this.pressedKeys.has(UiohookKey.Ctrl) ||
          this.pressedKeys.has(UiohookKey.CtrlRight);
        break;

      case UiohookKey.Shift:
      case UiohookKey.ShiftRight:
        this.modifierState.shift = this.pressedKeys.has(UiohookKey.Shift) ||
          this.pressedKeys.has(UiohookKey.ShiftRight);
        break;

      case UiohookKey.Alt:
      case UiohookKey.AltRight:
        this.modifierState.alt = this.pressedKeys.has(UiohookKey.Alt) ||
          this.pressedKeys.has(UiohookKey.AltRight);
        break;

      case UiohookKey.Meta:
      case UiohookKey.MetaRight:
        this.modifierState.meta = this.pressedKeys.has(UiohookKey.Meta) ||
          this.pressedKeys.has(UiohookKey.MetaRight);
        break;
    }
  }

  /**
   * Get display keys including active modifiers.
   */
  private getDisplayKeys(keyCode: number, event: UiohookKeyboardEvent): string[] {
    const keys: string[] = [];
    const modifiers = this.getKeyboardModifiers(event);

    // Add active modifiers in order
    if (modifiers.ctrl) {
      keys.push(this.getModifierDisplayName('ctrl'));
    }
    if (modifiers.alt) {
      keys.push(this.getModifierDisplayName('alt'));
    }
    if (modifiers.shift) {
      keys.push(this.getModifierDisplayName('shift'));
    }
    if (modifiers.meta) {
      keys.push(this.getModifierDisplayName('meta'));
    }

    // Add current key if it's not a modifier
    if (!this.isModifierKey(keyCode)) {
      const keyName = this.getKeyDisplayName(keyCode);
      keys.push(keyName);
    }

    return keys.length > 0 ? keys : ['Unknown'];
  }

  private getKeyboardModifiers(event: UiohookKeyboardEvent): typeof this.modifierState {
    // Native flags also cover modifiers held before the hook was started.
    return {
      ctrl: event.ctrlKey ?? this.modifierState.ctrl,
      alt: event.altKey ?? this.modifierState.alt,
      shift: event.shiftKey ?? this.modifierState.shift,
      meta: event.metaKey ?? this.modifierState.meta,
    };
  }

  private isPauseShortcut(keyCode: number, event: UiohookKeyboardEvent): boolean {
    if (!this.pauseShortcutRegistered || keyCode !== UiohookKey.F9) return false;
    const { ctrl, alt, shift, meta } = this.getKeyboardModifiers(event);
    return shift && !alt && (process.platform === 'darwin' ? meta && !ctrl : ctrl && !meta);
  }

  /**
   * Check if key is a modifier key.
   */
  private isModifierKey(keyCode: number): boolean {
    return (
      keyCode === UiohookKey.Ctrl ||
      keyCode === UiohookKey.CtrlRight ||
      keyCode === UiohookKey.Shift ||
      keyCode === UiohookKey.ShiftRight ||
      keyCode === UiohookKey.Alt ||
      keyCode === UiohookKey.AltRight ||
      keyCode === UiohookKey.Meta ||
      keyCode === UiohookKey.MetaRight
    );
  }

  /**
   * Get platform-specific modifier display name.
   */
  private getModifierDisplayName(modifier: 'ctrl' | 'alt' | 'shift' | 'meta'): string {
    if (process.platform === 'darwin') {
      // macOS
      switch (modifier) {
        case 'ctrl':
          return 'Ctrl';
        case 'alt':
          return 'Opt';
        case 'shift':
          return 'Shift';
        case 'meta':
          return 'Cmd';
      }
    } else {
      // Windows/Linux
      switch (modifier) {
        case 'ctrl':
          return 'Ctrl';
        case 'alt':
          return 'Alt';
        case 'shift':
          return 'Shift';
        case 'meta':
          return 'Win';
      }
    }
  }

  /**
   * Get key display name from key code.
   */
  private getKeyDisplayName(keyCode: number): string {
    const volumeLabel = volumeLabels[this.language][keyCode];
    if (volumeLabel) return volumeLabel;
    return this.keyNameMap.get(keyCode) ?? `Key${keyCode}`;
  }

  /**
   * Reset physical keys and modifier states.
   */
  private resetKeyState(): void {
    this.pressedKeys.clear();
    this.modifierState = {
      ctrl: false,
      shift: false,
      alt: false,
      meta: false,
    };
  }

  /**
   * Initialize key name mapping.
   * Maps uiohook key codes to display names.
   */
  private initializeKeyNameMap(): void {
    for (const [name, keyCode] of Object.entries(UiohookKey)) {
      this.keyNameMap.set(keyCode, name);
    }

    // Letters A-Z (uiohook key codes are NOT sequential, must map individually)
    this.keyNameMap.set(UiohookKey.A, 'A');
    this.keyNameMap.set(UiohookKey.B, 'B');
    this.keyNameMap.set(UiohookKey.C, 'C');
    this.keyNameMap.set(UiohookKey.D, 'D');
    this.keyNameMap.set(UiohookKey.E, 'E');
    this.keyNameMap.set(UiohookKey.F, 'F');
    this.keyNameMap.set(UiohookKey.G, 'G');
    this.keyNameMap.set(UiohookKey.H, 'H');
    this.keyNameMap.set(UiohookKey.I, 'I');
    this.keyNameMap.set(UiohookKey.J, 'J');
    this.keyNameMap.set(UiohookKey.K, 'K');
    this.keyNameMap.set(UiohookKey.L, 'L');
    this.keyNameMap.set(UiohookKey.M, 'M');
    this.keyNameMap.set(UiohookKey.N, 'N');
    this.keyNameMap.set(UiohookKey.O, 'O');
    this.keyNameMap.set(UiohookKey.P, 'P');
    this.keyNameMap.set(UiohookKey.Q, 'Q');
    this.keyNameMap.set(UiohookKey.R, 'R');
    this.keyNameMap.set(UiohookKey.S, 'S');
    this.keyNameMap.set(UiohookKey.T, 'T');
    this.keyNameMap.set(UiohookKey.U, 'U');
    this.keyNameMap.set(UiohookKey.V, 'V');
    this.keyNameMap.set(UiohookKey.W, 'W');
    this.keyNameMap.set(UiohookKey.X, 'X');
    this.keyNameMap.set(UiohookKey.Y, 'Y');
    this.keyNameMap.set(UiohookKey.Z, 'Z');

    // Numbers 0-9 (use string index for UiohookKey)
    this.keyNameMap.set(UiohookKey['0'], '0');
    this.keyNameMap.set(UiohookKey['1'], '1');
    this.keyNameMap.set(UiohookKey['2'], '2');
    this.keyNameMap.set(UiohookKey['3'], '3');
    this.keyNameMap.set(UiohookKey['4'], '4');
    this.keyNameMap.set(UiohookKey['5'], '5');
    this.keyNameMap.set(UiohookKey['6'], '6');
    this.keyNameMap.set(UiohookKey['7'], '7');
    this.keyNameMap.set(UiohookKey['8'], '8');
    this.keyNameMap.set(UiohookKey['9'], '9');

    // Function keys F1-F24
    this.keyNameMap.set(UiohookKey.F1, 'F1');
    this.keyNameMap.set(UiohookKey.F2, 'F2');
    this.keyNameMap.set(UiohookKey.F3, 'F3');
    this.keyNameMap.set(UiohookKey.F4, 'F4');
    this.keyNameMap.set(UiohookKey.F5, 'F5');
    this.keyNameMap.set(UiohookKey.F6, 'F6');
    this.keyNameMap.set(UiohookKey.F7, 'F7');
    this.keyNameMap.set(UiohookKey.F8, 'F8');
    this.keyNameMap.set(UiohookKey.F9, 'F9');
    this.keyNameMap.set(UiohookKey.F10, 'F10');
    this.keyNameMap.set(UiohookKey.F11, 'F11');
    this.keyNameMap.set(UiohookKey.F12, 'F12');
    this.keyNameMap.set(UiohookKey.F13, 'F13');
    this.keyNameMap.set(UiohookKey.F14, 'F14');
    this.keyNameMap.set(UiohookKey.F15, 'F15');
    this.keyNameMap.set(UiohookKey.F16, 'F16');
    this.keyNameMap.set(UiohookKey.F17, 'F17');
    this.keyNameMap.set(UiohookKey.F18, 'F18');
    this.keyNameMap.set(UiohookKey.F19, 'F19');
    this.keyNameMap.set(UiohookKey.F20, 'F20');
    this.keyNameMap.set(UiohookKey.F21, 'F21');
    this.keyNameMap.set(UiohookKey.F22, 'F22');
    this.keyNameMap.set(UiohookKey.F23, 'F23');
    this.keyNameMap.set(UiohookKey.F24, 'F24');

    // Special keys
    this.keyNameMap.set(UiohookKey.Space, 'Space');
    this.keyNameMap.set(UiohookKey.Enter, 'Enter');
    this.keyNameMap.set(UiohookKey.Backspace, 'Backspace');
    this.keyNameMap.set(UiohookKey.Tab, 'Tab');
    this.keyNameMap.set(UiohookKey.Escape, 'Esc');
    this.keyNameMap.set(UiohookKey.CapsLock, 'Caps');
    this.keyNameMap.set(UiohookKey.Delete, 'Del');
    this.keyNameMap.set(UiohookKey.Insert, 'Ins');
    this.keyNameMap.set(UiohookKey.Home, 'Home');
    this.keyNameMap.set(UiohookKey.End, 'End');
    this.keyNameMap.set(UiohookKey.PageUp, 'PgUp');
    this.keyNameMap.set(UiohookKey.PageDown, 'PgDn');
    this.keyNameMap.set(UiohookKey.ArrowUp, 'Up');
    this.keyNameMap.set(UiohookKey.ArrowDown, 'Down');
    this.keyNameMap.set(UiohookKey.ArrowLeft, 'Left');
    this.keyNameMap.set(UiohookKey.ArrowRight, 'Right');
    this.keyNameMap.set(UiohookKey.NumLock, 'NumLock');
    this.keyNameMap.set(UiohookKey.ScrollLock, 'ScrLk');
    this.keyNameMap.set(UiohookKey.PrintScreen, 'PrtSc');

    // Symbols
    this.keyNameMap.set(UiohookKey.Minus, '-');
    this.keyNameMap.set(UiohookKey.Equal, '=');
    this.keyNameMap.set(UiohookKey.BracketLeft, '[');
    this.keyNameMap.set(UiohookKey.BracketRight, ']');
    this.keyNameMap.set(UiohookKey.Backslash, '\\');
    this.keyNameMap.set(UiohookKey.Semicolon, ';');
    this.keyNameMap.set(UiohookKey.Quote, "'");
    this.keyNameMap.set(UiohookKey.Comma, ',');
    this.keyNameMap.set(UiohookKey.Period, '.');
    this.keyNameMap.set(UiohookKey.Slash, '/');
    this.keyNameMap.set(UiohookKey.Backquote, '`');

    // Numpad
    this.keyNameMap.set(UiohookKey.Numpad0, 'Num0');
    this.keyNameMap.set(UiohookKey.Numpad1, 'Num1');
    this.keyNameMap.set(UiohookKey.Numpad2, 'Num2');
    this.keyNameMap.set(UiohookKey.Numpad3, 'Num3');
    this.keyNameMap.set(UiohookKey.Numpad4, 'Num4');
    this.keyNameMap.set(UiohookKey.Numpad5, 'Num5');
    this.keyNameMap.set(UiohookKey.Numpad6, 'Num6');
    this.keyNameMap.set(UiohookKey.Numpad7, 'Num7');
    this.keyNameMap.set(UiohookKey.Numpad8, 'Num8');
    this.keyNameMap.set(UiohookKey.Numpad9, 'Num9');
    this.keyNameMap.set(UiohookKey.NumpadDecimal, 'Num.');
    this.keyNameMap.set(UiohookKey.NumpadAdd, 'Num+');
    this.keyNameMap.set(UiohookKey.NumpadSubtract, 'Num-');
    this.keyNameMap.set(UiohookKey.NumpadMultiply, 'Num*');
    this.keyNameMap.set(UiohookKey.NumpadDivide, 'Num/');
    this.keyNameMap.set(UiohookKey.NumpadEnter, 'NumEnter');
  }
}
