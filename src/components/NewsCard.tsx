import { Link } from 'react-router-dom';
import { Noticia } from '../types';
import { Clock, User } from 'lucide-react';
import { motion } from 'motion/react';

interface NewsCardProps {
  noticia: Noticia;
  featured?: boolean;
  key?: string | number;
}

export default function NewsCard({ noticia, featured = false }: NewsCardProps) {
  const date = new Date(noticia.publicado_en).toLocaleDateString('es-PY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  if (featured) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        className="group relative overflow-hidden rounded-xl bg-gray-900 aspect-video"
      >
        <img 
          src={noticia.imagen_destacada || 'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&auto=format&fit=crop&q=60'} 
          alt={noticia.titulo}
          className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-6 md:p-12 flex flex-col justify-end">
          {noticia.categoria_nombre && (
            <Link to={`/?categoria=${noticia.categoria_slug || noticia.categoria_nombre.toLowerCase()}`} className="self-start bg-red-600 text-white text-xs font-bold px-2 py-1 rounded mb-4 uppercase tracking-widest">
              {noticia.categoria_nombre}
            </Link>
          )}
          <Link to={`/noticia/${noticia.id}`}>
            <h2 className="font-serif text-3xl md:text-5xl font-bold text-white mb-4 group-hover:text-red-400 transition-colors">
              {noticia.titulo}
            </h2>
          </Link>
          <p className="text-gray-300 text-lg max-w-2xl mb-6 line-clamp-2">
            {noticia.subtitulo}
          </p>
          <div className="flex items-center gap-6 text-gray-400 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>{noticia.autor_nombre}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{date}</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="flex flex-col gap-4 border-b border-gray-200 pb-6 group"
    >
      <Link to={`/noticia/${noticia.id}`} className="overflow-hidden rounded-lg aspect-video">
        <img 
          src={noticia.imagen_destacada || 'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&auto=format&fit=crop&q=60'} 
          alt={noticia.titulo}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
      </Link>
      <div className="flex flex-col gap-2">
        {noticia.categoria_nombre && (
          <Link to={`/?categoria=${noticia.categoria_slug || noticia.categoria_nombre.toLowerCase()}`} className="text-red-600 text-[10px] font-bold uppercase tracking-widest">
            {noticia.categoria_nombre}
          </Link>
        )}
        <Link to={`/noticia/${noticia.id}`} className="news-card-title line-clamp-2">
          {noticia.titulo}
        </Link>
        <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed">
          {noticia.subtitulo}
        </p>
        <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-400 font-medium">
          <span className="flex items-center gap-1"><User className="w-3 h-3" /> {noticia.autor_nombre}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {date}</span>
        </div>
      </div>
    </motion.div>
  );
}
