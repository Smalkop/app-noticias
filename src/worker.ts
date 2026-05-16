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
    console.error('Categorias Error:', error.message, error.stack);
    return c.json({ error: error.message || 'Error al obtener categorías', details: error.message }, 500);
  }
});

// Auth: Me
app.get('/api/auth/me', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json(null);

  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    const user: any = await c.env.DB.prepare('SELECT id, email, nombre, rol, foto_perfil, bio FROM usuarios WHERE id = ?').bind(payload.id).first();
    // Special check for the admin email to ensure role is updated if needed
    if (user && user.email === 'brahiangonzalez300@gmail.com' && user.rol !== 'admin') {
      await c.env.DB.prepare('UPDATE usuarios SET rol = "admin" WHERE id = ?').bind(user.id).run();
      user.rol = 'admin';
    }
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
    }, secret, 'HS256');
    
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
    
    // Default role: if email is brahiangonzalez300@gmail.com, set as admin
    const rol = email === 'brahiangonzalez300@gmail.com' ? 'admin' : 'suscriptor';
    
    await c.env.DB.prepare(
      'INSERT INTO usuarios (id, email, password_hash, nombre, rol) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, email, password, nombre, rol).run();

    return c.json({ id, email, nombre, rol }, 201);
  } catch (error: any) {
    console.error('Registration Error:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'El email ya está registrado' }, 400);
    }
    return c.json({ error: 'Error al registrar usuario', details: error.message }, 400);
  }
});

// Perfil: Update
app.put('/api/auth/perfil', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    const { nombre, bio, foto_perfil } = await c.req.json();

    await c.env.DB.prepare(
      'UPDATE usuarios SET nombre = ?, bio = ?, foto_perfil = ? WHERE id = ?'
    ).bind(nombre, bio, foto_perfil, payload.id).run();

    return c.json({ message: 'Perfil actualizado' });
  } catch (error: any) {
    return c.json({ error: 'Error al actualizar perfil', details: error.message }, 500);
  }
});

// Autor: Solicitar ser autor
app.post('/api/auth/solicitar-autor', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    
    const body = await c.req.json().catch(() => ({}));
    const motivo = body.motivo || '';

    // Check for existing request
    const existing: any = await c.env.DB.prepare('SELECT id, estado FROM solicitudes_autor WHERE usuario_id = ?').bind(payload.id).first();
    
    if (existing) {
      if (existing.estado === 'pendiente') {
        return c.json({ error: 'Ya tienes una solicitud pendiente' }, 400);
      }
      if (existing.estado === 'aprobado') {
        return c.json({ error: 'Ya eres un autor verificado' }, 400);
      }
      
      // If rejected, update the existing request to pending again
      await c.env.DB.prepare(
        'UPDATE solicitudes_autor SET motivo = ?, estado = "pendiente", creado_en = CURRENT_TIMESTAMP WHERE usuario_id = ?'
      ).bind(motivo, payload.id).run();
    } else {
      // Create new request
      await c.env.DB.prepare(
        'INSERT INTO solicitudes_autor (usuario_id, motivo) VALUES (?, ?)'
      ).bind(payload.id, motivo).run();
    }

    return c.json({ message: 'Solicitud enviada correctamente' });
  } catch (error: any) {
    console.error('Solicitar Autor Error:', error);
    return c.json({ error: 'Error al enviar solicitud', details: error.message }, 500);
  }
});

// Seguidores: Check status
app.get('/api/seguidores/status/:autorId', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ siguiendo: false });

  const autorId = c.req.param('autorId');
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');

    const following = await c.env.DB.prepare('SELECT 1 FROM seguidores WHERE seguidor_id = ? AND autor_id = ?')
      .bind(payload.id, autorId).first();

    return c.json({ siguiendo: !!following });
  } catch (err) {
    return c.json({ siguiendo: false });
  }
});

// Seguidores: Follow
app.post('/api/seguidores/follow/:autorId', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  const autorId = c.req.param('autorId');
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');

    if (payload.id === autorId) return c.json({ error: 'No puedes seguirte a ti mismo' }, 400);

    await c.env.DB.prepare('INSERT OR IGNORE INTO seguidores (seguidor_id, autor_id) VALUES (?, ?)')
      .bind(payload.id, autorId).run();

    return c.json({ message: 'Siguiendo' });
  } catch (error: any) {
    return c.json({ error: 'Error al seguir autor', details: error.message }, 500);
  }
});

