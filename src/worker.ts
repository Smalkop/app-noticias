import { Hono } from 'hono';
import { jwt, sign, verify } from 'hono/jwt';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

type Bindings = {
  DB: D1Database;
  IMAGES: R2Bucket;
  ASSETS: { fetch: typeof fetch };
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', logger());

// Secret key for JWT
const DEFAULT_SECRET = 'noticias-py-secret-key';

// Middleware for CORS
app.use('*', cors({
  origin: (origin) => origin,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposeHeaders: ['Set-Cookie'],
}));

// Error handling
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Error interno del servidor', message: err.message, name: err.name }, 500);
});

app.use('/api/*', async (c, next) => {
  if (!c.env.DB) {
    return c.json({ error: 'Configuración de base de datos no encontrada (DB binding missing)' }, 500);
  }
  await next();
});

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// Categorías
app.get('/api/categorias', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM categorias WHERE activa = 1').all();
    return c.json(results || []);
  } catch (error: any) {
    console.error('Categorias Error:', error);
    return c.json({ error: 'Error al obtener categorías', details: error.message }, 500);
  }
});

// Auth: Me
app.get('/api/auth/me', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json(null);

  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret);
    const user = await c.env.DB.prepare('SELECT id, email, nombre, rol, foto_perfil, bio FROM usuarios WHERE id = ?').bind(payload.id).first();
    return c.json(user || null);
  } catch (err) {
    return c.json(null);
  }
});

// Auth: Login
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    const user: any = await c.env.DB.prepare('SELECT * FROM usuarios WHERE email = ?').bind(email).first();

    if (!user) {
      return c.json({ error: 'Usuario no encontrado' }, 401);
    }
    
    if (user.password_hash !== password) {
      return c.json({ error: 'Contraseña incorrecta' }, 401);
    }

    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const token = await sign({ 
      id: user.id, 
      email: user.email, 
      rol: user.rol, 
      nombre: user.nombre 
    }, secret);
    
    setCookie(c, 'token', token, {
      path: '/',
      secure: true,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
      sameSite: 'None',
    });

    return c.json({ 
      id: user.id, 
      email: user.email, 
      nombre: user.nombre, 
      rol: user.rol, 
      foto_perfil: user.foto_perfil 
    });
  } catch (error: any) {
    console.error('Login Error:', error);
    return c.json({ error: 'Error al iniciar sesión', details: error.message }, 500);
  }
});

