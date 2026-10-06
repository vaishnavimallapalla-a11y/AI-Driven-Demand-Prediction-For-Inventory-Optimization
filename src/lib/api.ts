import { useStore } from '../store/useStore';

const API_BASE_URL = '/api';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { token, logout } = useStore.getState();
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    logout();
    window.location.href = '/auth/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Something went wrong');
  }

  return response.json();
}

export const api = {
  auth: {
    login: (data: any) => fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => res.ok ? res.json() : res.json().then(e => { throw new Error(e.error) })),
    
    signup: (data: any) => fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => res.ok ? res.json() : res.json().then(e => { throw new Error(e.error) })),
  },
  
  products: {
    getAll: () => fetchWithAuth('/products'),
    create: (data: any) => fetchWithAuth('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id: string, data: any) => fetchWithAuth(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id: string) => fetchWithAuth(`/products/${id}`, {
      method: 'DELETE',
    }),
  },
  
  activities: {
    getAll: () => fetchWithAuth('/activities'),
    create: (data: any) => fetchWithAuth('/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },
  
  sales: {
    getAll: () => fetchWithAuth('/sales'),
  },
};