// Seguidores: Unfollow
app.post('/api/seguidores/unfollow/:autorId', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  const autorId = c.req.param('autorId');
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');

    await c.env.DB.prepare('DELETE FROM seguidores WHERE seguidor_id = ? AND autor_id = ?')
      .bind(payload.id, autorId).run();

    return c.json({ message: 'Dejaste de seguir' });
  } catch (error: any) {
    return c.json({ error: 'Error al dejar de seguir autor', details: error.message }, 500);
  }
});

// Seguidores: List (Mis Seguidores)
app.get('/api/seguidores/mis-seguidores', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');

    const { results } = await c.env.DB.prepare(`
      SELECT u.id as seguidor_id, u.nombre as seguidor_nombre, u.foto_perfil as seguidor_foto, s.creado_en
      FROM seguidores s
      JOIN usuarios u ON s.seguidor_id = u.id
      WHERE s.autor_id = ?
      ORDER BY s.creado_en DESC
    `).bind(payload.id).all();

    return c.json(results || []);
  } catch (error: any) {
    return c.json({ error: 'Error al obtener seguidores', details: error.message }, 500);
  }
});

// Track visit
app.post('/api/noticias/:id/track', async (c) => {
  const noticiaId = c.req.param('id');
  const { fuente, dispositivo, duracion, scroll, visitor_id } = await c.req.json();
  const token = getCookie(c, 'token');
  let usuario_id = null;
  const ip = c.req.header('cf-connecting-ip') || 'unknown';

  if (token) {
    try {
      const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
      const payload = await verify(token, secret, 'HS256');
      usuario_id = payload.id;
    } catch (e) {}
  }

  await c.env.DB.prepare(`
    INSERT INTO metricas_visitas (noticia_id, usuario_id, visitor_id, ip, fuente, dispositivo, duracion, scroll)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(noticiaId, usuario_id, visitor_id, ip, fuente, dispositivo, duracion, scroll).run();

  return c.json({ success: true });
});

// Reactions: Toggle
app.post('/api/noticias/:id/reaccionar', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'Debes iniciar sesión para reaccionar' }, 401);
  
  try {
    const noticiaId = c.req.param('id');
    const { tipo } = await c.req.json();
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');

    const existing: any = await c.env.DB.prepare(
      'SELECT tipo FROM reacciones WHERE noticia_id = ? AND usuario_id = ?'
    ).bind(noticiaId, payload.id).first();

    if (existing) {
      if (existing.tipo === tipo) {
        await c.env.DB.prepare(
          'DELETE FROM reacciones WHERE noticia_id = ? AND usuario_id = ?'
        ).bind(noticiaId, payload.id).run();
        return c.json({ action: 'removed' });
      } else {
        await c.env.DB.prepare(
          'UPDATE reacciones SET tipo = ? WHERE noticia_id = ? AND usuario_id = ?'
        ).bind(tipo, noticiaId, payload.id).run();
        return c.json({ action: 'updated' });
      }
    } else {
      await c.env.DB.prepare(
        'INSERT INTO reacciones (noticia_id, usuario_id, tipo) VALUES (?, ?, ?)'
      ).bind(noticiaId, payload.id, tipo).run();
      return c.json({ action: 'added' });
    }
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Share: Track
app.post('/api/noticias/:id/compartir', async (c) => {
  const noticiaId = c.req.param('id');
  const { plataforma } = await c.req.json();
  await c.env.DB.prepare(
    'INSERT INTO noticia_shares (noticia_id, plataforma) VALUES (?, ?)'
  ).bind(noticiaId, plataforma).run();
  return c.json({ success: true });
});

// Notificaciones: List
app.get('/api/notificaciones', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM notificaciones WHERE usuario_id = ? ORDER BY creado_en DESC LIMIT 50'
    ).bind(payload.id).all();

    return c.json(results || []);
  } catch (error: any) {
    return c.json({ error: 'Error al obtener notificaciones' }, 500);
  }
});

// Notificaciones: Leer todas
app.post('/api/notificaciones/leer', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    await c.env.DB.prepare('UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?').bind(payload.id).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Error' }, 500);
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
        rol TEXT DEFAULT 'suscriptor',
        foto_perfil TEXT,
        bio TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS solicitudes_autor (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id TEXT UNIQUE NOT NULL,
        motivo TEXT,
        estado TEXT DEFAULT 'pendiente',
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
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
        patrocinada INTEGER DEFAULT 0,
        patrocinio_monto REAL,
        patrocinio_marca TEXT,
        patrocinio_ruc TEXT,
        patrocinio_estado TEXT DEFAULT 'pendiente',
        patrocinio_comprobante TEXT,
        FOREIGN KEY (autor_id) REFERENCES usuarios(id),
        FOREIGN KEY (categoria_id) REFERENCES categorias(id)
      )`),
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS metricas_visitas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        noticia_id TEXT NOT NULL,
        usuario_id TEXT,
        visitor_id TEXT,
        ip TEXT,
        fuente TEXT,
        dispositivo TEXT,
        duracion INTEGER DEFAULT 0,
        scroll INTEGER DEFAULT 0,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (noticia_id) REFERENCES noticias(id)
      )`),
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS reacciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        noticia_id TEXT NOT NULL,
        usuario_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(noticia_id, usuario_id),
        FOREIGN KEY (noticia_id) REFERENCES noticias(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )`),
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS noticia_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        noticia_id TEXT NOT NULL,
        plataforma TEXT NOT NULL,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (noticia_id) REFERENCES noticias(id)
      )`),
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS seguidores (
        seguidor_id TEXT NOT NULL,
        autor_id TEXT NOT NULL,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (seguidor_id, autor_id),
        FOREIGN KEY (seguidor_id) REFERENCES usuarios(id),
        FOREIGN KEY (autor_id) REFERENCES usuarios(id)
      )`),
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS notificaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id TEXT NOT NULL,
        mensaje TEXT NOT NULL,
        tipo TEXT DEFAULT 'info',
        leida INTEGER DEFAULT 0,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )`),
      c.env.DB.prepare(`INSERT OR IGNORE INTO categorias (nombre, slug) VALUES 
        ('Política', 'politica'),
        ('Economía', 'economia'),
        ('Deportes', 'deportes'),
        ('Cultura', 'culture'),
        ('Tecnología', 'tecnologia'),
        ('Internacional', 'internacional')`)
    ]);
    return c.json({ message: 'Base de datos inicializada correctamente' });
  } catch (error: any) {
    return c.json({ error: 'Error al inicializar la base de datos', details: error.message }, 500);
  }
});

// Admin: Migrar DB (Add new columns)
app.get('/api/admin/migrar-db', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    if (payload.rol !== 'admin') return c.json({ error: 'Prohibido' }, 403);

    await c.env.DB.exec(`
      ALTER TABLE noticias ADD COLUMN patrocinada INTEGER DEFAULT 0;
      ALTER TABLE noticias ADD COLUMN patrocinio_monto REAL;
      ALTER TABLE noticias ADD COLUMN patrocinio_marca TEXT;
      ALTER TABLE noticias ADD COLUMN patrocinio_ruc TEXT;
      ALTER TABLE noticias ADD COLUMN patrocinio_estado TEXT DEFAULT 'pendiente';
      ALTER TABLE noticias ADD COLUMN patrocinio_comprobante TEXT;
    `).catch(() => console.log('Columnas patrocionio ya existen'));

    // Advanced metrics migration
    await c.env.DB.exec(`
      ALTER TABLE metricas_visitas ADD COLUMN usuario_id TEXT;
      ALTER TABLE metricas_visitas ADD COLUMN visitor_id TEXT;
      ALTER TABLE metricas_visitas ADD COLUMN ip TEXT;
      ALTER TABLE metricas_visitas ADD COLUMN fuente TEXT;
      ALTER TABLE metricas_visitas ADD COLUMN dispositivo TEXT;
      ALTER TABLE metricas_visitas ADD COLUMN duracion INTEGER DEFAULT 0;
      ALTER TABLE metricas_visitas ADD COLUMN scroll INTEGER DEFAULT 0;
    `).catch(() => console.log('Columnas metricas ya existen'));

    // New tables
    await c.env.DB.exec(`
      CREATE TABLE IF NOT EXISTS reacciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        noticia_id TEXT,
        usuario_id TEXT,
        tipo TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(noticia_id, usuario_id),
        FOREIGN KEY (noticia_id) REFERENCES noticias(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      );
      CREATE TABLE IF NOT EXISTS noticia_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        noticia_id TEXT,
        plataforma TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (noticia_id) REFERENCES noticias(id)
      );
    `).catch(() => console.log('Tablas ya existen'));

    return c.json({ message: 'Migración completada' });
  } catch (error: any) {
    return c.json({ error: 'Error en migración', details: error.message }, 500);
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
      // Assign admin role if email matches
      const rol = email === 'brahiangonzalez300@gmail.com' ? 'admin' : 'suscriptor';
      
      await c.env.DB.prepare(
        'INSERT INTO usuarios (id, email, password_hash, nombre, foto_perfil, rol) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(id, email, 'google-auth-' + google_id, name, picture, rol).run();
      
      user = await c.env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(id).first();
    } else if (email === 'brahiangonzalez300@gmail.com' && user.rol !== 'admin') {
      // Ensure existing user with this email becomes admin
      await c.env.DB.prepare('UPDATE usuarios SET rol = "admin" WHERE id = ?').bind(user.id).run();
      user.rol = 'admin';
    }

    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const token = await sign({ id: user.id, email: user.email, rol: user.rol, nombre: user.nombre }, secret, 'HS256');
    
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
    let payload;
    try {
      payload = await verify(token, secret, 'HS256');
    } catch (e) {
      return c.json({ error: 'Sesión inválida' }, 401);
    }
    
    const body = await c.req.json();
    const { 
      titulo, subtitulo, contenido, categoria_id, imagen_destacada, estado,
      patrocinada, patrocinio_monto, patrocinio_marca, patrocinio_ruc
    } = body;

    if (!titulo || !contenido || !categoria_id) {
      return c.json({ error: 'Faltan campos obligatorios (titulo, contenido, categoria_id)' }, 400);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const catId = parseInt(String(categoria_id));

    if (isNaN(catId)) {
      return c.json({ error: 'ID de categoría inválido' }, 400);
    }

    await c.env.DB.prepare(`
      INSERT INTO noticias (
        id, autor_id, categoria_id, titulo, subtitulo, contenido, imagen_destacada, estado, publicado_en, creado_en, actualizado_en,
        patrocinada, patrocinio_monto, patrocinio_marca, patrocinio_ruc, patrocinio_estado
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, 
      payload.id, 
      catId, 
      titulo, 
      subtitulo || '', 
      contenido, 
      imagen_destacada || '', 
      estado || 'borrador', 
      estado === 'publicado' ? now : null, 
      now, 
      now,
      patrocinada ? 1 : 0,
      patrocinada ? parseFloat(String(patrocinio_monto)) : null,
      patrocinada ? patrocinio_marca : null,
      patrocinada ? patrocinio_ruc : null,
      patrocinada ? 'pendiente' : null
    ).run();

    return c.json({ id, message: 'Noticia creada correctamente' }, 201);
  } catch (error: any) {
    console.error('Create Noticia Error:', error.message, error.stack);
    return c.json({ error: 'Error al crear noticia', details: error.message }, 500);
  }
});

