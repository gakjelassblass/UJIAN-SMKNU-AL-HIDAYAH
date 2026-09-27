import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { db, initDB } from './db';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password?: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      try {
        await initDB();
        const storedUserId = localStorage.getItem('current_user_id');
        if (storedUserId) {
          const foundUser = await db.users.getById(storedUserId);
          if (foundUser) {
            setUser(foundUser);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, []);

  const login = async (username: string, password?: string) => {
    const foundUser = await db.users.getByUsername(username);
    // In a real app, verify password hash here
    if (foundUser && foundUser.password === password) {
      setUser(foundUser);
      localStorage.setItem('current_user_id', foundUser.id);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('current_user_id');
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
