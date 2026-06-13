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
| --- | --- | --- |
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

```text
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
cd webmcp-demo

npm install
```

### 2. Start the web server

```bash
npm start
```

This serves the task list page at <http://localhost:3000> and the `/api/tasks`
REST API used by both integration layers.

### 3. Register the MCP server with VS Code Copilot

The MCP server is started automatically by VS Code when Copilot reads
`.vscode/mcp.json`. Open this project in VS Code, and a "Start" button will
appear at the top of `.vscode/mcp.json` — click it to start the server and
discover its tools.

### 4. Try it out

Open Copilot Chat, switch to **Agent** mode, and prompt it with natural
language, for example:

```text
Add a task "Review the WebMCP specification". Then list all tasks.
```

The tools icon in the chat box shows the registered MCP servers and their
tools (`list-tasks`, `add-task`, `complete-task`).

If a future browser implements WebMCP, opening <http://localhost:3000> with a WebMCP-capable browser agent would expose the same three tools directly on the page.

## Architecture summary

```text
Browser (future WebMCP-capable)          VS Code + GitHub Copilot
─────────────────────────────────        ──────────────────────────
  index.html                               .vscode/mcp.json
    └─ document.modelContext               └─ "webmcp-demo" (stdio)
         ├─ list-tasks   ──┐                    ├─ list-tasks   ──┐
         ├─ add-task     ──┼──► HTTP ──► server/index.js (Express / in-memory store)
         └─ complete-task──┘            ├─ add-task     ──┘
                                        └─ complete-task
```

## Difference from WebMCP and MCP

The distinction is best understood across three dimensions: architectural placement, transport mechanism, and integration target.

### Architectural placement

Regular MCP (Model Context Protocol), as designed by Anthropic and formalized at modelcontextprotocol.io, operates entirely in the backend layer. A service exposes an MCP server that runs as a standalone process or remote endpoint, and the AI platform communicates directly with it over a network connection, entirely outside the browser (Anthropic, 2024). The web page and its DOM are bypassed.

WebMCP, by contrast, operates inside the browser page itself. Tools are registered on `document.modelContext` within client-side JavaScript, which means the tool's `execute` callback runs in the same JavaScript context as the page, with full access to the DOM, the application's in-memory state, and the user's authenticated session (Walderman et al., 2025). There is no separate server process: the page itself acts as the tool provider.

### Transport mechanism

Regular MCP communicates over stdio (for local processes) or HTTP with Server-Sent Events (for remote servers). The AI model's host application manages the connection lifecycle independently of any browser tab (GitHub Documentation, 2026). WebMCP does not define a network transport at all: communication is brokered by the browser itself, between a browser-embedded agent and the running page, through a browser-native API (`document.modelContext.registerTool`). The specification explicitly notes that it was decided against directly adopting the MCP transport specification because MCP was built for server-to-client and stdio/SSE process communication and lacks native web concepts such as origins, standard browser permissions, DOM integration, and tab-level lifecycle management (Walderman et al., 2025).

### Integration target

Regular MCP targets AI platforms and coding agents such as GitHub Copilot, Claude Desktop, and similar host applications that read server configurations from files such as `.vscode/mcp.json` or `claude_desktop_config.json`. WebMCP targets browser-embedded agents: agents built directly into the browser, running in extensions, or embedded in iframes on the page. This is a population of agents that does not yet exist at scale in production browsers, which is why WebMCP remains a W3C proposal rather than a shipped API.

### State and authentication

This is arguably the most consequential practical difference. With regular MCP, a backend integration must independently replicate the user's authentication credentials and active session state on a separate server, which introduces security complexity and development overhead. With WebMCP, the tool executes inside the page where the user is already authenticated: it can call the same `fetch()` functions that the page's own UI would call, reuse existing application logic, and read or write the DOM directly, all without any credential replication (Walderman et al., 2025).

### Scope and goals

Regular MCP is designed for autonomous, headless, and fully agentic workflows where no browser UI is necessarily present. WebMCP explicitly excludes both headless browsing scenarios and fully autonomous workflows, positioning itself as a cooperative, human-in-the-loop protocol where the browser interface remains primary and the agent augments rather than replaces user interaction (Walderman et al., 2025). WebMCP is also not intended to replace regular MCP: the specification frames the two as complementary, with WebMCP handling client-side, UI-coupled actions and regular MCP handling server-side, session-independent actions.

A concise comparison of the two is given in the following table.

| Dimension | Regular MCP | WebMCP |
| --- | --- | --- |
| Execution environment | Separate process or remote server | Browser page (client-side JS) |
| Transport | stdio, HTTP/SSE | Browser-native API |
| Auth/state | Must be replicated on server | Inherited from page session |
| Integration target | AI desktop apps, coding agents | Browser-embedded agents |
| DOM access | None | Full |
| Standardization | Published specification (Anthropic) | W3C proposal (not yet shipped) |
| Human in the loop | Optional | Required by design |

In summary, the two protocols share vocabulary (tools, schemas, `inputSchema`) and complementary goals, but they occupy entirely different layers of the stack: regular MCP integrates at the network and platform level, while WebMCP integrates at the browser-page level.

## References

- Microsoft. (2025, July 14). *Model Context Protocol (MCP) support in VS Code is generally available*. GitHub Changelog. <https://github.blog/changelog/2025-07-14-model-context-protocol-mcp-support-in-vs-code-is-generally-available/>
- Visual Studio Code Documentation. (2026). *Add and manage MCP servers in VS Code*. Microsoft. <https://code.visualstudio.com/docs/agent-customization/mcp-servers>
- GitHub Documentation. (2026). *Extending GitHub Copilot Chat with Model Context Protocol (MCP) servers*. GitHub. <https://docs.github.com/copilot/customizing-copilot/using-model-context-protocol/extending-copilot-chat-with-mcp>
- Walderman, B., Lee, L., Nolan, A., Bokan, D., Sagar, K., & Van Opstal, H. (2025). *WebMCP* [Software repository]. W3C Web Machine Learning Community Group. <https://github.com/webmachinelearning/webmcp>
- Anthropic. (2024). *Model Context Protocol introduction*. <https://modelcontextprotocol.io/introduction>
- GitHub Documentation. (2026). *Extending GitHub Copilot Chat with Model Context Protocol (MCP) servers*. GitHub. <https://docs.github.com/copilot/customizing-copilot/using-model-context-protocol/extending-copilot-chat-with-mcp>
- Walderman, B., Lee, L., Nolan, A., Bokan, D., Sagar, K., & Van Opstal, H. (2025). *WebMCP* [Software repository]. W3C Web Machine Learning Community Group. <https://github.com/webmachinelearning/webmcp>
