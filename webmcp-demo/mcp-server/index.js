import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API = "http://localhost:3000/api/tasks";

const server = new McpServer({
  name: "webmcp-demo",
  version: "1.0.0"
});

// This server only mirrors the three WebMCP tools that have a REST
// equivalent (list-tasks, add-task, complete-task). The page's
// set-status-filter, set-search-filter, get-visible-tasks, select-task,
// get-selected-task and wizard-* tools operate on transient, in-memory
// browser state -- the current filter, the selected row, the wizard's
// step and draft fields -- none of which is persisted to the server or
// exposed via /api/tasks. There is nothing for this process to call to
// reproduce them.

// Mirror of the WebMCP "list-tasks" tool
server.tool(
  "list-tasks",
  "Returns all tasks in the task list.",
  {},
  async () => {
    const tasks = await fetch(API).then(r => r.json());
    return {
      content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }]
    };
  }
);

// Mirror of the WebMCP "add-task" tool
server.tool(
  "add-task",
  "Adds a new task to the task list.",
  { text: z.string().describe("The text of the task to add.") },
  async ({ text }) => {
    const task = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    }).then(r => r.json());
    return {
      content: [{ type: "text", text: `Task added: ${JSON.stringify(task)}` }]
    };
  }
);

// Mirror of the WebMCP "complete-task" tool
server.tool(
  "complete-task",
  "Marks a task as done by its numeric ID.",
  { id: z.number().describe("The numeric ID of the task to mark as done.") },
  async ({ id }) => {
    const task = await fetch(`${API}/${id}/done`, { method: "PATCH" })
      .then(r => r.json());
    return {
      content: [{ type: "text", text: `Task updated: ${JSON.stringify(task)}` }]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
