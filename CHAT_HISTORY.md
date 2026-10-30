# StageTimer Pro — Development & Chat History Summary

**Project**: StageTimer Pro (`stagetimer-pro`)  
**Version**: `1.0.1`  
**Repository**: `https://github.com/kachiDeGreat/timer.git`  
**Date**: October 30, 2026  

---

## 1. Session Overview & Key Objectives

This session resolved multi-monitor stage projection, window placement under Linux (Ubuntu Wayland/GNOME), keyboard shortcut controls, and startup presentation behavior modeled after industry-standard church/event projection tools like **VideoPsalm**, **EasyWorship**, and **OBS Studio**.

---

## 2. Problems Identified & Solutions

### A. Default Empty Queue
- **Requirement**: By default, nothing should be in the queue on startup.
- **Fix**: Removed mock queue seed items (`q-1`, `q-2`) so `DEFAULT_TIMER_STATE.timerQueue` initializes completely empty (`[]`). Added cleanup in `loadInitialState()` to filter out any previously cached seed items from `localStorage`.

### B. Projector Screen Opening on PC Primary Screen Instead of External Display
- **Symptom**: When clicking "Open Projector Screen" with an external HDMI display connected (`Technical Concepts Ltd`, 1366×768 at `x: 1536`), the projector opened on the PC's primary display (`1536×864`), covering the Control Surface.
- **Root Cause**:
  1. On modern Linux Ubuntu, the default session is **Wayland**. Under native Wayland (`xdg_shell`), client applications are forbidden from specifying arbitrary `(x, y)` screen coordinates. The compositor placed windows on the active monitor.
  2. If created with `fullscreen: true`, GNOME Mutter locks the window to the monitor that has active keyboard/pointer focus (the laptop display).
  3. Electron's internal display cache occasionally returned 1 display on immediate query before X11/Wayland event propagation.
- **The Solution**:
  1. **Guaranteed Detection**: In [electron/main.cjs](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/electron/main.cjs), `findExternalDisplay()` queries `screen.getAllDisplays()` and falls back to parsing `xrandr --listmonitors` so external HDMI displays are never missed.
  2. **Frameless Geometry**: Created borderless (`frame: false, fullscreen: false`) directly with `targetDisplay.bounds` (`x: 1536, y: 0, width: 1366, height: 768`), completely covering the external display with zero borders without triggering Mutter's fullscreen grab.
  3. **Multi-Stage Lock**: Reinforced bounds at 150ms, 400ms, and 800ms to keep the window settled on the HDMI screen.

### C. Closing the Projector Window (Escape, Alt + F4, One-Click Close)
- **Symptom**: The user could not close the fullscreen projector window via `Alt + F4` or keyboard shortcuts without force-quitting the entire app.
- **Fix**:
  1. **Keyboard Shortcuts**: Added `before-input-event` in Electron and a `keydown` listener in React for `Escape`, `Alt + F4`, and `Ctrl + W` / `Cmd + W`.
  2. **Control Surface Toggle**: The Control Surface button in [ControlSurface.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/components/ControlSurface.tsx) toggles dynamically between `Open Projector Screen` and `Close Projector`.
  3. **Hover Close Button**: A discreet floating close button (`✕ Close Stage Display (Esc)`) fades in at the top-right corner of the projector screen when hovering the mouse over it.

### D. The VideoPsalm Standard (Blackout on Launch)
- **User Instruction**: *"Just like VideoPsalm. The moment you launch VideoPsalm, the external display goes completely black. Then when you project, it shows on that black display."*
- **Implementation**:
  1. In [main.cjs](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/electron/main.cjs), immediately upon app launch (`app.whenReady()`), if an external display is detected, the app automatically opens the stage window on the external screen.
  2. In [timer.ts](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/types/timer.ts) and [TimerContext.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/context/TimerContext.tsx), `isBlackout` defaults to `true`. The external display starts completely black (`#000000`).
  3. Clicking **`UNBLANK SCREEN`**, pressing **`B`**, or clicking **`START LIVE`** / **`RESUME`** unblanks the screen and displays the live countdown.
  4. Clicking **`BLACKOUT SCREEN`** (or pressing **`B`**) returns the screen to clean black instantly.
  5. Hot-plugging an HDMI cable while the app is running triggers `screen.on('display-added')` to automatically black out the new display.

---

## 3. Windows Packages Explained

| Package | Type | Description |
| :--- | :--- | :--- |
| **`StageTimer Pro Setup 1.0.1.exe`** | **Installer (Recommended)** | Standard Windows Setup. Installs into Program Files, creates Desktop/Start Menu shortcuts, and configures file associations. |
| **`StageTimer Pro 1.0.1.exe`** | **Portable** | Standalone executable. Runs immediately without installation or admin rights; ideal for USB flash drives. |

---

## 4. Linux Packages

| Package | Command to Install / Run |
| :--- | :--- |
| **Debian / Ubuntu Package** | `sudo dpkg -i "release/stagetimer-pro_1.0.1_amd64.deb"` |
| **Linux AppImage** | `./release/StageTimer\ Pro-1.0.1.AppImage` |

---

## 5. Control & Shortcut Reference

| Action | Control Surface | Projector Screen Keyboard |
| :--- | :--- | :--- |
| **Start / Pause Timer** | Spacebar or Click `START LIVE` / `PAUSE` | — |
| **Toggle Blackout** | Click `BLACKOUT SCREEN` / `UNBLANK SCREEN` or press `B` | Press `B` |
| **Close Projector Window** | Click `Close Projector` | Press `Esc`, `Alt + F4`, or `Ctrl + W` |
| **Add / Subtract Time** | Click quick chips (`+1m`, `+5m`, `-1m`) | — |
| **Fullscreen Toggle** | Header button | Double-click projector screen |
