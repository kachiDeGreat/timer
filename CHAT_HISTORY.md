# StageTimer Pro — Development & Chat History Summary

**Project**: StageTimer Pro (`stagetimer-pro`)  
**Version**: `1.0.3`  
**Repository**: `https://github.com/kachiDeGreat/timer.git`  
**Date**: October 30, 2026  

---

## 1. Session Overview & Key Objectives

This session resolved multi-monitor stage projection, window placement under Linux (Ubuntu Wayland/GNOME), keyboard shortcut controls, and startup presentation behavior modeled after industry-standard church/event projection tools like **VideoPsalm**, **EasyWorship**, and **OBS Studio**.

In Version `1.0.3`, we delivered Canva-style multi-shade red "Drift" alerts, clean "UP NEXT" badges without flashing dots or arrows, strict cue suppression for unlabeled timers, and complete v1.0.3 desktop distribution packages for Linux, Windows, and macOS.

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

### C. Windows Taskbar Showing on External Screen (Resolved in 1.0.2)
- **Symptom**: On Windows 10/11, when the stage display opened on the external projector/TV, the Windows taskbar was still visible at the bottom of the screen.
- **Root Cause**: Because `fullscreen: false` was used across all platforms, Windows DWM treated the window as a borderless standard window. In Windows, the taskbar (`Shell_TrayWnd`) is a topmost system window that remains visible over non-fullscreen windows, especially when the laptop window receives focus.
- **The Solution**:
  1. In [main.cjs](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/electron/main.cjs), for Windows (`process.platform === 'win32'`), `applyExternalPlacement()` calls `win.setFullScreen(true)` and `win.setAlwaysOnTop(true, 'screen-saver')`.
  2. Added `skipTaskbar: isExternal` so the projector window does not reserve a taskbar slot or button.
  3. Re-focused the Control Surface on the laptop after launching the external projector so operators can immediately type and control without extra clicks.
  4. Added `F11` shortcut toggle in both Electron and React.

### D. Closing the Projector Window (Escape, Alt + F4, One-Click Close)
- **Symptom**: The user could not close the fullscreen projector window via `Alt + F4` or keyboard shortcuts without force-quitting the entire app.
- **Fix**:
  1. **Keyboard Shortcuts**: Added `before-input-event` in Electron and a `keydown` listener in React for `Escape`, `Alt + F4`, `F11`, and `Ctrl + W` / `Cmd + W`.
  2. **Control Surface Toggle**: The Control Surface button in [ControlSurface.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/components/ControlSurface.tsx) toggles dynamically between `Open Projector Screen` and `Close Projector`.
  3. **Hover Close Button**: A discreet floating close button (`✕ Close Stage Display (Esc)`) fades in at the top-right corner of the projector screen when hovering the mouse over it.

### E. The VideoPsalm Standard (Blackout on Launch)
- **User Instruction**: *"Just like VideoPsalm. The moment you launch VideoPsalm, the external display goes completely black. Then when you project, it shows on that black display."*
- **Implementation**:
  1. In [main.cjs](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/electron/main.cjs), immediately upon app launch (`app.whenReady()`), if an external display is detected, the app automatically opens the stage window on the external screen.
  2. In [timer.ts](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/types/timer.ts) and [TimerContext.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/context/TimerContext.tsx), `isBlackout` defaults to `true`. The external display starts completely black (`#000000`).
  3. Clicking **`UNBLANK SCREEN`**, pressing **`B`**, or clicking **`START LIVE`** / **`RESUME`** unblanks the screen and displays the live countdown.
  4. Clicking **`BLACKOUT SCREEN`** (or pressing **`B`**) returns the screen to clean black instantly.
  5. Hot-plugging an HDMI cable while the app is running triggers `screen.on('display-added')` to automatically black out the new display.

