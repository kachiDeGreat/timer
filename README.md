# StageTimer Pro ⏱️

A professional, material-styled web countdown timer engineered for church services, conferences, stage presentations, and multi-screen broadcasts. Built with React, TypeScript, and high-performance Vanilla CSS.

---

## 🌟 Key Features

### 1. Dual-Screen Architecture
- **Operator Control Panel ("The Surface")**: Compact, single-screen dashboard designed for broadcast operators. Features live preview, tactile transport controls, queue staging, and presets.
- **Stage Projector Output ("The Program View")**: Clean, high-contrast, distraction-free display designed for external TVs, stage monitors, or projectors. Pure black background with massive, bold standard `MM:SS` digits.
- **Zero-Latency Real-Time Sync**: Uses modern browser `BroadcastChannel` with `localStorage` fallback to instantly keep the control surface and projector window in sync without needing a backend server or network connection.

### 2. Live Staging & Fast-Tracking Workflow
- **Staged Small Box**: Whenever you select a preset or type a duration, it stages the time in the small preview box.
  - **`LOAD (READY)`**: Pushes the time onto the stage projector in standby/armed mode without running (clears previous Time Up alerts and displays the new duration ready for the speaker).
  - **`START`**: Pushes the time and immediately begins the countdown. If the timer is already running, it fast-tracks/jumps to the new duration instantly.
- **Add / Remove Accordion**: Collapsible tool to add (`+30s`, `+1m`, `+2m 30s`, `+5m`) or deduct (`-30s`, `-1m`, `-2m`, `-5m`) time to/from the live clock.
- **Blackout Screen Mode**: Blank the TV display between speakers with a single click.

### 3. Pure Red Time Up Sequence
When the countdown reaches `00:00`:
- The entire stage background switches from black to **pure solid red (`#ff0000`)**.
- Displays solid white pulsing **"TIME UP"** (heartbeat animation).
- Alternates with massive static text: **"PLEASE CONCLUDE NOW"** until the operator resets or loads the next session.
- Completely shadow-free for maximum legibility on stage monitors.

### 4. Multi-Screen Window Management
- **One-Click Extended Screen Placement**: Uses the browser's Window Management API (`getScreenDetails()`) to automatically detect secondary monitors (TV/Projector) and position the output window directly on it.
- **Fullscreen Mode**: Press `F11`, double-click, or click the fullscreen button in the projector window.
- **OBS Studio Integration**: Add as a Browser Source using URL `http://localhost:5174/?view=projector`.

---

## 🚀 Running the Project

```bash
# 1. Navigate to the timer directory
cd "/home/onyekachi-godswill-richard/Desktop/WEB DEV/Web Dev/timer"

# 2. Start the development server
npm run dev
```

- **Control Surface**: `http://localhost:5174/`
- **Projector / TV Output**: `http://localhost:5174/?view=projector`
