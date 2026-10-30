# StageTimer Pro ⏱️

A professional, material-styled web countdown timer engineered for church services, conferences, stage presentations, and multi-screen broadcasts. Built with React, TypeScript, and high-performance Vanilla CSS.

---

## 🌟 Key Features

### 1. Dual-Screen Architecture
- **Operator Control Panel ("The Surface")**: Compact, single-screen dashboard designed for broadcast operators. Features live preview, tactile transport controls, queue staging, and presets.
- **Stage Projector Output ("The Program View")**: Clean, high-contrast, distraction-free display designed for external TVs, stage monitors, or projectors. Pure black background with massive, bold standard `MM:SS` digits.
- **Zero-Latency Real-Time Sync**: Uses modern browser `BroadcastChannel` with `localStorage` fallback to instantly keep the control surface and projector window in sync without needing a backend server or network connection.

### 2. Multi-Timer Countdown Queue (Up to 5 Timers)
- **5-Slot Playlist**: Pre-load up to five countdown times (e.g., 5 minutes, 2 minutes, 15 minutes, etc.) in a single unified dashboard. Starts empty by default.
- **One-Click Play to Projector**: Each slot features a direct `PLAY` button that instantly pushes the countdown to the projector window and begins counting down.
- **`LOAD (READY)` Mode**: Arm any slot directly onto the stage display in standby mode (ready for the speaker to take the stage).
- **Completion Behavior**: When a countdown reaches `00:00`, it stays on Time Up alerts and overtime count-up until the operator clicks Play on the next queued timer.
- **Interactive Queue Management**: Move timers up or down with reorder arrows, click to inline rename segments, or quick-add presets (`+2m`, `+5m`, `+10m`, `+15m`, `+30m`).

### 3. Timer Builder & Direct Shoot Workflow
- **`+ ADD TO QUEUE`**: Build custom durations (Hours : Minutes : Seconds) with segment labels and presets, and add them to the 5-item playlist queue.
- **Direct Shoot (Bypass Queue)**: For emergency or one-off countdowns without queueing:
  - **`LOAD READY`**: Push duration directly to the stage display in armed standby mode.
  - **`START LIVE`**: Push duration directly to stage and begin countdown immediately.
- **Add / Remove Accordion**: Collapsible tool to add (`+30s`, `+1m`, `+5m`, `+15m`, `+1h`) or deduct (`-30s`, `-1m`, `-5m`, `-15m`, `-1h`) time to/from the live clock while a speaker is on stage.
- **Blackout Screen Mode**: Blank the TV display between speakers with a single click.

### 3. Time Up & Overtime Sequence
When the countdown reaches `00:00`:
- **Phase 1 (0s – 5s)**: Displays bold **"TIME UP"** in **red font** on a **pure black background** for 5 seconds.
- **Phase 2 (5s – 10s)**: Transitions to bold **"PLEASE CONCLUDE NOW"** in **red font** on a **pure black background** for 5 seconds.
- **Phase 3 (10s and onward)**: Starts an overtime **count-up in minus starting from `-00:11` upward** (`-00:11`, `-00:12`...) in **red font** on a **pure black background**.
- **Periodic Reminder Alerts**: At every 10-second interval (e.g. 20s, 30s, 40s...), **"TIME UP"** flashes for 2 seconds before continuing the count-up.
- Completely shadow-free with high contrast for maximum legibility on stage monitors and projectors.



### 4. Cross-Platform Desktop Application (Ubuntu / Linux, Windows, macOS)
- **Automatic External Projector Detection**: Just like EasyWorship, ProPresenter, and pro broadcast software, when you click **"Open Projector Screen"**, it detects whether an HDMI monitor, TV, or projector is connected.
- **Instant Fullscreen Coverage**: If an external display is plugged in, the projector window automatically opens directly on that display in borderless fullscreen mode — covering the entire TV without requiring manual dragging or pressing F11!
- **Dynamic Hotplug Migration**: If you open the projector window on your primary screen and plug in an HDMI cable afterwards, the window automatically detects the new display and jumps directly to the TV in fullscreen.
- **Dual-Engine Sync**: Synchronized via both high-speed Electron IPC and browser BroadcastChannel for zero latency and zero drift.
- **Double-Click Fullscreen**: Double-clicking the projector display toggles fullscreen anytime.
- **Top Bar Hardware Indicator**: Real-time status badge showing `🟢 HDMI DISPLAY DETECTED` or `⚪ SINGLE DISPLAY (AUTO-HDMI READY)`.

---

## 🚀 Running & Building

### 🖥️ Desktop Application (Ubuntu / Linux First)

```bash
# 1. Run desktop app in development mode (hot reloading)
npm run electron:dev

# 2. Run desktop app pointing directly to the build
npm run electron

# 3. Build standalone Ubuntu / Linux packages (AppImage + .deb)
npm run build:linux
```
The built Linux installers are generated inside the `release/` folder:
- `StageTimer Pro-1.0.1.AppImage` (Run directly with `chmod +x` and double-click)
- `stagetimer-pro_1.0.1_amd64.deb` (Install on Ubuntu via `sudo dpkg -i release/stagetimer-pro_1.0.1_amd64.deb`)
- `release/linux-unpacked/` (Portable standalone executable folder)

### 🪟 Windows (.EXE Setup Installer & Portable)
The Windows binaries are generated in the `release/` folder:
- `StageTimer Pro Setup 1.0.1.exe` (Standard Windows installation wizard — double-click to install)
- `StageTimer Pro-1.0.1-win.zip` (Portable ZIP package containing `StageTimer Pro.exe`)
- `release/win-unpacked/StageTimer Pro.exe` (Direct standalone executable)

### 🍎 macOS (.APP & ZIP)
The macOS binaries are generated in the `release/` folder:
- `StageTimer Pro-1.0.1-mac.zip` (macOS distribution ZIP containing `StageTimer Pro.app`)
- `release/mac/StageTimer Pro.app` (macOS Application bundle)


### 🌐 Web Browser Mode
```bash
npm run dev
```
- **Control Surface**: `http://localhost:5173/`
- **Projector / TV Output**: `http://localhost:5173/?view=projector`

