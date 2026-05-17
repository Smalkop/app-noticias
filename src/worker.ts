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
  'id sendpulse': string;
  'secret sendpulse': string;
  SENDPULSE_LIST_ID: string;
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

// CSP Middleware
app.use('*', async (c, next) => {
  await next();
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://static.cloudflareinsights.com",
    "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://api.sendpulse.com",
    "frame-src 'self' https://accounts.google.com",
    "img-src 'self' data: https: *",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com"
  ].join('; ');
  c.header('Content-Security-Policy', csp);
});

// Error handling
app.onError((err, c) => {
  console.error('App Error:', err);
  return c.json({ 
    error: 'Error interno del servidor', 
    message: err.message,
    stack: err.stack 
  }, 500);
});

// Sanitization helper to prevent XSS
function sanitize(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Password validation helper
function isPasswordSafe(password: string): boolean {
  // Min 8 characters, upper, lower, number, special char
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
}

// Hashing Helpers using Web Crypto API (PBKDF2)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  const key = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashArray = Array.from(new Uint8Array(key));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;
  
  // If the hash doesn't follow our secure format, it might be an old plain text password
  if (!storedHash.includes(':')) {
    return password === storedHash;
  }
  
  const [saltHex, originalHashHex] = storedHash.split(':');
  try {
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    const key = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    
    const hashHex = Array.from(new Uint8Array(key))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
      
    return hashHex === originalHashHex;
  } catch (e) {
    return false;
  }
}

// Helper for SendPulse
async function addToSendPulse(c: any, email: string, nombre: string, phone?: string) {
  const spId = c.env['id sendpulse'];
  const spSecret = c.env['secret sendpulse'];
  const spListId = c.env.SENDPULSE_LIST_ID;
  
  if (!spId || !spSecret || !spListId) {
    console.error('SendPulse Error: Credenciales o ID de lista faltantes', { 
      hasId: !!spId, 
      hasSecret: !!spSecret, 
      hasListId: !!spListId,
      listId: spListId
    });
    return { success: false, error: 'Credenciales faltantes en el servidor' };
  }

  try {
    // 1. Obtener Token
    const authRes = await fetch('https://api.sendpulse.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: spId,
        client_secret: spSecret
      })
    });
    
    if (!authRes.ok) {
      const errText = await authRes.text();
      console.error('SendPulse Auth Error:', errText);
      return { success: false, error: `Error de Auth: ${authRes.status}` };
    }
    
    const { access_token } = await authRes.json() as any;

    // 2. Preparar datos (SendPulse es sensible a los nombres de variables)
    const emailData: any = {
      email,
      variables: { 
        'Nombre': nombre,
        'nombre': nombre,
        'Name': nombre,
        'name': nombre
      }
    };
    if (phone) {
      emailData.variables.Phone = phone;
      emailData.variables.phone = phone;
      emailData.variables['Teléfono'] = phone;
      emailData.variables['Telefono'] = phone;
    }

    // 3. Enviar a la lista con la estructura exacta de la documentación
    const spRes = await fetch(`https://api.sendpulse.com/addressbooks/${spListId}/emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emails: [emailData],
        confirmation: "force", // Valor exacto requerido para DOI
        sender_email: "gonzalez@brahian.dev", // Emisor solicitado
        template_id: "44146dba-5aa2-4639-9198-d716abf985d8", // Tu UUID de planilla
        message_lang: "es" // Idioma del correo
      })
    });

    const result = await spRes.json() as any;
    
    // IF PHONE EXISTS: Update phone specifically using the PUT endpoint
    if (phone && spRes.ok) {
      try {
        const phoneClean = phone.replace(/\s+/g, '').replace('+', ''); // SendPulse usually likes clean digits
        const phoneRes = await fetch(`https://api.sendpulse.com/addressbooks/${spListId}/phone`, {
          method: 'PUT',
          headers: { 
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: parseInt(spListId),
            email: email,
            phone: phoneClean
          })
        });
        const phoneResult = await phoneRes.json() as any;
        console.log('SendPulse Phone API Result:', phoneResult);
        
        // Log phone sync result
        try {
          await c.env.DB.prepare('INSERT INTO webhook_logs (payload) VALUES (?)')
            .bind(`SendPulse Phone PUT [${email}] Result: ` + JSON.stringify(phoneResult)).run();
        } catch(e) {}
      } catch (phoneErr: any) {
        console.error('SendPulse Phone Sync Error:', phoneErr);
      }
    }
    
    // Log to D1 for debugging
    try {
      const dbStatus = spRes.ok ? "SUCCESS" : "ERROR";
      const logMsg = `SendPulse Main POST [${email}] (Phone: ${phone}) Result: ${JSON.stringify(result)}`;
      await c.env.DB.prepare('INSERT INTO webhook_logs (payload) VALUES (?)')
        .bind(logMsg).run();
    } catch(e) {}

    if (!spRes.ok) {
      console.error('SendPulse API Error:', result);
      return { success: false, error: result.message || 'Error desconocido API', details: result };
    }

    console.log(`SendPulse Success para ${email}:`, result);
    return { success: true, result };
  } catch (error: any) {
    console.error('SendPulse Exception:', error);
    return { success: false, error: error.message };
  }
}

