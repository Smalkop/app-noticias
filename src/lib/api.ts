import { User, Noticia, Categoria, Metrica } from '../types';

async function handleResponse(response: Response) {
  const contentType = response.headers.get('content-type');
  if (!response.ok) {
    let errorMessage = `Error ${response.status}`;
    try {
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
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
  // Asegurar que la URL sea absoluta respecto a la raíz del dominio para evitar 404s por rutas relativas
  const fullUrl = url.startsWith('http') ? url : url.startsWith('/') ? url : `/${url}`;
  
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
      }),
    
    register: (data: any): Promise<any> =>
      fetchWithAuth('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }),
    
    logout: () => fetchWithAuth('/api/auth/logout', { method: 'POST' }),
    
    me: (): Promise<User> => fetchWithAuth('/api/auth/me'),

    googleLogin: (credential: string): Promise<User> =>
      fetchWithAuth('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      }),
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
      return fetchWithAuth(`/api/noticias?${searchParams}`);
    },
    
    get: (id: string): Promise<Noticia> => fetchWithAuth(`/api/noticias/${id}`),
    
    create: (data: any): Promise<{ id: string }> =>
      fetchWithAuth('/api/noticias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }),
  },
  
  categorias: {
    list: (): Promise<Categoria[]> => fetchWithAuth('/api/categorias'),
  },
  
  metricas: {
    get: (): Promise<Metrica[]> => fetchWithAuth('/api/metricas'),
  },
  
  upload: (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    return fetchWithAuth('/api/upload', {
      method: 'POST',
      body: formData
    });
  }
};