// Noticias: Update
app.put('/api/noticias/:id', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  const newsId = c.req.param('id');
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');

    const body = await c.req.json();
    const { 
      titulo, subtitulo, contenido, categoria_id, imagen_destacada, estado,
      patrocinada, patrocinio_monto, patrocinio_marca, patrocinio_ruc
    } = body;

    // Verificar propiedad o admin
    const existing: any = await c.env.DB.prepare('SELECT autor_id FROM noticias WHERE id = ?').bind(newsId).first();
    if (!existing) return c.json({ error: 'Noticia no encontrada' }, 404);
    if (existing.autor_id !== payload.id && payload.rol !== 'admin') {
      return c.json({ error: 'No tienes permiso para editar esta noticia' }, 403);
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(`
      UPDATE noticias 
      SET titulo = ?, subtitulo = ?, contenido = ?, categoria_id = ?, imagen_destacada = ?, estado = ?, actualizado_en = ?,
          patrocinada = ?, patrocinio_monto = ?, patrocinio_marca = ?, patrocinio_ruc = ?
      WHERE id = ?
    `).bind(
      titulo, subtitulo, contenido, categoria_id, imagen_destacada, estado, now, 
      patrocinada ? 1 : 0, 
      patrocinada ? parseFloat(String(patrocinio_monto)) : null, 
      patrocinada ? patrocinio_marca : null, 
      patrocinada ? patrocinio_ruc : null,
      newsId
    ).run();

    return c.json({ message: 'Noticia actualizada correctamente' });
  } catch (error: any) {
    return c.json({ error: 'Error al actualizar noticia', details: error.message }, 500);
  }
});

