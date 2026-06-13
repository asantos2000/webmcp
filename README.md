# WebMCP Demo: Task Dashboard with Live Page State vs. Backend MCP

This project demonstrates the core distinction between **WebMCP**
(`document.modelContext`) and a conventional **backend MCP server** consumed
by tools like GitHub Copilot in VS Code.

The example app is a task dashboard with:

- A persisted task list, backed by a small Express REST API.
- A **client-side search/status filter** that is never sent to the server.
- A **selected task** (highlighted by clicking a row) that exists only in
  the page's in-memory state.
- A **multi-step "New Task" wizard** whose step, validation and field
  visibility are pure client-side logic.

WebMCP tools registered on the page (`public/index.html`) can operate on
*all* of this: the persisted tasks, the live filter, the current selection,
and the wizard's in-progress draft. The backend MCP server
(`mcp-server/index.js`), consumed by Copilot, can only ever see and change
what's exposed by `/api/tasks` — the persisted task list.

## What is WebMCP?

WebMCP is a [W3C Web Machine Learning Community Group proposal](https://github.com/webmachinelearning/webmcp)
that defines a `document.modelContext` API. A web page uses this API to
register **tools** — named, schema-described actions — directly on the live
page. A browser-embedded AI agent can discover and call these tools.

**WebMCP is not "an API caller that happens to run in the browser."** A
tool's `execute` callback can contain any JavaScript the page could otherwise
run: manipulate the DOM, call internal application functions, read
`localStorage`, or call a REST API. The defining characteristic of WebMCP is
not *what* a tool does internally, but *where it runs and what it has access
to*.

### The actual distinction: shared runtime context

A WebMCP tool executes inside the same JavaScript runtime as the page. That
grants access to three things a backend MCP server categorically cannot have:

1. **The live DOM.** A WebMCP tool can read what's currently rendered, click
   things, or update visual elements without scraping HTML. In this demo,
   `select-task` highlights a row in the actual page, and `get-visible-tasks`
   returns exactly the rows the user currently sees under the active filter.

2. **The authenticated session.** A WebMCP tool runs as if it were the user,
   inheriting cookies, in-memory tokens, and session storage transparently. A
   backend server must authenticate independently, which may be impossible
   for short-lived or browser-only tokens. (Not shown directly in this demo,
   since it has no auth, but it's the same mechanism as #3 below.)

3. **Live application state.** A WebMCP tool can read or mutate state held
   in memory — component state, in-progress form data, UI mode — that has
   never been (and may never be) persisted to a server. In this demo, the
   `dashboard` filter/selection state and the `wizard` step/draft state are
   exactly this: they live only in `public/index.html`'s JavaScript and are
   never sent to `server/index.js`.

### What makes it different from a backend MCP calling APIs

A backend MCP server operates on the application's *data model*: it can
create, read, or update records through whatever the API exposes. WebMCP
operates on the *running application itself*. If a page has a multi-step
wizard with client-side validation that's never serialized to a server, a
backend MCP server has no "advance to step 2" endpoint to call — there is
nothing for it to call. A WebMCP tool can call `wizard.goToStep(2)` directly,
because it shares the page's scope.

### A clarifying analogy

A backend MCP server is like a warehouse worker who interacts with a store
only through the loading dock — a formal, documented interface for receiving
and dispatching goods. A WebMCP tool is like a colleague working inside the
store: they can rearrange shelves, talk to customers, read the internal
inventory display, and use the point-of-sale system, all without going
through the loading dock.

### When the two approaches overlap

If a page has no meaningful client-side state beyond what's already exposed
by a REST API, WebMCP and a backend MCP calling that API are functionally
equivalent — a degenerate case, not the general one. This demo deliberately
includes both: `list-tasks`, `add-task`, and `complete-task` are the
degenerate, overlapping case (mirrored in both layers), while the filter,
selection, and wizard tools are the general case that only WebMCP can do.

## Difference from WebMCP and MCP

The distinction is best understood across three dimensions: architectural
placement, transport mechanism, and integration target.

### Architectural placement

Regular MCP (Model Context Protocol), as designed by Anthropic and
formalized at modelcontextprotocol.io, operates entirely in the backend
layer. A service exposes an MCP server that runs as a standalone process or
remote endpoint, and the AI platform communicates directly with it over a
network connection, entirely outside the browser (Anthropic, 2024). The web
page and its DOM are bypassed.

WebMCP, by contrast, operates inside the browser page itself. Tools are
registered on `document.modelContext` within client-side JavaScript, which
means the tool's `execute` callback runs in the same JavaScript context as
the page, with full access to the DOM, the application's in-memory state,
and the user's authenticated session (Walderman et al., 2025). There is no
separate server process: the page itself acts as the tool provider.

### Transport mechanism

Regular MCP communicates over stdio (for local processes) or HTTP with
Server-Sent Events (for remote servers). The AI model's host application
manages the connection lifecycle independently of any browser tab (GitHub
Documentation, 2026). WebMCP does not define a network transport at all:
communication is brokered by the browser itself, between a browser-embedded
agent and the running page, through a browser-native API
(`document.modelContext.registerTool`). The specification explicitly notes
that it was decided against directly adopting the MCP transport
specification because MCP was built for server-to-client and stdio/SSE
process communication and lacks native web concepts such as origins,
standard browser permissions, DOM integration, and tab-level lifecycle
management (Walderman et al., 2025).

### Integration target

Regular MCP targets AI platforms and coding agents such as GitHub Copilot,
Claude Desktop, and similar host applications that read server
configurations from files such as `.vscode/mcp.json` or
`claude_desktop_config.json`. WebMCP targets browser-embedded agents: agents
built directly into the browser, running in extensions, or embedded in
iframes on the page. This is a population of agents that does not yet exist
at scale in production browsers, which is why WebMCP remains a W3C proposal
rather than a shipped API.

### State and authentication

This is arguably the most consequential practical difference. With regular
MCP, a backend integration must independently replicate the user's
authentication credentials and active session state on a separate server,
which introduces security complexity and development overhead. With WebMCP,
the tool executes inside the page where the user is already authenticated:
it can call the same `fetch()` functions that the page's own UI would call,
reuse existing application logic, and read or write the DOM directly, all
without any credential replication (Walderman et al., 2025).

### Scope and goals

Regular MCP is designed for autonomous, headless, and fully agentic
workflows where no browser UI is necessarily present. WebMCP explicitly
excludes both headless browsing scenarios and fully autonomous workflows,
positioning itself as a cooperative, human-in-the-loop protocol where the
browser interface remains primary and the agent augments rather than
replaces user interaction (Walderman et al., 2025). WebMCP is also not
intended to replace regular MCP: the specification frames the two as
complementary, with WebMCP handling client-side, UI-coupled actions and
regular MCP handling server-side, session-independent actions.

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

In summary, the two protocols share vocabulary (tools, schemas,
`inputSchema`) and complementary goals, but they occupy entirely different
layers of the stack: regular MCP integrates at the network and platform
level, while WebMCP integrates at the browser-page level.

## Tool comparison

| Tool | WebMCP (`public/index.html`) | Backend MCP (`mcp-server/index.js`) | Why |
|---|---|---|---|
| `list-tasks` | ✅ | ✅ | Backed by `GET /api/tasks` |
| `add-task` | ✅ | ✅ | Backed by `POST /api/tasks` |
| `complete-task` | ✅ | ✅ | Backed by `PATCH /api/tasks/:id/done` |
| `set-status-filter` / `set-search-filter` | ✅ | ❌ | Filter state exists only in page JS, never sent to the server |
| `get-visible-tasks` | ✅ | ❌ | "What's currently on screen" has no server-side representation |
| `select-task` / `get-selected-task` | ✅ | ❌ | Selection is an in-memory/DOM concept with no API |
| `wizard-go-to-step` / `wizard-set-field` | ✅ | ❌ | Wizard step and draft fields are transient client-side state |
| `wizard-submit` | ✅ | ❌* | Calls the API internally, but only reachable through the wizard's client-side validation |

\* `wizard-submit` ultimately calls `POST /api/tasks`, so the *effect* is
reachable via the backend's `add-task`, but the wizard's step-by-step
flow and validation themselves are not.

## Project structure

```
webmcp-demo/
├── server/
│   └── index.js          # Express: serves the web page and exposes /api/tasks
├── mcp-server/
│   └── index.js          # stdio MCP server consumed by VS Code Copilot
├── public/
│   └── index.html         # WebMCP-instrumented task dashboard
├── package.json
└── .vscode/
    └── mcp.json           # Registers the MCP server with Copilot
```

The persisted state (an in-memory task list) lives in `server/index.js` and
is accessed via:

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

Open <http://localhost:3000> to see the task dashboard: the filter controls,
the task list, and the "New Task" wizard.

### 3. Register the MCP server with VS Code Copilot

The MCP server is started automatically by VS Code when Copilot reads
`.vscode/mcp.json`. Open this project in VS Code, and a "Start" button will
appear at the top of `.vscode/mcp.json` — click it to start the server and
discover its tools.

### 4. Try it out

**Via Copilot (backend MCP — persisted data only):**

```text
Add a task "Review the WebMCP specification". Then list all tasks.
```

The tools icon in the chat box shows the registered MCP servers and their
tools (`list-tasks`, `add-task`, `complete-task`).

**Via a WebMCP-capable browser agent (live page state):**

If a future browser implements WebMCP, opening <http://localhost:3000> with a
WebMCP-capable browser agent would expose all eleven tools, including ones
with no backend equivalent, e.g.:

```text
Filter the task list to show only active tasks containing "spec".
Then select the first visible task and tell me what's selected.
```

```text
Start the New Task wizard, set the text to "Write release notes",
go to step 2, set priority to high, then go to step 3 and submit.
```

Neither of these can be expressed as calls to `mcp-server/index.js`, because
the filter, selection, and wizard state they manipulate exist only in the
browser tab.

## Tool reference and examples

Each tool below shows the `execute()` input and the kind of result it
returns. The first three are also available from the backend MCP server; the
rest are WebMCP-only, operating on live page state.

### `list-tasks`

```json
// input
{}
```
```
// result
[{ "id": 1, "text": "Write release notes", "done": false }]
```
Fetches the full task list from the server and re-renders it. Use this to
get the ground truth, independent of any filter currently applied.

### `add-task`

```json
// input
{ "text": "Review the WebMCP specification" }
```
```
// result
Task added. Current tasks: [{"id":1,"text":"Review the WebMCP specification","done":false}]
```
Creates a task directly via `POST /api/tasks`, bypassing the wizard.

### `complete-task`

```json
// input
{ "id": 1 }
```
```
// result
Task 1 marked done. Tasks: [{"id":1,"text":"Review the WebMCP specification","done":true}]
```
Marks a task done via `PATCH /api/tasks/1/done`.

---

### `set-status-filter` (WebMCP-only)

```json
// input
{ "status": "active" }
```
```
// result
Filter set to "active". Visible tasks: [{"id":2,"text":"Write release notes","done":false}]
```
Updates the on-page status `<select>` and re-renders the list so completed
tasks are hidden. Nothing is sent to the server.

### `set-search-filter` (WebMCP-only)

```json
// input
{ "query": "spec" }
```
```
// result
Search set to "spec". Visible tasks: [{"id":1,"text":"Review the WebMCP specification","done":false}]
```
Filters the on-screen list to tasks whose text contains "spec"
(case-insensitive). Combine with `set-status-filter` — both filters apply
together.

### `get-visible-tasks` (WebMCP-only)

```json
// input
{}
```
```
// result
[{ "id": 1, "text": "Review the WebMCP specification", "done": false }]
```
Returns exactly the rows currently shown under the active filters — i.e.
what the user sees, not the full dataset. With no filter active, this
returns the same set as `list-tasks`.

### `select-task` (WebMCP-only)

```json
// input
{ "id": 1 }
```
```
// result
Selected task: {"id":1,"text":"Review the WebMCP specification","done":false}
```
Highlights row `1` in the DOM (adds the `.selected` class), exactly as if
the user clicked it. Returns an error if no task with that ID exists.

### `get-selected-task` (WebMCP-only)

```json
// input
{}
```
```
// result
{ "id": 1, "text": "Review the WebMCP specification", "done": false }
```
Reads back whichever task is currently highlighted, or `null` if none is
selected. There is no API endpoint that stores this — it only exists as a
JS variable in the page.

### `wizard-go-to-step` (WebMCP-only)

```json
// input
{ "step": 2 }
```
```json
// result
{
  "step": 2,
  "data": { "text": "Write release notes", "priority": "medium" },
  "visibleFields": ["priority"],
  "canAdvance": true
}
```
Navigates the on-page wizard to step 2, toggling which `<div class="step">`
is shown. Calling this with `step: 2` while step 1's `text` field is empty
returns an error (`isError: true`), matching the validation the on-page
"Next" button enforces.

### `wizard-set-field` (WebMCP-only)

```json
// input
{ "field": "priority", "value": "high" }
```
```json
// result
{
  "step": 2,
  "data": { "text": "Write release notes", "priority": "high" },
  "visibleFields": ["priority"],
  "canAdvance": true
}
```
Updates the wizard's in-memory draft and the corresponding `<input>`/`<select>`
element on the page. Nothing is persisted until `wizard-submit` is called.

### `wizard-submit` (WebMCP-only, calls the API internally)

```json
// input
{}
```
```
// result
Task created: {"id":3,"text":"[high] Write release notes","done":false}
```
Posts the wizard's draft to `POST /api/tasks` and resets the wizard back to
step 1. This is the only WebMCP-only tool that touches the server — but
reaching this point requires driving the wizard's step/validation state
first, which `mcp-server/index.js` has no way to do.

### Putting it together: a full wizard walkthrough

```text
wizard-go-to-step { "step": 1 }     -> step 1, text field visible
wizard-set-field  { "field": "text", "value": "Write release notes" }
wizard-go-to-step { "step": 2 }     -> succeeds because text is non-empty
wizard-set-field  { "field": "priority", "value": "high" }
wizard-go-to-step { "step": 3 }     -> shows the review screen
wizard-submit     {}                -> creates "[high] Write release notes"
```

## Architecture summary

```text
Browser (future WebMCP-capable)              VS Code + GitHub Copilot
──────────────────────────────────           ──────────────────────────
  index.html                                   .vscode/mcp.json
    └─ document.modelContext                   └─ "webmcp-demo" (stdio)
         ├─ list-tasks            ──┐               ├─ list-tasks   ──┐
         ├─ add-task              ──┼─► HTTP ──► server/index.js      │
         ├─ complete-task         ──┘          (Express / in-memory)  │
         │                                          ├─ add-task     ──┤
         ├─ set-status-filter     ─┐                └─ complete-task─┘
         ├─ set-search-filter      │
         ├─ get-visible-tasks      ├─► live page state only
         ├─ select-task            │   (filter, selection, wizard) --
         ├─ get-selected-task      │   no backend equivalent
         ├─ wizard-go-to-step      │
         ├─ wizard-set-field       │
         └─ wizard-submit         ─┘
```

## References

- Anthropic. (2024). *Model Context Protocol introduction*. <https://modelcontextprotocol.io/introduction>
- Microsoft. (2025, July 14). *Model Context Protocol (MCP) support in VS Code is generally available*. GitHub Changelog. <https://github.blog/changelog/2025-07-14-model-context-protocol-mcp-support-in-vs-code-is-generally-available/>
- Visual Studio Code Documentation. (2026). *Add and manage MCP servers in VS Code*. Microsoft. <https://code.visualstudio.com/docs/agent-customization/mcp-servers>
- GitHub Documentation. (2026). *Extending GitHub Copilot Chat with Model Context Protocol (MCP) servers*. GitHub. <https://docs.github.com/copilot/customizing-copilot/using-model-context-protocol/extending-copilot-chat-with-mcp>
- Walderman, B., Lee, L., Nolan, A., Bokan, D., Sagar, K., & Van Opstal, H. (2025). *WebMCP* [Software repository]. W3C Web Machine Learning Community Group. <https://github.com/webmachinelearning/webmcp>
