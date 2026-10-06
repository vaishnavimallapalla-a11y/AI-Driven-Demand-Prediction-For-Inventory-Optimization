import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const PORT = 3000;

const db = new Database('inventory.db');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    role TEXT,
    avatar TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT,
    sku TEXT,
    category TEXT,
    currentStock INTEGER,
    minStock INTEGER,
    price REAL,
    status TEXT,
    prediction INTEGER,
    confidence INTEGER,
    lastUpdated TEXT,
    image TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT,
    title TEXT,
    description TEXT,
    timestamp TEXT,
    severity TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    date TEXT,
    actual REAL,
    predicted REAL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cors());

  // Middleware to verify JWT
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Forbidden' });
      req.user = user;
      next();
    });
  };

  // Auth Routes
  app.post('/api/auth/signup', async (req, res) => {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = Math.random().toString(36).substring(2, 15);

    try {
      db.prepare('INSERT INTO users (id, email, password, name, role, avatar) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, email, hashedPassword, name, 'Admin', `https://i.pravatar.cc/150?u=${id}`);
      
      const token = jwt.sign({ id, email, name }, JWT_SECRET);
      res.json({ token, user: { id, email, name, role: 'Admin' } });
    } catch (error) {
      res.status(400).json({ error: 'Email already exists' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar } });
  });

  // Product Routes
  app.get('/api/products', authenticateToken, (req: any, res) => {
    const products = db.prepare('SELECT * FROM products WHERE user_id = ?').all(req.user.id);
    res.json(products);
  });

  app.post('/api/products', authenticateToken, (req: any, res) => {
    const { name, sku, category, currentStock, minStock, price, status, prediction, confidence, image } = req.body;
    const id = Math.random().toString(36).substring(2, 15);
    const lastUpdated = new Date().toISOString();

    db.prepare(`
      INSERT INTO products (id, user_id, name, sku, category, currentStock, minStock, price, status, prediction, confidence, lastUpdated, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, name, sku, category, currentStock, minStock, price, status, prediction, confidence, lastUpdated, image);

    res.json({ id, name, sku, category, currentStock, minStock, price, status, prediction, confidence, lastUpdated, image });
  });

  app.put('/api/products/:id', authenticateToken, (req: any, res) => {
    const { name, sku, category, currentStock, minStock, price, status, prediction, confidence, image } = req.body;
    const lastUpdated = new Date().toISOString();

    db.prepare(`
      UPDATE products 
      SET name = ?, sku = ?, category = ?, currentStock = ?, minStock = ?, price = ?, status = ?, prediction = ?, confidence = ?, lastUpdated = ?, image = ?
      WHERE id = ? AND user_id = ?
    `).run(name, sku, category, currentStock, minStock, price, status, prediction, confidence, lastUpdated, image, req.params.id, req.user.id);

    res.json({ success: true });
  });

  app.delete('/api/products/:id', authenticateToken, (req: any, res) => {
    db.prepare('DELETE FROM products WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  // Activity Routes
  app.get('/api/activities', authenticateToken, (req: any, res) => {
    const activities = db.prepare('SELECT * FROM activities WHERE user_id = ? ORDER BY timestamp DESC').all(req.user.id);
    res.json(activities);
  });

  app.post('/api/activities', authenticateToken, (req: any, res) => {
    const { type, title, description, severity } = req.body;
    const id = Math.random().toString(36).substring(2, 15);
    const timestamp = new Date().toISOString();

    db.prepare(`
      INSERT INTO activities (id, user_id, type, title, description, timestamp, severity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, type, title, description, timestamp, severity);

    res.json({ id, type, title, description, timestamp, severity });
  });

  // Sales/Analytics Routes
  app.get('/api/sales', authenticateToken, (req: any, res) => {
    const sales = db.prepare('SELECT * FROM sales WHERE user_id = ?').all(req.user.id);
    res.json(sales);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
