const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const app = express();
const PORT = 3000;

// ── Middleware ─────────────────────────────
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ── Temp workspace ─────────────────────────
const TMP_DIR = path.join(__dirname, "tmp");

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// ── Helpers ────────────────────────────────
const clean = (dir) => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const extractClassName = (code) => {
  const match = code.match(/public\s+class\s+(\w+)/);
  return match ? match[1] : "Main";
};

// ── RUN endpoint ───────────────────────────
app.post("/run", async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.json({
      output: [],
      errors: ["No code provided"],
    });
  }

  const className = extractClassName(code);
  const jobId = Date.now().toString();
  const jobDir = path.join(TMP_DIR, jobId);

  fs.mkdirSync(jobDir);

  const filePath = path.join(jobDir, `${className}.java`);
  fs.writeFileSync(filePath, code);

  // compile + run
  exec(
    `cd ${jobDir} && javac ${className}.java && java ${className}`,
    { timeout: 5000 },
    (err, stdout, stderr) => {
      let output = [];
      let errors = [];

      if (err) {
        errors.push(stderr || err.message);
      } else {
        output = stdout.split("\n").filter(Boolean);
      }

      clean(jobDir);

      res.json({ output, errors });
    }
  );
});

// ── Health check ───────────────────────────
app.get("/", (req, res) => {
  res.send("Java IDE server running 🚀");
});

// ── Start server ───────────────────────────
app.listen(PORT, () => {
  console.log(`🔥 Server running on http://localhost:${PORT}`);
});
