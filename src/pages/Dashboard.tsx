import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { User, Metrica, Categoria } from '../types';
import { BarChart3, Plus, FileText, Image as ImageIcon, Send } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'metrics' | 'create'>('metrics');

  // Form state
  const [titulo, setTitulo] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [m, c] = await Promise.all([
          api.metricas.get(),
          api.categorias.list()
        ]);
        setMetricas(m);
        setCategorias(c);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.upload(file);
      setImagenUrl(url);
    } catch (error) {
      alert('Error subiendo imagen');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.noticias.create({
        titulo,
        subtitulo,
        contenido,
        categoria_id: Number(categoriaId),
        imagen_destacada: imagenUrl,
        estado: 'publicado'
      });
      setSuccess(true);
      setTitulo('');
      setSubtitulo('');
      setContenido('');
      setImagenUrl('');
      setCategoriaId('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      alert('Error creando noticia');
    }
  };

  if (loading) return <div className="p-12 text-center">Cargando dashboard...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-serif font-bold text-gray-900">Panel de {user.rol === 'admin' ? 'Administración' : 'Autor'}</h1>
          <p className="text-gray-500 mt-2">Gestiona tus noticias y mira el impacto de tus publicaciones</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('metrics')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'metrics' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <BarChart3 className="w-4 h-4" /> Métricas
          </button>
          <button 
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'create' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <Plus className="w-4 h-4" /> Redactar
          </button>
        </div>
      </header>

      {activeTab === 'metrics' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-600" /> Noticias más leídas
            </h3>
            <div className="space-y-6">
              {Array.isArray(metricas) && metricas.length > 0 ? metricas.map((m, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-400 text-xs">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 line-clamp-1">{m.titulo}</p>
                    <div className="w-full bg-gray-100 h-2 rounded-full mt-2 overflow-hidden">
                      <div 
                        className="bg-red-500 h-full rounded-full" 
                        style={{ width: `${(m.total_visitas / (metricas[0]?.total_visitas || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-red-600">{m.total_visitas}</span>
                </div>
              )) : (
                <p className="text-gray-400 italic">No hay datos de visitas aún.</p>
              )}
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-600 to-red-800 text-white p-8 rounded-2xl shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold opacity-80 mb-1">Total Impacto</h3>
              <p className="text-5xl font-serif font-bold">
                {Array.isArray(metricas) ? metricas.reduce((acc, m) => acc + m.total_visitas, 0) : 0}
              </p>
              <p className="text-sm opacity-60 mt-2">Visitas totales acumuladas</p>
            </div>
            <div className="mt-12 bg-white/10 p-4 rounded-xl backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-wider mb-2">Tip del día</p>
              <p className="text-sm">Las noticias con imágenes de alta resolución tienen un 40% más de clics.</p>
            </div>
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-8">
            {success && (
              <div className="bg-green-50 text-green-700 p-4 rounded-lg font-bold text-center border border-green-100">
                ¡Noticia publicada con éxito!
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6 md:col-span-2">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Título de la noticia</label>
                  <input 
                    type="text" 
                    required
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                    placeholder="Ej: Histórico acuerdo comercial..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Subtítulo (Copete)</label>
                  <textarea 
                    rows={2}
                    required
                    value={subtitulo}
                    onChange={(e) => setSubtitulo(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                    placeholder="Breve resumen de la noticia..."
                  ></textarea>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Categoría</label>
                <select 
                  required
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none appearance-none"
                >
                  <option value="">Seleccionar...</option>
                  {Array.isArray(categorias) && categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Imagen destacada</label>
                <div className="flex items-center gap-4">
                  <label className="flex-1 cursor-pointer bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center hover:border-red-400 transition-colors">
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                    <div className="flex items-center gap-2 text-gray-500">
                      <ImageIcon className="w-5 h-5" />
                      <span className="text-sm font-medium">{uploading ? 'Subiendo...' : 'Subir Imagen'}</span>
                    </div>
                  </label>
                  {imagenUrl && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200">
                      <img src={imagenUrl} alt="Vista previa" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">Cuerpo de la noticia</label>
                <textarea 
                  rows={8}
                  required
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-sans"
                  placeholder="Escribe aquí el contenido completo..."
                ></textarea>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full bg-red-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-lg"
            >
              <Send className="w-5 h-5" /> Publicar Noticia
            </button>
          </form>
        </motion.div>
      )}
    </div>
  );
}
