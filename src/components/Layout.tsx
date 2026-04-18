import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  Package, 
  Box, 
  Calculator, 
  History, 
  LogOut, 
  User as UserIcon,
  Users as UsersIcon,
  Store as StoreIcon,
  ChevronDown,
  ShieldCheck,
  Menu,
  X,
  Download,
  Database,
  AlertCircle,
  Truck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const { stores, activeStore, setActiveStore } = useStore();
  const { user, logout, isAdmin, isGerente, isOperador } = useAuth();
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPwaReady, setIsPwaReady] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      console.log('App instalado com sucesso');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsPwaReady(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'GERENTE', 'OPERADOR'] },
    { id: 'clients', label: 'Clientes', icon: UsersIcon, roles: ['ADMIN', 'GERENTE', 'OPERADOR'] },
    { id: 'suppliers', label: 'Fornecedores', icon: Truck, roles: ['ADMIN', 'GERENTE', 'OPERADOR'] },
    { id: 'costs', label: 'Base de Custos', icon: Settings, roles: ['ADMIN', 'GERENTE', 'OPERADOR'] },
    { id: 'materials', label: 'Matéria-prima', icon: Package, roles: ['ADMIN', 'GERENTE', 'OPERADOR'] },
    { id: 'inventory', label: 'Estoque', icon: Box, roles: ['ADMIN', 'GERENTE', 'OPERADOR'] },
    { id: 'products', label: 'Produtos', icon: Box, roles: ['ADMIN', 'GERENTE', 'OPERADOR'] },
    { id: 'pricing', label: 'Precificação', icon: Calculator, roles: ['ADMIN', 'GERENTE', 'OPERADOR'] },
    { id: 'history', label: 'Histórico', icon: History, roles: ['ADMIN', 'GERENTE', 'OPERADOR'] },
    { id: 'stores', label: 'Lojas', icon: StoreIcon, roles: ['ADMIN'] },
    { id: 'users', label: 'Usuários', icon: ShieldCheck, roles: ['ADMIN', 'GERENTE'] },
    { id: 'backup', label: 'Backup', icon: Database, roles: ['ADMIN'] },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (isAdmin) return true;
    if (isGerente) return item.roles.includes('GERENTE');
    if (isOperador) return item.roles.includes('OPERADOR');
    return false;
  });

  const handleTabChange = (id: string) => {
    onTabChange(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-neutral-50 text-neutral-900">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-3 bg-white border-b border-neutral-200 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            C
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stores.length > 0 && (
            <button 
              onClick={() => setShowStoreDropdown(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-full text-[10px] font-bold shadow-sm"
            >
              <StoreIcon className="w-3 h-3 text-neutral-400" />
              <span className="max-w-[120px] truncate">{activeStore?.name || 'Selecionar Loja'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Store Selector Modal */}
      {showStoreDropdown && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full bg-white rounded-t-[2.5rem] p-8 space-y-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Selecionar Loja</h3>
              <button onClick={() => setShowStoreDropdown(false)} className="p-2 bg-neutral-100 rounded-full">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {stores.map(store => (
                <button
                  key={store.id}
                  onClick={() => {
                    setActiveStore(store);
                    setShowStoreDropdown(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all",
                    activeStore?.id === store.id 
                      ? "bg-neutral-900 border-neutral-900 text-white shadow-lg" 
                      : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    activeStore?.id === store.id ? "bg-white/20" : "bg-white"
                  )}>
                    <StoreIcon className={cn("w-5 h-5", activeStore?.id === store.id ? "text-white" : "text-neutral-400")} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-bold">{store.name}</span>
                    <span className={cn("text-[10px]", activeStore?.id === store.id ? "text-white/60" : "text-neutral-400")}>
                      {store.city}, {store.state}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar / Mobile Menu */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-neutral-200 p-6 flex flex-col gap-8 transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:w-64 md:p-4 md:z-40",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between md:hidden mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                P
              </div>
              <span className="font-bold tracking-tight text-sm">A Caverna</span>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 bg-neutral-100 rounded-full"
            >
              <X className="w-5 h-5 text-neutral-500" />
            </button>
          </div>

          <div className="hidden md:flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              C
            </div>
            <span className="font-bold text-xl tracking-tight">A Caverna</span>
          </div>

          {/* Store Selector */}
          {stores.length > 0 && (
            <div className="relative px-2 mt-4 md:mt-0">
              <button 
                onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold hover:bg-neutral-100 transition-all"
              >
                <div className="flex items-center gap-2 truncate">
                  <StoreIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="truncate">{activeStore?.name || 'Selecionar Loja'}</span>
                </div>
                <ChevronDown className={cn("w-3 h-3 text-neutral-400 transition-transform", showStoreDropdown && "rotate-180")} />
              </button>

              {showStoreDropdown && (
                <div className="absolute z-50 left-2 right-2 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {stores.map(store => (
                    <button
                      key={store.id}
                      onClick={() => {
                        setActiveStore(store);
                        setShowStoreDropdown(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2.5 text-left text-xs font-medium hover:bg-neutral-50 transition-colors",
                        activeStore?.id === store.id ? "bg-neutral-50 text-neutral-900 font-bold" : "text-neutral-500"
                      )}
                    >
                      {store.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-xl text-sm font-medium transition-all group",
                activeTab === item.id 
                  ? "bg-neutral-900 text-white shadow-sm" 
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              )}
            >
              <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-white" : "text-neutral-400 group-hover:text-neutral-900")} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-neutral-100 flex flex-col gap-4">
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors text-sm font-bold"
            >
              <Download className="w-4 h-4" />
              Instalar App
            </button>
          )}

          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center border border-neutral-200 shrink-0">
              <UserIcon className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold truncate">{user?.name}</span>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">{user?.role}</span>
                {user?.status === 'bloqueado' && (
                  <span className="text-[8px] bg-red-100 text-red-600 px-1 rounded font-bold">BLOQUEADO</span>
                )}
                {user?.status === 'pendente' && (
                  <span className="text-[8px] bg-yellow-100 text-yellow-600 px-1 rounded font-bold">PENDENTE</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-neutral-900/50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-neutral-200 px-2 py-1 z-40 flex items-center justify-around shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        {filteredNavItems.slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabChange(item.id)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[64px]",
              activeTab === item.id 
                ? "text-neutral-900" 
                : "text-neutral-400"
            )}
          >
            <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-neutral-900" : "text-neutral-400")} />
            <span className="text-[10px] font-bold">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center gap-1 p-2 rounded-xl text-neutral-400 min-w-[64px]"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-bold">Menu</span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 max-w-7xl mx-auto w-full overflow-y-auto pb-20 md:pb-10">
        {!activeStore && activeTab !== 'users' && activeTab !== 'stores' && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-8 bg-white rounded-[2.5rem] border border-neutral-100 shadow-sm">
            <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center text-yellow-600">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div className="max-w-md">
              <h2 className="text-2xl font-bold text-neutral-900">Nenhuma loja vinculada</h2>
              <p className="text-neutral-500 mt-2">
                Seu usuário ainda não foi vinculado a nenhuma loja. 
                Entre em contato com o administrador para solicitar o acesso.
              </p>
            </div>
          </div>
        )}
        {(activeStore || activeTab === 'users' || activeTab === 'stores') && children}
      </main>
    </div>
  );
}
