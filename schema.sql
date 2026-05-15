
-- =============================================
-- USUARIOS
-- =============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  bio TEXT DEFAULT '',
  foto_perfil TEXT DEFAULT '',
  rol TEXT DEFAULT 'autor' CHECK(rol IN ('autor', 'admin')),
  email_verificado INTEGER DEFAULT 0,
  activo INTEGER DEFAULT 1,
  creado_en TEXT DEFAULT (datetime('now')),
  actualizado_en TEXT DEFAULT (datetime('now'))
);

-- =============================================
-- CATEGORÍAS
-- =============================================
CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  activa INTEGER DEFAULT 1
);

-- =============================================
-- NOTICIAS
-- =============================================
CREATE TABLE IF NOT EXISTS noticias (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  autor_id TEXT NOT NULL REFERENCES usuarios(id),
  titulo TEXT NOT NULL,
  subtitulo TEXT DEFAULT '',
  contenido TEXT NOT NULL,
  imagen_destacada TEXT DEFAULT '',
  categoria_id INTEGER REFERENCES categorias(id),
  ciudad TEXT DEFAULT '',
  estado TEXT DEFAULT 'borrador' CHECK(estado IN ('borrador', 'publicado', 'eliminado')),
  destacada INTEGER DEFAULT 0,
  publicado_en TEXT,
  creado_en TEXT DEFAULT (datetime('now')),
  actualizado_en TEXT DEFAULT (datetime('now'))
);

-- =============================================
-- GALERÍA DE IMÁGENES
-- =============================================
CREATE TABLE IF NOT EXISTS galeria_imagenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  noticia_id TEXT NOT NULL REFERENCES noticias(id) ON DELETE CASCADE,
  url_imagen TEXT NOT NULL,
  orden INTEGER DEFAULT 0
);

-- =============================================
-- MÉTRICAS DE VISITAS
-- =============================================
CREATE TABLE IF NOT EXISTS metricas_visitas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  noticia_id TEXT NOT NULL REFERENCES noticias(id),
  fecha TEXT NOT NULL DEFAULT (date('now')),
  visitas INTEGER DEFAULT 0,
  UNIQUE(noticia_id, fecha)
);

-- =============================================
-- SESIONES
-- =============================================
CREATE TABLE IF NOT EXISTS sesiones (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  token TEXT UNIQUE NOT NULL,
  expira_en TEXT NOT NULL,
  creado_en TEXT DEFAULT (datetime('now'))
);

-- =============================================
-- ÍNDICES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_noticias_autor ON noticias(autor_id);
CREATE INDEX IF NOT EXISTS idx_noticias_estado ON noticias(estado, publicado_en DESC);
CREATE INDEX IF NOT EXISTS idx_noticias_categoria ON noticias(categoria_id, estado);
CREATE INDEX IF NOT EXISTS idx_noticias_ciudad ON noticias(ciudad, estado);
CREATE INDEX IF NOT EXISTS idx_noticias_destacada ON noticias(destacada, publicado_en DESC);
CREATE INDEX IF NOT EXISTS idx_metricas_noticia ON metricas_visitas(noticia_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- Borrar categorías previas para evitar duplicados si se reinicia
DELETE FROM categorias;
INSERT INTO categorias (nombre, slug) VALUES
  ('Política', 'politica'),
  ('Tecnología', 'tecnologia'),
  ('Deportes', 'deportes'),
  ('Economía', 'economia'),
  ('Cultura', 'cultura'),
  ('Internacional', 'internacional'),
  ('Local', 'local');
