'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { StoreSession, AdminSession } from './types';
import { storeLoginApi, adminLoginApi } from './api';

interface AuthContextType {
  storeSession: StoreSession | null;
  adminSession: AdminSession | null;
  isInitialized: boolean;
  loginStore: (email: string, pass: string) => Promise<StoreSession>;
  logoutStore: () => void;
  loginAdmin: (email: string, pass: string) => Promise<AdminSession>;
  logoutAdmin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORE_SESSION_KEY = 'medigrid_store_session';
const ADMIN_SESSION_KEY = 'medigrid_admin_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [storeSession, setStoreSession] = useState<StoreSession | null>(null);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const rawStore = localStorage.getItem(STORE_SESSION_KEY);
      if (rawStore) {
        setStoreSession(JSON.parse(rawStore));
      }
      const rawAdmin = localStorage.getItem(ADMIN_SESSION_KEY);
      if (rawAdmin) {
        setAdminSession(JSON.parse(rawAdmin));
      }
    } catch {
      // ignore
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const loginStore = async (email: string, pass: string): Promise<StoreSession> => {
    const session = await storeLoginApi(email, pass);
    setStoreSession(session);
    try {
      localStorage.setItem(STORE_SESSION_KEY, JSON.stringify(session));
    } catch {
      // ignore
    }
    return session;
  };

  const logoutStore = () => {
    setStoreSession(null);
    try {
      localStorage.removeItem(STORE_SESSION_KEY);
    } catch {
      // ignore
    }
  };

  const loginAdmin = async (email: string, pass: string): Promise<AdminSession> => {
    const session = await adminLoginApi(email, pass);
    setAdminSession(session);
    try {
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    } catch {
      // ignore
    }
    return session;
  };

  const logoutAdmin = () => {
    setAdminSession(null);
    try {
      localStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        storeSession,
        adminSession,
        isInitialized,
        loginStore,
        logoutStore,
        loginAdmin,
        logoutAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
