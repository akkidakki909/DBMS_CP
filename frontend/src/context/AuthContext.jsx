import { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../api/client';
import { currentUser as mockUser } from '../data/mockData';

const AuthContext = createContext(null);

const DEMO_EMAIL = 'aditya_dev@example.com';
const DEMO_PASSWORD = 'password123';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('chirp_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem('token')
  );

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const startDemoSession = async () => {
      const existingToken = localStorage.getItem('token');

      if (existingToken) {
        const savedUser = localStorage.getItem('chirp_user');

        if (savedUser) {
          setUser(JSON.parse(savedUser));
          setIsAuthenticated(true);
          setLoading(false);
          return;
        }
      }

      try {
        // Automatically login using the seeded demo account.
        const response = await apiClient.post('/auth/login', {
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
        });

        const { token, user: loggedInUser } = response.data;

        localStorage.setItem('token', token);
        localStorage.setItem('chirp_user', JSON.stringify(loggedInUser));

        setUser(loggedInUser);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Demo login failed:', error);

        // Keep the UI usable even if backend login is temporarily unavailable.
        setUser(mockUser);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    startDemoSession();
  }, []);

  const login = async (email, password) => {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
    });

    const { token, user: loggedInUser } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem('chirp_user', JSON.stringify(loggedInUser));

    setUser(loggedInUser);
    setIsAuthenticated(true);

    return loggedInUser;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('chirp_user');

    setUser(null);
    setIsAuthenticated(false);
  };

  const updateProfile = (updates) => {
    setUser((prev) => {
      const updatedUser = { ...prev, ...updates };

      localStorage.setItem(
        'chirp_user',
        JSON.stringify(updatedUser)
      );

      return updatedUser;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}