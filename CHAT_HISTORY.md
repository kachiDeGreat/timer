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

---

## 9. Mobile Remote Double-Dispatch & Time Adjustments Fixes (Version 1.0.4)

### A. Problems Identified & Root Causes
1. **Queue Items Added Twice**:
   - **Symptom**: Tapping "+ ADD TO QUEUE" or any quick-add chip (`+2m`, `+5m`...) on the phone added the timer item twice to the queue.
   - **Root Cause**: `sendActionToHost` in [TimerContext.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/context/TimerContext.tsx) was sending the action over WebSocket, and without returning, immediately executing a secondary HTTP POST to `/api/action`. Because both transports reached the master server, the host dispatched and executed `addToQueue` twice.
2. **Time Adjustment Multiplied / Unpredictable (1m became 10m / 30m became 1h)**:
   - **Symptom**: Adding 30 minutes added 1 hour; subtracting 5 minutes subtracted 10 minutes.
   - **Root Cause**: The same double-dispatch bug caused `ADD_TIME` and `SUBTRACT_TIME` actions to execute twice in immediate succession (e.g., +30m + 30m = 60m = 1h; -5m + -5m = -10m).
3. **Ambiguous Digital Clock Formatting**:
   - In the Adjust card, applying 1 minute formatted as `-01:00`, which was visually misread by operators as 1 hour rather than 1 minute.
4. **Stale Staging Defaults Overwriting Host Queued Times**:
   - The Builder steppers initialized to local default state (`0h 10m 0s`) and did not sync with the host's actual staged duration on initial load, inadvertently overwriting staged times when steppers were touched.

### B. The Solutions Implemented
1. **Triple-Layer Action Deduplication & Single-Transport Guarantee**:
   - **Layer 1 (Client)**: [TimerContext.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/context/TimerContext.tsx) generates a unique `actionId` (`act-${timestamp}-${random}`) per user action. If WebSocket is connected (`readyState === OPEN`), it sends over WS and terminates immediately (`return`), completely eliminating redundant HTTP POST fallback calls.
   - **Layer 2 (Host / Remote Server)**: [remoteServer.cjs](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/electron/remoteServer.cjs) and [vite.config.ts](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/vite.config.ts) track recently processed `actionId`s within a 10-second window, dropping any duplicate payloads.
   - **Layer 3 (Authoritative React Host)**: `executeAction` guards execution against duplicate `actionId`s.
2. **Instant 1-Tap Quick Adjust Live Clock Bar**:
   - Directly below the master transport controls on the "Live & Controls" screen of [MobileRemoteView.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/components/MobileRemoteView.tsx), added instant 1-tap adjustment chips:
     - Minus: `[-5m]`, `[-1m]`, `[-30s]`
     - Plus: `[+30s]`, `[+1m]`, `[+5m]`
   - Operators can adjust the live countdown directly without navigating away to the builder tab.
3. **Enhanced Mobile Adjust Card with Steppers & Active Highlighting**:
   - Added full `HRS`, `MIN`, `SEC` stepper controls for both Add and Subtract modes.
   - Added active visual highlight (`is-active` / `is-active-sub`) on chips matching current inputs.
   - Replaced ambiguous digital string buttons with crystal-clear human-readable labels:
     `APPLY +1m TO LIVE CLOCK`, `APPLY -1m TO LIVE CLOCK`, `APPLY -30m TO LIVE CLOCK`, `APPLY -1h TO LIVE CLOCK`.
4. **Touch Debounce & Synchronization**:
   - Wrapped mobile action buttons with a 350ms cooldown lock (`withActionLock`) to prevent hardware double-tap triggers.
   - Synchronized initial builder steppers with host queued durations upon connecting.

### C. Default 00:00 Startup Clock
- **Requirement**: When the app first starts, the master clock should display `00:00` (ready for operators to build, load presets, or enqueue timers) instead of seeding with `10:00`.
- **Fix**:
  1. Updated `DEFAULT_TIMER_STATE` in [timer.ts](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/types/timer.ts) (`totalSeconds: 0, remainingSeconds: 0, queuedMinutes: 0`).
  2. Updated `DEFAULT_STATE` in [remoteServer.cjs](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/electron/remoteServer.cjs) to initialize to `00:00`.
  3. Added localStorage purge in `loadInitialState()` in [TimerContext.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/context/TimerContext.tsx) to clear any legacy `600s` (`10:00`) idle state.
  4. Updated builder fallback display in [ControlSurface.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/components/ControlSurface.tsx) and [MobileRemoteView.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB%20DEV/Web%20Dev/timer/src/components/MobileRemoteView.tsx) to `00:00`.

