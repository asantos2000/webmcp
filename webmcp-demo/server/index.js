import express from "express";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// In-memory task store (shared state)
const tasks = [];

app.get("/api/tasks", (_req, res) => res.json(tasks));

app.post("/api/tasks", (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });
  const task = { id: Date.now(), text, done: false };
  tasks.push(task);
  res.status(201).json(task);
});

app.patch("/api/tasks/:id/done", (req, res) => {
  const task = tasks.find(t => t.id === Number(req.params.id));
  if (!task) return res.status(404).json({ error: "not found" });
  task.done = true;
  res.json(task);
});

app.listen(3000, () =>
  console.log("Web server running at http://localhost:3000")
);