// Auth: Registro
app.post('/api/auth/registro', async (c) => {
  try {
    const { email, password, nombre } = await c.req.json();
    if (!email || !password || !nombre) {
      return c.json({ error: 'Faltan campos obligatorios (email, password, nombre)' }, 400);
    }

    const id = crypto.randomUUID();
    
    // El esquema de setup_d1.sql no tiene 'activo', lo removemos o lo agregamos al SQL
    await c.env.DB.prepare(
      'INSERT INTO usuarios (id, email, password_hash, nombre, rol) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, email, password, nombre, 'autor').run();

    return c.json({ id, email, nombre }, 201);
  } catch (error: any) {
    console.error('Registration Error:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'El email ya está registrado' }, 400);
    }
    return c.json({ error: 'Error al registrar usuario', details: error.message }, 400);
  }
});

// Setup: Inicializar Database (Ruta temporal de utilidad)
app.get('/api/setup-db', async (c) => {
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        nombre TEXT NOT NULL,
        rol TEXT DEFAULT 'autor',
        foto_perfil TEXT,
        bio TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        activa INTEGER DEFAULT 1
      )`),
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS noticias (
        id TEXT PRIMARY KEY,
        autor_id TEXT NOT NULL,
        categoria_id INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        subtitulo TEXT,
        contenido TEXT NOT NULL,
        imagen_destacada TEXT,
        estado TEXT DEFAULT 'borrador',
        destacada INTEGER DEFAULT 0,
        publicado_en DATETIME,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (autor_id) REFERENCES usuarios(id),
        FOREIGN KEY (categoria_id) REFERENCES categorias(id)
      )`),
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS metricas_visitas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        noticia_id TEXT NOT NULL,
        fecha DATE NOT NULL,
        visitas INTEGER DEFAULT 0,
        UNIQUE(noticia_id, fecha),
        FOREIGN KEY (noticia_id) REFERENCES noticias(id)
      )`),
      c.env.DB.prepare(`INSERT OR IGNORE INTO categorias (nombre, slug) VALUES 
        ('Política', 'politica'),
        ('Economía', 'economia'),
        ('Deportes', 'deportes'),
        ('Cultura', 'cultura'),
        ('Tecnología', 'tecnologia'),
        ('Internacional', 'internacional')`)
    ]);
    return c.json({ message: 'Base de datos inicializada correctamente' });
  } catch (error: any) {
    return c.json({ error: 'Error al inicializar la base de datos', details: error.message }, 500);
  }
});

// Auth: Google Login
app.post('/api/auth/google', async (c) => {
  try {
    const { credential } = await c.req.json();
    if (!credential) return c.json({ error: 'No se recibió la credencial de Google' }, 400);

    // En un Worker, para verificar el token de Google sin librerías pesadas:
    // podemos usar la API de Google: https://oauth2.googleapis.com/tokeninfo?id_token=XYZ
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!response.ok) return c.json({ error: 'Token de Google inválido' }, 401);
    
    const payload: any = await response.json();
    const { email, name, picture, sub: google_id } = payload;

    // Verificar si el usuario existe
    let user: any = await c.env.DB.prepare('SELECT * FROM usuarios WHERE email = ?').bind(email).first();

    if (!user) {
      // Crear usuario si no existe
      const id = crypto.randomUUID();
      await c.env.DB.prepare(
        'INSERT INTO usuarios (id, email, password_hash, nombre, foto_perfil, rol) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(id, email, 'google-auth-' + google_id, name, picture, 'autor').run();
      
      user = await c.env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(id).first();
    }

    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const token = await sign({ id: user.id, email: user.email, rol: user.rol, nombre: user.nombre }, secret);
    
    setCookie(c, 'token', token, {
      path: '/',
      secure: true,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
      sameSite: 'None',
    });

    return c.json({ id: user.id, email: user.email, nombre: user.nombre, rol: user.rol, foto_perfil: user.foto_perfil });
  } catch (error: any) {
    console.error('Google Auth Error:', error);
    return c.json({ error: 'Error en autenticación con Google', details: error.message }, 500);
  }
});

// Auth: Logout
app.post('/api/auth/logout', (c) => {
  deleteCookie(c, 'token', { path: '/', sameSite: 'None', secure: true });
  return c.json({ message: 'Sesión cerrada' });
});

// Noticias: Create
app.post('/api/noticias', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret);
    
    const body = await c.req.json();
    const { titulo, subtitulo, contenido, categoria_id, imagen_destacada, estado } = body;

    if (!titulo || !contenido || !categoria_id) {
      return c.json({ error: 'Faltan campos obligatorios (titulo, contenido, categoria_id)' }, 400);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(`
      INSERT INTO noticias (id, autor_id, categoria_id, titulo, subtitulo, contenido, imagen_destacada, estado, publicado_en, creado_en, actualizado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, payload.id, categoria_id, titulo, subtitulo, contenido, imagen_destacada, estado || 'borrador', estado === 'publicado' ? now : null, now, now).run();

    return c.json({ id, message: 'Noticia creada correctamente' }, 201);
  } catch (error: any) {
    console.error('Create Noticia Error:', error);
    return c.json({ error: 'Error al crear noticia', details: error.message }, 500);
  }
});

// Noticias: List
app.get('/api/noticias', async (c) => {
  try {
    const q = c.req.query('q');
    const categoria = c.req.query('categoria');
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = parseInt(c.req.query('offset') || '0');

    let query = `
      SELECT n.*, u.nombre as autor_nombre, c.nombre as categoria_nombre 
      FROM noticias n 
      JOIN usuarios u ON n.autor_id = u.id 
      JOIN categorias c ON n.categoria_id = c.id 
      WHERE n.estado = 'publicado'
    `;
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
    params.push(limit, offset);

    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json(results || []);
  } catch (error: any) {
    console.error('Noticias Error:', error);
    return c.json({ error: 'Error al obtener noticias', details: error.message }, 500);
  }
});