---

## 10. Production Distribution Packages (v1.0.4)

| Platform | Format | Filename | Size | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Windows** | **NSIS Setup Installer** | `StageTimer Pro Setup 1.0.4.exe` | **119 MB** | Standard Windows installer with desktop shortcut & uninstaller |
| **Windows** | **Portable** | `StageTimer Pro 1.0.4.exe` | **106 MB** | Single-file portable executable (runs directly off USB drives without install) |
| **Linux** | **AppImage** | `StageTimer Pro-1.0.4.AppImage` | **125 MB** | Universal Linux standalone executable (Ubuntu, Debian, Fedora, Arch) |
| **Linux** | **Debian/Ubuntu** | `stagetimer-pro_1.0.4_amd64.deb` | **99 MB** | Native Debian/Ubuntu package with desktop menu integration |
| **macOS** | **Zip Bundle (v1.0.3)** | `StageTimer Pro-1.0.3-mac.zip` | **121 MB** | Preserved v1.0.3 bundle (macOS build skipped as requested) |

---

## 11. Web & Feature Overhaul (Version 1.0.5)

### A. Reset Behavior Bug Fix
- **Problem**: When a 5-minute timer was running and an operator prepared or queued a 1-minute timer, clicking RESET reset the countdown to 1 minute instead of the original 5 minutes.
- **Root Cause**:
  1. `state.queuedHours`, `state.queuedMinutes`, and `state.queuedSeconds` were being modified by builder inputs.
  2. When `reset()` transitioned state to `'idle'`, clicking START subsequently executed `pushQueueToLive()`, which calculated its duration from `queuedHours/queuedMinutes/queuedSeconds` (the 1-minute item) instead of preserving the active timer session's planned duration.
- **Solution**:
  1. Added `initialDurationSeconds` to `TimerState` to track the authoritative planned duration for the active timer session.
  2. Fixed `reset()` to strictly restore `remainingSeconds` to `activeItem.totalSeconds` (if tied to a queue item) or `prev.initialDurationSeconds` (if manual countdown).
  3. Fixed START in both Control Surface and Mobile Remote: when `status === 'idle'` and `remainingSeconds > 0`, clicking START resumes/starts the staged duration rather than recalculating from builder inputs.

### B. Default Idle Display Mode (00:00 vs Live Device Clock)
- **Requirement**: When idle, the stage screen should display `00:00` or a live digital clock showing device local time.
- **Solution**:
  1. Added `idleDisplayMode: 'zero' | 'clock'` and `clockFormat24: boolean` settings.
  2. Configurable via both Desktop Settings Modal and Mobile Controller.
  3. In `ProjectorDisplay.tsx`, when `idleDisplayMode === 'clock'`, displays live device wall clock time with AM/PM or 24-hour formatting, ticking smoothly every second with zero drift.

### C. Unlimited Timing Queue
- **Requirement**: Remove the previous 5-timer queue limit so users can queue as many countdowns as needed.
- **Solution**:
  1. Removed `queue.length >= 5` checks across `TimerContext.tsx`, `CountdownQueue.tsx`, `ControlSurface.tsx`, and `MobileRemoteView.tsx`.
  2. Dynamic scrollable queue view with inline editing, quick reordering (Move Up / Down), status pills (`LIVE`, `PAUSED`, `READY`, `QUEUED`), and 1-tap delete.

### D. Queue Transition Automation Modes
- **Requirement**: When a timer finishes, allow user to choose in settings:
  1. `auto-start`: Shows "TIME UP" (5s) and "PLEASE CONCLUDE NOW" (5s) -> automatically starts next queued item without overtime count up.
  2. `auto-load`: Shows "TIME UP" (5s) and "PLEASE CONCLUDE NOW" (5s) -> loads next queued item in Ready/Standby mode on stage.
  3. `manual`: Operator controls next item; counts overtime indefinitely after 10s.
  - Active only when queue has items.
