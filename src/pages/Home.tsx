import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Noticia } from '../types';
import NewsCard from '../components/NewsCard';
import { motion } from 'motion/react';

export default function Home() {
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  const categoria = searchParams.get('categoria');
  const query = searchParams.get('q');

  useEffect(() => {
    async function loadNoticias() {
      setLoading(true);
      try {
        const data = await api.noticias.list({
          categoria: categoria || undefined,
          q: query || undefined
        });
        setNoticias(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadNoticias();
  }, [categoria, query]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="animate-pulse flex flex-col gap-4">
              <div className="bg-gray-200 aspect-video rounded-lg"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const featured = noticias[0];
  const others = noticias.slice(1);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Header */}
      {(categoria || query) && (
        <div className="mb-12 border-l-4 border-lapacho-pink pl-6">
          <h1 className="text-4xl font-serif font-bold text-gray-900">
            {query ? `Busqueda: "${query}"` : categoria?.toUpperCase()}
          </h1>
          <p className="text-gray-500 mt-2 font-medium">Encontradas {noticias.length} noticias</p>
        </div>
      )}

      {/* Featured News */}
      {!categoria && !query && featured && (
        <section className="mb-16">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Destacada</h2>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>
          <NewsCard noticia={featured} featured />
        </section>
      )}

      {/* Grid of news */}
      <section>
        {!categoria && !query && (
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Ultimo momento</h2>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-12">
          {Array.isArray(noticias) && (!categoria && !query ? others : noticias).map((noticia) => (
            <NewsCard key={noticia.id} noticia={noticia} />
          ))}
        </div>
        
        {noticias.length === 0 && (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <h2 className="text-2xl font-serif font-bold text-gray-400">No hay noticias para mostrar</h2>
            <p className="text-gray-400 mt-2">Prueba ajustando tus filtros de búsqueda.</p>
          </div>
        )}
      </section>
    </main>
  );
}
