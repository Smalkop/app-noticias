import { Link, useNavigate } from 'react-router-dom';
import { User, Categoria } from '../types';
import { Menu, User as UserIcon, LogOut, ChevronDown, Search } from 'lucide-react';
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
            <div className="bg-red-600 text-white px-2 py-1 font-serif font-bold text-xl rounded">PY</div>
            <span className="font-serif font-bold text-2xl tracking-tighter">Noticias</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {Array.isArray(categorias) && categorias.slice(0, 5).map((cat) => (
              <Link 
                key={cat.id} 
                to={`/?categoria=${cat.slug}`} 
                className="text-sm font-medium text-gray-600 hover:text-red-600 transition-colors uppercase tracking-wider"
              >
                {cat.nombre}
              </Link>
            ))}
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
              <div className="relative group">
                <button className="flex items-center gap-2 p-1 hover:bg-gray-100 rounded-lg transition-colors">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                    {user.foto_perfil ? (
                      <img src={user.foto_perfil} alt={user.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  <span className="text-sm font-medium hidden sm:block">{user.nombre}</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
                
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="p-2">
                    <Link to="/dashboard" className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">
                      Dashboard
                    </Link>
                    <button 
                      onClick={onLogout}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
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
                className="text-sm font-semibold bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
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
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button type="submit" className="bg-red-600 text-white px-6 py-2 rounded-lg font-semibold">
                Buscar
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
