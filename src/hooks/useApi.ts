import { useState } from 'react';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<T>;
}

export const useApi = <T>(apiFunction: (...args: any[]) => Promise<T>): UseApiResult<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = async (...args: any[]): Promise<T> => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFunction(...args);
      setData(result);
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Une erreur est survenue';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, execute };
};

// URL de base
//const API_BASE_URL = 'http://localhost:3001';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'     ;
export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  // Essayez différents noms de token
  const token = localStorage.getItem('authToken') || 
                localStorage.getItem('token') || 
                localStorage.getItem('access_token');
  
  console.log('🔑 Token récupéré:', token ? 'Présent' : 'Absent');
  
  // Construire l'URL complète
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  console.log('🚀 API Request:', {
    url,
    method: options.method || 'GET',
    hasToken: !!token
  });

  try {
    const response = await fetch(url, config);
    
    console.log('📨 Response reçue:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expiré ou invalide
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('access_token');
        throw new Error('Session expirée, veuillez vous reconnecter');
      }
      
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // Lire la réponse
    const responseText = await response.text();
    console.log('📄 Response text (first 200 chars):', responseText.substring(0, 200));

    // Parser seulement si c'est du JSON
    if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
      return JSON.parse(responseText);
    } else {
      throw new Error(`Réponse non-JSON reçue: ${responseText}`);
    }
  } catch (error: any) {
    console.error('💥 Erreur API complète:', error);
    throw error;
  }
};