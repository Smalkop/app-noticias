import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Noticia } from '../types';
import { Clock, User as UserIcon, ChevronLeft, Share2, Facebook, Twitter } from 'lucide-react';
import { motion } from 'motion/react';

export default function Article() {
  const { id } = useParams<{ id: string }>();
  const [noticia, setNoticia] = useState<Noticia | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNoticia() {
      if (!id) return;
      setLoading(true);
      try {
        const data = await api.noticias.get(id);
        setNoticia(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadNoticia();
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) return <div className="max-w-4xl mx-auto p-12 h-96 bg-gray-100 animate-pulse rounded-xl mt-8"></div>;
  if (!noticia) return <div className="text-center py-20">Noticia no encontrada</div>;

  const date = new Date(noticia.publicado_en).toLocaleDateString('es-PY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <article className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      <div className="flex flex-col md:flex-row gap-12">
        {/* Main Content */}
        <div className="flex-1 max-w-4xl">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-red-600 mb-8 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Volver al inicio
          </Link>

          <header className="mb-10">
            <Link to={`/?categoria=${noticia.categoria_nombre.toLowerCase()}`} className="text-red-600 font-bold text-sm uppercase tracking-widest block mb-4">
              {noticia.categoria_nombre}
            </Link>
            <h1 className="font-serif text-4xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
              {noticia.titulo}
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed font-medium italic border-l-4 border-gray-200 pl-6 mb-8">
              {noticia.subtitulo}
            </p>

            <div className="flex flex-wrap items-center gap-6 py-6 border-y border-gray-100 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <span className="block font-bold text-gray-900">{noticia.autor_nombre}</span>
                  <span className="text-xs">Redacción Noticias PY</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Publicado el {date}</span>
              </div>
              <div className="flex items-center gap-4 ml-auto">
                 <button className="p-2 hover:bg-blue-50 rounded-full text-blue-600 transition-colors"><Facebook className="w-5 h-5"/></button>
                 <button className="p-2 hover:bg-sky-50 rounded-full text-sky-500 transition-colors"><Twitter className="w-5 h-5"/></button>
                 <button className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"><Share2 className="w-5 h-5"/></button>
              </div>
            </div>
          </header>

          <img 
            src={noticia.imagen_destacada || 'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1200&auto=format&fit=crop&q=80'} 
            alt={noticia.titulo}
            className="w-full rounded-xl mb-12 shadow-2xl"
          />

          <div className="prose prose-lg max-w-none prose-headings:font-serif prose-red prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-6">
            {noticia.contenido.split('\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-full md:w-80 flex flex-col gap-8">
          <div className="bg-gray-900 text-white p-8 rounded-2xl sticky top-24">
            <h3 className="font-serif text-2xl font-bold mb-4">Sobre el autor</h3>
            <div className="flex items-center gap-4 mb-4">
               <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"><UserIcon className="w-6 h-6"/></div>
               <span className="font-bold text-lg">{noticia.autor_nombre}</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              {noticia.autor_bio || 'Periodista especializado en actualidad nacional con más de 10 años de trayectoria.'}
            </p>
            <button className="w-full py-3 bg-red-600 rounded-lg font-bold text-sm hover:bg-red-700 transition-colors">
              Seguir autor
            </button>
          </div>
        </aside>
      </div>
    </article>
  );
}
