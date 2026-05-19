import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { User, Metrica, Categoria, Noticia } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  BarChart3, Plus, FileText, Image as ImageIcon, Send, 
  Settings, User as UserIcon, Trash2, Edit, CheckCircle, XCircle,
  Clock, AlertCircle, Bell, Users, Calendar, ArrowUpRight, 
  Smartphone, Monitor, Globe, Activity, ChevronLeft, ChevronRight,
  Eye, Share2, Database, ShieldAlert, ShieldCheck, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { compressImage } from '../lib/imageUtils';
import { Seguidor, Notificacion } from '../types';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardProps {
  user: User;
  onUserUpdate: (updatedUser: User) => void;
}

export default function Dashboard({ user, onUserUpdate }: DashboardProps) {
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [globalImpact, setGlobalImpact] = useState(0);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [misNoticias, setMisNoticias] = useState<Noticia[]>([]);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [seguidores, setSeguidores] = useState<Seguidor[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch unread count globally
  const fetchUnreadCount = async () => {
    try {
      const allNotics = await api.notificaciones.list();
      setUnreadCount(allNotics.filter(n => !n.leida).length);
    } catch (e) {}
  };

  useEffect(() => {
    fetchUnreadCount();
  }, []);
  const [activeTab, setActiveTab] = useState<'metrics' | 'create' | 'manage' | 'profile' | 'admin' | 'notifications' | 'users' | 'verify' | 'sponsorships' | 'pages'>('metrics');
  const [metricPeriod, setMetricPeriod] = useState('mes');
  const [selectedMetrica, setSelectedMetrica] = useState<Metrica | null>(null);
  const [selectedNoticiaId, setSelectedNoticiaId] = useState<string | null>(null);

  // User Management State
  const [searchEmail, setSearchEmail] = useState('');
  const [foundUsers, setFoundUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form state for News
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  
  // Sponsorship state
  const [patrocinada, setPatrocinada] = useState(false);
  const [patrocinioMonto, setPatrocinioMonto] = useState('');
  const [patrocinioMarca, setPatrocinioMarca] = useState('');
  const [patrocinioRUC, setPatrocinioRUC] = useState('');
  const [adminPatrocinios, setAdminPatrocinios] = useState<any[]>([]);

  // Form state for Pages
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [pageSlug, setPageSlug] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  const [pageContent, setPageContent] = useState('');
  const [pageActive, setPageActive] = useState(true);
  const [adminPages, setAdminPages] = useState<any[]>([]);

  // Verification state for Authors
  const [selfieUrl, setSelfieUrl] = useState('');
  const [cedulaFrontalUrl, setCedulaFrontalUrl] = useState('');
  const [cedulaTraseraUrl, setCedulaTraseraUrl] = useState('');
  const [adminVerificaciones, setAdminVerificaciones] = useState<any[]>([]);

  // Sponsorship flow redesign
  const [misPatrocinios, setMisPatrocinios] = useState<any[]>([]);
  const [selectedPatrocinioId, setSelectedPatrocinioId] = useState<string | null>(null);
  const [showBankInfo, setShowBankInfo] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');

  // Form state for Profile
  const [nombre, setNombre] = useState(user.nombre);
  const [bio, setBio] = useState(user.bio || '');
  const [telefono, setTelefono] = useState(user.telefono || '');
  const [perfilUrl, setPerfilUrl] = useState(user.foto_perfil || '');
  
  // Sincronizar estado local cuando cambia el usuario (ej: después de refreshUser o onUserUpdate)
  useEffect(() => {
    setNombre(user.nombre);
    setBio(user.bio || '');
    setTelefono(user.telefono || '');
    setPerfilUrl(user.foto_perfil || '');
  }, [user]);

  // Author Request state
  const [motivo, setMotivo] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    // Refresh user data on mount to catch verification status changes
    const refreshUser = async () => {
      try {
        const freshUser = await api.auth.me();
        onUserUpdate(freshUser);
      } catch (e) {}
    };
    refreshUser();
    loadData();
  }, [activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      if (activeTab === 'metrics') {
        const [results, globalData] = await Promise.all([
          api.metricas.get(metricPeriod, selectedNoticiaId || undefined),
          api.metricas.get(metricPeriod, undefined, true)
        ]);
        
        if (selectedNoticiaId && results.length > 0) {
          setSelectedMetrica(results[0]);
        } else {
          setMetricas(results);
          setGlobalImpact(globalData.total_impacto || 0);
        }
        if (user.rol === 'autor' || user.rol === 'admin') {
          const follows = await api.seguidores.misSeguidores();
          setSeguidores(follows);
        }
      } else if (activeTab === 'manage') {
        const results = await api.noticias.misNoticias();
        setMisNoticias(results);
      } else if (activeTab === 'create') {
        const results = await api.categorias.list();
        setCategorias(results);
      } else if (activeTab === 'sponsorships') {
        const results = await api.patrocinios.misPatrocinios();
        setMisPatrocinios(results);
      } else if (activeTab === 'verify') {
        // No special action needed, just initial render
      } else if (activeTab === 'pages' && user.rol === 'admin') {
        const results = await api.admin.listPaginas();
        setAdminPages(results);
      } else if (activeTab === 'admin' && user.rol === 'admin') {
        const [solics, patrocs, vers] = await Promise.all([
          api.admin.listSolicitudes(),
          api.admin.listPatrocinios(),
          api.admin.listVerificaciones()
        ]);
        setSolicitudes(solics);
        setAdminPatrocinios(patrocs);
        setAdminVerificaciones(vers);
      } else if (activeTab === 'notifications') {
        const [notics, news] = await Promise.all([
          api.notificaciones.list(),
          api.noticias.misNoticias()
        ]);
        setNotificaciones(notics);
        setMisNoticias(news);
        await api.notificaciones.leerTodas();
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'metrics') {
      loadData();
    }
  }, [metricPeriod, selectedNoticiaId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'news' | 'profile' | 'selfie' | 'cedula_frontal' | 'cedula_trasera' = 'news') => {
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
      
      // Convertir Blob a File para el upload (Forzando PNG)
      const fileName = file.name.split('.').slice(0, -1).join('.') || 'upload';
      const compressedFile = new File([compressedBlob], `${fileName}.png`, { type: 'image/png' });
      
      const { url } = await api.upload(compressedFile);
      if (type === 'news') {
        setImagenUrl(url);
      } else if (type === 'profile') {
        setPerfilUrl(url);
      } else if (type === 'selfie') {
        setSelfieUrl(url);
      } else if (type === 'cedula_frontal') {
        setCedulaFrontalUrl(url);
      } else if (type === 'cedula_trasera') {
        setCedulaTraseraUrl(url);
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
        estado: 'publicado',
        patrocinada: !!selectedPatrocinioId,
        patrocinio_id: selectedPatrocinioId
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
      setPatrocinada(false);
      setPatrocinioMonto('');
      setPatrocinioMarca('');
      setPatrocinioRUC('');
      
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
        foto_perfil: perfilUrl,
        telefono
      });
      
      // Actualizar el estado global del usuario
      onUserUpdate({
        ...user,
        nombre,
        bio,
        foto_perfil: perfilUrl,
        telefono
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
    setSelectedPatrocinioId(noticia.patrocinio_id || null);
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

  const handleSearchUsers = async () => {
    if (!searchEmail) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/usuarios/buscar?email=${searchEmail}`);
      const data = await res.json();
      setFoundUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      alert('Error buscando usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      const res = await fetch(`/api/admin/usuarios/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser)
      });
      if (res.ok) {
        alert('Usuario actualizado');
        setEditingUser(null);
        handleSearchUsers();
      }
    } catch (e) {
      alert('Error actualizando usuario');
    }
  };

  const handleSyncSendPulse = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/usuarios/${id}/sync-sendpulse`, { method: 'POST' });
      const data: any = await res.json();
      if (res.ok) {
        alert('Sincronización exitosa: ' + (data.message || 'Usuario enviado'));
      } else {
        alert('Error: ' + (data.error || 'No se pudo sincronizar') + '\n' + (data.details || ''));
      }
    } catch (e) {
      alert('Error de conexión');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario? Se borrarán todas sus noticias y reacciones (CASCADE).')) return;
    try {
      const res = await fetch(`/api/admin/usuarios/${id}`, { method: 'DELETE' });
      const data: any = await res.json();
      if (res.ok) {
        alert('Usuario eliminado');
        setFoundUsers(foundUsers.filter(u => u.id !== id));
      } else {
        alert('Error: ' + (data.error || 'No se pudo eliminar'));
        if (data.details) console.error(data.details);
      }
    } catch (e) {
      alert('Error eliminando usuario');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
            {user.foto_perfil ? (
            <img src={user.foto_perfil} className="w-16 h-16 rounded-full object-cover border-2 border-lapacho-pink/20" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-lapacho-pink/5 flex items-center justify-center text-lapacho-pink">
              <UserIcon className="w-8 h-8" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-serif font-bold text-gray-900">Hola, {user.nombre}!</h1>
              {user.estado_verificacion === 'aprobado' && (
                <div className="flex items-center gap-2 bg-green-100/50 px-3 py-1 rounded-full border border-green-200">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                  <span className="text-xs font-black text-green-700 uppercase tracking-wider">Perfil Verificado</span>
                </div>
              )}
            </div>
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
          {user.rol === 'admin' && (
            <TabButton 
              active={activeTab === 'users'} 
              onClick={() => setActiveTab('users')} 
              icon={<Users className="w-4 h-4" />} 
              label="Usuarios" 
            />
          )}
          {user.rol === 'autor' && (
            <TabButton 
              active={activeTab === 'verify'} 
              onClick={() => setActiveTab('verify')} 
              icon={user.estado_verificacion === 'aprobado' ? <ShieldCheck className="w-4 h-4 text-green-500" /> : <ShieldAlert className="w-4 h-4" />} 
              label={user.estado_verificacion === 'aprobado' ? 'Identidad Verificada' : 'Verificar Identidad'} 
            />
          )}
          {user.rol === 'autor' && (
            <TabButton 
              active={activeTab === 'sponsorships'} 
              onClick={() => setActiveTab('sponsorships')} 
              icon={<Activity className="w-4 h-4" />} 
              label="Patrocinios" 
            />
          )}
          {user.rol === 'admin' && (
            <TabButton 
              active={activeTab === 'pages'} 
              onClick={() => setActiveTab('pages')} 
              icon={<Database className="w-4 h-4" />} 
              label="Páginas" 
            />
          )}
          <TabButton 
            active={activeTab === 'notifications'} 
            onClick={() => { setActiveTab('notifications'); setUnreadCount(0); }} 
            icon={<Bell className="w-4 h-4" />} 
            label="Notificaciones" 
            badgeCount={unreadCount}
          />
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
              <div className="animate-in fade-in duration-500">
                {selectedMetrica ? (
                  <div className="space-y-8">
                    <div className="flex items-center justify-between mb-2">
                      <button 
                        onClick={() => {
                          setSelectedNoticiaId(null);
                          setSelectedMetrica(null);
                        }}
                        className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-lapacho-pink transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" /> Volver al ranking
                      </button>
                      <h2 className="text-xl font-serif font-bold text-gray-900 truncate max-w-lg">{selectedMetrica.titulo}</h2>
                    </div>

                    {/* Grid de Métricas Avanzadas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <MetricCard 
                        icon={<Eye className="w-5 h-5"/>} 
                        label="Alcance" 
                        value={selectedMetrica.total_visitas} 
                        subValue={selectedMetrica.public_only ? 'Vistas totales' : `${selectedMetrica.vistas_unicas || 0} únicas`} 
                        color="red"
                      />
                      {!selectedMetrica.public_only && (
                        <>
                          <MetricCard 
                            icon={<Clock className="w-5 h-5"/>} 
                            label="Calidad" 
                            value={`${selectedMetrica.tiempo_medio || 0}s`} 
                            subValue={`Rebotes: ${selectedMetrica.rebotes || 0}%`} 
                            color="blue"
                          />
                          <MetricCard 
                            icon={<Activity className="w-5 h-5"/>} 
                            label="Engagement" 
                            value={`${selectedMetrica.scroll_medio || 0}%`} 
                            subValue={`${selectedMetrica.interacciones || 0} reacciones`} 
                            color="purple"
                          />
                          <MetricCard 
                            icon={<Share2 className="w-5 h-5"/>} 
                            label="Lealtad" 
                            value={selectedMetrica.compartidos || 0} 
                            subValue="Veces compartido" 
                            color="amber"
                          />
                        </>
                      )}
                    </div>

                    {!selectedMetrica.public_only ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                         <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                           <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                             <Globe className="w-4 h-4"/> Fuentes de Tráfico
                           </h3>
                           <div className="h-[300px] w-full min-h-[300px]">
                             <ResponsiveContainer width="100%" height="100%">
                               <PieChart>
                                 <Pie
                                   data={[
                                     { name: 'Directo', value: selectedMetrica.fuentes?.directo || 0 },
                                     { name: 'Redes', value: selectedMetrica.fuentes?.redes || 0 },
                                     { name: 'Buscador', value: selectedMetrica.fuentes?.buscador || 0 },
                                   ]}
                                   innerRadius={60}
                                   outerRadius={80}
                                   paddingAngle={5}
                                   dataKey="value"
                                 >
                                   {['#ef4444', '#1f2937', '#6b7280'].map((color, index) => (
                                     <Cell key={`cell-${index}`} fill={color} />
                                   ))}
                                 </Pie>
                                 <ReTooltip />
                               </PieChart>
                             </ResponsiveContainer>
                           </div>
                         </div>

                         <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                           <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                             <Smartphone className="w-4 h-4"/> Segmentación Dispositivo
                           </h3>
                           <div className="h-[300px] w-full min-h-[300px]">
                             <ResponsiveContainer width="100%" height="100%">
                               <BarChart data={[
                                 { name: 'Móvil', value: selectedMetrica.dispositivos?.mobile || 0 },
                                 { name: 'Desktop', value: selectedMetrica.dispositivos?.desktop || 0 },
                               ]}>
                                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700 }} />
                                 <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                 <ReTooltip />
                                 <Bar dataKey="value" fill="#ef4444" radius={[8, 8, 0, 0]} />
                               </BarChart>
                             </ResponsiveContainer>
                           </div>
                         </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-8 rounded-2xl border border-gray-200 flex items-center gap-4">
                        <ShieldAlert className="w-6 h-6 text-red-500" />
                        <div>
                          <p className="font-bold text-gray-900">Métricas avanzadas protegidas</p>
                          <p className="text-sm text-gray-500">Solo el autor de esta publicación puede ver estadísticas detalladas de comportamiento y retención.</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                          <h3 className="text-xl font-bold flex items-center gap-2">
                            <FileText className="w-5 h-5 text-red-600" /> 
                            Ranking de Noticias
                          </h3>
                          <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
                            {['dia', 'mes', 'año'].map((p) => (
                              <button 
                                key={p}
                                onClick={() => setMetricPeriod(p)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all capitalize ${metricPeriod === p ? 'bg-white text-lapacho-pink shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                              >
                                {p === 'dia' ? 'Hoy' : p}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-6">
                          {Array.isArray(metricas) && metricas.length > 0 ? metricas.map((m, i) => (
                            <div 
                              key={i} 
                              className="flex items-center gap-4 cursor-pointer hover:bg-gray-50 p-2 rounded-xl transition-colors group"
                              onClick={() => setSelectedNoticiaId(m.id || null)}
                            >
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-400 text-xs">
                                {i + 1}
                              </div>
                              <div className="flex-1">
                                <p className="font-bold text-gray-900 line-clamp-1 group-hover:text-lapacho-pink transition-colors">{m.titulo}</p>
                                <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                  <div 
                                    className="bg-lapacho-pink h-full rounded-full transition-all duration-1000" 
                                    style={{ width: `${(m.total_visitas / (metricas[0]?.total_visitas || 1)) * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                              <div className="text-right flex items-center gap-4">
                                <span className="font-mono font-bold text-gray-900">{m.total_visitas}</span>
                                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-lapacho-pink transition-colors" />
                              </div>
                            </div>
                          )) : (
                            <div className="text-center py-12">
                              <AlertCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                              <p className="text-gray-400 italic">No hay datos de visitas para este periodo.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {(user.rol === 'autor' || user.rol === 'admin') && (
                        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                          <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
                            <Users className="w-5 h-5 text-lapacho-pink" /> Mis Suscriptores ({seguidores.length})
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                            {seguidores.length > 0 ? seguidores.map((s) => (
                              <div key={s.seguidor_id} className="flex flex-col items-center text-center">
                                {s.seguidor_foto ? (
                                  <img src={s.seguidor_foto} className="w-12 h-12 rounded-full object-cover mb-2 border border-gray-100" />
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-2">
                                    <UserIcon className="w-6 h-6" />
                                  </div>
                                )}
                                <span className="text-xs font-bold text-gray-900 line-clamp-1">{s.seguidor_nombre}</span>
                                <span className="text-[10px] text-gray-400 capitalize">{new Date(s.creado_en).toLocaleDateString()}</span>
                              </div>
                            )) : (
                              <div className="col-span-full py-8 text-center text-gray-400 italic text-sm">
                                Aún no tienes seguidores. Interactúa más con tus lectores.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-8">
                      <div className="bg-gradient-to-br from-lapacho-pink to-lapacho-pink/80 text-white p-8 rounded-2xl shadow-xl flex flex-col justify-between">
                        <div>
                          <h3 className="text-lg font-bold opacity-80 mb-1">Impacto ({metricPeriod})</h3>
                          <p className="text-5xl font-serif font-bold">
                            {globalImpact}
                          </p>
                          <p className="text-sm opacity-60 mt-2">Alcance total de tus publicaciones</p>
                        </div>
                        <div className="mt-12 bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                          <p className="text-xs font-bold uppercase tracking-wider mb-2">Tip del día</p>
                          <p className="text-sm italic">
                            {getTipOfDay()}
                          </p>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-lapacho-pink" /> Resumen de Actividad
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Noticias publicadas</span>
                            <span className="font-bold">{misNoticias.length}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Periodo activo</span>
                            <span className="font-bold capitalize">{metricPeriod}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Ranking global</span>
                            <span className="font-bold text-red-600">#4</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Bell className="w-5 h-5 text-lapacho-pink" /> Centro de Notificaciones
                  </h3>
                </div>
                
                {misNoticias.filter(n => n.patrocinada && n.patrocinio_estado !== 'aceptado').length > 0 && (
                  <div className="bg-lapacho-pink/5 p-6 border-b border-lapacho-pink/10">
                    <h4 className="text-sm font-black text-red-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Pendientes de Comprobante
                    </h4>
                    <div className="space-y-3">
                      {misNoticias.filter(n => n.patrocinada && n.patrocinio_estado !== 'aceptado').map(n => (
                        <div key={n.id} className="bg-white p-4 rounded-xl border border-lapacho-pink/10 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 line-clamp-1 truncate">{n.titulo}</p>
                            <p className="text-xs text-gray-500">{n.patrocinio_marca} • Gs. {Number(n.patrocinio_monto).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded bg-gray-100 ${
                              n.patrocinio_estado === 'rechazado' ? 'text-lapacho-pink' : 'text-gray-500'
                            }`}>
                              {n.patrocinio_estado}
                            </span>
                            <label className="bg-lapacho-pink text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:opacity-90 transition-colors">
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*,application/pdf"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setUploading(true);
                                  try {
                                    let fileToUpload = file;
                                    // Si es imagen, comprimir y convertir a PNG
                                    if (file.type.startsWith('image/')) {
                                      const compressedBlob = await compressImage(file, 1600, 1600, 0.8);
                                      const fileName = file.name.split('.').slice(0, -1).join('.') || 'comprobante';
                                      fileToUpload = new File([compressedBlob], `${fileName}.png`, { type: 'image/png' });
                                    }
                                    
                                    const { url } = await api.upload(fileToUpload);
                                    await api.noticias.subirComprobante(n.id, url);
                                    setSuccess('Comprobante enviado para revisión');
                                    loadData();
                                    setTimeout(() => setSuccess(''), 3000);
                                  } catch (err) {
                                    alert('Error al subir comprobante');
                                  } finally {
                                    setUploading(false);
                                  }
                                }}
                              />
                              {n.patrocinio_comprobante ? 'Cambiar Comprobante' : 'Subir Comprobante'}
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="divide-y divide-gray-50">
                  {notificaciones.length > 0 ? notificaciones.map((n) => (
                    <div key={n.id} className={`p-6 flex gap-4 hover:bg-gray-50 transition-colors ${!n.leida ? 'bg-lapacho-pink/5' : ''}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                        n.tipo === 'verificacion' ? 'bg-green-100 text-green-600 border border-green-200' : 
                        n.tipo === 'mensaje_admin' ? 'bg-lapacho-pink text-white border-2 border-lapacho-pink/10 animate-pulse' :
                        'bg-blue-100 text-blue-600 border border-blue-200'
                      }`}>
                         {n.tipo === 'mensaje_admin' ? <Send className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                            n.tipo === 'verificacion' ? 'bg-green-100 text-green-700' : 
                            n.tipo === 'mensaje_admin' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {n.tipo === 'verificacion' ? 'Seguridad' : n.tipo === 'mensaje_admin' ? 'Comunicado Oficial' : 'Aviso'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold">{new Date(n.creado_en).toLocaleString()}</span>
                        </div>
                        
                        {n.tipo === 'mensaje_admin' ? (
                          (() => {
                            try {
                              const msg = JSON.parse(n.mensaje);
                              return (
                                <div className="space-y-1">
                                  <p className="font-bold text-gray-900 text-sm">{msg.title}</p>
                                  <p className="text-gray-600 text-xs leading-relaxed">{msg.content}</p>
                                </div>
                              );
                            } catch(e) { return <p className="text-sm text-gray-900">{n.mensaje}</p>; }
                          })()
                        ) : (
                          <p className="text-sm text-gray-900 font-medium leading-relaxed">{n.mensaje}</p>
                        )}
                      </div>
                      {!n.leida && <div className="w-2 h-2 rounded-full bg-red-600 self-center shadow-[0_0_8px_rgba(220,38,38,0.5)]"></div>}
                    </div>
                  )) : (
                    <div className="p-16 text-center">
                      <Bell className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                      <p className="text-gray-400">No tienes notificaciones por el momento.</p>
                    </div>
                  )}
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
                            {n.patrocinada === 1 && (
                              <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase tracking-wider ${
                                n.patrocinio_estado === 'aceptado' ? 'bg-blue-100 text-blue-700' :
                                n.patrocinio_estado === 'rechazado' ? 'bg-red-100 text-red-700' :
                                n.patrocinio_estado === 'en revision' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {n.patrocinio_marca}: {n.patrocinio_estado}
                              </span>
                            )}
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

            {activeTab === 'verify' && (
              <div className="max-w-2xl mx-auto">
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-xl space-y-8">
                  <div className="text-center">
                    <ShieldAlert className={`w-16 h-16 ${user.estado_verificacion === 'aprobado' ? 'text-green-600' : 'text-red-600'} mx-auto mb-4`} />
                    <h2 className="text-3xl font-serif font-black text-gray-900">
                      {user.estado_verificacion === 'aprobado' ? 'Tu Identidad está Verificada' : 'Verificación de Identidad'}
                    </h2>
                    <p className="text-gray-500 mt-2">
                      {user.estado_verificacion === 'aprobado' 
                        ? 'Gracias por ayudarnos a mantener Lapacho Post como un entorno seguro y confiable.' 
                        : 'Para mantener la integridad de Lapacho Post, requerimos que todos los autores verifiquen su identidad real.'}
                    </p>
                  </div>

                  {user.estado_verificacion === 'aprobado' ? (
                    <div className="space-y-6">
                      <div className="bg-green-50 border border-green-200 p-6 rounded-2xl flex items-center gap-4">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                        <div>
                          <p className="font-bold text-green-900">¡Verificación Exitosa!</p>
                          <p className="text-sm text-green-700">Tus documentos han sido validados por el equipo administrativo. No puedes realizar cambios a menos que se solicite una nueva verificación.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-70 grayscale hover:grayscale-0 transition-all">
                        <div className="space-y-2 text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase">Selfie</p>
                          {user.selfie && <img src={user.selfie} className="w-full h-32 object-cover rounded-xl border-2 border-white shadow-sm" />}
                        </div>
                        <div className="space-y-2 text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase">Frente</p>
                          {user.cedula_frontal && <img src={user.cedula_frontal} className="w-full h-32 object-cover rounded-xl border-2 border-white shadow-sm" />}
                        </div>
                        <div className="space-y-2 text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase">Dorso</p>
                          {user.cedula_trasera && <img src={user.cedula_trasera} className="w-full h-32 object-cover rounded-xl border-2 border-white shadow-sm" />}
                        </div>
                      </div>
                    </div>
                  ) : user.estado_verificacion === 'pendiente' ? (
                    <div className="bg-blue-50 border border-blue-200 p-6 rounded-2xl text-center">
                      <Clock className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                      <h4 className="font-bold text-blue-900 text-xl">Verificación en Proceso</h4>
                      <p className="text-blue-700">Estamos revisando tus documentos. Recibirás una notificación una vez que completemos el proceso.</p>
                    </div>
                  ) : (
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setLoading(true);
                      try {
                        await api.auth.updatePerfil({
                          selfie: selfieUrl,
                          cedula_frontal: cedulaFrontalUrl,
                          cedula_trasera: cedulaTraseraUrl,
                          nombre, bio, foto_perfil: perfilUrl, telefono 
                        });
                        alert('Documentos enviados correctamente.');
                        const freshUser = await api.auth.me();
                        onUserUpdate(freshUser);
                      } catch (err) {
                        alert('Error al enviar documentos');
                      } finally {
                        setLoading(false);
                      }
                    }} className="space-y-6">
                      <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                        <p className="text-sm text-amber-800">
                          {user.estado_verificacion === 'rechazado' 
                            ? 'Tu solicitud anterior fue rechazada. Por favor sube fotos más nítidas y vuelve a intentarlo.' 
                            : 'Debes subir una selfie sosteniendo tu cédula y fotos legibles del frente y dorso de tu documento.'}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-sm font-black text-gray-400 uppercase tracking-widest">1. Selfie con Rostro Visible</label>
                        <div className="flex items-center gap-4">
                          <label className="flex-1 cursor-pointer bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-red-400 text-gray-500 transition-all">
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'selfie')} />
                            <ImageIcon className="w-8 h-8" />
                            <span className="text-sm font-bold">{uploading ? 'Subiendo...' : 'Subir Selfie'}</span>
                          </label>
                          {selfieUrl && <img src={selfieUrl} className="w-24 h-24 object-cover rounded-xl border-2 border-white shadow-sm" />}
                        </div>

                        <label className="block text-sm font-black text-gray-400 uppercase tracking-widest">2. Foto de Cédula (Frente)</label>
                        <div className="flex items-center gap-4">
                          <label className="flex-1 cursor-pointer bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-red-400 text-gray-500 transition-all">
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'cedula_frontal')} />
                            <ImageIcon className="w-8 h-8" />
                            <span className="text-sm font-bold">{uploading ? 'Subiendo...' : 'Subir Frente'}</span>
                          </label>
                          {cedulaFrontalUrl && <img src={cedulaFrontalUrl} className="w-24 h-24 object-cover rounded-xl border-2 border-white shadow-sm" />}
                        </div>

                        <label className="block text-sm font-black text-gray-400 uppercase tracking-widest">3. Foto de Cédula (Dorso)</label>
                        <div className="flex items-center gap-4">
                          <label className="flex-1 cursor-pointer bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-red-400 text-gray-500 transition-all">
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'cedula_trasera')} />
                            <ImageIcon className="w-8 h-8" />
                            <span className="text-sm font-bold">{uploading ? 'Subiendo...' : 'Subir Dorso'}</span>
                          </label>
                          {cedulaTraseraUrl && <img src={cedulaTraseraUrl} className="w-24 h-24 object-cover rounded-xl border-2 border-white shadow-sm" />}
                        </div>
                      </div>

                      <button 
                        type="submit" 
                        disabled={!selfieUrl || !cedulaFrontalUrl || !cedulaTraseraUrl || uploading}
                        className="w-full bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-black transition-all shadow-lg disabled:opacity-50"
                      >
                        {uploading ? 'Subiendo archivos...' : 'Enviar para Revisión'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'sponsorships' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="text-2xl font-serif font-black mb-6">Solicitar Nuevo Patrocinio</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true);
                    try {
                      await api.patrocinios.solicitar({
                        marca: patrocinioMarca,
                        ruc: patrocinioRUC,
                        monto: Number(patrocinioMonto),
                        comprobante: imagenUrl // Using image context for comprobante upload here
                      });
                      alert('Solicitud enviada. Debe ser aprobada por administración.');
                      loadData();
                      setPatrocinioMarca('');
                      setPatrocinioRUC('');
                      setPatrocinioMonto('');
                      setImagenUrl('');
                    } catch (err: any) {
                      alert('Error al solicitar patrocinio: ' + (err.message || 'Error desconocido'));
                    } finally {
                      setLoading(false);
                    }
                  }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <input 
                        placeholder="Nombre de la Marca" 
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold"
                        value={patrocinioMarca}
                        onChange={(e) => setPatrocinioMarca(e.target.value)}
                        required
                      />
                      <input 
                        placeholder="RUC de la empresa" 
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold"
                        value={patrocinioRUC}
                        onChange={(e) => setPatrocinioRUC(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-4">
                      <input 
                        placeholder="Monto Acordado (Gs)" 
                        type="number"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold"
                        value={patrocinioMonto}
                        onChange={(e) => setPatrocinioMonto(e.target.value)}
                        required
                      />
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <label className="flex-1 cursor-pointer bg-red-50 text-red-600 border-2 border-dashed border-red-200 rounded-xl p-3 text-center text-xs font-black uppercase hover:bg-red-100 transition-colors">
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'news')} />
                            {uploading ? 'Subiendo...' : (imagenUrl ? 'Comprobante Listo ✅' : 'Subir Comprobante de Transferencia')}
                          </label>
                          <button 
                            type="button"
                            onClick={() => setShowBankInfo(true)}
                            className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center border border-gray-200"
                            title="Ver Datos Bancarios"
                          >
                            <span className="text-xs font-black uppercase">¿A dónde envío?</span>
                          </button>
                        </div>
                        {!imagenUrl && !uploading && (
                          <p className="text-[10px] text-red-500 font-bold uppercase text-center">* Comprobante obligatorio</p>
                        )}
                      </div>
                    </div>
                    <button 
                      type="submit" 
                      disabled={!imagenUrl || uploading || !patrocinioMarca || !patrocinioMonto}
                      className="md:col-span-2 bg-lapacho-navy text-white py-4 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {uploading ? 'Procesando archivos...' : 'Registrar Solicitud de Patrocinio'}
                    </button>
                  </form>
                </div>

                <AnimatePresence>
                  {showBankInfo && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                      <motion.div 
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
                      >
                        <div className="bg-red-600 p-6 text-white flex justify-between items-center">
                          <h4 className="text-xl font-serif font-black">Datos de Transferencia</h4>
                          <button 
                            onClick={() => setShowBankInfo(false)}
                            className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
                          >
                            <XCircle className="w-6 h-6" />
                          </button>
                        </div>
                        <div className="p-8 space-y-6">
                          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Banco</span>
                              <span className="font-bold text-gray-900 italic">Banco Vision</span>
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cuenta</span>
                              <span className="font-mono font-bold text-gray-900">12.345.678 / 9</span>
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Titular</span>
                              <span className="font-bold text-gray-900">Lapacho Post SRL</span>
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">RUC</span>
                              <span className="font-bold text-gray-900">80099887-6</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo</span>
                              <span className="font-bold text-gray-900">Caja de Ahorro</span>
                            </div>
                          </div>
                          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                            <p className="text-[10px] font-bold text-amber-900 uppercase">Asegúrate de subir el comprobante una vez realizada la transferencia para validar tu solicitud.</p>
                          </div>
                          <button 
                            onClick={() => setShowBankInfo(false)}
                            className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-900 transition-all uppercase tracking-widest text-xs"
                          >
                            Entendido, cerrar
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-100">
                    <h3 className="text-xl font-bold">Mis Solicitudes de Patrocinio</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {misPatrocinios.length > 0 ? misPatrocinios.map((p) => (
                      <div key={p.id} className="p-6 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900">{p.marca}</p>
                          <p className="text-xs text-gray-500">Gs. {Number(p.monto).toLocaleString()} • {new Date(p.creado_en).toLocaleDateString()}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          p.estado === 'aprobado' ? 'bg-green-100 text-green-700' :
                          p.estado === 'rechazado' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {p.estado}
                        </span>
                      </div>
                    )) : (
                      <div className="p-8 text-center text-gray-400 italic">No tienes solicitudes registradas.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pages' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="text-2xl font-serif font-black mb-6">{editingPageId ? 'Editar Página' : 'Añadir Nueva Página'}</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true);
                    try {
                      if (editingPageId) {
                        await api.admin.updatePagina(editingPageId, { slug: pageSlug, titulo: pageTitle, contenido: pageContent, activa: pageActive });
                      } else {
                        await api.admin.createPagina({ slug: pageSlug, titulo: pageTitle, contenido: pageContent, activa: pageActive });
                      }
                      alert('Página guardada');
                      loadData();
                      setEditingPageId(null);
                      setPageSlug('');
                      setPageTitle('');
                      setPageContent('');
                    } catch (err) {
                      alert('Error al guardar página');
                    } finally {
                      setLoading(false);
                    }
                  }} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <input 
                        placeholder="Título de la página (Ej: Sobre Nosotros)" 
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold"
                        value={pageTitle}
                        onChange={(e) => setPageTitle(e.target.value)}
                        required
                      />
                      <input 
                        placeholder="Slug (Ej: sobre-nosotros)" 
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm"
                        value={pageSlug}
                        onChange={(e) => setPageSlug(e.target.value)}
                        required
                      />
                    </div>
                    <div className="min-h-[300px] border border-gray-200 rounded-xl overflow-hidden">
                      <ReactQuill theme="snow" value={pageContent} onChange={setPageContent} className="h-[250px]" />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={pageActive} onChange={(e) => setPageActive(e.target.checked)} className="w-4 h-4 rounded text-red-600" />
                        <span className="text-sm font-bold text-gray-700">Página Activa</span>
                      </label>
                      <div className="flex gap-4">
                        {editingPageId && <button type="button" onClick={() => setEditingPageId(null)} className="text-gray-500 font-bold">Cancelar</button>}
                        <button type="submit" className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-all">
                          {editingPageId ? 'Actualizar Página' : 'Publicar Página'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-100">
                    <h3 className="text-xl font-bold">Gestión de Páginas Estáticas</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {adminPages.length > 0 ? adminPages.map((p) => (
                      <div key={p.id} className="p-6 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900">{p.titulo}</p>
                          <p className="text-xs text-gray-500">/{p.slug} • Actualizada el {new Date(p.actualizado_en).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setEditingPageId(p.id);
                              setPageTitle(p.titulo);
                              setPageSlug(p.slug);
                              setPageContent(p.contenido);
                              setPageActive(!!p.activa);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={async () => {
                              if(confirm('¿Seguro?')) {
                                await api.admin.deletePagina(p.id);
                                loadData();
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )) : (
                      <div className="p-12 text-center text-gray-400 italic">No hay páginas creadas.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'create' && (
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-serif font-black text-gray-900">{editingId ? 'Editar Noticia' : 'Nueva Noticia'}</h2>
                    <p className="text-gray-500">Crea contenido de alto impacto para tu audiencia.</p>
                  </div>
                </div>

                <form onSubmit={handleNewsSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-black text-gray-400 uppercase tracking-widest">Título Impactante</label>
                      <input 
                        className="w-full bg-gray-50 border-0 rounded-xl p-4 text-lg font-serif focus:ring-2 focus:ring-red-500 transition-all font-bold"
                        placeholder="Ej: El futuro del periodismo en Paraguay..."
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-gray-400 uppercase tracking-widest">Categoría</label>
                      <select 
                        className="w-full bg-gray-50 border-0 rounded-xl p-4 focus:ring-2 focus:ring-red-500 transition-all font-bold appearance-none"
                        value={categoriaId}
                        onChange={(e) => setCategoriaId(e.target.value)}
                        required
                      >
                        <option value="">Seleccionar categoría</option>
                        {categorias.filter(c => c.activa).map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-400 uppercase tracking-widest">Subtítulo o Resumen</label>
                    <textarea 
                      className="w-full bg-gray-50 border-0 rounded-xl p-4 h-20 focus:ring-2 focus:ring-red-500 transition-all text-gray-600 font-medium"
                      placeholder="Una breve descripción que invite a leer..."
                      value={subtitulo}
                      onChange={(e) => setSubtitulo(e.target.value)}
                    />
                  </div>

                    <div className="space-y-2">
                      <label className="text-sm font-black text-gray-400 uppercase tracking-widest block">
                        Imagen Principal (Fija al inicio)
                      </label>
                      <p className="text-[10px] text-red-600 font-bold bg-red-50 inline-block px-2 py-0.5 rounded">
                        ℹ️ Se recomienda subir imágenes en formato 16:9 para un mejor resultado visual.
                      </p>
                      <div className="relative group mt-2">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <ImageIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input 
                        className="w-full bg-gray-50 border-0 rounded-xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-2 focus:ring-red-500 transition-all"
                        placeholder="URL de la imagen o subir abajo..."
                        value={imagenUrl}
                        onChange={(e) => setImagenUrl(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <label className="cursor-pointer bg-red-50 border-2 border-dashed border-red-200 hover:border-red-500 transition-all rounded-xl px-6 py-4 flex-1 flex flex-col items-center gap-2 group">
                        <Plus className="w-6 h-6 text-red-400 group-hover:text-red-500" />
                        <span className="text-xs font-black text-red-500 uppercase tracking-tighter">Subir Imagen Principal</span>
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'news')} accept="image/*" />
                      </label>
                      {imagenUrl && (
                        <div className="w-32 aspect-video rounded-xl overflow-hidden shadow-sm border-2 border-white relative group">
                          <img src={imagenUrl} alt="Preview" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setImagenUrl('')} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-6 h-6 text-white" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-400 uppercase tracking-widest">Cuerpo de la Noticia</label>
                    <div className="bg-gray-50 rounded-xl border border-gray-100 min-h-[400px]">
                      <ReactQuill 
                        theme="snow" 
                        value={contenido} 
                        onChange={setContenido}
                        placeholder="Escribe tu contenido aquí... El autor puede añadir más imágenes y dar formato al texto de manera visual."
                        modules={{
                          toolbar: [
                            [{ 'header': [1, 2, 3, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{'list': 'ordered'}, {'list': 'bullet'}],
                            ['link', 'image'],
                            ['clean']
                          ],
                        }}
                        className="h-[340px]"
                      />
                    </div>
                  </div>

                  <div className="p-6 bg-blue-50 rounded-2xl border border-blue-200">
                    <label className="flex items-center gap-3 font-bold text-blue-900 mb-4">
                      <Activity className="w-5 h-5" /> Asociar Patrocinio Aprobado
                    </label>
                    
                    {misPatrocinios.filter(p => p.estado === 'aprobado').length > 0 ? (
                      <select 
                        className="w-full bg-white border border-blue-100 rounded-xl p-3 text-sm font-bold"
                        value={selectedPatrocinioId || ''}
                        onChange={(e) => setSelectedPatrocinioId(e.target.value || null)}
                      >
                        <option value="">Ninguno - Contenido estándar</option>
                        {misPatrocinios.filter(p => p.estado === 'aprobado').map(p => (
                          <option key={p.id} value={p.id}>{p.marca} (Gs. {p.monto.toLocaleString()})</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-blue-600 italic">No tienes patrocinios aprobados vinculados a tu cuenta. Los patrocinios deben aprobarse antes de poder ser vinculados a una noticia.</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-6 pt-6">
                    <button 
                      type="button" 
                      onClick={() => setActiveTab('manage')}
                      className="text-gray-500 font-bold hover:text-red-600"
                    >
                      Descartar
                    </button>
                    <button 
                      type="submit" 
                      disabled={uploading}
                      className="bg-red-600 text-white px-12 py-4 rounded-xl font-black text-lg hover:bg-black transition-all shadow-lg flex items-center gap-3"
                    >
                      {uploading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                      {editingId ? 'Guardar Cambios' : 'Publicar Noticia'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="max-w-2xl mx-auto space-y-8">
                {!user.verificado && (
                  <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-amber-900">Correo no verificado</h4>
                      <p className="text-sm text-amber-700">Por favor, revisa tu correo electrónico y verifica tu cuenta. Las cuentas no verificadas serán eliminadas después de 24 horas.</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleProfileSubmit} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">Mi Perfil</h3>
                    {user.verificado ? (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Verificado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                        <Clock className="w-3 h-3" /> Pendiente
                      </span>
                    )}
                  </div>
                  
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
                    <label className="block text-sm font-bold text-gray-700 mb-2">Teléfono (Opcional)</label>
                    <div className="phone-input-container">
                      <PhoneInput
                        placeholder="Ej: +595 9xx xxx xxx"
                        value={telefono}
                        onChange={(val) => setTelefono(val || '')}
                        defaultCountry="PY"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-red-500 outline-none transition-all"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">Esencial para recibir alertas de noticias de último momento.</p>
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
                    className="w-full bg-lapacho-navy text-white py-3 rounded-xl font-bold hover:opacity-90 transition-all"
                  >
                    Guardar Cambios
                  </button>
                </form>

                {(user.rol === 'autor' || user.rol === 'admin') && (
                  <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-xl font-bold mb-6 flex items-center justify-between">
                      Mis Seguidores
                      <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-sm">{seguidores.length} suscriptores</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {seguidores.length > 0 ? seguidores.map((s) => (
                        <div key={s.seguidor_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                            {s.seguidor_foto ? (
                              <img src={s.seguidor_foto} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <UserIcon className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">{s.seguidor_nombre}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-black">Siguiendo desde {new Date(s.creado_en).toLocaleDateString()}</p>
                          </div>
                        </div>
                      )) : (
                        <div className="col-span-2 text-center py-8 text-gray-400 italic">
                          Aún no tienes suscriptores. ¡Sigue publicando contenido de calidad!
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {user.rol === 'suscriptor' && (
                  <div className="bg-red-50 border border-red-100 p-8 rounded-2xl">
                    <h4 className="text-xl font-black text-red-900 mb-2">¿Quieres ser Autor?</h4>
                    <p className="text-red-700 mb-6">Si te apasiona escribir noticias, solicita convertirte en autor verificado de Lapacho Post.</p>
                    
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

            {activeTab === 'users' && user.rol === 'admin' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
                    <Users className="w-5 h-5 text-red-600" /> Gestión de Usuarios
                  </h3>
                  
                  <div className="flex gap-4 mb-8">
                    <input 
                      type="text"
                      placeholder="Buscar por correo..."
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                      className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                    />
                    <button 
                      onClick={handleSearchUsers}
                      className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-all flex items-center gap-2"
                    >
                      <ArrowUpRight className="w-5 h-5 rotate-45" /> Buscar
                    </button>
                  </div>

                  <div className="space-y-4">
                    {foundUsers.map(u => (
                      <div key={u.id} className="p-4 border border-gray-50 rounded-xl bg-gray-50/50 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">
                            {u.nombre.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{u.nombre}</p>
                            <p className="text-xs text-gray-500">{u.email} • {u.rol}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {u.rol === 'autor' && (
                            <button 
                              onClick={async () => {
                                if(window.confirm('¿Deseas solicitar que este usuario vuelva a verificar su identidad? Se le notificará y se reseteará su estado.')) {
                                  try {
                                    await api.admin.pedirVerificacion(u.id);
                                    alert('Solicitud enviada con éxito');
                                    handleSearchUsers();
                                  } catch (e) { alert('Error al procesar solicitud'); }
                                }
                              }}
                              title="Solicitar Re-verificación"
                              className={`p-2 rounded-lg transition-colors ${u.estado_verificacion === 'aprobado' ? 'text-amber-600 hover:bg-amber-50' : 'text-gray-300 cursor-not-allowed'}`}
                              disabled={u.estado_verificacion !== 'aprobado'}
                            >
                              <ShieldAlert className="w-5 h-5" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleSyncSendPulse(u.id)}
                            title="Sincronizar con SendPulse"
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          >
                            <RefreshCw className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => setEditingUser(u)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {searchEmail && foundUsers.length === 0 && !loading && (
                      <p className="text-center text-gray-400 italic py-4">No se encontraron usuarios.</p>
                    )}
                  </div>
                </div>

                {editingUser && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-8 rounded-2xl border-2 border-red-100 shadow-xl"
                  >
                    <h4 className="text-lg font-bold mb-6 flex items-center justify-between">
                      Editando Usuario: {editingUser.email}
                      <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-900">
                         <XCircle className="w-5 h-5" />
                      </button>
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Nombre</label>
                        <input 
                          type="text" 
                          value={editingUser.nombre}
                          onChange={(e) => setEditingUser({...editingUser, nombre: e.target.value})}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Email</label>
                        <input 
                          type="email" 
                          value={editingUser.email}
                          onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Rol</label>
                        <select 
                          value={editingUser.rol}
                          onChange={(e) => setEditingUser({...editingUser, rol: e.target.value as any})}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                        >
                          <option value="suscriptor">Suscriptor</option>
                          <option value="autor">Autor</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Verificado</label>
                        <select 
                          value={editingUser.verificado ? 1 : 0}
                          onChange={(e) => setEditingUser({...editingUser, verificado: e.target.value === '1'})}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                        >
                          <option value={1}>Sí</option>
                          <option value={0}>No</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Teléfono</label>
                        <input 
                          type="text" 
                          value={editingUser.telefono || ''}
                          onChange={(e) => setEditingUser({...editingUser, telefono: e.target.value})}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                        />
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleUpdateUser}
                      className="w-full bg-lapacho-navy text-white py-3 mt-8 rounded-xl font-bold hover:opacity-90 transition-all"
                    >
                      Guardar Cambios del Usuario
                    </button>
                  </motion.div>
                )}
              </div>
            )}

            {activeTab === 'admin' && user.rol === 'admin' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Panel de Verificaciones de Identidad */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-red-50/30">
                <h3 className="text-xl font-black flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600" /> Verificaciones de Identidad
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {adminVerificaciones.length > 0 ? adminVerificaciones.map(v => (
                  <div key={v.id} className="p-8 space-y-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-black text-lg text-gray-900">{v.nombre}</p>
                        <p className="text-sm text-gray-500 font-bold">{v.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={async () => {
                            await api.admin.handleVerificacion(v.id, 'aprobar');
                            loadData();
                          }}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg font-black text-xs hover:bg-green-700 transition-all"
                        >
                          Aprobar Identidad
                        </button>
                        <button 
                          onClick={async () => {
                            await api.admin.handleVerificacion(v.id, 'rechazar');
                            loadData();
                          }}
                          className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg font-black text-xs hover:bg-gray-300 transition-all"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Selfie</p>
                        <img src={v.selfie} className="w-full h-48 object-cover rounded-2xl border-2 border-gray-100 shadow-sm cursor-zoom-in" onClick={() => window.open(v.selfie, '_blank')} />
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ID Frontal</p>
                        <img src={v.cedula_frontal} className="w-full h-48 object-cover rounded-2xl border-2 border-gray-100 shadow-sm cursor-zoom-in" onClick={() => window.open(v.cedula_frontal, '_blank')} />
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ID Trasero</p>
                        <img src={v.cedula_trasera} className="w-full h-48 object-cover rounded-2xl border-2 border-gray-100 shadow-sm cursor-zoom-in" onClick={() => window.open(v.cedula_trasera, '_blank')} />
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="p-12 text-center text-gray-400 italic font-bold">No hay verificaciones de identidad pendientes.</div>
                )}
              </div>
            </div>

            {/* Gestión de Patrocinios */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden mt-8">
              <div className="p-6 border-b border-gray-100 bg-amber-50/30">
                <h3 className="text-xl font-black flex items-center gap-2">
                  <Activity className="w-5 h-5 text-amber-600" /> Solicitudes de Patrocinio (Marketing)
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {adminPatrocinios.length > 0 ? adminPatrocinios.map(p => (
                  <div key={p.id} className="p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase tracking-wider">Pendiente de Aprobación</span>
                        <p className="text-xs text-gray-400 font-bold">Solicitado por {p.autor_nombre || 'Autor'}</p>
                      </div>
                      <h4 className="text-2xl font-serif font-black text-gray-900 leading-tight">{p.marca}</h4>
                      <div className="flex gap-4 mt-2">
                        <p className="text-sm font-bold text-gray-500">Monto: <span className="text-gray-900">Gs. {Number(p.monto).toLocaleString()}</span></p>
                        <p className="text-sm font-bold text-gray-500">RUC: <span className="text-gray-900">{p.ruc}</span></p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 min-w-[200px]">
                      {p.comprobante && (
                        <button 
                          onClick={() => window.open(p.comprobante, '_blank')}
                          className="text-xs font-black text-amber-600 hover:underline flex items-center gap-1"
                        >
                          <ImageIcon className="w-3 h-3" /> Ver Comprobante de Pago
                        </button>
                      )}
                      <div className="flex gap-2">
                        <button 
                          onClick={async () => {
                            await api.admin.handlePatrocinio(p.id, 'aprobado');
                            loadData();
                          }}
                          className="flex-1 bg-green-600 text-white font-black py-2 rounded-lg text-xs hover:bg-green-700 transition-all shadow-md"
                        >
                          Aprobar
                        </button>
                        <button 
                          onClick={async () => {
                            await api.admin.handlePatrocinio(p.id, 'rechazado');
                            loadData();
                          }}
                          className="flex-1 bg-gray-200 text-gray-600 font-black py-2 rounded-lg text-xs hover:bg-gray-300 transition-all"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="p-12 text-center text-gray-400 italic font-bold">No hay patrocinios pendientes de revisión comercial.</div>
                )}
              </div>
            </div>

            {/* Centro de Mensajería */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                 <h3 className="text-xl font-black flex items-center gap-2">
                   <Send className="w-5 h-5 text-red-600" /> Centro de Mensajería Global
                 </h3>
               </div>
               <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Destinatarios</label>
                      <select id="msg-target" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500">
                        <option value="todos">Toda la comunidad (Global)</option>
                        <option value="autores">Solo Autores y Administradores</option>
                        <option value="suscriptores">Solo Suscriptores</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Asunto / Título</label>
                      <input id="msg-title" type="text" placeholder="Ej: Nueva funcionalidad disponible" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Mensaje</label>
                      <textarea id="msg-content" rows={3} placeholder="Escribe el contenido del mensaje..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500"></textarea>
                    </div>
                    <button 
                      onClick={async () => {
                        const target = (document.getElementById('msg-target') as unknown as HTMLSelectElement)?.value;
                        const title = (document.getElementById('msg-title') as unknown as HTMLInputElement)?.value;
                        const content = (document.getElementById('msg-content') as unknown as HTMLTextAreaElement)?.value;
                        if(!title || !content) return alert('Completa título y contenido');
                        
                        try {
                          const res = await fetch('/api/admin/enviar-mensaje', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ target, title, content })
                          });
                          const data = await res.json() as any;
                          if(data.error) throw new Error(data.error);
                          alert('Mensaje enviado a ' + data.count + ' usuarios');
                          (document.getElementById('msg-title') as HTMLInputElement).value = '';
                          (document.getElementById('msg-content') as HTMLTextAreaElement).value = '';
                        } catch(e: any) { alert('Error: ' + e.message); }
                      }}
                      className="w-full bg-red-600 text-white font-black py-4 rounded-xl hover:bg-red-700 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" /> Difundir Mensaje
                    </button>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Globe className="w-5 h-5 text-red-600" /> Configuración de Webhook (SendPulse)
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  Copia esta URL y pégala en tu panel de SendPulse (Ajustes de cuenta → API → Webhooks → "Suscribirse" o "Añadir correo") 
                  para que la verificación de usuarios sea automática cuando confirmen su correo.
                </p>
                <div className="bg-gray-100 p-4 rounded-xl flex items-center justify-between gap-4">
                  <code className="text-xs font-mono text-gray-800 break-all">
                    https://noticias.brahian.dev/api/webhook/sendpulse
                  </code>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText('https://noticias.brahian.dev/api/webhook/sendpulse');
                      alert('URL copiada al portapapeles');
                    }}
                    className="bg-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm border border-gray-200 hover:bg-gray-50 transition-all shrink-0"
                  >
                    Copiar
                  </button>
                </div>
              </div>
            </div>

            {/* Dashboard de Mantenimiento Rediseñado */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden mb-12">
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-8 text-white">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-serif font-black flex items-center gap-3">
                      <Settings className="w-10 h-10 text-red-500" /> Panel de Mantenimiento
                    </h3>
                    <p className="text-gray-400 text-sm">Control total sobre infraestructura, sincronización y auditoría del sistema.</p>
                  </div>
                  <Database className="w-12 h-12 text-white/5" />
                </div>
              </div>
              
              <div className="p-8 bg-gray-50/30">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Sincronización Principal */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all groups">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                      <RefreshCw className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-gray-900">Base de Datos</h4>
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-4">Sincronización Total</p>
                    <button 
                      onClick={async () => {
                        setLoading(true);
                        try {
                          const res = await fetch('/api/admin/migrar-db');
                          const data: any = await res.json();
                          alert('✅ ' + (data.message || 'Sistema sincronizado con éxito'));
                        } catch (e) { alert('❌ Error'); }
                        finally { setLoading(false); }
                      }}
                      className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                    >
                      Sincronizar DB
                    </button>
                  </div>

                  {/* Integridad Cascadas */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-gray-900">Integridad</h4>
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-4">Foreign Keys / Cascades</p>
                    <button 
                      onClick={async () => {
                        if(window.confirm('¿Reparar integridad estructural?')) {
                          try {
                            const res = await fetch('/api/admin/fix-cascades');
                            const data: any = await res.json();
                            alert('✅ ' + data.message);
                          } catch (e) { alert('❌ Error'); }
                        }
                      }}
                      className="w-full bg-lapacho-navy text-white py-2.5 rounded-xl font-bold text-xs hover:opacity-90 transition-colors"
                    >
                      Reparar Borrado
                    </button>
                  </div>

                  {/* SendPulse Diag */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mb-4">
                      <Bell className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-gray-900">Notificaciones</h4>
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-4">Diagnóstico SendPulse</p>
                    <button 
                      onClick={async () => {
                        try {
                          await fetch('/api/admin/test-sendpulse');
                          alert('✅ Diagnóstico enviado correctamente.');
                        } catch (e) { alert('❌ Error'); }
                      }}
                      className="w-full bg-green-600 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-green-700 transition-colors shadow-lg shadow-green-100"
                    >
                      Diagnóstico API
                    </button>
                  </div>

                  {/* Logs de Webhook */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
                      <Activity className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-gray-900">Auditoría</h4>
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-4">Logs de Webhook</p>
                    <button 
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/admin/webhook-logs');
                          const data: any = await res.json();
                          console.log('Webhook Logs:', data);
                          alert('Logs volcados en consola (F12)');
                        } catch (e) { alert('❌ Error'); }
                      }}
                      className="w-full bg-amber-500 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-amber-600 transition-colors shadow-lg shadow-amber-100"
                    >
                      Ver Historial
                    </button>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap gap-6 items-center justify-between">
                  <div className="flex gap-6">
                    <button 
                      onClick={async () => {
                        if(window.confirm('¿Disparar evento semanal ahora?')) {
                          try {
                            await api.admin.triggerSendPulse();
                            alert('✅ Evento enviado');
                          } catch (e: any) { alert('❌ ' + e.message); }
                        }
                      }}
                      className="flex items-center gap-2 text-xs font-black uppercase text-purple-600 hover:text-purple-800 transition-colors tracking-widest"
                    >
                      <Send className="w-4 h-4" /> Disparar Semanal
                    </button>
                    <button 
                      onClick={async () => {
                        if(window.confirm('¿Limpiar usuarios inactivos?')) {
                          try {
                            await fetch('/api/admin/limpiar-usuarios', { method: 'POST' });
                            alert('✅ Limpieza realizada');
                          } catch (e) { alert('❌ Error'); }
                        }
                      }}
                      className="flex items-center gap-2 text-xs font-black uppercase text-red-600 hover:text-red-800 transition-colors tracking-widest"
                    >
                      <Trash2 className="w-4 h-4" /> Limpiar Inactivos
                    </button>
                    <a 
                      href="/api/json-feed/semanal"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-xs font-black uppercase text-gray-500 hover:text-gray-800 transition-colors tracking-widest"
                    >
                      <Database className="w-4 h-4" /> JSON Feed
                    </a>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Estado: Operativo</span>
                  </div>
                </div>
              </div>
            </div>

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
                  <div className="p-8 text-center text-gray-400 italic">No hay solicitudes pendientes.</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-red-600" /> Solicitudes de Patrocinio
                </h3>
              </div>
              <div className="divide-y divide-gray-50">
                {adminPatrocinios.length > 0 ? adminPatrocinios.map((p) => (
                  <div key={p.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h4 className="font-bold text-gray-900">{p.titulo}</h4>
                        <p className="text-xs text-gray-500">Por: {p.autor_nombre} • {p.patrocinio_marca} (Gs. {Number(p.patrocinio_monto).toLocaleString()})</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {['pendiente', 'en revision', 'aceptado', 'rechazado', 'envie otra'].map(est => (
                          <button 
                            key={est}
                            onClick={async () => {
                              await api.admin.handlePatrocinio(p.id, est);
                              loadData();
                            }}
                            className={`px-3 py-1 text-[10px] font-black rounded uppercase tracking-wider transition-all ${
                              p.patrocinio_estado === est 
                                ? (est === 'aceptado' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-white') 
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {est}
                          </button>
                        ))}
                      </div>
                    </div>
                    {p.patrocinio_comprobante && (
                      <a 
                        href={p.patrocinio_comprobante} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-bold text-red-600 hover:underline"
                      >
                        Ver Comprobante Adjunto <FileText className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )) : (
                  <div className="p-8 text-center text-gray-400 italic">No hay patrocinios registrados.</div>
                )}
              </div>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-900">Mantenimiento de Sistema</h4>
                <p className="text-sm text-gray-500">Asegúrate de que la base de datos tenga las últimas columnas añadidas.</p>
              </div>
              <button 
                onClick={async () => {
                  try {
                    await api.admin.migrarDB();
                    alert('Migración exitosa');
                  } catch (e) {
                    alert('Error en migración');
                  }
                }}
                className="bg-lapacho-navy text-white px-6 py-2 rounded-xl font-bold hover:opacity-90 transition-all shadow-sm"
              >
                Migrar Base de Datos
              </button>
            </div>
          </div>
        )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricCard({ icon, label, value, subValue, color }: { icon: React.ReactNode, label: string, value: string | number, subValue: string, color: string }) {
  const colorMap: any = {
    red: 'bg-lapacho-pink/5 text-lapacho-pink',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600'
  };
  
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
        <span className="text-[10px] font-black uppercase text-gray-400">{label}</span>
      </div>
      <div>
        <p className="text-3xl font-black text-lapacho-navy">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{subValue}</p>
      </div>
    </div>
  );
}

function getTipOfDay() {
  const tips = [
    "Optimizar tus imágenes reduce la carga en un 60%, mejorando el SEO de tu noticia.",
    "El mejor momento para publicar es entre las 8:00 y las 10:00 AM.",
    "Títulos cortos y directos (menos de 60 caracteres) obtienen más clics.",
    "Incluir enlaces a fuentes externas confiables aumenta la autoridad del artículo.",
    "Las infografías y listas aumentan el tiempo de lectura promedio.",
    "Comparte tus noticias en LinkedIn para llegar a un público más profesional.",
    "Interactúa con tus seguidores respondiendo a sus intereses en redes sociales."
  ];
  const dayOfYear = Math.floor(new Date().getTime() / (1000 * 60 * 60 * 24));
  return tips[dayOfYear % tips.length];
}

function TabButton({ active, onClick, icon, label, badgeCount }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badgeCount?: number }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap relative ${active ? 'bg-white text-lapacho-pink shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
    >
      {icon} 
      <span>{label}</span>
      {badgeCount !== undefined && badgeCount > 0 && (
        <div className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lapacho-pink/40 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-lapacho-pink border-2 border-white text-[8px] items-center justify-center text-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        </div>
      )}
    </button>
  );
}