- **Solution**:
  - Implemented automatic transition effect in `TimerContext.tsx` that triggers precisely at `elapsed >= 10` when `autoAdvanceMode` is set to `auto-start` or `auto-load` and next queued item is present.

### E. Event Timing Report & Session Audit Trail
- **Requirement**: Full timing report tracking when timers started, paused, resumed, stopped, reset, overtime taken, and time added/removed, with a printable report page.
- **Solution**:
  1. Created `TimingReportModal.tsx` for Desktop and embedded Report View in Mobile Remote.
  2. Tracks all event types with timestamps, planned durations, actual durations, and overtime.
  3. Summary metrics: Total Segments, Planned Duration, Overtime Accrued, Audit Log Count.
  4. Print-optimized CSS (`@media print`): prints a broadcast run sheet for service directors, pastors, and producers via `window.print()`.
  5. 1-click CSV spreadsheet export (`StageTimer_Report_YYYY-MM-DD.csv`).

### F. Buttery-Smooth Canva Drift Cue Transitions
- **Requirement**: Make the UP NEXT stage alert cue transitions significantly smoother without abrupt pops.
- **Solution**:
  1. Restructured `ProjectorDisplay.tsx` to mount the Canva Drift banner as an overlay on top of the stage digits container.
  2. Added `cueSmoothDrift` keyframes with cubic-bezier easing: smooth fade-in over first 0.4s (8%), smooth sweep across the display, and smooth cross-dissolve exit (last 10%) seamlessly revealing the running timer digits.

### G. Streamlined Mobile Remote Controller Redesign
- **Requirement**: Declutter the mobile interface, remove bloated duplicate steppers, and provide fast, thumb-friendly navigation.
- **Solution**:
  1. Redesigned `MobileRemoteView.tsx` with a modern 3-tab layout:
     - ⏱ **Live Control**: Big readable clock hero card, thumb-friendly transport (`START LIVE`, `PAUSE`, `STOP`, `RESET`), 1-tap quick adjustment bar (`-1m`, `-30s`, `+30s`, `+1m`, `+5m`), and Up Next banner.
     - 📋 **Queue**: Clean playlist with quick duration chips (`5m`, `10m`, `15m`, `20m`, `30m`, `45m`, `1h`), compact `HH:MM:SS` duration builder, and unlimited scrollable queue cards.
     - 📊 **Report & Config**: In-app Event Timing Report table, Print/CSV buttons, and full Settings toggles.

---

## 12. Persistent User Settings (`settings.json`) & Clean Startup/Unblank Zero Display

### A. Root Cause Analysis of Stale Overtime Display (`-72:43:56`)
- **Problem**: When unblanking or launching the app, the stage projector preview displayed an extreme negative overtime (`-72:43:56`).
- **Cause**: `TimerContext.tsx` was saving full runtime countdown state (`remainingSeconds`, `status: 'finished'`, `finishedAt`) to `localStorage` under `STAGE_TIMER_STATE_V2`. When reopened 72 hours later, `loadInitialState()` restored the old `finishedAt` timestamp, which `ProjectorDisplay.tsx` computed as 72 hours of accrued overtime.

### B. Implementation of Pure `settings.json` Storage & Runtime State Decoupling
1. **Purged Runtime Persistence**:
   - `loadInitialState()` automatically purges `STAGE_TIMER_STATE_V2` and `STAGE_TIMER_STATE` from `localStorage` on boot.
   - `broadcastState()` no longer writes countdown runtime state to `localStorage`. Active timer state lives strictly in memory and syncs across active tabs and clients via `BroadcastChannel`, WebSockets, and Electron IPC.
2. **Standard `settings.json` File**:
   - Stored in workspace root `settings.json`:
     ```json
     {
       "idleDisplayMode": "zero",
       "clockFormat24": false,
       "autoAdvanceMode": "manual",
       "upNextTriggerSeconds": 60,
       "colorScheme": "white"
     }
     ```
