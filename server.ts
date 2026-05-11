import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-change-in-production";
const DB_FILE = "./database.json";

// Simple JSON Database
let db = {
  users: [] as any[],
  preferences: [] as any[]
};

async function loadDb() {
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    db = JSON.parse(data);
  } catch (e) {
    // File doesn't exist or is invalid, use default empty db
    await saveDb();
  }
}

async function saveDb() {
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

async function startServer() {
  await loadDb();
  
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: "Forbidden" });
      req.user = user;
      next();
    });
  };

  // API Routes
  app.post("/api/signup", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    if (db.users.find(u => u.username === username)) {
      return res.status(400).json({ error: "Username already exists" });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newId = db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1;
      
      db.users.push({ id: newId, username, password: hashedPassword });
      
      // Default preferences
      db.preferences.push({
        user_id: newId,
        zeta: 1.0,
        bloomScale: 1.8,
        selectedPathways: ["RAS_MAPK", "PI3K_AKT", "Cell_Cycle", "Apoptosis", "Angiogenesis"]
      });
      
      await saveDb();

      const token = jwt.sign({ id: newId, username }, JWT_SECRET, { expiresIn: "24h" });
      res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production" });
      res.json({ id: newId, username });
    } catch (error: any) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user = db.users.find(u => u.username === username);
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "24h" });
    res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production" });
    res.json({ id: user.id, username: user.username });
  });

  app.post("/api/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  app.get("/api/me", authenticateToken, (req: any, res: any) => {
    res.json(req.user);
  });

  app.get("/api/preferences", authenticateToken, (req: any, res: any) => {
    const prefs = db.preferences.find(p => p.user_id === req.user.id);
    if (prefs) {
      res.json({
        zeta: prefs.zeta,
        bloomScale: prefs.bloomScale,
        selectedPathways: prefs.selectedPathways
      });
    } else {
      res.status(404).json({ error: "Preferences not found" });
    }
  });

  app.post("/api/preferences", authenticateToken, async (req: any, res: any) => {
    const { zeta, bloomScale, selectedPathways } = req.body;
    const prefIndex = db.preferences.findIndex(p => p.user_id === req.user.id);
    
    if (prefIndex >= 0) {
      db.preferences[prefIndex] = { ...db.preferences[prefIndex], zeta, bloomScale, selectedPathways };
    } else {
      db.preferences.push({ user_id: req.user.id, zeta, bloomScale, selectedPathways });
    }
    
    await saveDb();
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
