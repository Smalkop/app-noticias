import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { motion } from 'motion/react';

export default function PageDetail() {
  const { slug } = useParams();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPage() {
      try {
        const pages = await api.admin.listPaginas();
        const found = pages.find((p: any) => p.slug === slug);
        setPage(found);
      } catch (err) {
        console.error('Error loading page', err);
      } finally {
        setLoading(false);
      }
    }
    loadPage();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!page || !page.activa) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-4">
        <div>
          <h1 className="text-6xl font-serif font-black text-gray-200 mb-4">404</h1>
          <p className="text-xl text-gray-500 font-bold">Página no encontrada</p>
          <a href="/" className="mt-8 inline-block bg-red-600 text-white px-8 py-3 rounded-xl font-bold">Volver al Inicio</a>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto px-4 py-20"
    >
      <h1 className="text-5xl md:text-7xl font-serif font-black text-gray-900 mb-12 tracking-tighter leading-tight border-b-8 border-red-600 pb-8">
        {page.titulo}
      </h1>
      
      <div className="prose prose-xl max-w-none text-gray-700 leading-relaxed font-serif">
        {/* Usamos dangerouslySetInnerHTML porque viene del editor enriquecido react-quill */}
        <div dangerouslySetInnerHTML={{ __html: page.contenido }} />
      </div>

      <div className="mt-20 pt-10 border-t border-gray-100 flex items-center justify-between">
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Lapacho Post Institutional</p>
        <p className="text-xs text-gray-400 font-mono">Última actualización: {new Date(page.actualizado_en).toLocaleDateString()}</p>
      </div>
    </motion.div>
  );
}
