import { uIOhook, UiohookKey, UiohookKeyboardEvent } from 'uiohook-napi';
import { WindowManager } from './WindowManager';
import { IPC_CHANNELS, KeyPressEvent } from '../renderer/shared/types';

/**
 * Keyboard listener using uiohook-napi.
 * Tracks keyboard events and modifier key states.
 */
export class KeyListener {
  private windowManager: WindowManager;
  private isListening = false;
  private pressedModifierKeys = new Set<number>();

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

  constructor(windowManager: WindowManager) {
    this.windowManager = windowManager;
    this.initializeKeyNameMap();

    // Bind handlers once
    this.keyDownHandler = this.handleKeyDown.bind(this);
    this.keyUpHandler = this.handleKeyUp.bind(this);
  }

  /**
   * Start listening to keyboard events.
   */
  start(): void {
    if (this.isListening) return;

    uIOhook.on('keydown', this.keyDownHandler);
    uIOhook.on('keyup', this.keyUpHandler);

    try {
      uIOhook.start();
      this.isListening = true;
    } catch (error) {
      uIOhook.off('keydown', this.keyDownHandler);
      uIOhook.off('keyup', this.keyUpHandler);
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

    uIOhook.stop();
    this.isListening = false;

    // Reset modifier state
    this.resetModifierState();
  }

  /**
   * Handle keydown event.
   */
  private handleKeyDown(event: UiohookKeyboardEvent): void {
    const keyCode = event.keycode;

    // Update modifier state
    this.updateModifierState(keyCode, true);

    // Don't send event if only modifier key is pressed (no main key)
    if (this.isModifierKey(keyCode)) {
      return;
    }

    // Get display keys (modifiers + current key)
    const displayKeys = this.getDisplayKeys(keyCode);

    // Send to Overlay window
    const keyEvent: KeyPressEvent = {
      keys: displayKeys,
      timestamp: Date.now(),
    };

    this.windowManager.sendToOverlay(IPC_CHANNELS.KEY_PRESSED, keyEvent);
  }

  /**
   * Handle keyup event.
   */
  private handleKeyUp(event: UiohookKeyboardEvent): void {
    const keyCode = event.keycode;

    // Update modifier state
    this.updateModifierState(keyCode, false);
  }

  /**
   * Update modifier key state.
   */
  private updateModifierState(keyCode: number, isPressed: boolean): void {
    if (!this.isModifierKey(keyCode)) return;

    if (isPressed) {
      this.pressedModifierKeys.add(keyCode);
    } else {
      this.pressedModifierKeys.delete(keyCode);
    }

    switch (keyCode) {
      case UiohookKey.Ctrl:
      case UiohookKey.CtrlRight:
        this.modifierState.ctrl = this.pressedModifierKeys.has(UiohookKey.Ctrl) ||
          this.pressedModifierKeys.has(UiohookKey.CtrlRight);
        break;

      case UiohookKey.Shift:
      case UiohookKey.ShiftRight:
        this.modifierState.shift = this.pressedModifierKeys.has(UiohookKey.Shift) ||
          this.pressedModifierKeys.has(UiohookKey.ShiftRight);
        break;

      case UiohookKey.Alt:
      case UiohookKey.AltRight:
        this.modifierState.alt = this.pressedModifierKeys.has(UiohookKey.Alt) ||
          this.pressedModifierKeys.has(UiohookKey.AltRight);
        break;

      case UiohookKey.Meta:
      case UiohookKey.MetaRight:
        this.modifierState.meta = this.pressedModifierKeys.has(UiohookKey.Meta) ||
          this.pressedModifierKeys.has(UiohookKey.MetaRight);
        break;
    }
  }

  /**
   * Get display keys including active modifiers.
   */
  private getDisplayKeys(keyCode: number): string[] {
    const keys: string[] = [];

    // Add active modifiers in order
    if (this.modifierState.ctrl) {
      keys.push(this.getModifierDisplayName('ctrl'));
    }
    if (this.modifierState.alt) {
      keys.push(this.getModifierDisplayName('alt'));
    }
    if (this.modifierState.shift) {
      keys.push(this.getModifierDisplayName('shift'));
    }
    if (this.modifierState.meta) {
      keys.push(this.getModifierDisplayName('meta'));
    }

    // Add current key if it's not a modifier
    if (!this.isModifierKey(keyCode)) {
      const keyName = this.getKeyDisplayName(keyCode);
      keys.push(keyName);
    }

    return keys.length > 0 ? keys : ['Unknown'];
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
    return this.keyNameMap.get(keyCode) ?? `Key${keyCode}`;
  }

  /**
   * Reset all modifier states.
   */
  private resetModifierState(): void {
    this.pressedModifierKeys.clear();
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
