'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import type { UserRole, CustomClaims } from '@/types';

interface AuthUser {
  uid: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  role: UserRole | null;
  storeId?: string;
  regionId?: string;
  claims: CustomClaims | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOutUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Get custom claims from the ID token
      const tokenResult = await firebaseUser.getIdTokenResult();
      const claims = tokenResult.claims as CustomClaims;

      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        phone: firebaseUser.phoneNumber,
        displayName: firebaseUser.displayName,
        role: claims.role ?? null,
        storeId: claims.storeId,
        regionId: claims.regionId,
        claims,
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOutUser = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRequireRole(allowedRoles: UserRole[]) {
  const { user, loading } = useAuth();
  const isAuthorized = user ? allowedRoles.includes(user.role ?? 'customer' as UserRole) : false;
  return { user, loading, isAuthorized };
}