### F. Canva "Drift" Multi-Shade Red "UP NEXT" Stage Alert
- **Requirement**: Inform the speaker/worship leader/pastor on stage what is coming up next in the queue (e.g., Praise -> Offering -> Sermon) without interrupting the presentation.
- **Design & Animation**: Modeled after Canva's "Drift" transition and broadcast news graphics:
  1. **Multi-Shade Red Drift Layers**: Slanted diagonal ribbons with layered shades of red (deep wine `#450a0a`, rich crimson `#991b1b`, and vivid broadcast scarlet `#dc2626` with specular sheen) sweep across the screen with staggered velocity.
  2. **Prominent 5-Second Cue**: Displays clean `UP NEXT` badge (no flashing dot or arrows), the next item's title in massive bold text, and a frosted countdown pill showing the remaining clock time or overtime status.
  3. **Auto & Manual Triggers**:
     - **Automatic**: Triggers at the configured remaining time (defaults to `01:00`, with options for `2:00`, `1:30`, `1:00`, `0:45`, `0:30`, or `Disabled`).
     - **Manual**: Operators can click `Cue Up Next (5s)` from the Control Surface or from the queue slot anytime.
  4. **Smooth Drift Out**: After 5 seconds, the red ribbons drift smoothly off to the right, returning the display seamlessly to the standard countdown digits (`00:55`, `00:54`...).

### G. Unlabeled Timers & Cue Suppression (Version 1.0.3)
- **Requirement**: Timers added without an explicit name (e.g., quick-add chips `+5m` or unnamed countdowns) should NOT display generic fallbacks like "15 minutes countdown" or have any CUE option.
- **Implementation**:
  1. Implemented `hasValidTimerLabel` in [src/utils/time.ts](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/utils/time.ts) to filter out generic countdown names.
  2. In [CountdownQueue.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/components/CountdownQueue.tsx), only render the `CUE` button if `hasValidTimerLabel(item.title)` is true. If unlabeled, show `(Click to add label)` and keep status as `QUEUED`.
  3. In [ControlSurface.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/components/ControlSurface.tsx), hide the `Cue Up Next (5s)` button when the next timer has no custom label.
  4. In [TimerContext.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/context/TimerContext.tsx), guard both manual cueing and auto-triggering against unlabeled items.

---

## 3. Windows Packages (v1.0.3)

| Package | Type | Description |
| :--- | :--- | :--- |
| **`StageTimer Pro Setup 1.0.3.exe`** | **Installer (Recommended)** | Standard Windows Setup. Installs into Program Files, creates Desktop/Start Menu shortcuts, and configures file associations. |
| **`StageTimer Pro 1.0.3.exe`** | **Portable** | Standalone executable. Runs immediately without installation or admin rights; ideal for USB flash drives. |

---

## 4. Linux Packages (v1.0.3)

| Package | Command to Install / Run |
| :--- | :--- |
| **Debian / Ubuntu Package** | `sudo dpkg -i "release/stagetimer-pro_1.0.3_amd64.deb"` |
| **Linux AppImage** | `./release/StageTimer\ Pro-1.0.3.AppImage` |

---

## 5. macOS Packages (v1.0.3)

| Package | Description |
| :--- | :--- |
| **`StageTimer Pro-1.0.3-mac.zip`** | macOS distribution ZIP containing `StageTimer Pro.app` |

## 6. Local Network Mobile Remote Control System (Version 1.0.3)

### A. Architectural Overview
- **Master Engine (Laptop)**:
  - Operates the authoritative countdown timer engine.
  - Controls the external projector screen over HDMI.
  - Hosts the embedded HTTP and WebSocket server on port `3456` (or `5173` in dev mode).
  - Broadcasts master state changes and real-time second ticks to all connected remote clients.
- **Remote Client (Phone/Tablet)**:
  - Connects over local Wi-Fi or laptop hotspot without needing an internet connection.
  - Detected via User-Agent mobile regex, `?view=remote` query parameter, or access via port `3456`.
  - Dispatches actions (`PAUSE`, `RESUME`, `START_LIVE`, `STOP`, `RESET`, `ADD_TIME`, `SUBTRACT_TIME`, `TOGGLE_BLACKOUT`, queue mutations) to the host instead of mutating local state.
  - Provides instant tactile haptic feedback (`navigator.vibrate`) upon user interaction.

