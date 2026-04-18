import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { User } from '../types';
import { ADMIN_EMAIL } from '../constants';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isGerente: boolean;
  isOperador: boolean;
  status: 'aprovado' | 'pendente' | 'bloqueado' | 'desconhecido';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'aprovado' | 'pendente' | 'bloqueado' | 'desconhecido'>('desconhecido');

  useEffect(() => {
    let unsubscribeUser: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      
      if (fUser) {
        // Listen to user profile changes
        const userRef = doc(db, 'users', fUser.uid);
        unsubscribeUser = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const userData = { 
              id: docSnap.id, 
              ...docSnap.data(),
              storeIds: docSnap.data().storeIds || []
            } as User;
            
            setStatus(userData.status as any);
            
            if (userData.status === 'pendente' || userData.status === 'bloqueado') {
              setUser(null);
            } else {
              setUser(userData);
            }
            setLoading(false);
          } else {
            // Create user document if it doesn't exist
            const isAdminEmail = fUser.email === ADMIN_EMAIL;
            try {
              await setDoc(userRef, {
                name: fUser.displayName || 'Usuário ' + (fUser.email?.split('@')[0] || 'Novo'),
                email: fUser.email,
                phone: '',
                role: isAdminEmail ? 'ADMIN' : 'OPERADOR',
                status: isAdminEmail ? 'aprovado' : 'pendente',
                storeIds: [],
                createdAt: new Date().toISOString()
              });
              // Set status to pendente while doc is being created
              setStatus('pendente');
              setLoading(false);
            } catch (err) {
              console.error('Error creating user document:', err);
              setUser(null);
              setStatus('desconhecido');
              setLoading(false);
            }
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${fUser.uid}`);
          setUser(null);
          setStatus('desconhecido');
          setLoading(false);
        });
      } else {
        if (unsubscribeUser) {
          unsubscribeUser();
        }
        setUser(null);
        setStatus('desconhecido');
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) {
        unsubscribeUser();
      }
    };
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const isAdmin = user?.role === 'ADMIN' || firebaseUser?.email === ADMIN_EMAIL;
  const isGerente = user?.role === 'GERENTE';
  const isOperador = user?.role === 'OPERADOR';

  return (
    <AuthContext.Provider value={{ 
      user, 
      firebaseUser, 
      loading, 
      logout,
      isAdmin,
      isGerente,
      isOperador,
      status
    }}>
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