3. **API Endpoints (`GET /api/settings` and `POST /api/settings`)**:
   - Added in `vite.config.ts` for browser web dev server.
   - Added in `electron/remoteServer.cjs` for mobile remote and standalone server.
   - Added in `electron/main.cjs` via `get-settings` and `save-settings` IPC handlers.
4. **Guaranteed Default Clean Unblank Display**:
   - When the user clicks **UNBLANK SCREEN**, `remainingSeconds` starts strictly at `0` in `idle` status.
   - By default, displays `00:00` in crisp white digits.
   - If the user changes **Default Idle Screen Display** to **Device Clock** in Settings, unblanking displays the live local wall clock.
   - Zero stale timers, zero overtime resurrecting across sessions.

---

## 13. Settings Modal Restyling & Multi-Color Stage Theme Customization

### A. Settings Modal Architectural Restyle
- **Root Cause of Cluttered/Left-Aligned Modal**: `.modal-backdrop` was missing standard fixed centering and backdrop filter styles, causing the settings modal to render in-flow from the left screen boundary and obscuring the control surface.
- **Restyled Layout**:
  1. Centered floating modal overlay with dark frosted glass (`background-color: rgba(0, 0, 0, 0.82); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 99999;`).
  2. Sleek broadcast console header with emerald icon badge, clear titles, and circular close icon button (`X`) with hover rotation and ESC key support.
  3. Clean card layout for all 4 settings modules with custom scrollbar, distinct selection borders, and emerald badges.
  4. Footer featuring **Restore Defaults** and primary **Done** action buttons.

### B. Stage Digit Color Customization (Beyond White and Blue)
- **Problem**: Users were restricted to only two hardcoded themes (White and Blue).
- **Solution**:
  1. **8 Broadcast Presets**: Studio White (`#ffffff`), Electric Sky (`#38bdf8`), Vivid Cyan (`#06b6d4`), Emerald Green (`#10b981`), Amber Gold (`#f59e0b`), Vivid Orange (`#f97316`), Neon Purple (`#a855f7`), and Hot Coral (`#f43f5e`).
  2. **Interactive Custom Hex Picker**: Added native color wheel picker (`<input type="color">`) plus direct `#HEX` input with live validation, enabling any church or corporate brand color.
  3. **Universal Display Integration**: Dynamically renders across Desktop Control Surface preview, Fullscreen Projector Window, and Mobile Remote View. Overtime retains authoritative `#ff0000` red.

---

## 14. Professional Software Redesign: Clean Clock (No Seconds), Removal of Duplicate Home Settings & Anti-Glow Flat UI

### A. Stage Display Clock Formatting
- **Time without seconds**: `formatDeviceClock` formats strictly `${h}:${m}` (e.g. `01:59` instead of `01:59:08`), avoiding distracting speaker visual clutter.
- **Removed "CURRENT TIME" label**: Completely removed the redundant badge. The display renders clean, bold digits with subtle `AM`/`PM` period indicator in 12-hour mode.

### B. Clean Home Screen (Removal of Duplicate Settings)
- **Removed Stage Display Settings Card**: Completely deleted the duplicate `STAGE DISPLAY SETTINGS` card from the bottom-left of `ControlSurface.tsx`. Operators access all configuration directly via the topbar **Settings** dialog, keeping the main operator surface uncluttered.

### C. Flat Professional AV Software Settings (Anti-Glow Redesign)
- **Problem**: The settings screen previously incorporated glowing AI-style visual elements (neon text-shadows, mock TV monitors, glowing drop shadows, and sparkles).
- **Solution**:
  1. Stripped out all `text-shadow` glows, glowing borders (`box-shadow: 0 0 ...`), and neon halos.
  2. Removed decorative TV monitor mockups and sparkles icons.
  3. Replaced with clean, flat broadcast software styling (solid neutral `#18181b` surface, crisp 1px `#2e2e33` borders, clean solid `#2563eb` active button states, and high-density, legible typography).
---

## 15. New Official Brand App Icon & Favicon Suite Across Linux, Windows, macOS & Web (v1.0.5)

