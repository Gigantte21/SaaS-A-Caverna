import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { StoreProvider, useStore } from './contexts/StoreContext';
import { ToastProvider } from './contexts/ToastContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { CostBaseSettings } from './components/CostBase';
import { Materials } from './components/Materials';
import { Inventory } from './components/Inventory';
import { Products } from './components/Products';
import { Pricing } from './components/Pricing';
import { History } from './components/History';
import { Clients } from './components/Clients';
import { Suppliers } from './components/Suppliers';
import { Stores } from './components/Stores';
import { Users } from './components/Users';
import { Login } from './components/Login';
import { Backup } from './components/Backup';
import { Loader2, AlertCircle } from 'lucide-react';

import { ErrorBoundary } from './components/ErrorBoundary';

function AppContent() {
  const { user, loading: authLoading, isAdmin, isGerente } = useAuth();
  const { activeStore, loading: storeLoading } = useStore();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (authLoading || storeLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    // Access control: only render if user has permission
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'clients': return <Clients />;
      case 'suppliers': return <Suppliers />;
      case 'costs': return <CostBaseSettings />;
      case 'materials': return <Materials />;
      case 'inventory': return <Inventory />;
      case 'products': return <Products />;
      case 'pricing': return <Pricing />;
      case 'history': return <History />;
      case 'stores':
  return (isAdmin || user?.role === 'GERENTE')
    ? <Stores />
    : (
      <div className="p-10 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold">Acesso Negado</h2>
        <p className="text-neutral-500">Você não tem permissão para gerenciar lojas.</p>
      </div>
    )
      case 'users': return (isAdmin || isGerente) ? <Users /> : <div className="p-10 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold">Acesso Negado</h2>
        <p className="text-neutral-500">Você não tem permissão para gerenciar usuários.</p>
      </div>;
      case 'backup': return isAdmin ? <Backup /> : <div className="p-10 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold">Acesso Negado</h2>
        <p className="text-neutral-500">Apenas administradores podem realizar backups.</p>
      </div>;
      default: return <Dashboard />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderContent()}
      </Layout>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <StoreProvider>
          <AppContent />
        </StoreProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
