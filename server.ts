import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import multer from 'multer';
import { z } from 'zod';

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'noticias-py-secret-key';

// Database initialization
const db = new Database('noticias.db');
const schema = fs.readFileSync(path.join(process.cwd(), 'schema.sql'), 'utf8');
db.exec(schema);

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors());

  // --- Auth Middlewares ---
  const authenticateToken = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Acceso denegado' });

    try {
      const verified = jwt.verify(token, JWT_SECRET);
      req.user = verified;
      next();
    } catch (err) {
      res.status(403).json({ error: 'Token inválido' });
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user?.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden realizar esta acción' });
    }
    next();
  };

  // --- API Routes ---

  // Auth Routes
  app.post('/api/auth/registro', async (req, res) => {
    const { email, password, nombre } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare('INSERT INTO usuarios (email, password_hash, nombre) VALUES (?, ?, ?)');
      const info = stmt.run(email, hashedPassword, nombre);
      res.status(201).json({ id: info.lastInsertRowid, email, nombre });
    } catch (error: any) {
      res.status(400).json({ error: 'El email ya existe o datos inválidos' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol, nombre: user.nombre }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/', sameSite: 'lax' });
    res.json({ id: user.id, email: user.email, nombre: user.nombre, rol: user.rol, foto_perfil: user.foto_perfil });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token', { path: '/' });
    res.json({ message: 'Sesión cerrada' });
  });

  app.get('/api/auth/me', (req: any, res) => {
    const token = req.cookies.token;
    if (!token) return res.json(null);

    try {
      const verified: any = jwt.verify(token, JWT_SECRET);
      const user: any = db.prepare('SELECT id, email, nombre, rol, foto_perfil, bio FROM usuarios WHERE id = ?').get(verified.id);
      res.json(user || null);
    } catch (err) {
      res.json(null);
    }
  });

  // Noticias Routes
  app.get('/api/noticias', (req, res) => {
    try {
      const { categoria, q, limit = 10, offset = 0 } = req.query;
      let query = "SELECT n.*, u.nombre as autor_nombre, c.nombre as categoria_nombre FROM noticias n JOIN usuarios u ON n.autor_id = u.id JOIN categorias c ON n.categoria_id = c.id WHERE n.estado = 'publicado'";
      const params: any[] = [];

      if (categoria) {
        query += ' AND c.slug = ?';
        params.push(categoria);
      }
      if (q) {
        query += ' AND (n.titulo LIKE ? OR n.subtitulo LIKE ?)';
        params.push(`%${q}%`, `%${q}%`);
      }

      query += ' ORDER BY n.publicado_en DESC LIMIT ? OFFSET ?';
      params.push(Number(limit), Number(offset));

      const rows = db.prepare(query).all(...params);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: 'Error al obtener noticias' });
    }
  });

  app.get('/api/noticias/:id', (req, res) => {
    try {
      const stmt = db.prepare('SELECT n.*, u.nombre as autor_nombre, u.bio as autor_bio, c.nombre as categoria_nombre FROM noticias n JOIN usuarios u ON n.autor_id = u.id JOIN categorias c ON n.categoria_id = c.id WHERE n.id = ?');
      const noticia: any = stmt.get(req.params.id);
      
      if (noticia) {
        // Incrementar visitas
        db.prepare("INSERT INTO metricas_visitas (noticia_id, fecha, visitas) VALUES (?, date('now'), 1) ON CONFLICT(noticia_id, fecha) DO UPDATE SET visitas = visitas + 1").run(noticia.id);
        res.json(noticia);
      } else {
        res.status(404).json({ error: 'Noticia no encontrada' });
      }
    } catch (error: any) {
      res.status(500).json({ error: 'Error al obtener la noticia' });
    }
  });

  app.post('/api/noticias', authenticateToken, (req: any, res) => {
    const { titulo, subtitulo, contenido, categoria_id, imagen_destacada, estado = 'borrador' } = req.body;
    const publicado_en = estado === 'publicado' ? new Date().toISOString() : null;
    
    const stmt = db.prepare('INSERT INTO noticias (autor_id, titulo, subtitulo, contenido, categoria_id, imagen_destacada, estado, publicado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(req.user.id, titulo, subtitulo, contenido, categoria_id, imagen_destacada, estado, publicado_en);
    res.status(201).json({ id: info.lastInsertRowid });
  });

  // Categorias
  app.get('/api/categorias', (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM categorias WHERE activa = 1').all();
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener categorías' });
    }
  });

  // Images upload
  app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });

  // Metricas
  app.get('/api/metricas', authenticateToken, (req: any, res) => {
    try {
      let query = 'SELECT n.titulo, SUM(m.visitas) as total_visitas FROM metricas_visitas m JOIN noticias n ON m.noticia_id = n.id';
      if (req.user.rol !== 'admin') {
        query += ' WHERE n.autor_id = ?';
      }
      query += ' GROUP BY n.id ORDER BY total_visitas DESC LIMIT 5';
      
      const rows = req.user.rol === 'admin' ? db.prepare(query).all() : db.prepare(query).all(req.user.id);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener métricas' });
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