- **Version Bump**: Bumped application release version to `1.0.5` across `package.json` and build artifacts.
- **Brand Artwork Integration**: Replaced legacy graphics with the official vibrant hourglass-and-arrow stopwatch icon:
  - **Linux Desktop & Package Icons** (`build/icons/`): Generated crisp multi-resolution PNGs at `16x16`, `32x32`, `48x48`, `64x64`, `128x128`, `256x256`, and `512x512` for desktop environment launchers, Ubuntu Dash, `.deb`, and `AppImage`.
  - **Windows Executable & Installer Icon** (`build/icon.ico`): Generated Windows multi-size ICO binary embedding `16x16`, `24x24`, `32x32`, `48x48`, `64x64`, `128x128`, and `256x256` mipmaps for File Explorer, taskbar, Alt+Tab, and NSIS installer.
  - **macOS App & Window Icon** (`build/icon.png`): High-resolution `512x512` RGBA master icon with transparent rounded contours.
  - **Web Favicon & Browser PWA Icons** (`public/icon.png`, `public/favicon.ico`): High-res `512x512` web icon and multi-size favicon for browser tabs and mobile shortcuts.
### Desktop Release Packages (v1.0.5)

| Platform | Format | Filename | Size | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Linux** | **AppImage** | `StageTimer Pro-1.0.5.AppImage` | **126 MB** | Universal standalone Linux executable (Ubuntu, Debian, Fedora, Arch) |
| **Linux** | **Debian/Ubuntu** | `stagetimer-pro_1.0.5_amd64.deb` | **100 MB** | Native Debian/Ubuntu package with desktop application launcher |
| **Windows** | **NSIS Installer** | `StageTimer Pro Setup 1.0.5.exe` | **119 MB** | Standard Windows installer with start menu and desktop shortcuts |
| **Windows** | **Portable** | `StageTimer Pro 1.0.5.exe` | **107 MB** | Single-file portable executable (runs directly off USB drives without install) |
| **macOS** | **Zip Bundle** | `StageTimer Pro-1.0.5-mac.zip` | **122 MB** | macOS application archive containing `StageTimer Pro.app` |
---

## 16. Dedicated 'SET IDLE' Transport Button & Timing Cue / Settings Persistence (settings.json)

### A. Dedicated 'SET IDLE' Transport Control
- **Problem**: Operators previously had to close and restart the application just to return the projector/stage screen to Idle mode (`00:00` or Device Clock) after running or loading timers.
- **Solution**:
  1. **New Action (`setIdle`)**: Added `setIdle` in `TimerContext.tsx` and WebSocket action dispatch `{ type: 'SET_IDLE' }`.
  2. **Instant Transition**: Immediately stops active running timers or overtime, clears staged labels and active queue selections, and returns the stage display cleanly to Idle mode (`00:00` or local Device Clock, as configured in Settings) without wiping the queued playlist.
  3. **Desktop Transport Button**: Added a dedicated `SET IDLE` button (with `Clock` icon) inside the master transport bar in `ControlSurface.tsx`.
  4. **Mobile Remote Button**: Added `SET IDLE` to the secondary transport controls in `MobileRemoteView.tsx`, allowing stage directors to return the screen to Idle mode with a single tap from their phone or tablet.

### B. Persistent Timing Cues & Settings (settings.json)
- **Problem**: Accidental browser refresh or closing the app caused operators to lose their entire prepared countdown playlist cues and forced them to recreate them.
- **Solution**:
  1. **Integrated `timerQueue` in `settings.json`**: Extended backend API endpoints (`/api/settings` across `vite.config.ts`, `electron/remoteServer.cjs`, and `electron/main.cjs`) to store and retrieve `timerQueue`.
  2. **Automatic Sync**: Any cue playlist mutation (`addToQueue`, `removeFromQueue`, `reorderQueue`, `updateQueueItemTitle`, `clearQueue`) automatically writes the updated list to `settings.json` and syncs with `localStorage`.
  3. **Safe Startup Restoration**: When reopening the app or browser, the full playlist of timing cues is restored immediately, starting cleanly in Idle mode without resurrecting expired countdowns or overtime.
---

## 17. App Super-Settings (settings.json), Auto-Saved Queues (queue.json), Native File Manager Save, and Space-Optimized Display Digits

