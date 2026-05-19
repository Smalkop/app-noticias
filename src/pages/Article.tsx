import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Noticia, User } from '../types';
import { Clock, User as UserIcon, ChevronLeft, Share2, Facebook, Twitter, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ArticleProps {
  user: User | null;
}

function getVisitorId() {
  let id = localStorage.getItem('visitor_id');
  if (!id) {
    id = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('visitor_id', id);
  }
  return id;
}

export default function Article({ user }: ArticleProps) {
  const { id } = useParams<{ id: string }>();
  const [noticia, setNoticia] = useState<Noticia | null>(null);
  const [loading, setLoading] = useState(true);
  const [siguiendo, setSiguiendo] = useState(false);
  const [showShareTooltip, setShowShareTooltip] = useState(false);
  const [reaccionLoading, setReaccionLoading] = useState(false);
  const [startTime] = useState(Date.now());
  const [maxScroll, setMaxScroll] = useState(0);

  useEffect(() => {
    async function loadNoticia() {
      if (!id) return;
      setLoading(true);
      try {
        const data = await api.noticias.get(id);
        setNoticia(data);
        
        // Initial track ONLY if not recently tracked in this session
        const trackedKey = `tracked_${id}`;
        const lastTrack = sessionStorage.getItem(trackedKey);
        const now = Date.now();
        
        if (!lastTrack || (now - parseInt(lastTrack) > 1000 * 60 * 60)) { // Once per hour per session
          api.noticias.track(id, {
            fuente: document.referrer.includes('facebook.com') || document.referrer.includes('t.co') || document.referrer.includes('whatsapp') ? 'redes' : 
                    document.referrer.includes('google.com') ? 'buscador' : 'directo',
            dispositivo: window.innerWidth < 768 ? 'mobile' : 'desktop',
            duracion: 0,
            scroll: 0,
            visitor_id: getVisitorId()
          }).catch(() => {});
          sessionStorage.setItem(trackedKey, now.toString());
        }

        // Check following status only if logged in
        if (user) {
          const { siguiendo } = await api.seguidores.getStatus(data.autor_id);
          setSiguiendo(siguiendo);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadNoticia();
    window.scrollTo(0, 0);

    const handleScroll = () => {
      const scrollPercent = Math.round((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100);
      if (scrollPercent > maxScroll) setMaxScroll(scrollPercent);
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Final track on unmount
      const duration = Math.round((Date.now() - startTime) / 1000);
      if (id) {
        api.noticias.track(id, {
          fuente: 'on_exit', // internal marker
          dispositivo: window.innerWidth < 768 ? 'mobile' : 'desktop',
          duracion: duration,
          scroll: maxScroll,
          visitor_id: getVisitorId()
        });
      }
    };
  }, [id, user]);

  const handleFollow = async () => {
    if (!noticia || !user) return;
    if (user.id === noticia.autor_id) return; // Client-side guard

    try {
      if (siguiendo) {
        await api.seguidores.unfollow(noticia.autor_id);
        setSiguiendo(false);
      } else {
        await api.seguidores.follow(noticia.autor_id);
        setSiguiendo(true);
      }
    } catch (error) {
      console.error('Error with follow/unfollow:', error);
    }
  };

  const handleReaccion = async (tipo: string) => {
    if (!user) {
      alert('Debes iniciar sesión para reaccionar');
      return;
    }
    setReaccionLoading(true);
    try {
      await api.noticias.reaccionar(String(id), tipo);
      const updated = await api.noticias.get(String(id));
      setNoticia(updated);
    } catch (err) {
      alert('Error al reaccionar');
    } finally {
      setReaccionLoading(false);
    }
  };

  const handleShare = async (platform: 'fb' | 'tw' | 'wa' | 'copy') => {
    const url = window.location.href;
    const text = noticia?.titulo || 'Mira esta noticia en Lapacho Post';
    
    if (id) {
      await api.noticias.compartir(id, platform);
    }

    if (platform === 'fb') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'tw') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'wa') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    } else if (platform === 'copy') {
      navigator.clipboard.writeText(url);
      setShowShareTooltip(true);
      setTimeout(() => setShowShareTooltip(false), 2000);
    }
  };

  if (loading) return <div className="max-w-4xl mx-auto p-12 h-96 bg-gray-100 animate-pulse rounded-xl mt-8"></div>;
  if (!noticia) return <div className="text-center py-20">Noticia no encontrada</div>;

  const date = new Date(noticia.publicado_en).toLocaleDateString('es-PY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const isOwnArticle = user?.id === noticia.autor_id;
  const shouldShowFollowButton = user && !isOwnArticle && !siguiendo;

  return (
    <article className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      <div className="flex flex-col md:flex-row gap-12">
        {/* Main Content */}
        <div className="flex-1 max-w-4xl">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-lapacho-pink mb-8 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Volver al inicio
          </Link>

          <header className="mb-10">
            {noticia.categoria_nombre && (
              <Link to={`/?categoria=${noticia.categoria_slug || noticia.categoria_nombre.toLowerCase()}`} className="text-lapacho-pink font-bold text-sm uppercase tracking-widest block mb-4">
                {noticia.categoria_nombre}
              </Link>
            )}
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
                  <span className="text-xs">Redacción Lapacho Post</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Publicado el {date}</span>
              </div>
              <div className="flex items-center gap-4 ml-auto">
                 <button onClick={() => handleShare('fb')} className="p-2 hover:bg-blue-50 rounded-full text-blue-600 transition-colors" title="Compartir en Facebook"><Facebook className="w-5 h-5"/></button>
                 <button onClick={() => handleShare('tw')} className="p-2 hover:bg-sky-50 rounded-full text-sky-500 transition-colors" title="Compartir en Twitter"><Twitter className="w-5 h-5"/></button>
                 <div className="relative">
                   <button onClick={() => handleShare('copy')} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors" title="Copiar enlace"><Share2 className="w-5 h-5"/></button>
                   <AnimatePresence>
                     {showShareTooltip && (
                       <motion.div 
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         exit={{ opacity: 0 }}
                         className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-lapacho-navy text-white text-[10px] rounded whitespace-nowrap"
                       >
                         ¡Copiado!
                       </motion.div>
                     )}
                   </AnimatePresence>
                 </div>
              </div>
            </div>
          </header>

          <img 
            src={noticia.imagen_destacada || 'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1200&auto=format&fit=crop&q=80'} 
            alt={noticia.titulo}
            className="w-full aspect-video object-cover rounded-xl mb-12 shadow-2xl"
          />

          <div className="prose prose-lg max-w-none prose-headings:font-serif prose-red prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-6">
            <div dangerouslySetInnerHTML={{ __html: noticia.contenido }} />
          </div>

          <div className="mt-8 pt-8 border-t border-gray-100">
            <div className="flex flex-wrap gap-4 items-center mb-8">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest mr-2">¿Qué te pareció?</span>
              {[
                { type: 'me_gusta', emoji: '👍', label: 'Me gusta' },
                { type: 'me_encanta', emoji: '❤️', label: 'Me encanta' },
                { type: 'sorprendente', emoji: '😮', label: 'Wow' },
                { type: 'triste', emoji: '😢', label: 'Triste' },
                { type: 'enojado', emoji: '😡', label: 'Enojo' }
              ].map((r) => (
                <button
                  key={r.type}
                  disabled={reaccionLoading}
                  onClick={() => handleReaccion(r.type)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all hover:scale-105 ${
                    noticia.mi_reaccion === r.type 
                      ? 'bg-lapacho-pink/5 border-lapacho-pink/20 text-lapacho-pink font-bold' 
                      : 'bg-white border-gray-200 text-gray-600 hover:border-lapacho-pink/20'
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span className="text-xs">{noticia.reacciones?.[r.type] || 0}</span>
                </button>
              ))}
            </div>

            <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Compartir esta noticia</h4>
            <div className="flex gap-4">
              <button 
                onClick={() => handleShare('tw')}
                className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-md"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </button>
              <button 
                onClick={() => handleShare('fb')}
                className="w-12 h-12 bg-[#1877F2] text-white rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-md"
              >
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </button>
              <button 
                onClick={() => handleShare('wa')}
                className="w-12 h-12 bg-[#25D366] text-white rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-md"
              >
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-full md:w-80 flex flex-col gap-8">
          <div className="bg-lapacho-navy text-white p-8 rounded-2xl sticky top-24">
            <h3 className="font-serif text-2xl font-bold mb-4">Sobre el autor</h3>
            <div className="flex items-center gap-4 mb-4">
               <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                 <UserIcon className="w-6 h-6"/>
               </div>
               <span className="font-bold text-lg">{noticia.autor_nombre}</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              {noticia.autor_bio || 'Periodista especializado en actualidad nacional con más de 10 años de trayectoria.'}
            </p>

            {shouldShowFollowButton && (
              <button 
                onClick={handleFollow}
                className="w-full py-3 bg-lapacho-pink text-white rounded-lg font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-lapacho-navy/20"
              >
                Seguir autor
              </button>
            )}
            
            {siguiendo && (
              <div className="flex items-center justify-center gap-2 py-3 bg-gray-800 text-gray-400 rounded-lg text-sm font-bold border border-gray-700">
                <Check className="w-4 h-4" /> Siguiendo
              </div>
            )}
            
            {noticia.patrocinio_id && (
              <div className="mt-8 p-6 bg-lapacho-pink/5 rounded-2xl border border-lapacho-pink/10 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-lapacho-pink rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-black text-lapacho-pink uppercase tracking-widest">Contenido Patrocinado</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold mb-1">Este espacio es posible gracias a:</p>
                  <p className="font-serif text-xl font-black text-gray-900 leading-tight">{noticia.patrocinio_marca}</p>
                  <p className="text-[10px] text-gray-400 font-mono mt-1">RUC: {noticia.patrocinio_ruc}</p>
                </div>
                <div className="pt-4 border-t border-lapacho-pink/10 italic text-[11px] text-lapacho-pink leading-snug">
                  "Lapacho Post mantiene su independencia editorial. El contenido patrocinado no influye en nuestra línea periodística."
                </div>
              </div>
            )}

            {isOwnArticle && (
              <div className="text-xs text-gray-500 text-center italic mt-4">
                Esta es tu propia noticia
              </div>
            )}
          </div>
        </aside>
      </div>
    </article>
  );
}
