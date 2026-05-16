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
}

export interface Metrica {
  titulo: string;
  total_visitas: number;
}
