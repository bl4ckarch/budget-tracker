import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  email: string;
  firstName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      console.log('🔄 Tentative de connexion...');
      
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const responseText = await response.text();
      console.log('📄 Réponse login (texte):', responseText);

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${responseText}`);
      }

      const data = JSON.parse(responseText);
      console.log('✅ Login réussi, données reçues:', data);
      console.log('🔑 Token reçu:', data.token);

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      
      console.log('💾 Token stocké dans localStorage');
    } catch (error: any) {
      console.error('💥 Erreur login:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, firstName: string) => {
    try {
      console.log('🔄 Tentative d\'inscription avec:', { email, firstName });
      
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, firstName }),
      });

      console.log('📡 Réponse reçue:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries())
      });

      // Récupérer le texte brut d'abord
      const responseText = await response.text();
      console.log('📝 Contenu de la réponse (texte brut):', responseText);

      if (!response.ok) {
        console.error('❌ Réponse non-OK:', response.status);
        throw new Error(`Erreur ${response.status}: ${responseText}`);
      }

      // Essayer de parser seulement si c'est du JSON valide
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('✅ JSON parsé avec succès:', data);
      } catch (parseError) {
        console.error('❌ Erreur de parsing JSON:', parseError);
        console.error('📄 Contenu qui n\'est pas du JSON:', responseText);
        throw new Error('Réponse du serveur invalide (pas du JSON)');
      }

      // Continuer avec le traitement normal...
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } catch (error: any) {
      console.error('💥 Erreur register complète:', error);
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};