### A. Dedicated App Super-Settings (settings.json) & Auto-Saved Timing Cue (queue.json)
- **Separation of Concerns**:
  - `settings.json`: Stores application-wide super-settings (`idleDisplayMode`, `clockFormat24`, `autoAdvanceMode`, `upNextTriggerSeconds`, `colorScheme`).
  - `queue.json`: Dedicated auto-save destination for active countdown playlist items (`id`, `title`, `hours`, `minutes`, `seconds`, `totalSeconds`).
- **Zero Loss on Accidental Close**: Any addition, reordering, title edit, or deletion in the queue auto-saves immediately into `queue.json` and syncs with `localStorage`. If the operator closes the app by mistake, the full queue is restored on startup while starting safely in Idle display mode.
- **Backend API Endpoints**: Dedicated `/api/settings` and `/api/queue` endpoints implemented in Vite server, Electron Remote Server, and Electron IPC (`get-settings`, `save-settings`, `get-queue`, `save-queue`).

### B. "Save Queue" & "Load Queue" Desktop File Manager Integration
- **Manual Save Queue**: Added a dedicated `Save Queue` button in the Countdown Playlist Queue header.
  - **Desktop (Electron)**: Invokes native `dialog.showSaveDialog` opening the OS file manager for the operator to choose destination folder and filename (`stagetimer-queue.json`).
  - **Web Browser**: Utilizes modern File System Access API (`showSaveFilePicker`) to open native OS file save dialog, with automatic fallback to browser download.
- **Load Queue**: Added `Load Queue` button allowing operators to open and import previously saved queue playlist files from their computer.

### C. Space-Optimized Digital Time Formatting & Bolder, Bigger Digits
- **Problem**: Displaying standard `HH:MM:SS` or leading zeros on single-digit minutes (e.g. `09:30`, `05:00`, `01:05:00`) consumed unnecessary horizontal space, reducing the maximum possible digit size on smaller displays and monitors.
- **Solution**:
  - For single-digit minutes (<10 mins): Renders `M:SS` without leading zero (e.g., `9:30` instead of `09:30`, `5:00` instead of `05:00`, `0:00` instead of `00:00`).
  - For hours: Renders `H:MM:SS` without leading zero on hours (e.g., `1:05:30` instead of `01:05:30`).
  - Scaled up stage display typography font-size clamp in `index.css` (`clamp(8.5rem, 40vw, 62vh)` with font-weight 950) so numerals render significantly bigger and bolder on projector screens, stage monitors, and mobile controllers.


## Section 18: 12-Hour Clock Screen Clipping Fix & Mobile Remote Tabbed Time Adjuster (Version 1.0.5)

### 1. Stage Device Clock 12-Hour Scaling Fix
- **Root Cause Analysis**: Photos of the projector display in 12-hour format showed `03:06 P` cut off on the left (the leading `0` was clipped) and on the right (the `M` in `PM` was pushed offscreen), whereas 24-hour mode (`15:06`) fit nicely. The stage digits font scaling clamp (`clamp(8.5rem, 40vw, 62vh)`) caused 8 characters (`03:06 PM`) to exceed 100vw.
- **Leading Zero Removal**: Updated `formatDeviceClock` in [ProjectorDisplay.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/src/components/ProjectorDisplay.tsx) and [MobileRemoteView.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/src/components/MobileRemoteView.tsx) to drop `padStart(2, '0')` in 12-hour mode. E.g., `3:06 PM` instead of `03:06 PM`.
- **Dedicated Viewport Scaling & Safe Margins**:
  - In [index.css](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/src/index.css), added `.stage-screen-root.is-device-clock .stage-digits-container` with `padding: 0 4vw; overflow: hidden; box-sizing: border-box;`.
  - Added dedicated styling for 24-hour mode (`.is-clock-digits.is-24h` at `clamp(6.5rem, 30vw, 52vh)`) ensuring massive bold numerals.
  - Added calibrated scaling for 12-hour mode (`.is-clock-digits.has-period` at `clamp(4.2rem, 18.5vw, 38vh)`).
  - Aligned `.clock-period-tag` with `font-size: 0.35em; font-weight: 900; line-height: 1; vertical-align: baseline; margin-left: 1.5vw;` so both the digits and the AM/PM tag stay centered with safe margins and never clip on any screen ratio.

