import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { User, Metrica, Categoria, Noticia } from '../types';
import { 
  BarChart3, Plus, FileText, Image as ImageIcon, Send, 
  Settings, User as UserIcon, Trash2, Edit, CheckCircle, XCircle,
  Clock, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { compressImage } from '../lib/imageUtils';

interface DashboardProps {
  user: User;
  onUserUpdate: (updatedUser: User) => void;
}

export default function Dashboard({ user, onUserUpdate }: DashboardProps) {
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [misNoticias, setMisNoticias] = useState<Noticia[]>([]);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'metrics' | 'create' | 'manage' | 'profile' | 'admin'>('metrics');

  // Form state for News
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');

  // Form state for Profile
  const [nombre, setNombre] = useState(user.nombre);
  const [bio, setBio] = useState(user.bio || '');
  const [perfilUrl, setPerfilUrl] = useState(user.foto_perfil || '');
  
  // Author Request state
  const [motivo, setMotivo] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      if (activeTab === 'metrics') {
        const results = await api.metricas.get();
        setMetricas(results);
      } else if (activeTab === 'manage') {
        const results = await api.noticias.misNoticias();
        setMisNoticias(results);
      } else if (activeTab === 'create') {
        const results = await api.categorias.list();
        setCategorias(results);
      } else if (activeTab === 'admin' && user.rol === 'admin') {
        const results = await api.admin.listSolicitudes();
        setSolicitudes(results);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'news' | 'profile' = 'news') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      // Comprimir imagen antes de subir (Máximo 1200px para noticias, 400px para perfil)
      const compressedBlob = await compressImage(
        file, 
        type === 'news' ? 1200 : 400, 
        type === 'news' ? 1200 : 400, 
        0.8
      );
      
      // Convertir Blob a File para el upload
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/webp' });
      
      const { url } = await api.upload(compressedFile);
      if (type === 'news') {
        setImagenUrl(url);
      } else {
        setPerfilUrl(url);
      }
    } catch (error) {
      alert('Error procesando o subiendo imagen');
    } finally {
      setUploading(false);
    }
  };

  const handleNewsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        titulo,
        subtitulo,
        contenido,
        categoria_id: Number(categoriaId),
        imagen_destacada: imagenUrl,
        estado: 'publicado'
      };

      if (editingId) {
        await api.noticias.update(editingId, data);
        setSuccess('¡Noticia actualizada correctamente!');
      } else {
        await api.noticias.create(data);
        setSuccess('¡Noticia publicada con éxito!');
      }

      // Reset form
      setEditingId(null);
      setTitulo('');
      setSubtitulo('');
      setContenido('');
      setImagenUrl('');
      setCategoriaId('');
      
      setTimeout(() => {
        setSuccess('');
        setActiveTab('manage');
      }, 2000);
    } catch (error) {
      alert('Error al guardar noticia');
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.auth.updatePerfil({
        nombre,
        bio,
        foto_perfil: perfilUrl
      });
      
      // Actualizar el estado global del usuario
      onUserUpdate({
        ...user,
        nombre,
        bio,
        foto_perfil: perfilUrl
      });
      
      setSuccess('¡Perfil actualizado correctamente!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      alert('Error al actualizar perfil');
    }
  };

  const handleRequestAuthor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.auth.solicitarAutor(motivo);
      setRequestSent(true);
      setMotivo('');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDeleteNews = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta noticia?')) return;
    try {
      await api.noticias.delete(id);
      setMisNoticias(misNoticias.filter(n => n.id !== id));
    } catch (error) {
      alert('Error al eliminar noticia');
    }
  };

  const startEditing = (noticia: Noticia) => {
    setEditingId(noticia.id);
    setTitulo(noticia.titulo);
    setSubtitulo(noticia.subtitulo || '');
    setContenido(noticia.contenido);
    setCategoriaId(String(noticia.categoria_id));
    setImagenUrl(noticia.imagen_destacada || '');
    setActiveTab('create');
  };

  const handleAdminSolicitud = async (id: number, accion: 'aprobar' | 'rechazar') => {
    try {
      await api.admin.handleSolicitud(id, accion);
      setSolicitudes(solicitudes.filter(s => s.id !== id));
    } catch (error) {
      alert('Error al procesar solicitud');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {user.foto_perfil ? (
            <img src={user.foto_perfil} className="w-16 h-16 rounded-full object-cover border-2 border-red-100" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-500">
              <UserIcon className="w-8 h-8" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-serif font-bold text-gray-900">Hola, {user.nombre}!</h1>
            <p className="text-gray-500 capitalize">{user.rol} • {user.email}</p>
          </div>
        </div>
        
        <nav className="flex flex-wrap bg-gray-100 p-1 rounded-xl gap-1">
          <TabButton 
            active={activeTab === 'metrics'} 
            onClick={() => setActiveTab('metrics')} 
            icon={<BarChart3 className="w-4 h-4" />} 
            label="Métricas" 
          />
          {(user.rol === 'autor' || user.rol === 'admin') && (
            <>
              <TabButton 
                active={activeTab === 'create'} 
                onClick={() => { setEditingId(null); setActiveTab('create'); }} 
                icon={<Plus className="w-4 h-4" />} 
                label={editingId ? 'Editando' : 'Redactar'} 
              />
              <TabButton 
                active={activeTab === 'manage'} 
                onClick={() => setActiveTab('manage')} 
                icon={<FileText className="w-4 h-4" />} 
                label="Mis Noticias" 
              />
            </>
          )}
          {user.rol === 'admin' && (
            <TabButton 
              active={activeTab === 'admin'} 
              onClick={() => setActiveTab('admin')} 
              icon={<Settings className="w-4 h-4" />} 
              label="Verificación" 
            />
          )}
          <TabButton 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')} 
            icon={<UserIcon className="w-4 h-4" />} 
            label="Perfil" 
          />
        </nav>
      </header>

      <AnimatePresence mode="wait">
        {loading && activeTab !== 'create' && activeTab !== 'profile' ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center text-gray-400">
            Cargando datos...
          </motion.div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'metrics' && (
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
                              className="bg-red-500 h-full rounded-full transition-all duration-1000" 
                              style={{ width: `${(m.total_visitas / (metricas[0]?.total_visitas || 1)) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-red-600">{m.total_visitas}</span>
                      </div>
                    )) : (
                      <div className="text-center py-12">
                        <AlertCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-400 italic">No hay datos de visitas aún.</p>
                      </div>
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
                    <p className="text-sm">Optimizar tus imágenes reduce la carga en un 60%, mejorando el SEO de tu noticia.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'manage' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-xl font-bold">Gestionar Noticias</h3>
                  <span className="text-sm text-gray-500">{misNoticias.length} publicaciones</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {misNoticias.length > 0 ? misNoticias.map((n) => (
                    <div key={n.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex gap-4 items-center">
                        <div className="w-16 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-100">
                          {n.imagen_destacada && <img src={n.imagen_destacada} className="w-full h-full object-cover" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 line-clamp-1">{n.titulo}</h4>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">{n.categoria_nombre}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(n.creado_en).toLocaleDateString()}</span>
                            <span className={`px-2 py-0.5 rounded font-bold capitalize ${n.estado === 'publicado' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                              {n.estado}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => startEditing(n)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteNews(n.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="p-12 text-center text-gray-400 italic">No has publicado ninguna noticia aún.</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'create' && (
              <div className="max-w-4xl mx-auto">
                <form onSubmit={handleNewsSubmit} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-8">
                  {success && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-green-50 text-green-700 p-4 rounded-lg font-bold text-center border border-green-100">
                      {success}
                    </motion.div>
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
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'news')} />
                          <div className="flex items-center gap-2 text-gray-500">
                            <ImageIcon className="w-5 h-5" />
                            <span className="text-sm font-medium">{uploading ? 'Procesando...' : 'Subir Imagen'}</span>
                          </div>
                        </label>
                        {imagenUrl && (
                          <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200 relative group">
                            <img src={imagenUrl} alt="Vista previa" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer" onClick={() => setImagenUrl('')}>
                              <XCircle className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-gray-700 mb-2">Cuerpo de la noticia</label>
                      <textarea 
                        rows={12}
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
                    disabled={uploading}
                    className="w-full bg-red-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-lg disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" /> {editingId ? 'Actualizar Noticia' : 'Publicar Noticia'}
                  </button>
                  
                  {editingId && (
                    <button 
                      type="button" 
                      onClick={() => { setEditingId(null); setActiveTab('manage'); }}
                      className="w-full text-gray-500 mt-2 hover:text-gray-900 font-medium"
                    >
                      Cancelar Edición
                    </button>
                  )}
                </form>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="max-w-2xl mx-auto space-y-8">
                <form onSubmit={handleProfileSubmit} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                  <h3 className="text-xl font-bold mb-6">Mi Perfil</h3>
                  
                  {success && (
                    <div className="bg-green-50 text-green-700 p-4 rounded-lg font-bold text-center border border-green-100">
                      {success}
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-4 mb-8">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-50 shadow-md">
                        {perfilUrl ? (
                          <img src={perfilUrl} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">
                            <UserIcon className="w-12 h-12" />
                          </div>
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white border-2 border-white cursor-pointer hover:bg-red-700 shadow-sm">
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'profile')} />
                        <ImageIcon className="w-4 h-4" />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">JPG, PNG o WebP. Autocompresión activada.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Nombre público</label>
                    <input 
                      type="text" 
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Bio / Descripción</label>
                    <textarea 
                      rows={4}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                      placeholder="Escribe algo sobre ti..."
                    ></textarea>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-all"
                  >
                    Guardar Cambios
                  </button>
                </form>

                {user.rol === 'suscriptor' && (
                  <div className="bg-red-50 border border-red-100 p-8 rounded-2xl">
                    <h4 className="text-xl font-black text-red-900 mb-2">¿Quieres ser Autor?</h4>
                    <p className="text-red-700 mb-6">Si te apasiona escribir noticias, solicita convertirte en autor verificado de ParaguayHoy.</p>
                    
                    {requestSent ? (
                      <div className="bg-white p-6 rounded-xl flex items-center gap-4 text-green-600 font-bold border border-green-100">
                        <CheckCircle className="w-6 h-6" /> Solicitud enviada. Un administrador la revisará pronto.
                      </div>
                    ) : (
                      <form onSubmit={handleRequestAuthor} className="space-y-4">
                        <textarea 
                          required
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                          placeholder="¿Por qué quieres ser autor? Cuéntanos tu experiencia o temas de interés..."
                          className="w-full p-4 rounded-xl border border-red-200 outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm"
                          rows={3}
                        />
                        <button 
                          type="submit"
                          className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-md"
                        >
                          Enviar Solicitud
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'admin' && user.rol === 'admin' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" /> Solicitudes de Autor Pendientes
                  </h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {solicitudes.length > 0 ? solicitudes.map((s) => (
                    <div key={s.id} className="p-8 space-y-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-lg text-gray-900">{s.nombre}</p>
                          <p className="text-gray-500 text-sm">{s.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleAdminSolicitud(s.id, 'aprobar')}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-700 flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" /> Aprobar
                          </button>
                          <button 
                            onClick={() => handleAdminSolicitud(s.id, 'rechazar')}
                            className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-300 flex items-center gap-2"
                          >
                            <XCircle className="w-4 h-4" /> Rechazar
                          </button>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-gray-200 italic text-gray-600">
                        "{s.motivo || 'Sin motivo especificado'}"
                      </div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Solicitado el {new Date(s.creado_en).toLocaleDateString()}</p>
                    </div>
                  )) : (
                    <div className="p-16 text-center">
                      <CheckCircle className="w-16 h-16 text-green-100 mx-auto mb-4" />
                      <p className="text-gray-500">No hay solicitudes pendientes en este momento.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${active ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
    >
      {icon} {label}
    </button>
  );
}