// Noticias: Delete
app.delete('/api/noticias/:id', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  const newsId = c.req.param('id');
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');

    // Verificar propiedad o admin
    const existing: any = await c.env.DB.prepare('SELECT autor_id FROM noticias WHERE id = ?').bind(newsId).first();
    if (!existing) return c.json({ error: 'Noticia no encontrada' }, 404);
    if (existing.autor_id !== payload.id && payload.rol !== 'admin') {
      return c.json({ error: 'No tienes permiso para eliminar esta noticia' }, 403);
    }

    await c.env.DB.prepare('DELETE FROM noticias WHERE id = ?').bind(newsId).run();
    return c.json({ message: 'Noticia eliminada correctamente' });
  } catch (error: any) {
    return c.json({ error: 'Error al eliminar noticia', details: error.message }, 500);
  }
});

// Admin: List Requests
app.get('/api/admin/solicitudes', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    if (payload.rol !== 'admin') return c.json({ error: 'Prohibido' }, 403);

    const { results } = await c.env.DB.prepare(`
      SELECT s.*, u.nombre, u.email 
      FROM solicitudes_autor s 
      JOIN usuarios u ON s.usuario_id = u.id 
      WHERE s.estado = 'pendiente'
    `).all();
    return c.json(results || []);
  } catch (error: any) {
    return c.json({ error: 'Error al obtener solicitudes', details: error.message }, 500);
  }
});

