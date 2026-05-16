import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api } from './lib/api';
import { User, Categoria } from './types';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Article from './pages/Article';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

function Footer() {
  return (
    <footer className="bg-gray-900 text-white mt-20 pt-16 pb-8 border-t-8 border-red-600">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="bg-red-600 text-white px-2 py-1 font-serif font-bold text-xl rounded">LP</div>
              <span className="font-serif font-bold text-2xl tracking-tighter">Lapacho Post</span>
            </div>
            <p className="text-gray-400 max-w-sm leading-relaxed">
              El portal de noticias más importante de la región. Información veraz, objetiva y al instante sobre lo que sucede en el país y el mundo.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-6">Secciones</h4>
            <ul className="space-y-4 text-gray-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Política</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Economía</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Deportes</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Cultura</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-6">Institucional</h4>
            <ul className="space-y-4 text-gray-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Sobre nosotros</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Código de ética</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Publicidad</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contacto</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <p>© 2024 Lapacho Post - Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white">Términos de uso</a>
            <a href="#" className="hover:text-white">Privacidad</a>
            <a href="#" className="hover:text-white">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const userData = await api.auth.me().catch(() => null);
        const categoriesData = await api.categorias.list().catch(() => []);
        
        setUser(userData);
        setCategorias(Array.isArray(categoriesData) ? categoriesData : []);
      } catch (err) {
        console.error('Failed to initialize', err);
      } finally {
        setInitializing(false);
      }
    }
    init();
  }, []);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
      setUser(null);
    } catch (err) {
      console.error(err);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-serif font-bold text-gray-500 italic">Lapacho Post ...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar user={user} categorias={categorias} onLogout={handleLogout} />
        
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/noticia/:id" element={<Article user={user} />} />
            <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login onLogin={setUser} />} />
            <Route path="/registro" element={user ? <Navigate to="/dashboard" /> : <Register />} />
            <Route path="/dashboard" element={user ? <Dashboard user={user} onUserUpdate={setUser} /> : <Navigate to="/login" />} />
          </Routes>
        </div>

        <Footer />
      </div>
    </BrowserRouter>
  );
}