// ... despues de remover de sendpulse
async function removeFromSendPulse(c: any, email: string) {
  const spId = c.env['id sendpulse'];
  const spSecret = c.env['secret sendpulse'];
  const spListId = c.env.SENDPULSE_LIST_ID;
  if (!spId || !spSecret || !spListId) return;

  try {
    const authRes = await fetch('https://api.sendpulse.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: spId, client_secret: spSecret })
    });
    const { access_token } = await authRes.json() as any;

    await fetch(`https://api.sendpulse.com/addressbooks/${spListId}/emails`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: [email] })
    });
  } catch (err) { console.error('SendPulse Delete Error:', err); }
}

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
    const user: any = await c.env.DB.prepare('SELECT id, email, nombre, rol, foto_perfil, bio, verificado, telefono FROM usuarios WHERE id = ?').bind(payload.id).first();
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
    if (!email || !password) {
      return c.json({ error: 'Email y contraseña son obligatorios' }, 400);
    }

    const user: any = await c.env.DB.prepare('SELECT * FROM usuarios WHERE email = ?').bind(email).first();

    if (!user) {
      return c.json({ error: 'Credenciales inválidas' }, 401);
    }
    
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json({ error: 'Credenciales inválidas' }, 401);
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

    // Sanitization
    const cleanNombre = sanitize(nombre.trim());
    const cleanEmail = email.toLowerCase().trim();

    // Password validation
    if (!isPasswordSafe(password)) {
      return c.json({ 
        error: 'La contraseña no es segura. Debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y caracteres especiales (@$!%*?&).' 
      }, 400);
    }

    const id = crypto.randomUUID();
    const hashedPassword = await hashPassword(password);
    
    // Default role: if email matches admin, set as admin
    const rol = cleanEmail === 'brahiangonzalez300@gmail.com' ? 'admin' : 'suscriptor';
    
    await c.env.DB.prepare(
      'INSERT INTO usuarios (id, email, password_hash, nombre, rol, verificado) VALUES (?, ?, ?, ?, ?, 0)'
    ).bind(id, cleanEmail, hashedPassword, cleanNombre, rol).run();

    // Add to SendPulse in background
    c.executionCtx.waitUntil(addToSendPulse(c, cleanEmail, cleanNombre));

    return c.json({ id, email: cleanEmail, nombre: cleanNombre, rol, verificado: 0 }, 201);
  } catch (error: any) {
    console.error('Registration Error:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'El email ya está registrado' }, 400);
    }
    return c.json({ error: 'Error al registrar usuario. Asegúrese de que los datos sean correctos.' }, 400);
  }
});

