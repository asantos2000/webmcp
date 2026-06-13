# WebMCP Demo: Shared Task List for Browser Agents and VS Code Copilot

This project demonstrates how the same application logic can be exposed to two
different kinds of AI agents:

- A **browser-embedded agent**, via the WebMCP proposal (`document.modelContext`).
- **GitHub Copilot in VS Code**, via a standard stdio MCP server.

The example app is a simple task list. Both integration layers read and write
the same shared state through a small Express REST API, so a task added by
Copilot is immediately visible in the browser (after a refresh), and vice versa.

## What is WebMCP?

WebMCP is a [W3C Web Machine Learning Community Group proposal](https://github.com/webmachinelearning/webmcp)
that defines a `document.modelContext` API. A web page can use this API to
register **tools** — named, schema-described actions (e.g. "add a task",
"list tasks") — directly on the live page. A browser-embedded AI agent can
then discover and call these tools to interact with the page, without
scraping the DOM or relying on a separate backend integration.

This is architecturally different from the **Model Context Protocol (MCP)**
used by tools like GitHub Copilot, VS Code, and Claude:

| | WebMCP (`document.modelContext`) | MCP (stdio/HTTP servers) |
|---|---|---|
| Where it runs | Inside a web page, in the browser | As a separate server process |
| Who calls it | A browser-embedded agent | An MCP client (e.g. VS Code Copilot) |
| Status | Proposal, not yet shipped in any stable browser | Widely supported standard |

Because these two systems operate at different layers, they can't be wired
together directly. The practical bridge is to expose the **same domain
logic** as both: a WebMCP page for the browser agent, and a backend MCP
server for Copilot. That's what this project does — `public/index.html`
registers WebMCP tools, and `mcp-server/index.js` mirrors the same tools as
an MCP server, both calling the same REST API in `server/index.js`.

The `document.modelContext` API is guarded with `if ("modelContext" in
document)`, so the page works as a normal web app in current browsers while
being forward-compatible with browsers that implement WebMCP.

## Project structure

```
webmcp-demo/
├── server/
│   └── index.js          # Express: serves the web page and exposes /api/tasks
├── mcp-server/
│   └── index.js          # stdio MCP server consumed by VS Code Copilot
├── public/
│   └── index.html         # WebMCP-instrumented web page
├── package.json
└── .vscode/
    └── mcp.json           # Registers the MCP server with Copilot
```

The shared state (an in-memory task list) lives in `server/index.js` and is
accessed via:

- `GET /api/tasks` — list all tasks
- `POST /api/tasks` — add a task (`{ "text": "..." }`)
- `PATCH /api/tasks/:id/done` — mark a task as done

## Running the example

### 1. Install dependencies

```bash
npm install
```

### 2. Start the web server

```bash
npm start
```

This serves the task list page at http://localhost:3000 and the `/api/tasks`
REST API used by both integration layers.

### 3. Register the MCP server with VS Code Copilot

The MCP server is started automatically by VS Code when Copilot reads
`.vscode/mcp.json`. Open this project in VS Code, and a "Start" button will
appear at the top of `.vscode/mcp.json` — click it to start the server and
discover its tools.

### 4. Try it out

Open Copilot Chat, switch to **Agent** mode, and prompt it with natural
language, for example:

```
Add a task "Review the WebMCP specification". Then list all tasks.
```

The tools icon in the chat box shows the registered MCP servers and their
tools (`list-tasks`, `add-task`, `complete-task`).

If a future browser implements WebMCP, opening http://localhost:3000 with a
WebMCP-capable browser agent would expose the same three tools directly on
the page.

## Architecture summary

```
Browser (future WebMCP-capable)          VS Code + GitHub Copilot
─────────────────────────────────        ──────────────────────────
  index.html                               .vscode/mcp.json
    └─ document.modelContext               └─ "webmcp-demo" (stdio)
         ├─ list-tasks   ──┐                    ├─ list-tasks   ──┐
         ├─ add-task     ──┼──► HTTP ──► server/index.js (Express / in-memory store)
         └─ complete-task──┘            ├─ add-task     ──┘
                                        └─ complete-task
```

## References

- Microsoft. (2025, July 14). *Model Context Protocol (MCP) support in VS Code is generally available*. GitHub Changelog. https://github.blog/changelog/2025-07-14-model-context-protocol-mcp-support-in-vs-code-is-generally-available/
- Visual Studio Code Documentation. (2026). *Add and manage MCP servers in VS Code*. Microsoft. https://code.visualstudio.com/docs/agent-customization/mcp-servers
- GitHub Documentation. (2026). *Extending GitHub Copilot Chat with Model Context Protocol (MCP) servers*. GitHub. https://docs.github.com/copilot/customizing-copilot/using-model-context-protocol/extending-copilot-chat-with-mcp
- Walderman, B., Lee, L., Nolan, A., Bokan, D., Sagar, K., & Van Opstal, H. (2025). *WebMCP* [Software repository]. W3C Web Machine Learning Community Group. https://github.com/webmachinelearning/webmcp
