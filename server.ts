import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import multer from "multer";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "locallens-secret-key-123";
const PORT = 3000;

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Database initialization
const dbFile = path.resolve(__dirname, "database.json");
let dbData: { users: any[], posts: any[] } = { users: [], posts: [] };

async function initDb() {
  if (fs.existsSync(dbFile)) {
    dbData = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  } else {
    await saveDb();
  }
}

async function saveDb() {
  await fs.promises.writeFile(dbFile, JSON.stringify(dbData, null, 2));
}

interface AuthRequest extends express.Request {
  user?: {
    id: number;
    username: string;
  };
}

async function startServer() {
  const app = express();
  await initDb();

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  app.use("/uploads", express.static(uploadDir));

  // Auth Middleware
  const authenticateToken = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: "Forbidden" });
      req.user = user;
      next();
    });
  };

  // Multer Storage Configuration
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });
  const upload = multer({ storage });

  // --- API Routes ---
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Auth
  app.post("/api/auth/register", async (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const userExists = dbData.users.find(u => u.username === username || u.email === email);
      if (userExists) {
        return res.status(400).json({ error: "User or Email already exists" });
      }
      
      const newUser = { id: Date.now(), username, email, password: hashedPassword };
      dbData.users.push(newUser);
      await saveDb();
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to register" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = dbData.users.find(u => u.email === email);
    
    if (user && (await bcrypt.compare(password, user.password))) {
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
        expiresIn: "1h",
      });
      res.cookie("token", token, { httpOnly: true });
      res.json({ success: true, user: { id: user.id, username: user.username } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  app.get("/api/auth/me", authenticateToken, (req: AuthRequest, res) => {
    res.json(req.user);
  });

  // Google OAuth
  app.get("/api/auth/google/url", (req, res) => {
    const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account'
    });
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  });

  app.get(['/auth/google/callback', '/auth/google/callback/'], async (req, res) => {
    const { code } = req.query;
    try {
      if (!code) {
         return res.send('No code provided');
      }
      const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/auth/google/callback`;
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          code: code as string,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }).toString(),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        console.error("Token error:", tokenData);
        throw new Error('Failed to obtain access token');
      }
      
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = await userRes.json();
      
      const email = userData.email;
      const username = userData.name || email.split('@')[0];
      
      let user = dbData.users.find(u => u.email === email);
      if (!user) {
        user = { id: Date.now(), username, email, password: "" };
        dbData.users.push(user);
        await saveDb();
      }
      
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
        expiresIn: "1h",
      });
      res.cookie("token", token, { 
        secure: true,
        sameSite: 'none',
        httpOnly: true,
      });
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/profile';
              }
            </script>
            <p>Authentication successful. Redirecting...</p>
          </body>
        </html>
      `);
    } catch (e) {
      console.error('Google Auth Error:', e);
      res.send('Authentication failed check console logs.');
    }
  });

  // Blog Posts
  app.get("/api/posts", async (req, res) => {
    const { username } = req.query;
    
    let posts = dbData.posts.map(p => {
      const author = dbData.users.find(u => u.id === p.user_id)?.username;
      return { ...p, author };
    });

    if (username) {
      posts = posts.filter(p => p.author === username);
    }

    posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(posts);
  });

  app.delete("/api/posts/:id", authenticateToken, async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
      const post = dbData.posts.find(p => p.id == id);
      if (!post) return res.status(404).json({ error: "Post not found" });
      if (!req.user || post.user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized to delete this post" });

      // Optionally delete file from disk here
      if (post.media_url) {
        const filePath = path.join(__dirname, post.media_url);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      dbData.posts = dbData.posts.filter(p => p.id != id);
      await saveDb();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete post" });
    }
  });

  app.post("/api/posts", authenticateToken, upload.single("media"), async (req: AuthRequest, res) => {
    const { title, content } = req.body;
    const media_url = req.file ? `/uploads/${req.file.filename}` : null;
    const media_type = req.file ? (req.file.mimetype.startsWith("video") ? "video" : "image") : null;

    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      
      const newPost = {
        id: Date.now(),
        user_id: req.user.id,
        title,
        content,
        media_url,
        media_type,
        created_at: new Date().toISOString()
      };
      
      dbData.posts.push(newPost);
      await saveDb();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static files from dist
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> LocalLens Server is active at http://0.0.0.0:${PORT}`);
  });
}

startServer();