// Noticias: Get
app.get('/api/noticias/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const noticia: any = await c.env.DB.prepare(
      'SELECT n.*, u.nombre as autor_nombre, u.bio as autor_bio, c.nombre as categoria_nombre FROM noticias n JOIN usuarios u ON n.autor_id = u.id JOIN categorias c ON n.categoria_id = c.id WHERE n.id = ?'
    ).bind(id).first();

    if (noticia) {
      // Incrementar visitas (en Cloudflare esto es asíncrono idealmente)
      c.executionCtx.waitUntil(
        c.env.DB.prepare(
          "INSERT INTO metricas_visitas (noticia_id, fecha, visitas) VALUES (?, date('now'), 1) ON CONFLICT(noticia_id, fecha) DO UPDATE SET visitas = visitas + 1"
        ).bind(id).run()
      );
      return c.json(noticia);
    } else {
      return c.json({ error: 'Noticia no encontrada' }, 404);
    }
  } catch (error: any) {
    return c.json({ error: 'Error al obtener noticia', details: error.message }, 500);
  }
});

// Upload: R2
app.post('/api/upload', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  try {
    const body = await c.req.parseBody();
    const file = body['image'] as File;
    if (!file) return c.json({ error: 'No se subió ninguna imagen' }, 400);

    const key = `uploads/${Date.now()}-${file.name}`;
    await c.env.IMAGES.put(key, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    // En Cloudflare Workers Assets, podemos servir el R2 a través de una ruta pública o una URL firmada
    // Para simplificar, asumiremos que configuraste un dominio custom o simplemente devolvemos la ruta que el worker interceptará
    return c.json({ url: `/api/images/${key}` });
  } catch (error: any) {
    return c.json({ error: 'Error al subir imagen', details: error.message }, 500);
  }
});

// Serve R2 images
app.get('/api/images/*', async (c) => {
  const key = c.req.path.replace('/api/images/', '');
  const object = await c.env.IMAGES.get(key);
  if (!object) return c.json({ error: 'Imagen no encontrada' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  return new Response(object.body, { headers });
});

// Métricas
app.get('/api/metricas', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret);
    
    let query = 'SELECT n.titulo, SUM(m.visitas) as total_visitas FROM metricas_visitas m JOIN noticias n ON m.noticia_id = n.id';
    const params: any[] = [];
    
    if (payload.rol !== 'admin') {
      query += ' WHERE n.autor_id = ?';
      params.push(payload.id);
    }
    query += ' GROUP BY n.id, n.titulo ORDER BY total_visitas DESC LIMIT 5';
    
    const { results, error: dbError } = await c.env.DB.prepare(query).bind(...params).all();
    if (dbError) {
      throw new Error(`D1 Error: ${dbError}`);
    }
    return c.json(results || []);
  } catch (error: any) {
    console.error('Metricas Error:', error);
    return c.json({ 
      error: 'Error al obtener métricas', 
      details: error.message,
      stack: error.stack
    }, 500);
  }
});

// --- FALLBACK TO ASSETS ---
app.all('*', async (c) => {
  const url = new URL(c.req.url);
  
  // Si es una ruta de API que no existía arriba, devolvemos 404 JSON
  if (url.pathname.startsWith('/api/')) {
    return c.json({ error: 'Ruta de API no encontrada', path: url.pathname }, 404);
  }

  // Si la ruta parece un archivo estático (tiene extensión), intentar servirlo
  if (url.pathname.includes('.')) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  
  // Para SPA, si no es una ruta de API, servir index.html
  try {
    const indexResponse = await c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url)));
    if (indexResponse.ok) {
      return indexResponse;
    }
  } catch (err) {
    console.error('Error fetching index.html:', err);
  }
  
  return c.text('Not Found', 404);
});

export default app;
