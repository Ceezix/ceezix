import express from "express";
import cors from "cors";
import { exec, spawn } from "child_process";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// ===== CONFIG =====
const AUTH_TOKEN = "dnyf123"; // change if needed

// ===== PATH FIX =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== INIT =====
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket"] // 🔥 force stable mode
});

app.use(cors());
app.use(express.json());

// ===== PATHS =====
const LOG_FILE = path.join(process.env.HOME, "dnyf-os/logs/backend.log");

// ===== COMMANDS =====
const CMD = {
  start: "dnyf start",
  stop: "dnyf stop",
  restart: "dnyf restart",
  status: "dnyf status",
  deploy: "dnyf deploy",
  clean: "dnyf clean"
};

// ===== EXEC =====
function run(cmd, cb) {
  exec(cmd, (err, stdout, stderr) => {
    const output = stdout || stderr || err?.message;
    cb(output);
  });
}

// ===== API =====
app.post("/action", (req, res) => {
  const { action, token } = req.body;

  if (token !== AUTH_TOKEN) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  if (!CMD[action]) {
    return res.status(400).json({ error: "Invalid action" });
  }

  run(CMD[action], (output) => {
    io.emit("log", `> ${output}`);
    res.json({ output });
  });
});

// ===== SOCKET AUTH =====
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token || token !== AUTH_TOKEN) {
    console.log("❌ Socket auth failed");
    return next(new Error("Unauthorized"));
  }

  next();
});

// ===== LOG STREAM =====
let watcher = null;

function streamLogs() {
  if (!fs.existsSync(LOG_FILE)) return;

  const proc = spawn("tail", ["-f", LOG_FILE]);

  proc.stdout.on("data", (data) => {
    io.emit("log", data.toString());
  });

  proc.stderr.on("data", (data) => {
    io.emit("log", data.toString());
  });

  return proc;
}

// ===== SOCKET =====
io.on("connection", (socket) => {
  console.log("🟢 Dashboard connected");
  socket.emit("log", "🧠 Connected to DevOps OS");

  if (!watcher) watcher = streamLogs();

  socket.on("disconnect", () => {
    console.log("🔴 Dashboard disconnected");
  });
});

// ===== STATIC =====
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== START =====
const PORT = 5050;

server.listen(PORT, () => {
  console.log(`🚀 Dashboard → http://localhost:${PORT}`);
});