// Admin: Handle Request
app.post('/api/admin/solicitudes/:id', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  const requestId = c.req.param('id');
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    if (payload.rol !== 'admin') return c.json({ error: 'Prohibido' }, 403);

    const { accion } = await c.req.json(); // 'aprobar' o 'rechazar'
    
    const solicitud: any = await c.env.DB.prepare(`
      SELECT s.usuario_id, u.email, u.nombre 
      FROM solicitudes_autor s 
      JOIN usuarios u ON s.usuario_id = u.id 
      WHERE s.id = ?
    `).bind(requestId).first();
    
    if (!solicitud) return c.json({ error: 'Solicitud no encontrada' }, 404);

    if (accion === 'aprobar') {
      await c.env.DB.batch([
        c.env.DB.prepare("UPDATE usuarios SET rol = 'autor' WHERE id = ?").bind(solicitud.usuario_id),
        c.env.DB.prepare("UPDATE solicitudes_autor SET estado = 'aprobado' WHERE id = ?").bind(requestId),
        c.env.DB.prepare("INSERT INTO notificaciones (usuario_id, mensaje, tipo) VALUES (?, ?, ?)").bind(
          solicitud.usuario_id, 
          '¡Tu solicitud para ser autor ha sido aprobada! Ya puedes publicar noticias.', 
          'success'
        )
      ]);
      console.log(`[EMAIL SIMULATION] To: ${solicitud.email} - Subject: ¡Felicidades, ya eres autor! - Body: Hola ${solicitud.nombre}, tu solicitud ha sido aprobada.`);
    } else {
      await c.env.DB.batch([
        c.env.DB.prepare("UPDATE solicitudes_autor SET estado = 'rechazado' WHERE id = ?").bind(requestId),
        c.env.DB.prepare("INSERT INTO notificaciones (usuario_id, mensaje, tipo) VALUES (?, ?, ?)").bind(
          solicitud.usuario_id, 
          'Lamentamos informarte que tu solicitud para ser autor no ha sido aprobada en esta ocasión.', 
          'warning'
        )
      ]);
      console.log(`[EMAIL SIMULATION] To: ${solicitud.email} - Subject: Actualización sobre tu solicitud - Body: Hola ${solicitud.nombre}, lamentamos informarte que tu solicitud ha sido rechazada.`);
    }

    return c.json({ message: `Solicitud ${accion}ada` });
  } catch (error: any) {
    return c.json({ error: 'Error al procesar solicitud', details: error.message }, 500);
  }
});