// Perfil: Update
app.put('/api/auth/perfil', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256') as any;
    const { nombre, bio, foto_perfil, telefono } = await c.req.json();

    await c.env.DB.prepare(`
      UPDATE usuarios 
      SET nombre = ?, 
          bio = ?, 
          foto_perfil = ?,
          telefono = ?
      WHERE id = ?
    `).bind(nombre, bio, foto_perfil, telefono, payload.id).run();

    // Sync with SendPulse
    const user: any = await c.env.DB.prepare('SELECT email, nombre, telefono FROM usuarios WHERE id = ?').bind(payload.id).first();
    if (user) {
      c.executionCtx.waitUntil(addToSendPulse(c, user.email, user.nombre, user.telefono));
    }

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
  try {
    const data = await c.req.json();
    const { fuente, dispositivo, duracion, scroll, visitor_id } = data;
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
    `).bind(noticiaId, usuario_id, visitor_id, ip, fuente, dispositivo, duracion || 0, scroll || 0).run();

    return c.json({ success: true });
  } catch (err: any) {
    console.error('Error tracking visit:', err);
    return c.json({ error: err.message }, 400);
  }
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

// Redundant endpoint removed

// Webhook for SendPulse Verification
app.post('/api/webhook/sendpulse', async (c) => {
  try {
    let body: any;
    const contentType = c.req.header('content-type') || '';
    
    if (contentType.includes('application/json')) {
      body = await c.req.json();
    } else {
      body = await c.req.parseBody();
    }

    console.log('SendPulse Webhook Received:', JSON.stringify(body));
    
    // Log for debugging
    try {
      await c.env.DB.prepare('INSERT INTO webhook_logs (payload) VALUES (?)').bind(JSON.stringify(body)).run();
    } catch (e) {
      console.error('Failed to log webhook:', e);
    }
    
    // SendPulse can send an array or a single object
    const events = Array.isArray(body) ? body : [body];
    
    for (const event of events) {
      // Normalizar búsqueda de email: top level, data.email, variables, etc.
      let emailRaw = event.email || (event.data && event.data.email);
      
      // Si no está fácil, buscar en variables
      if (!emailRaw && event.variables) {
        if (typeof event.variables === 'string') {
          // A veces viene como string JSON
          try {
            const v = JSON.parse(event.variables);
            emailRaw = v.email || v.Email;
          } catch(e) {}
        } else {
          emailRaw = event.variables.email || event.variables.Email;
        }
      }

      if (emailRaw) {
        const email = emailRaw.toString().trim();
        // Usar LOWER para evitar problemas de capitalización
        console.log(`Intentando verificar email: ${email}`);
        
        const result = await c.env.DB.prepare('UPDATE usuarios SET verificado = 1 WHERE LOWER(email) = LOWER(?)')
          .bind(email).run();
        
        if (result.meta.changes > 0) {
          console.log(`Usuario verificado con éxito vía webhook: ${email}`);
          
          const user: any = await c.env.DB.prepare('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)').bind(email).first();
          if (user) {
            await c.env.DB.prepare(`
              INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, leida)
              VALUES (?, '¡Cuenta Verificada!', 'Tu correo electrónico ha sido verificado con éxito.', 'sistema', 0)
            `).bind(user.id).run();
          }
        } else {
          console.log(`Webhook no encontró usuario para: ${email} (o ya estaba verificado)`);
        }
      } else {
        console.log('Webhook no contenía email identificable:', JSON.stringify(event));
      }
    }
    return c.json({ ok: true, message: 'Processed' });
  } catch (err: any) {
    console.error('Webhook Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// Admin: Get webhook logs
app.get('/api/admin/webhook-logs', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256') as any;
    if (payload.rol !== 'admin') return c.json({ error: 'Prohibido' }, 403);

    // Safety check for table existence
    try {
      const logs: any = await c.env.DB.prepare('SELECT * FROM webhook_logs ORDER BY creado_en DESC LIMIT 50').all();
      return c.json(logs.results || []);
    } catch (e: any) {
      if (e.message.includes('no such table')) {
        return c.json([{ id: 0, payload: 'La tabla webhook_logs aún no existe. Ejecuta Configurar/Migrar DB.', creado_en: new Date().toISOString() }]);
      }
      throw e;
    }
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Admin: Sync verification status with SendPulse
app.post('/api/admin/sync-verificaciones', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256') as any;
    if (payload.rol !== 'admin') return c.json({ error: 'Prohibido' }, 403);

    // 1. Get unverified users
    const unverifiedUsers: any = await c.env.DB.prepare('SELECT id, email FROM usuarios WHERE verificado = 0').all();
    
    if (!unverifiedUsers.results || unverifiedUsers.results.length === 0) {
      return c.json({ message: 'No hay usuarios pendientes de verificación', synced: 0 });
    }

    // 2. Get SendPulse Token
    const spId = c.env['id sendpulse'];
    const spSecret = c.env['secret sendpulse'];
    const spListId = c.env.SENDPULSE_LIST_ID;
    
    const authRes = await fetch('https://api.sendpulse.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: spId, client_secret: spSecret })
    });
    
    if (!authRes.ok) return c.json({ error: 'Error de autenticación con SendPulse' }, 500);
    const { access_token } = await authRes.json() as any;

    let syncCount = 0;
    const details = [];

    // 3. Check each user in SendPulse
    for (const user of unverifiedUsers.results) {
      const spUserRes = await fetch(`https://api.sendpulse.com/addressbooks/${spListId}/emails/${encodeURIComponent(user.email)}`, {
        headers: { 'Authorization': `Bearer ${access_token}` }
      });

      if (spUserRes.ok) {
        const spUserData = await spUserRes.json() as any;
        // SendPulse "status" codes: 
        // 0 – active
        // 1 – unconfirmed
        // 2 – unsubscribed
        // etc.
        // We look for status 0 (active)
        if (spUserData && spUserData.status === 0) {
          await c.env.DB.prepare('UPDATE usuarios SET verificado = 1 WHERE id = ?').bind(user.id).run();
          syncCount++;
          details.push({ email: user.email, status: 'Synced' });
        } else {
          details.push({ email: user.email, status: `In list but status ${spUserData?.status ?? 'unknown'}` });
        }
      } else {
        details.push({ email: user.email, status: 'Not found in SendPulse list' });
      }
    }

    return c.json({ message: `Sincronización completada. Usuarios verificados: ${syncCount}`, synced: syncCount, details });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Admin: Cleanup unverified users (>24h)