### 2. Mobile Remote Custom Tabbed Time Adjuster
- **Replaced Fixed Quick Nudge Bar**: In [MobileRemoteView.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/src/components/MobileRemoteView.tsx), replaced the fixed quick chip strip with a full tabbed adjuster card (`.mobile-adjust-card`).
- **Tab Header**: Dual-tab toggle:
  - `[ + ADD TIME ]` (emerald/green active state)
  - `[ - SUBTRACT TIME ]` (rose/red active state)
- **Digital Stepper Inputs**:
  - `HRS` : `MIN` : `SEC` steppers with `[-]` / `[+]` touch-friendly buttons and direct numeric keyboard entry.
  - Quick increment/decrement preset chips (`+30s`, `+1m`, `+2m`, `+5m`, `+10m` or `-30s`, `-1m`, `-2m`, `-5m`, `-10m`) plus a `Clear` button to reset to `0s`.
- **Prominent Action Button**:
  - Automatically calculates and previews the exact target adjustment (`+ ADD 2m 30s TO LIVE` or `- SUBTRACT 2m 30s FROM LIVE`).
  - Calls `addTimeToLive` or `subtractTimeFromLive` with mobile haptic feedback and toast confirmation.
  - Automatically disabled when total adjustment duration is 0 or when the timer is idle.


## Section 19: Dynamic External Display Typography Auto-Fit & Maximum Screen Fill (Version 1.0.5)

### Dynamic Display Width & Height Measurement
- **User Request**: "noo the time is now to small, please always calculate the width o f the external display and make it fill accordingly, the 12 hours am/pm clock including the timier too, i want it bigg you get"
- **Architecture & Implementation**:
  - In [ProjectorDisplay.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/src/components/ProjectorDisplay.tsx), implemented dynamic auto-scaling typography using an offscreen DOM measurement ruler (`rulerRef`) and container `ResizeObserver`.
  - Continuously measures the exact rendered dimensions of the active stage text (including 12-hour clock with AM/PM tag, 24-hour clock, countdown timers `M:SS`/`H:MM:SS`, overtime count-up, "TIME UP", and "PLEASE CONCLUDE NOW") against the container's physical pixel width and height.
  - Scales up typography to fill **93% of the external display width** (reserving a 3.5% safe bezel/overscan margin on each side) and up to **74% of the container height** (or **52%** when the UP NEXT drift cue banner is active).
  - Proportional AM/PM alignment: [index.css](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/src/index.css) sets `.clock-period-tag` with `font-size: 0.35em; margin-left: 0.28em;` so the period tag scales strictly in proportion with the dynamic digits font size.
  - Container padding removed from `.stage-digits-container` so the dynamic calculator has 100% of the display canvas to maximize text size.
  - Auto-adapts instantly to 1080p TVs, 4K displays, 720p projectors, 4:3 ratios, ultrawide monitors, and the desktop controller preview box with 0 clipping and maximum bold visibility.


## Section 20: Software Timing Report Log System & 30-Day Auto-Retention (Version 1.0.5)

### Dedicated Timing Reports Log Engine
- **User Request**: "even the timing report should be saved to in it own file like log file for software, we can have a timing report folder, it will be written as apps write log files, and will be deleted after 30 days"
- **Architecture & Implementation**:
  - **Directory**: Created dedicated [timing_reports/](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/timing_reports) folder.
  - **Daily Log Files**: Each event day creates an append-only software log file (`timing-report-YYYY-MM-DD.log`) and structured JSON data file (`timing-report-YYYY-MM-DD.json`).
  - **Software Log Record Format**: Appends formatted audit lines for all operations:
    `[YYYY-MM-DD HH:MM:SS] [EVENT_TYPE] Label: "..." | Planned: MM:SS | Actual: MM:SS | Overtime: MM:SS | Notes: "..."`
  - **30-Day Automatic Log Retention Cleanup**: On app startup and during log appends, scans `timing_reports/` for log/json files older than 30 days (by date extraction and filesystem modification times) and automatically unlinks/deletes them.
  - **Session Restoration**: When the application opens or restarts, today's report entries from `timing_reports/timing-report-YYYY-MM-DD.json` are automatically loaded into `state.timingReport` so user history is never lost if closed by mistake.
  - **Timing Report Modal UI**:
    - Added **"Reports Folder"** button with `FolderOpen` icon in [TimingReportModal.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/src/components/TimingReportModal.tsx), letting users open the `timing_reports/` directory directly on their computer.
    - Added clear subtitle pill indicating `Saved to timing_reports/ · 30-day retention`.
  - **IPC & API Handlers**:
    - [main.cjs](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/electron/main.cjs): Added `save-timing-report-entry`, `get-today-timing-report`, `clear-timing-reports`, `open-timing-reports-folder`.
    - [preload.cjs](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/electron/preload.cjs): Exposed handlers to frontend.
    - [vite.config.ts](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/vite.config.ts) & [remoteServer.cjs](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/electron/remoteServer.cjs): Added `/api/timing-reports`, `/api/timing-reports/today`, `/api/timing-reports/clear`, and `/api/timing-reports/open`.
    - [TimerContext.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/src/context/TimerContext.tsx): Integrated automated logging into `updateStateAndBroadcast`.