// Admin: List Patrocinios
app.get('/api/admin/patrocinios', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    if (payload.rol !== 'admin') return c.json({ error: 'Prohibido' }, 403);

    const { results } = await c.env.DB.prepare(`
      SELECT n.id, n.titulo, n.patrocinio_marca, n.patrocinio_monto, n.patrocinio_ruc, n.patrocinio_estado, n.patrocinio_comprobante, u.nombre as autor_nombre
      FROM noticias n 
      JOIN usuarios u ON n.autor_id = u.id
      WHERE n.patrocinada = 1 
      ORDER BY n.creado_en DESC
    `).all();
    return c.json(results || []);
  } catch (error: any) {
    return c.json({ error: 'Error al obtener patrocinios', details: error.message }, 500);
  }
});

// Admin: Update Patrocinio Status
app.post('/api/admin/patrocinios/:id/estado', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  const newsId = c.req.param('id');
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    if (payload.rol !== 'admin') return c.json({ error: 'Prohibido' }, 403);

    const { estado } = await c.req.json();
    
    const noticia: any = await c.env.DB.prepare('SELECT autor_id, titulo FROM noticias WHERE id = ?').bind(newsId).first();
    if (!noticia) return c.json({ error: 'Noticia no encontrada' }, 404);

    await c.env.DB.prepare("UPDATE noticias SET patrocinio_estado = ? WHERE id = ?").bind(estado, newsId).run();

    // Notificar al autor
    await c.env.DB.prepare("INSERT INTO notificaciones (usuario_id, mensaje, tipo) VALUES (?, ?, ?)").bind(
      noticia.autor_id, 
      `El patrocinio para tu noticia "${noticia.titulo}" ha cambiado de estado a: ${estado}.`, 
      estado === 'aceptado' ? 'success' : (estado === 'rechazado' ? 'error' : 'info')
    ).run();

    return c.json({ message: 'Estado de patrocinio actualizado' });
  } catch (error: any) {
    return c.json({ error: 'Error al actualizar estado de patrocinio', details: error.message }, 500);
  }
});

// Noticias: Upload Comprobante
app.post('/api/noticias/:id/comprobante', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  const newsId = c.req.param('id');
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');

    const body = await c.req.json();
    const { url } = body;

    const existing: any = await c.env.DB.prepare('SELECT autor_id FROM noticias WHERE id = ?').bind(newsId).first();
    if (!existing) return c.json({ error: 'Noticia no encontrada' }, 404);
    if (existing.autor_id !== payload.id) return c.json({ error: 'Prohibido' }, 403);

    await c.env.DB.prepare("UPDATE noticias SET patrocinio_comprobante = ?, patrocinio_estado = 'en revision' WHERE id = ?").bind(url, newsId).run();

    return c.json({ message: 'Comprobante subido correctamente, en revisión' });
  } catch (error: any) {
    return c.json({ error: 'Error al subir comprobante', details: error.message }, 500);
  }
});