### B. Mobile Remote Interface Design
- **Top Bar**: Connection status indicator (`● STAGE MASTER CONNECTED`), instant Blackout toggle button, and White/Blue color scheme switch.
- **Live Master Clock Card**: Clean, high-contrast tabular countdown digits reflecting the stage clock in real time, accompanied by status pills (`ACTIVE LIVE`, `STAGE SCREEN BLACKED OUT`, `OVERTIME`, `PAUSED`). The stage preview box was intentionally removed to maximize thumb usability.
- **Thumb-Friendly Transport**: Massive `START LIVE` / `RESUME` / `PAUSE` button with secondary `STOP` and `RESET` controls.
- **Accordion Tools**: Quick time adjustment chips (`+30s`, `+1m`, `+2m`, `+5m`, `-30s`, `-1m`, `-2m`, `-5m`), queue builder with preset duration chips (`5m` through `2h`), and drag-and-drop queue management.

### C. Clock Skew Compensation & Master TICK Relay (+1 Second Fix)
- **Symptom**: When pausing/stopping and resuming on a phone, the mobile screen would jump from `04:00` to `04:01` for one second before counting down normally, while the desktop displayed `04:00` correctly.
- **Root Cause**: Device hardware clock skew. Because the phone's clock was slightly behind the laptop by even 20–100ms, `Math.ceil((targetEndTime - phoneNow) / 1000)` calculated `240.05`, rounding up to **241** (`04:01`).
- **The Solution**:
  1. **Clock Skew Compensation (`serverTimeOffset`)**: The client calculates `serverTimeOffset = Date.now() - incoming.lastUpdated` upon receiving any state packet, adjusting `phoneNow` to the laptop's exact timeframe.
  2. **Mathematical Upper-Bound Clamping**: Clamped `remaining` across all countdown and pause/resume logic so remaining time can never exceed `current.remainingSeconds` or `current.totalSeconds`:
     ```ts
     const ceilingLimit = current.remainingSeconds > 0 
       ? current.remainingSeconds 
       : (current.totalSeconds > 0 ? current.totalSeconds : rawRemaining);
     const remaining = Math.min(ceilingLimit, rawRemaining);
     ```
  3. **Authoritative Master `TICK` Relay**: The host broadcasts an authoritative `TICK` message on every second change over WebSocket, keeping remote devices locked to the exact second.

---

## 7. Production Desktop Distribution Packages (v1.0.3)

All production packages are built and verified in the [release/](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/release) folder. Intermediate unpacked directories and updater metadata files were pruned to leave only clean, standalone distribution binaries.

| Platform | Format | Filename | Size | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Linux** | **AppImage** | `StageTimer Pro-1.0.3.AppImage` | **125 MB** | Universal Linux standalone executable (Ubuntu, Debian, Fedora, Arch) |
| **Linux** | **Debian/Ubuntu** | `stagetimer-pro_1.0.3_amd64.deb` | **100 MB** | Native Debian/Ubuntu package with desktop menu integration |
| **Windows** | **NSIS Installer** | `StageTimer Pro Setup 1.0.3.exe` | **119 MB** | Standard Windows setup installer with desktop shortcut & uninstaller |
| **Windows** | **Portable** | `StageTimer Pro 1.0.3.exe` | **107 MB** | Single-file portable executable (runs directly off USB drives without install) |
| **macOS** | **Zip Bundle** | `StageTimer Pro-1.0.3-mac.zip` | **122 MB** | macOS application archive containing `StageTimer Pro.app` |

---

## 8. Control & Shortcut Reference

| Action | Control Surface | Projector Screen Keyboard | Mobile Remote |
| :--- | :--- | :--- | :--- |
| **Start / Pause Timer** | Spacebar or Click `START LIVE` / `PAUSE` | — | Tap massive `START LIVE` / `PAUSE` |
| **Toggle Blackout** | Click `BLACKOUT SCREEN` / `UNBLANK SCREEN` or press `B` | Press `B` | Tap Topbar Eye icon |
| **Close Projector Window** | Click `Close Projector` | Press `Esc`, `Alt + F4`, or `Ctrl + W` | — |
| **Add / Subtract Time** | Click quick chips (`+1m`, `+5m`, `-1m`) | — | Quick adjust chips (`+30s` to `+5m`) |
| **Fullscreen Toggle** | Header button or `F11` | Double-click projector screen or `F11` | — |
| **Cue Up Next Alert** | Click `Cue Up Next (5s)` | — | Tap `CUE UP NEXT` on queue item |