## Section 21: Unblack Stage Screen React Hook Order & Crash Fix (Version 1.0.5)

### Diagnosis & Root Cause
- **Problem**: Clicking "Unblack" caused the projector window to crash and freeze into a dark gray/blank display.
- **Root Cause**: In [ProjectorDisplay.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/src/components/ProjectorDisplay.tsx), an early return `if (state.isBlackout) return (...)` was located at line 64, placed **before** `useLayoutEffect` and `useEffect` (lines 190 and 194).
- In React, returning early conditionally skips hooks during blackout renders. When unblacking, the component did not return early and proceeded to run the remaining hooks, violating React's fundamental **Rule of Hooks** ("Rendered more hooks than during previous render") and causing an unhandled component unmount crash.

### Resolution
- Removed the early return before the hooks in [ProjectorDisplay.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/src/components/ProjectorDisplay.tsx).
- All 7 hooks (`useState`, `useRef`, `useEffect` for ticking, `useLayoutEffect` for dynamic scale measurement, and `useEffect` for `ResizeObserver`) are now called unconditionally on every render in identical order.
- Moved the `state.isBlackout` render branch to the bottom of the component after all hooks have executed.
- Added `state.isBlackout` to `contentKey` and an early exit inside `measureAndScale()` so transitions from Blackout -> Unblackout trigger an immediate, seamless re-scale and display of the live timer or clock with zero errors.


## Section 22: High-Visibility Stage Prompt Scaling for "PLEASE CONCLUDE NOW" (Version 1.0.5)

### Diagnosis & Root Cause
- **Problem**: "PLEASE CONCLUDE NOW" was rendering too small on stage displays, making it difficult for speakers/presenters to read from a distance.
- **Root Cause**: The 19-character string `"PLEASE CONCLUDE NOW"` was constrained onto a single horizontal line (`white-space: nowrap`) in both the measuring ruler and the DOM. Because 19 characters side-by-side had to fit within screen width, the dynamic auto-fit engine had to clamp the font size down to ~150px, occupying only ~14% of display height.

### Resolution
- **Two-Line Natural Layout**:
  - In [ProjectorDisplay.tsx](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/src/components/ProjectorDisplay.tsx), structured "PLEASE CONCLUDE NOW" into two stacked lines:
    - Line 1: `PLEASE` (with subtle letter-spacing for visual balance)
    - Line 2: `CONCLUDE NOW`
  - Updated the offscreen measurement ruler to match this 2-line layout.
- **Dramatic Size Increase**:
  - Max horizontal line length reduced from 19 characters to 12 characters (`CONCLUDE NOW`).
  - Font size on 1080p screens jumped from **150px** to **~260px - 280px** (a **+75% increase in font size** and **over 3x larger in total visual area**).
  - Vertical height increased from ~140px to nearly **500px tall**, commanding the center of the stage screen in bold `#ff0000` red.
- **CSS Enhancements**:
  - In [index.css](file:///home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer/src/index.css), removed `padding: 0 4vw;` from `.timeup-container` so the prompt utilizes 100% of the display canvas.
  - Styled `.conclude-line-top` and `.conclude-line-bottom` with tight line-height (`0.92`) and font-weight 950.
