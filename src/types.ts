export interface User {
  id: string;
  email: string;
  nombre: string;
  rol: 'suscriptor' | 'autor' | 'admin';
  foto_perfil?: string;
  bio?: string;
}

export interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  activa: number;
}

export interface Noticia {
  id: string;
  autor_id: string;
  autor_nombre: string;
  autor_bio?: string;
  titulo: string;
  subtitulo: string;
  contenido: string;
  imagen_destacada: string;
  categoria_id: number;
  categoria_nombre: string;
  categoria_slug: string;
  ciudad: string;
  estado: 'borrador' | 'publicado' | 'eliminado';
  destacada: number;
  publicado_en: string;
  creado_en: string;
  actualizado_en: string;
  // Sponsorship
  patrocinada: number;
  patrocinio_monto?: number;
  patrocinio_marca?: string;
  patrocinio_ruc?: string;
  patrocinio_estado?: 'pendiente' | 'en revision' | 'aceptado' | 'rechazado' | 'envie otra';
  patrocinio_comprobante?: string;
}

export interface Metrica {
  titulo: string;
  total_visitas: number;
}

export interface Notificacion {
  id: number;
  usuario_id: string;
  mensaje: string;
  leida: number;
  tipo: 'info' | 'success' | 'warning' | 'error';
  creado_en: string;
}

export interface Seguidor {
  seguidor_id: string;
  seguidor_nombre: string;
  seguidor_foto?: string;
  creado_en: string;
}
