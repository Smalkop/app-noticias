import { User, Noticia, Categoria, Metrica } from '../types';

async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Algo salió mal');
  }
  return response.json();
}

export const api = {
  auth: {
    login: (credentials: any): Promise<User> => 
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      }).then(handleResponse),
    
    register: (data: any): Promise<any> =>
      fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(handleResponse),
    
    logout: () => fetch('/api/auth/logout', { method: 'POST' }).then(handleResponse),
    
    me: (): Promise<User> => fetch('/api/auth/me').then(handleResponse),
  },
  
  noticias: {
    list: (params: any = {}): Promise<Noticia[]> => {
      const searchParams = new URLSearchParams(params);
      return fetch(`/api/noticias?${searchParams}`).then(handleResponse);
    },
    
    get: (id: string): Promise<Noticia> => fetch(`/api/noticias/${id}`).then(handleResponse),
    
    create: (data: any): Promise<{ id: string }> =>
      fetch('/api/noticias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(handleResponse),
  },
  
  categorias: {
    list: (): Promise<Categoria[]> => fetch('/api/categorias').then(handleResponse),
  },
  
  metricas: {
    get: (): Promise<Metrica[]> => fetch('/api/metricas').then(handleResponse),
  },
  
  upload: (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    return fetch('/api/upload', {
      method: 'POST',
      body: formData
    }).then(handleResponse);
  }
};
