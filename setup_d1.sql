-- SQL para inicializar Cloudflare D1

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  nombre TEXT NOT NULL,
  rol TEXT DEFAULT 'autor',
  foto_perfil TEXT,
  bio TEXT,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  activa INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS noticias (
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
);

CREATE TABLE IF NOT EXISTS metricas_visitas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  noticia_id TEXT NOT NULL,
  fecha DATE NOT NULL,
  visitas INTEGER DEFAULT 0,
  UNIQUE(noticia_id, fecha),
  FOREIGN KEY (noticia_id) REFERENCES noticias(id)
);

-- Datos iniciales
INSERT OR IGNORE INTO categorias (nombre, slug) VALUES ('Política', 'politica');
INSERT OR IGNORE INTO categorias (nombre, slug) VALUES ('Economía', 'economia');
INSERT OR IGNORE INTO categorias (nombre, slug) VALUES ('Deportes', 'deportes');
INSERT OR IGNORE INTO categorias (nombre, slug) VALUES ('Cultura', 'cultura');
INSERT OR IGNORE INTO categorias (nombre, slug) VALUES ('Policiales', 'policiales');
