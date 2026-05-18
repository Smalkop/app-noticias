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
    
    subirComprobante: (id: string, url: string): Promise<any> => 
      fetchWithAuth(`/api/noticias/${id}/comprobante`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      }) as any,

    track: (id: string, data: any): Promise<any> =>
      fetchWithAuth(`/api/noticias/${id}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as any,

    reaccionar: (id: string, tipo: string): Promise<any> =>
      fetchWithAuth(`/api/noticias/${id}/reaccionar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo })
      }) as any,

    compartir: (id: string, plataforma: string): Promise<any> =>
      fetchWithAuth(`/api/noticias/${id}/compartir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plataforma })
      }) as any,
  },
  
  admin: {
    listSolicitudes: (): Promise<any[]> => fetchWithAuth('/api/admin/solicitudes') as any,
    handleSolicitud: (id: number, accion: 'aprobar' | 'rechazar'): Promise<any> =>
      fetchWithAuth(`/api/admin/solicitudes/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion })
      }) as any,
    listPatrocinios: (): Promise<any[]> => fetchWithAuth('/api/admin/patrocinios') as any,
    handlePatrocinio: (id: string, estado: string): Promise<any> => 
      fetchWithAuth(`/api/admin/patrocinios/${id}/estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado })
      }) as any,
    migrarDB: (): Promise<any> => fetchWithAuth('/api/admin/migrar-db') as any,
    triggerSendPulse: (): Promise<any> => fetchWithAuth('/api/admin/trigger-sendpulse', { method: 'POST' }) as any,
    handleVerificacion: (id: string, accion: 'aprobar' | 'rechazar'): Promise<any> =>
      fetchWithAuth(`/api/admin/verificaciones/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion })
      }) as any,
    listVerificaciones: (): Promise<any[]> => fetchWithAuth('/api/admin/verificaciones') as any,
    listPaginas: (): Promise<any[]> => fetchWithAuth('/api/admin/paginas') as any,
    createPagina: (data: any): Promise<any> =>
      fetchWithAuth('/api/admin/paginas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as any,
    updatePagina: (id: string, data: any): Promise<any> =>
      fetchWithAuth(`/api/admin/paginas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as any,
    deletePagina: (id: string): Promise<any> =>
      fetchWithAuth(`/api/admin/paginas/${id}`, { method: 'DELETE' }) as any,
  },
  
  patrocinios: {
    solicitar: (data: any): Promise<any> =>
      fetchWithAuth('/api/patrocinios/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as any,
    misPatrocinios: (): Promise<any[]> => fetchWithAuth('/api/patrocinios/mis-patrocinios') as any,
  },
  
  seguidores: {
    getStatus: (autorId: string): Promise<{ siguiendo: boolean }> => 
      fetchWithAuth(`/api/seguidores/status/${autorId}`) as any,
    follow: (autorId: string): Promise<any> => 
      fetchWithAuth(`/api/seguidores/follow/${autorId}`, { method: 'POST' }) as any,
    unfollow: (autorId: string): Promise<any> => 
      fetchWithAuth(`/api/seguidores/unfollow/${autorId}`, { method: 'POST' }) as any,
    misSeguidores: (): Promise<any[]> => 
      fetchWithAuth('/api/seguidores/mis-seguidores') as any,
  },
  
  notificaciones: {
    list: (): Promise<any[]> => fetchWithAuth('/api/notificaciones') as any,
    leerTodas: (): Promise<any> => fetchWithAuth('/api/notificaciones/leer', { method: 'POST' }) as any,
  },
  
  categorias: {
    list: (): Promise<Categoria[]> => fetchWithAuth('/api/categorias') as any,
  },
  
  metricas: {
    get: (periodo: string = 'mes', noticiaId?: string, global: boolean = false): Promise<any> => 
      fetchWithAuth(`/api/metricas?periodo=${periodo}${noticiaId ? `&noticiaId=${noticiaId}` : ''}${global ? '&global=true' : ''}`) as any,
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
