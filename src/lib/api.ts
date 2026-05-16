import { User, Noticia, Categoria, Metrica } from '../types';

async function handleResponse(response: Response) {
  const contentType = response.headers.get('content-type');
  if (!response.ok) {
    let errorMessage = `Error ${response.status}`;
    try {
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json() as any;
        errorMessage = error.error || error.message || errorMessage;
      } else {
        const text = await response.text();
        errorMessage = `${errorMessage}: ${text.slice(0, 100)}`;
      }
    } catch (e) {
      errorMessage = `${errorMessage} (cuerpo no legible)`;
    }
    console.error(`API Error [${response.status}] ${response.url}:`, errorMessage);
    throw new Error(errorMessage);
  }
  
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // Asegurar que la URL sea absoluta respecto al origen actual para evitar 404s por rutas relativas en SPAs
  let fullUrl = url;
  if (!url.startsWith('http')) {
    const origin = window.location.origin;
    const path = url.startsWith('/') ? url : `/${url}`;
    fullUrl = `${origin}${path}`;
  }
  
  return fetch(fullUrl, {
    ...options,
    credentials: 'include',
  }).then(handleResponse);
}

export const api = {
  auth: {
    login: (credentials: any): Promise<User> => 
      fetchWithAuth('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      }) as any,
    
    register: (data: any): Promise<any> =>
      fetchWithAuth('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }),
    
    logout: () => fetchWithAuth('/api/auth/logout', { method: 'POST' }),
    
    me: (): Promise<User> => fetchWithAuth('/api/auth/me') as any,

    updatePerfil: (data: any): Promise<any> =>
      fetchWithAuth('/api/auth/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as any,

    solicitarAutor: (motivo: string): Promise<any> =>
      fetchWithAuth('/api/auth/solicitar-autor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo })
      }) as any,

    googleLogin: (credential: string): Promise<User> =>
      fetchWithAuth('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      }) as any,
  },
  
  noticias: {
    list: (params: any = {}): Promise<Noticia[]> => {
      const cleanParams: any = {};
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== 'undefined') {
          cleanParams[key] = params[key];
        }
      });
      const searchParams = new URLSearchParams(cleanParams);
      return fetchWithAuth(`/api/noticias?${searchParams}`) as any;
    },
    
    get: (id: string): Promise<Noticia> => fetchWithAuth(`/api/noticias/${id}`) as any,
    
    create: (data: any): Promise<{ id: string }> =>
      fetchWithAuth('/api/noticias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as any,

    misNoticias: (): Promise<Noticia[]> => fetchWithAuth('/api/mis-noticias') as any,

    update: (id: string, data: any): Promise<any> =>
      fetchWithAuth(`/api/noticias/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as any,

    delete: (id: string): Promise<any> =>
      fetchWithAuth(`/api/noticias/${id}`, { method: 'DELETE' }) as any,
  },
  
  admin: {
    listSolicitudes: (): Promise<any[]> => fetchWithAuth('/api/admin/solicitudes') as any,
    handleSolicitud: (id: number, accion: 'aprobar' | 'rechazar'): Promise<any> =>
      fetchWithAuth(`/api/admin/solicitudes/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion })
      }) as any,
  },
  
  categorias: {
    list: (): Promise<Categoria[]> => fetchWithAuth('/api/categorias') as any,
  },
  
  metricas: {
    get: (): Promise<Metrica[]> => fetchWithAuth('/api/metricas') as any,
  },
  
  upload: (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    return fetchWithAuth('/api/upload', {
      method: 'POST',
      body: formData
    }) as any;
  }
};
