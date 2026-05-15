import { User, Noticia, Categoria, Metrica } from '../types';

async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Algo salió mal');
  }
  return response.json();
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  return fetch(url, {
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
      const searchParams = new URLSearchParams(params);
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
