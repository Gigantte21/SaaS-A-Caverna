import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Store } from '../types';
import { useAuth } from './AuthContext';

interface StoreContextType {
  stores: Store[];
  activeStore: Store | null;
  setActiveStore: (store: Store | null) => void;
  loading: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const activeStoreRef = React.useRef<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    activeStoreRef.current = activeStore;
  }, [activeStore]);

  useEffect(() => {
    if (!user && !isAdmin) {
      setStores([]);
      setActiveStore(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let q = query(collection(db, 'stores'), orderBy('name', 'asc'));

    // For non-admins, filter by allowed store IDs at the query level if possible
    // Note: 'in' query is limited to 30 items, which should be enough for stores
    if (!isAdmin && user && user.storeIds && user.storeIds.length > 0) {
      // Note: 'in' query on __name__ cannot be combined with orderBy on another field
      // without a composite index. We'll sort client-side instead.
      q = query(
        collection(db, 'stores'),
        where('__name__', 'in', user.storeIds)
      );
    } else if (!isAdmin && user && (!user.storeIds || user.storeIds.length === 0)) {
      // If user has no stores assigned, they shouldn't see any
      setStores([]);
      setActiveStore(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let storesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
      
      // Sort client-side if we couldn't do it in the query
      if (!isAdmin && user && user.storeIds && user.storeIds.length > 0) {
        storesData.sort((a, b) => a.name.localeCompare(b.name));
      }
      
      setStores(storesData);

      // If no stores exist and admin, create default ones
      if (storesData.length === 0 && loading && isAdmin) {
        const defaultStores = [
          { name: 'A Caverna Personalizados', fantasyName: 'A Caverna', phone: '', email: '', city: '', state: '' },
          { name: 'T&N Personalizados', fantasyName: 'T&N', phone: '', email: '', city: '', state: '' }
        ];
        
        for (const store of defaultStores) {
          try {
            await addDoc(collection(db, 'stores'), store);
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'stores');
          }
        }
      } else if (storesData.length > 0) {
        // Set active store from localStorage or default to first one
        const savedStoreId = localStorage.getItem('activeStoreId');
        
        // Check if current activeStore is still valid
        const isCurrentValid = activeStoreRef.current && storesData.some(s => s.id === activeStoreRef.current?.id);
        
        if (!isCurrentValid && storesData.length > 0) {
  const nextStore =
    storesData.find(s => s.id === savedStoreId) ||
    storesData[0]

  setActiveStore(nextStore)
}
        setLoading(false);
      } else {
        setActiveStore(null);
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stores');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    if (activeStore) {
      localStorage.setItem('activeStoreId', activeStore.id);
    } else {
      localStorage.removeItem('activeStoreId');
    }
  }, [activeStore]);

  const handleSetActiveStore = (store: Store | null) => {
    setActiveStore(store);
    if (store) {
      localStorage.setItem('activeStoreId', store.id);
    } else {
      localStorage.removeItem('activeStoreId');
    }
  };

  return (
    <StoreContext.Provider value={{ stores, activeStore, setActiveStore: handleSetActiveStore, loading }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