app.post('/api/admin/limpiar-usuarios', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);

  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    if (payload.rol !== 'admin') return c.json({ error: 'Prohibido' }, 403);

    // 1. Find users to delete
    const { results } = await c.env.DB.prepare(`
      SELECT email FROM usuarios 
      WHERE verificado = 0 
      AND creado_en < datetime('now', '-1 day')
    `).all();

    if (results && results.length > 0) {
      for (const row of results) {
        // 2. Remove from SendPulse
        c.executionCtx.waitUntil(removeFromSendPulse(c, row.email as string));
      }

      // 3. Delete from DB
      await c.env.DB.prepare(`
        DELETE FROM usuarios 
        WHERE verificado = 0 
        AND creado_en < datetime('now', '-1 day')
      `).run();
    }

    return c.json({ deleted: results?.length || 0 });
  } catch (err) {
    return c.json({ error: 'Error en limpieza' }, 500);
  }
});

// Setup: Inicializar Database (Ruta temporal de utilidad)
app.get('/api/setup-db', async (c) => {
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS webhook_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        nombre TEXT NOT NULL,
        rol TEXT DEFAULT 'suscriptor',
        foto_perfil TEXT,
        bio TEXT,
        verificado INTEGER DEFAULT 0,
        telefono TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS solicitudes_autor (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id TEXT UNIQUE NOT NULL,
        motivo TEXT,
        estado TEXT DEFAULT 'pendiente',
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
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
        vistas INTEGER DEFAULT 0,
        publicado_en DATETIME,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        patrocinada INTEGER DEFAULT 0,
        patrocinio_monto REAL,
        patrocinio_marca TEXT,
        patrocinio_ruc TEXT,
        patrocinio_estado TEXT DEFAULT 'pendiente',
        patrocinio_comprobante TEXT,
        FOREIGN KEY (autor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
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
        FOREIGN KEY (noticia_id) REFERENCES noticias(id) ON DELETE CASCADE
      )`),
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS reacciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        noticia_id TEXT NOT NULL,
        usuario_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(noticia_id, usuario_id),
        FOREIGN KEY (noticia_id) REFERENCES noticias(id) ON DELETE CASCADE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      )`),
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS noticia_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        noticia_id TEXT NOT NULL,
        plataforma TEXT NOT NULL,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (noticia_id) REFERENCES noticias(id) ON DELETE CASCADE
      )`),
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS seguidores (
        seguidor_id TEXT NOT NULL,
        autor_id TEXT NOT NULL,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (seguidor_id, autor_id),
        FOREIGN KEY (seguidor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (autor_id) REFERENCES usuarios(id) ON DELETE CASCADE
      )`),
      c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS notificaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id TEXT NOT NULL,
        mensaje TEXT NOT NULL,
        tipo TEXT DEFAULT 'info',
        leida INTEGER DEFAULT 0,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
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

