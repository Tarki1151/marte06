// src/utils/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebaseConfig'; // Firebase auth objesini import et
import type { User } from 'firebase/auth'; // Firebase User tipini import et, type-only import yapıldı

interface AuthContextType {
  currentUser: User | null;
  loading: boolean; // Kimlik doğrulama durumunu kontrol ederken yüklenme state'i
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Başlangıçta yükleniyor olarak ayarla

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      setLoading(false); // Kullanıcı durumu kontrol edildi, yüklenme bitti
    });

    // Clean up subscription on unmount
    return unsubscribe;
  }, []);

  const value = { currentUser, loading };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
