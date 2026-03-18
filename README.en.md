# Open AUI

> An open-source intelligent assistant framework that lets AI **actually operate your computer**

## Overview

Open AUI (Open AI User Interface) is an open-source multi‑modal AI operation framework. It is designed to let users interact with AI via natural language, and let the AI directly operate the user's computer (terminal, browser, apps, etc.), achieving a "say it, then it happens" experience.

Core ideas:

- **User experience first**: smooth interaction, timely feedback, intuitive UI
- **Zero‑friction deployment**: no Docker required, runs as a single Electron app
- **High usability**: clean UI, clear interactions, easily extensible capabilities
- **Dual modes**: normal chat (Chat) and AI operation mode (AUI)

Key capabilities:

- Voice interaction (with wake word)
- Terminal / console command execution
- Browser web automation
- Task decomposition and multi‑model orchestration
- Behavior memory and conversation summarization
- Chat / AUI dual modes

## Documentation

- **Product design (Chinese)**: [`docs/open-aui-产品设计文档.md`](./docs/open-aui-产品设计文档.md)
- **Product design (English, brief)**: see the "Overview" and "Modules" sections below
- **Changelog (Chinese)**: [`docs/CHANGELOG.md`](./docs/CHANGELOG.md)

## Quick Start

### Option 1: Electron desktop app (recommended)

Double‑click **`启动 Open AUI.bat`** to start everything with one click, or run manually:

```bash
cd frontend
npm install
npm run electron:dev
```

This will open a standalone desktop window, similar to QQ / VS Code. The WebSocket backend is bundled inside the app, so you do **not** need to start the backend separately.

### Option 2: Browser dev mode

Start backend and frontend separately, then open in your browser:

```bash
# Terminal 1: backend
cd backend && npm install && npm start

# Terminal 2: frontend
cd frontend && npm install && npm run dev
```

Then visit `http://localhost:5173` in your browser.

### Packaging as an installer

```bash
cd frontend
npm install
npm run pack        # build and generate installer under release/
```

> Note:
> - Currently the backend works in echo mode: whatever you send will be returned as‑is. AI model integration will be added later.
> - **Development status**: The author is currently focused on AI tool compatibility (GUI, browser, MCP, etc.). The chat module and history/records are not fully developed yet.
> - **Common issues**:
>   - Frontend error `@rollup/rollup-win32-x64-msvc`: run `npm install @rollup/rollup-win32-x64-msvc` in the `frontend` directory.
>   - Electron `EBUSY` error: **fully quit Cursor / VS Code**, then double‑click **`安装依赖.bat`** in File Explorer (do not run it inside the Cursor terminal). If it still fails, try moving the project to a pure ASCII path such as `C:\openAUI` and retry.

## Main Modules (Conceptual)

This section is a concise English summary of the detailed Chinese product design document.

### Voice Module

- Continuous microphone listening and real‑time transcription
- Wake word support (e.g. "小寒", "open aui")
- Hands‑free operation via voice only
- TTS speech feedback for results or replies

### Console / Terminal Module

- Execute arbitrary commands in the user's local shell
- Cross‑platform (Windows PowerShell / CMD, macOS, Linux)
- Safety controls (sandboxing, permission checks, confirmation for dangerous commands)
- Capture stdout/stderr and feed back to the user

### Browser Automation Module

- Parse buttons, inputs, links and other interactive DOM elements
- Operate pages via injected scripts / CDP: click, type, scroll, etc.
- Optional multi‑modal understanding (screenshots / OCR + structure analysis)
- Multiple windows / tabs and switching

### Task Decomposition & Orchestration

- Understand user intent and break it into executable action steps
- Route each sub‑task to the right module (console, browser, extensions, etc.)
- Use different models for different roles (planning, execution, dialog)
- Support serial and conditional flows

### Memory & Conversation Management

- Log each operation: command, actions, result, timestamp
- Manage multi‑turn context and summarization
- Persist memories for later retrieval / session restore
- Use history to improve answer quality and success rate

### Model Groups

- Group of models under one vendor for different roles:
  - Planning / decomposition model
  - Dialog model
  - Speech models (ASR / TTS)
  - Optional vision models
- **Simple config**: pick a model group + fill **one API key per vendor**
- Advanced: override vendor/model per module if needed

### Extension Module

- Custom capabilities via JavaScript / Python scripts
- Register extensions as "abilities" that the planner can call
- Run in sandbox by default for safety

### Chat vs AUI Modes

- **Chat**: pure text Q&A, good for knowledge questions, code explanation, casual chat
- **AUI**: operation mode; can execute console commands, browser flows, extensions, etc.
- Users can toggle modes via the UI.

---

© 盐城小寒科技有限责任公司