// Noticias: Mis Noticias (for dashboard)
app.get('/api/mis-noticias', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');

    const { results } = await c.env.DB.prepare(`
      SELECT n.*, c.nombre as categoria_nombre 
      FROM noticias n 
      JOIN categorias c ON n.categoria_id = c.id 
      WHERE n.autor_id = ? 
      ORDER BY n.creado_en DESC
    `).bind(payload.id).all();

    return c.json(results || []);
  } catch (error: any) {
    return c.json({ error: 'Error al obtener mis noticias', details: error.message }, 500);
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
      SELECT n.*, u.nombre as autor_nombre, c.nombre as categoria_nombre, c.slug as categoria_slug 
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
  const token = getCookie(c, 'token');
  let currentUserId = null;
  
  if (token) {
    try {
      const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
      const payload = await verify(token, secret, 'HS256');
      currentUserId = payload.id;
    } catch (e) {}
  }

  try {
    const noticia: any = await c.env.DB.prepare(
      'SELECT n.*, u.nombre as autor_nombre, u.bio as autor_bio, c.nombre as categoria_nombre, c.slug as categoria_slug FROM noticias n JOIN usuarios u ON n.autor_id = u.id JOIN categorias c ON n.categoria_id = c.id WHERE n.id = ?'
    ).bind(id).first();

    if (noticia) {
      // Reacciones count
      const { results: reacciones } = await c.env.DB.prepare(
        'SELECT tipo, COUNT(*) as total FROM reacciones WHERE noticia_id = ? GROUP BY tipo'
      ).bind(id).all();
      
      const reaccionesMap: any = {};
      reacciones?.forEach((r: any) => {
        reaccionesMap[r.tipo] = r.total;
      });

      // User reaccion
      let mi_reaccion = null;
      if (currentUserId) {
        const r: any = await c.env.DB.prepare(
          'SELECT tipo FROM reacciones WHERE noticia_id = ? AND usuario_id = ?'
        ).bind(id, currentUserId).first();
        if (r) mi_reaccion = r.tipo;
      }

      noticia.reacciones = reaccionesMap;
      noticia.mi_reaccion = mi_reaccion;
      
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

// Metrics: Detailed stats
app.get('/api/metricas', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);
  const periodo = c.req.query('periodo') || 'mes';
  const noticiaId = c.req.query('noticiaId');

  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    
    let dateFilter = "datetime('now', '-30 days')";
    if (periodo === 'dia') dateFilter = "datetime('now', '-1 day')";
    if (periodo === 'semana') dateFilter = "datetime('now', '-7 days')";
    if (periodo === 'año') dateFilter = "datetime('now', '-1 year')";

    if (noticiaId) {
      const stats: any = await c.env.DB.prepare(`
        SELECT 
          n.titulo,
          COUNT(m.id) as total_visitas,
          COUNT(DISTINCT COALESCE(m.usuario_id, m.visitor_id, m.ip)) as vistas_unicas,
          SUM(CASE WHEN m.fuente = 'redes' THEN 1 ELSE 0 END) as fuentes_redes,
          SUM(CASE WHEN m.fuente = 'buscador' THEN 1 ELSE 0 END) as fuentes_buscador,
          SUM(CASE WHEN m.fuente = 'directo' THEN 1 ELSE 0 END) as fuentes_directo,
          SUM(CASE WHEN m.dispositivo = 'mobile' THEN 1 ELSE 0 END) as dispositivos_mobile,
          SUM(CASE WHEN m.dispositivo = 'desktop' THEN 1 ELSE 0 END) as dispositivos_desktop,
          AVG(m.duracion) as tiempo_medio,
          AVG(m.scroll) as scroll_medio,
          SUM(CASE WHEN m.duracion < 5 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(m.id), 0) as rebotes,
          (SELECT COUNT(*) FROM reacciones WHERE noticia_id = n.id) as interacciones,
          (SELECT COUNT(*) FROM noticia_shares WHERE noticia_id = n.id) as compartidos
        FROM noticias n
        LEFT JOIN metricas_visitas m ON n.id = m.noticia_id AND m.fecha >= ${dateFilter}
        WHERE n.id = ?
        GROUP BY n.id
      `).bind(noticiaId).first();

      if (!stats) return c.json([]);

      return c.json([{
        titulo: stats.titulo,
        total_visitas: stats.total_visitas || 0,
        vistas_unicas: stats.vistas_unicas || 0,
        fuentes: { 
          directo: stats.fuentes_directo || 0, 
          redes: stats.fuentes_redes || 0, 
          buscador: stats.fuentes_buscador || 0 
        },
        dispositivos: { 
          mobile: stats.dispositivos_mobile || 0, 
          desktop: stats.dispositivos_desktop || 0 
        },
        tiempo_medio: Math.round(stats.tiempo_medio || 0),
        scroll_medio: Math.round(stats.scroll_medio || 0),
        rebotes: Math.round(stats.rebotes || 0),
        interacciones: stats.interacciones || 0,
        compartidos: stats.compartidos || 0
      }]);
    } else {
      let query = `
        SELECT n.id, n.titulo, COUNT(m.id) as total_visitas 
        FROM noticias n 
        LEFT JOIN metricas_visitas m ON n.id = m.noticia_id AND m.fecha >= ${dateFilter}
      `;
      const params = [];
      if (payload.rol === 'autor') {
        query += ' WHERE n.autor_id = ?';
        params.push(payload.id);
      }
      query += ' GROUP BY n.id, n.titulo ORDER BY total_visitas DESC LIMIT 10';
      
      const { results } = await c.env.DB.prepare(query).bind(...params).all();
      return c.json(results || []);
    }
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
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