// Admin: Send global or group messages
app.post('/api/admin/enviar-mensaje', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256') as any;
    if (payload.rol !== 'admin') return c.json({ error: 'Prohibido' }, 403);

    const { target, title, content } = await c.req.json();
    
    let userQuery = 'SELECT id FROM usuarios';
    if (target === 'autores') userQuery += " WHERE rol = 'autor' OR rol = 'admin'";
    else if (target === 'suscriptores') userQuery += " WHERE rol = 'suscriptor'";

    const users: any = await c.env.DB.prepare(userQuery).all();
    const notificationId = crypto.randomUUID();
    
    const statements = (users.results || []).map((u: any) => {
      return c.env.DB.prepare(
        'INSERT INTO notificaciones (usuario_id, mensaje, tipo, leida) VALUES (?, ?, ?, 0)'
      ).bind(u.id, JSON.stringify({ title, content }), 'mensaje_admin');
    });

    if (statements.length > 0) {
      await c.env.DB.batch(statements);
    }

    return c.json({ success: true, count: statements.length });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Admin: Sync current user profile to SendPulse manually
app.post('/api/admin/sync-perfil', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);
  
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256') as any;
    
    const user: any = await c.env.DB.prepare('SELECT email, nombre, telefono FROM usuarios WHERE id = ?').bind(payload.id).first();
    if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);
    
    const result = await addToSendPulse(c, user.email, user.nombre, user.telefono);
    return c.json({ message: 'Sincronización completada', result });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
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

    await c.env.DB.exec(`ALTER TABLE noticias ADD COLUMN vistas INTEGER DEFAULT 0`).catch(() => console.log('Columna vistas ya existe'));
    
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
        FOREIGN KEY (noticia_id) REFERENCES noticias(id) ON DELETE CASCADE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS noticia_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        noticia_id TEXT,
        plataforma TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (noticia_id) REFERENCES noticias(id) ON DELETE CASCADE
      );
    `).catch(() => console.log('Tablas ya existen'));

    // User verification and phone migration - INDIVIDUAL statements
    await c.env.DB.exec(`ALTER TABLE usuarios ADD COLUMN verificado INTEGER DEFAULT 0`).catch(() => console.log('Columna verificado ya existe'));
    await c.env.DB.exec(`ALTER TABLE usuarios ADD COLUMN telefono TEXT`).catch(() => console.log('Columna telefono ya existe'));

    // Webhook logs table if missing
    await c.env.DB.exec(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => console.log('Tabla webhook_logs ya existe'));

    return c.json({ message: 'Migración completada con éxito. Todas las columnas y tablas han sido revisadas.' });
  } catch (error: any) {
    return c.json({ error: 'Error en migración', details: error.message }, 500);
  }
});

// Admin: Filtered Users Search
app.get('/api/admin/usuarios/buscar', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    if (payload.rol !== 'admin') return c.json({ error: 'Prohibido' }, 403);

    const email = c.req.query('email');
    if (!email) return c.json([]);

    const { results } = await c.env.DB.prepare(`
      SELECT id, email, nombre, rol, verificado, telefono, creado_en 
      FROM usuarios 
      WHERE email LIKE ? 
      LIMIT 10
    `).bind(`%${email}%`).all();

    return c.json(results || []);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Admin: Update User
app.put('/api/admin/usuarios/:id', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);
  const targetId = c.req.param('id');
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    if (payload.rol !== 'admin') return c.json({ error: 'Prohibido' }, 403);

    const { nombre, rol, verificado, telefono, email } = await c.req.json();

    await c.env.DB.prepare(`
      UPDATE usuarios 
      SET nombre = COALESCE(?, nombre), 
          rol = COALESCE(?, rol), 
          verificado = COALESCE(?, verificado), 
          telefono = COALESCE(?, telefono),
          email = COALESCE(?, email)
      WHERE id = ?
    `).bind(nombre, rol, verificado, telefono, email, targetId).run();

    return c.json({ message: 'Usuario actualizado' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Admin: Delete User (Strict)
app.delete('/api/admin/usuarios/:id', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);
  const targetId = c.req.param('id');
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    if (payload.rol !== 'admin') return c.json({ error: 'Prohibido' }, 403);

    // Get email before deleting to remove from SendPulse
    const user: any = await c.env.DB.prepare('SELECT email FROM usuarios WHERE id = ?').bind(targetId).first();
    if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

    // Manual cascading delete to be absolutely sure
    // 1. Delete notifications
    await c.env.DB.prepare('DELETE FROM notificaciones WHERE usuario_id = ?').bind(targetId).run();
    // 2. Delete reactions (direct)
    await c.env.DB.prepare('DELETE FROM reacciones WHERE usuario_id = ?').bind(targetId).run();
    // 3. Delete followers/following
    await c.env.DB.prepare('DELETE FROM seguidores WHERE seguidor_id = ? OR autor_id = ?').bind(targetId, targetId).run();
    // 4. Delete author requests
    await c.env.DB.prepare('DELETE FROM solicitudes_autor WHERE usuario_id = ?').bind(targetId).run();
    
    // 5. Delete things related to news by this author
    // Get news IDs
    const { results: news }: any = await c.env.DB.prepare('SELECT id FROM noticias WHERE autor_id = ?').bind(targetId).all();
    if (news && news.length > 0) {
      for (const n of news) {
        await c.env.DB.prepare('DELETE FROM metricas_visitas WHERE noticia_id = ?').bind(n.id).run();
        await c.env.DB.prepare('DELETE FROM reacciones WHERE noticia_id = ?').bind(n.id).run();
        await c.env.DB.prepare('DELETE FROM noticia_shares WHERE noticia_id = ?').bind(n.id).run();
        await c.env.DB.prepare('DELETE FROM noticias WHERE id = ?').bind(n.id).run();
      }
    }
    
    // Finally delete the user
    await c.env.DB.prepare('DELETE FROM usuarios WHERE id = ?').bind(targetId).run();
    
    // Remove from SendPulse
    c.executionCtx.waitUntil(removeFromSendPulse(c, user.email));

    return c.json({ message: 'Usuario eliminado correctamente' });
  } catch (err: any) {
    console.error('Delete User Error:', err.message);
    return c.json({ error: 'Error al eliminar usuario. Puede que tenga registros vinculados.', details: err.message }, 500);
  }
});

// Admin: Fix Foreign Keys (Drop and recreate with CASCADE)
app.get('/api/admin/fix-cascades', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    if (payload.rol !== 'admin') return c.json({ error: 'Prohibido' }, 403);

    // Turn off FK checks for the migration
    await c.env.DB.exec('PRAGMA foreign_keys = OFF;');

    // 1. Create temp tables with CASCADE
    // 2. Transfer data
    // 3. Drop old, rename new
    
    const tablesToFix = [
      { 
        name: 'solicitudes_autor', 
        schema: `CREATE TABLE solicitudes_autor_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id TEXT UNIQUE NOT NULL,
          motivo TEXT,
          estado TEXT DEFAULT 'pendiente',
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        )`
      },
      {
        name: 'noticias',
        schema: `CREATE TABLE noticias_new (
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
          FOREIGN KEY (autor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
          FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
        )`
      },
      {
        name: 'metricas_visitas',
        schema: `CREATE TABLE metricas_visitas_new (
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
          FOREIGN KEY (noticia_id) REFERENCES noticias(id) ON DELETE CASCADE
        )`
      },
      {
        name: 'reacciones',
        schema: `CREATE TABLE reacciones_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          noticia_id TEXT NOT NULL,
          usuario_id TEXT NOT NULL,
          tipo TEXT NOT NULL,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(noticia_id, usuario_id),
          FOREIGN KEY (noticia_id) REFERENCES noticias(id) ON DELETE CASCADE,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        )`
      },
      {
        name: 'noticia_shares',
        schema: `CREATE TABLE noticia_shares_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          noticia_id TEXT NOT NULL,
          plataforma TEXT NOT NULL,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (noticia_id) REFERENCES noticias(id) ON DELETE CASCADE
        )`
      },
      {
        name: 'seguidores',
        schema: `CREATE TABLE seguidores_new (
          seguidor_id TEXT NOT NULL,
          autor_id TEXT NOT NULL,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (seguidor_id, autor_id),
          FOREIGN KEY (seguidor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
          FOREIGN KEY (autor_id) REFERENCES usuarios(id) ON DELETE CASCADE
        )`
      },
      {
        name: 'notificaciones',
        schema: `CREATE TABLE notificaciones_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id TEXT NOT NULL,
          mensaje TEXT NOT NULL,
          tipo TEXT DEFAULT 'info',
          leida INTEGER DEFAULT 0,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        )`
      }
    ];

    for (const table of tablesToFix) {
      try {
        // Check if old table exists
        const exists = await c.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(table.name).first();
        if (!exists) continue;

        await c.env.DB.exec(table.schema);
        
        // Use batch to ensure they run together or at least identify the column mapping
        const info: any = await c.env.DB.prepare(`PRAGMA table_info(${table.name})`).all();
        const columns = info.results.map((r: any) => r.name).join(', ');
        
        await c.env.DB.exec(`INSERT INTO ${table.name}_new (${columns}) SELECT ${columns} FROM ${table.name};`);
        await c.env.DB.exec(`DROP TABLE ${table.name};`);
        await c.env.DB.exec(`ALTER TABLE ${table.name}_new RENAME TO ${table.name};`);
      } catch (e: any) {
        console.error(`Error migratory table ${table.name}:`, e.message);
      }
    }

    await c.env.DB.exec('PRAGMA foreign_keys = ON;');

    return c.json({ message: 'Foreign Keys actualizadas con CASCADE' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Admin: Sync User to SendPulse Manually
app.post('/api/admin/usuarios/:id/sync-sendpulse', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);
  const targetId = c.req.param('id');
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');
    if (payload.rol !== 'admin') return c.json({ error: 'Prohibido' }, 403);

    const user: any = await c.env.DB.prepare('SELECT email, nombre, telefono FROM usuarios WHERE id = ?').bind(targetId).first();
    if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

    const result = await addToSendPulse(c, user.email, user.nombre, user.telefono);
    
    if (result.success) {
      return c.json({ message: 'Sincronización exitosa', result: result.result });
    } else {
      return c.json({ error: 'Error en sincronización', details: result.error }, 500);
    }
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Admin: Test SendPulse
app.get('/api/admin/test-sendpulse', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'No autorizado' }, 401);
  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256') as any;
    if (payload.rol !== 'admin') return c.json({ error: 'Prohibido' }, 403);

    const email = payload.email; // Test with current admin email
    const spId = c.env['id sendpulse'];
    const spSecret = c.env['secret sendpulse'];
    const spListId = c.env.SENDPULSE_LIST_ID;

    if (!spId || !spSecret || !spListId) {
      return c.json({ 
        error: 'Credenciales faltantes', 
        details: { hasId: !!spId, hasSecret: !!spSecret, hasListId: !!spListId } 
      }, 400);
    }

    // Attempt auth
    const authRes = await fetch('https://api.sendpulse.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: spId, client_secret: spSecret })
    });

    if (!authRes.ok) {
      const text = await authRes.text();
      return c.json({ error: 'Error de autenticación SendPulse', details: text, status: authRes.status }, 500);
    }

    const { access_token } = await authRes.json() as any;

    // ELIMINAR para prueba limpia: Si existe, lo borramos para forzar nueva confirmación
    await fetch(`https://api.sendpulse.com/addressbooks/${spListId}/emails`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: [email] })
    });

    // Check list
    const listRes = await fetch(`https://api.sendpulse.com/addressbooks/${spListId}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    if (!listRes.ok) {
      const text = await listRes.text();
      return c.json({ error: 'Error al obtener la lista', details: text, status: listRes.status }, 500);
    }

    const listInfo = await listRes.json();

    // Check list settings (Opt-in info)
    const settingsRes = await fetch(`https://api.sendpulse.com/addressbooks/${spListId}/settings`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    const listSettings = settingsRes.ok ? await settingsRes.json() : { error: 'Settings not available', status: settingsRes.status };

    // Check if current user is already in list
    const checkRes = await fetch(`https://api.sendpulse.com/addressbooks/${spListId}/emails/${encodeURIComponent(email)}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    const checkUser = checkRes.ok ? await checkRes.json() : { error: 'Not found or fail', status: checkRes.status };

    // Try adding test email with final configuration
    const templateId = "44146dba-5aa2-4639-9198-d716abf985d8";
    const sender = "gonzalez@brahian.dev";
    
    const strategy = { 
      name: 'Estructura Final (FORCE DOI)', 
      body: { 
        emails: [{ email, variables: { "Nombre": "Admin Test" } }], 
        confirmation: "force", 
        sender_email: sender, 
        template_id: templateId, 
        message_lang: "es" 
      } 
    };

    // Clean test: ensure we can re-send DOI
    await fetch(`https://api.sendpulse.com/addressbooks/${spListId}/emails`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: [email] })
    });

    const res = await fetch(`https://api.sendpulse.com/addressbooks/${spListId}/emails`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(strategy.body)
    });
    
    const data = await res.json();
    const result = { strategy: strategy.name, status: res.status, ok: res.ok, data };

    return c.json({ 
      message: 'Prueba de envío finalizada', 
      list: listInfo,
      currentUserStatus: checkUser,
      results: [result]
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
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
      
      // Sync with SendPulse
      c.executionCtx.waitUntil(addToSendPulse(c, email, name));
      
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

    // Manual cascade for noticia children
    await c.env.DB.prepare('DELETE FROM metricas_visitas WHERE noticia_id = ?').bind(newsId).run();
    await c.env.DB.prepare('DELETE FROM reacciones WHERE noticia_id = ?').bind(newsId).run();
    await c.env.DB.prepare('DELETE FROM noticia_shares WHERE noticia_id = ?').bind(newsId).run();

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
  const vistoCookie = getCookie(c, `visto_${id}`);
  let currentUserId = null;
  
  if (token) {
    try {
      const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
      const payload = await verify(token, secret, 'HS256');
      currentUserId = payload.id;
    } catch (e) {}
  }

  // 1. Algoritmo de Conteo de Vistas con Cookies
  if (!vistoCookie) {
    try {
      // Incrementar vistas en D1
      await c.env.DB.prepare('UPDATE noticias SET vistas = vistas + 1 WHERE id = ?').bind(id).run();
      
      // Inyectar cookie de 24h
      setCookie(c, `visto_${id}`, '1', {
        path: '/',
        maxAge: 86400, // 24 horas
        httpOnly: true,
        secure: true,
        sameSite: 'Lax'
      });
    } catch (err) {
      console.error('Error al actualizar contador de vistas:', err);
    }
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
  const global = c.req.query('global') === 'true';

  try {
    const secret = c.env.JWT_SECRET || DEFAULT_SECRET;
    const payload = await verify(token, secret, 'HS256');

    let dateFilter = "30 days";
    if (periodo === 'dia') dateFilter = "1 day";
    if (periodo === 'semana') dateFilter = "7 days";
    if (periodo === 'año') dateFilter = "1 year";

    const dateLimit = `datetime('now', '-${dateFilter}')`;

    if (global) {
      // Global stats for the user
      let newsFilter = '';
      const params = [];
      if (payload.rol === 'autor') {
        newsFilter = 'WHERE autor_id = ?';
        params.push(payload.id);
      }
      
      const stats: any = await c.env.DB.prepare(`
        SELECT 
          SUM(COALESCE(vistas, 0)) as total_vistas_db,
          (SELECT COUNT(*) FROM metricas_visitas m JOIN noticias n2 ON m.noticia_id = n2.id ${newsFilter ? 'WHERE n2.autor_id = ?' : ''} AND m.fecha >= ${dateLimit}) as total_visitas_registradas
        FROM noticias
        ${newsFilter}
      `).bind(...params, ...(newsFilter ? params : [])).first();
      
      return c.json({
        total_impacto: Math.max(stats?.total_vistas_db || 0, stats?.total_visitas_registradas || 0)
      });
    }

    if (noticiaId) {
      // PRIVACY CHECK: Only author or admin can see detailed metrics
      const newsInfo: any = await c.env.DB.prepare('SELECT autor_id FROM noticias WHERE id = ?').bind(noticiaId).first();
      if (!newsInfo) return c.json({ error: 'Noticia no encontrada' }, 404);

      if (newsInfo.autor_id !== payload.id && payload.rol !== 'admin') {
        // Return only public views for others
        const publicStats: any = await c.env.DB.prepare(`
          SELECT 
            n.titulo,
            COALESCE(n.vistas, 0) as vistas_db,
            COUNT(m.id) as total_visitas_registradas
          FROM noticias n
          LEFT JOIN metricas_visitas m ON n.id = m.noticia_id AND m.fecha >= ${dateLimit}
          WHERE n.id = ?
          GROUP BY n.id
        `).bind(noticiaId).first();

        if (!publicStats) return c.json([]);

        return c.json([{
          titulo: publicStats.titulo,
          total_visitas: Math.max(publicStats.vistas_db, publicStats.total_visitas_registradas),
          public_only: true
        }]);
      }

      const stats: any = await c.env.DB.prepare(`
        SELECT 
          n.titulo,
          COALESCE(n.vistas, 0) as vistas_totales_db,
          COUNT(m.id) as total_visitas_registradas,
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
        LEFT JOIN metricas_visitas m ON n.id = m.noticia_id AND m.fecha >= ${dateLimit}
        WHERE n.id = ?
        GROUP BY n.id
      `).bind(noticiaId).first();

      if (!stats) return c.json([]);

      return c.json([{
        titulo: stats.titulo,
        total_visitas: Math.max(stats.vistas_totales_db, stats.total_visitas_registradas),
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
        SELECT n.id, n.titulo, 
          CASE WHEN COALESCE(n.vistas, 0) > COUNT(m.id) THEN COALESCE(n.vistas, 0) ELSE COUNT(m.id) END as total_visitas 
        FROM noticias n 
        LEFT JOIN metricas_visitas m ON n.id = m.noticia_id AND m.fecha >= ${dateLimit}
      `;
      const params = [];
      if (payload.rol === 'autor') {
        query += ' WHERE n.autor_id = ?';
        params.push(payload.id);
      }
      query += ' GROUP BY n.id, n.titulo ORDER BY total_visitas DESC LIMIT 10';
      
      const { results } = await c.env.DB.prepare(query).bind(...params).all();
      return c.json(Array.isArray(results) ? results : []);
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
