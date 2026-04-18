import React, { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Client, Quote } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Plus, Trash2, User, Search, PlusCircle, X, Phone, Mail, MapPin, FileText, History, Loader2 } from 'lucide-react';

export function Clients() {
  const { activeStore } = useStore();
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientQuotes, setClientQuotes] = useState<Quote[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [newClient, setNewClient] = useState<Partial<Client>>({
    name: '',
    type: 'PF',
    document: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    observations: '',
  });

  useEffect(() => {
    if (!activeStore) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'clients'), 
      where('storeId', '==', activeStore.id),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clients');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeStore]);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !newClient.name || !newClient.phone) return;

    try {
      await addDoc(collection(db, 'clients'), {
        ...newClient,
        storeId: activeStore.id,
        totalSpent: 0,
        quoteCount: 0,
        lastPurchase: null,
      });
      setNewClient({ name: '', type: 'PF', document: '', phone: '', email: '', city: '', state: '', observations: '' });
      setIsModalOpen(false);
      addToast('Cliente cadastrado com sucesso!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'clients');
    }
  };

  const handleDelete = async () => {
    if (!clientToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'clients', clientToDelete));
      addToast('Cliente excluído com sucesso!', 'success');
      setClientToDelete(null);
      if (selectedClient?.id === clientToDelete) {
        setSelectedClient(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `clients/${clientToDelete}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const viewClientDetails = async (client: Client) => {
    setSelectedClient(client);
    const q = query(collection(db, 'quotes'), where('clientId', '==', client.id), orderBy('date', 'desc'));
    try {
      const snapshot = await getDocs(q);
      const quotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quote));
      setClientQuotes(quotes);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'quotes');
    }
  };

  const filteredClients = clients.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').includes(searchTerm) ||
    (c.document || '').includes(searchTerm)
  );

  if (!activeStore) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
          <User className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
        <p className="text-neutral-500">Você precisa selecionar uma loja para gerenciar os clientes.</p>
      </div>
    );
  }

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Clientes</h1>
          <p className="text-neutral-500 mt-1">Gerencie sua base de clientes e histórico de compras.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all font-bold shadow-sm"
        >
          <PlusCircle className="w-5 h-5" />
          Novo Cliente
        </button>
      </header>

      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <div 
              key={client.id} 
              onClick={() => viewClientDetails(client)}
              className="bg-white p-6 rounded-2xl border border-neutral-200 hover:border-neutral-900 transition-all group relative cursor-pointer"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-neutral-400" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-lg font-bold text-neutral-900 truncate">{client.name}</span>
                    <span className="text-xs text-neutral-400 uppercase tracking-wider font-bold">
                      {client.type} {client.document ? `• ${client.document}` : ''}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-neutral-500 text-sm">
                    <Phone className="w-4 h-4" />
                    <span>{client.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-500 text-sm">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{client.email}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase">Total Gasto</span>
                    <span className="text-sm font-bold text-neutral-900">{formatCurrency(client.totalSpent || 0)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase">Orçamentos</span>
                    <span className="text-sm font-bold text-neutral-900 block">{client.quoteCount || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredClients.length === 0 && (
            <div className="col-span-full py-20 text-center text-neutral-400 italic">Nenhum cliente encontrado.</div>
          )}
        </div>
      </div>

      {/* Modal Novo Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-neutral-900">Novo Cliente</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>

            <form onSubmit={handleAddClient} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Nome / Razão Social</label>
                  <input
                    type="text"
                    required
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Tipo</label>
                  <select
                    value={newClient.type}
                    onChange={(e) => setNewClient({ ...newClient, type: e.target.value as 'PF' | 'PJ' })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                  >
                    <option value="PF">Pessoa Física (PF)</option>
                    <option value="PJ">Pessoa Jurídica (PJ)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">{newClient.type === 'PF' ? 'CPF' : 'CNPJ'} (Opcional)</label>
                  <input
                    type="text"
                    value={newClient.document}
                    onChange={(e) => setNewClient({ ...newClient, document: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder={newClient.type === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: 5511999999999"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2 md:col-span-1">
                  <label className="text-sm font-bold text-neutral-700">Email</label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Cidade</label>
                  <input
                    type="text"
                    value={newClient.city}
                    onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Estado</label>
                  <input
                    type="text"
                    value={newClient.state}
                    onChange={(e) => setNewClient({ ...newClient, state: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: SP"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700">Observações</label>
                <textarea
                  value={newClient.observations}
                  onChange={(e) => setNewClient({ ...newClient, observations: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none min-h-[100px]"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg"
                >
                  Cadastrar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detalhes do Cliente */}
      {selectedClient && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center text-white">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900">{selectedClient.name}</h2>
                  <p className="text-sm text-neutral-500">
                    {selectedClient.type} {selectedClient.document ? `• ${selectedClient.document}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                  {(isAdmin || user?.role === 'GERENTE') && (
                    <button
                      onClick={() => setClientToDelete(selectedClient.id)}
                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                <button onClick={() => setSelectedClient(null)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-neutral-400" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-1 space-y-6">
                <div className="bg-neutral-50 p-6 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Informações de Contato</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-neutral-400" />
                      <span>{selectedClient.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-neutral-400" />
                      <span className="truncate">{selectedClient.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-neutral-400" />
                      <span>{selectedClient.city}, {selectedClient.state}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-900 p-6 rounded-2xl text-white space-y-4">
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Resumo de Compras</h3>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] text-neutral-400 block">TOTAL GASTO</span>
                      <span className="text-xl font-bold">{formatCurrency(selectedClient.totalSpent || 0)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block">ÚLTIMA COMPRA</span>
                      <span className="text-sm font-medium">
                        {selectedClient.lastPurchase ? new Date(selectedClient.lastPurchase).toLocaleDateString() : 'Nenhuma'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-6">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-neutral-400" />
                  <h3 className="font-bold text-neutral-900">Histórico de Orçamentos</h3>
                </div>
                
                <div className="space-y-4">
                  {clientQuotes.map((quote) => (
                    <div key={quote.id} className="p-4 bg-white border border-neutral-100 rounded-2xl flex items-center justify-between hover:bg-neutral-50 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-neutral-900">
                          {quote.items?.[0]?.productName || 'Vários itens'}
                          {quote.items?.length > 1 && ` (+${quote.items.length - 1})`}
                        </span>
                        <span className="text-xs text-neutral-500">{new Date(quote.date).toLocaleDateString()} • {quote.items?.reduce((acc, i) => acc + i.quantity, 0)} un</span>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <span className="text-sm font-bold text-neutral-900">{formatCurrency(quote.totalAmount)}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          quote.status === 'Finalizado' ? "bg-green-100 text-green-700" :
                          quote.status === 'Pendente' ? "bg-yellow-100 text-yellow-700" :
                          "bg-blue-100 text-blue-700"
                        )}>
                          {quote.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {clientQuotes.length === 0 && (
                    <div className="text-center py-10 text-neutral-400 italic text-sm">
                      Nenhum orçamento vinculado a este cliente.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white w-full max-md rounded-3xl shadow-2xl p-8 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 text-red-600">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Excluir Cliente?</h3>
            </div>
            
            <p className="text-neutral-600 leading-relaxed">
              Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setClientToDelete(null)}
                disabled={isDeleting}
                className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-900 rounded-xl font-bold hover:bg-neutral-200 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Confirmar Exclusão'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
