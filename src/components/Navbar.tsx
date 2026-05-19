import { Link, useNavigate } from 'react-router-dom';
import { User, Categoria } from '../types';
import { Menu, User as UserIcon, LogOut, ChevronDown, Search, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface NavbarProps {
  user: User | null;
  categorias: Categoria[];
  onLogout: () => void;
}

export default function Navbar({ user, categorias, onLogout }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
    }
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-lapacho-pink text-white px-2 py-1 font-serif font-bold text-xl rounded">LP</div>
            <span className="font-serif font-bold text-2xl tracking-tighter">Lapacho Post</span>
          </Link>

          {/* Desktop Navigation (Moved to sub-nav for scrolling) */}
          <div className="hidden md:flex items-center space-x-6">
            {/* Logic removed from here, handled in sub-nav below */}
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
            >
              <Search className="w-5 h-5" />
            </button>

            {user ? (
              <div className="relative group hidden md:block">
                <button className="flex items-center gap-2 p-1 hover:bg-gray-100 rounded-lg transition-colors">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                    {user.foto_perfil ? (
                      <img src={user.foto_perfil} alt={user.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                    <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                      <span className="text-sm font-bold text-gray-900 hidden sm:block">{user.nombre}</span>
                      {user.estado_verificacion === 'aprobado' && (
                        <div className="flex items-center gap-1 bg-green-50 px-1.5 py-0.5 rounded-md border border-green-100">
                          <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-[10px] font-black text-green-700 uppercase hidden lg:block">Verificado</span>
                        </div>
                      )}
                    </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
                
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="p-2">
                    <Link to="/dashboard" className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">
                      Dashboard
                    </Link>
                    <button 
                      onClick={onLogout}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-lapacho-pink hover:bg-lapacho-pink/5 rounded"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <Link 
                to="/login" 
                className="hidden md:block text-sm font-semibold bg-lapacho-navy text-white px-4 py-2 rounded hover:opacity-90 transition-colors"
              >
                Ingresar
              </Link>
            )}

            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Sub-Nav with Horizontal Scroll */}
      <div className="border-b border-gray-100 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center space-x-8 h-10 whitespace-nowrap">
            <Link to="/" className="text-[10px] font-black uppercase text-gray-400 hover:text-lapacho-pink transition-colors">
              Inicio
            </Link>
            {Array.isArray(categorias) && categorias.map((cat) => (
              <Link 
                key={cat.id} 
                to={`/?categoria=${cat.slug}`} 
                className="text-[10px] font-black uppercase text-gray-900 hover:text-lapacho-pink transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {cat.nombre}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed top-0 left-0 bottom-0 w-[280px] bg-white z-50 md:hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2" onClick={() => setIsMenuOpen(false)}>
                  <div className="bg-lapacho-pink text-white px-2 py-1 font-serif font-bold text-xl rounded">LP</div>
                  <span className="font-serif font-bold text-xl tracking-tighter">Lapacho Post</span>
                </Link>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {user && (
                  <div className="mb-8 p-4 bg-gray-50 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                      {user.foto_perfil ? (
                        <img src={user.foto_perfil} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-full h-full p-2 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-gray-900 text-sm truncate max-w-[150px]">{user.nombre}</p>
                        {user.estado_verificacion === 'aprobado' && (
                          <div className="flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                            <ShieldCheck className="w-3 h-3 text-green-600" />
                            <span className="text-[10px] font-black text-green-700 uppercase">Verificado</span>
                          </div>
                        )}
                      </div>
                      <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className="text-[10px] uppercase font-black text-lapacho-pink">Ver Dashboard</Link>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Categorías</h4>
                    <div className="grid grid-cols-1 gap-2">
                       {Array.isArray(categorias) && categorias.map(cat => (
                         <Link 
                            key={cat.id} 
                            to={`/?categoria=${cat.slug}`}
                            className="p-3 text-sm font-bold text-gray-900 hover:bg-red-50 rounded-xl transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                         >
                           {cat.nombre}
                         </Link>
                       ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100">
                {user ? (
                  <button 
                    onClick={() => {
                        onLogout();
                        setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 p-3 text-sm font-bold text-lapacho-pink bg-lapacho-pink/5 rounded-xl"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                  </button>
                ) : (
                  <Link 
                    to="/login" 
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full flex items-center justify-center p-3 text-sm font-bold text-white bg-lapacho-navy rounded-xl"
                  >
                    Ingresar a mi cuenta
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Search Bar Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 w-full bg-white border-b border-gray-200 p-4 shadow-lg"
          >
            <form onSubmit={handleSearch} className="max-w-3xl mx-auto flex gap-2">
              <input 
                type="text" 
                placeholder="Buscar noticias..." 
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-lapacho-pink focus:border-lapacho-pink outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button type="submit" className="bg-lapacho-pink text-white px-6 py-2 rounded-lg font-semibold">
                Buscar
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
