import React, { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Supplier } from '../types';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { PlusCircle, Search, X, Trash2, Truck, Phone, Mail, Globe, MapPin, FileText, Edit2, Loader2, Building2 } from 'lucide-react';

export function Suppliers() {
  const { activeStore } = useStore();
  const { user, isAdmin, isOperador } = useAuth();
  const { addToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    observations: '',
    paymentMethod: 'pix',
    paymentTerms: 'credito_avista',
    discount: 0,
  });

  useEffect(() => {
    if (!activeStore) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'suppliers'),
      where('storeId', '==', activeStore.id),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching suppliers', error);
      addToast('Erro ao carregar fornecedores.', 'error');
      handleFirestoreError(error, OperationType.LIST, 'suppliers');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeStore]);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleAddSupplier called', { activeStore, newSupplier });
    if (!activeStore || !newSupplier.name) {
      console.log('Validation failed', { activeStore, newSupplier });
      return;
    }

    setSubmitting(true);
    try {
      if (editingSupplier) {
        console.log('Updating supplier', editingSupplier.id);
        await updateDoc(doc(db, 'suppliers', editingSupplier.id), {
          ...newSupplier,
          updatedAt: new Date().toISOString(),
        });
      } else {
        console.log('Adding supplier');
        await addDoc(collection(db, 'suppliers'), {
          ...newSupplier,
          storeId: activeStore.id,
          createdAt: new Date().toISOString(),
        });
      }
      setNewSupplier({ 
        name: '', 
        contactName: '', 
        email: '', 
        phone: '', 
        website: '', 
        address: '', 
        observations: '',
        paymentMethod: 'pix',
        paymentTerms: 'credito_avista',
        discount: 0
      });
      setEditingSupplier(null);
      setIsModalOpen(false);
      addToast(editingSupplier ? 'Fornecedor atualizado com sucesso!' : 'Fornecedor cadastrado com sucesso!', 'success');
    } catch (error) {
      console.error('Error adding/updating supplier', error);
      addToast('Erro ao salvar fornecedor. Tente novamente.', 'error');
      handleFirestoreError(error, editingSupplier ? OperationType.UPDATE : OperationType.CREATE, editingSupplier ? `suppliers/${editingSupplier.id}` : 'suppliers');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setNewSupplier({
      name: supplier.name,
      contactName: supplier.contactName || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      website: supplier.website || '',
      address: supplier.address || '',
      observations: supplier.observations || '',
      paymentMethod: supplier.paymentMethod || 'pix',
      paymentTerms: supplier.paymentTerms || 'credito_avista',
      discount: supplier.discount || 0,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!supplierToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'suppliers', supplierToDelete));
      if (selectedSupplier?.id === supplierToDelete) setSelectedSupplier(null);
      addToast('Fornecedor excluído com sucesso!', 'success');
      setSupplierToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `suppliers/${supplierToDelete}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s =>
    (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.contactName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!activeStore) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
          <Building2 className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
        <p className="text-neutral-500">Você precisa selecionar uma loja para gerenciar os fornecedores.</p>
      </div>
    );
  }

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Fornecedores</h1>
          <p className="text-neutral-500 mt-1">Gerencie seus fornecedores e contatos.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all font-bold shadow-sm"
        >
          <PlusCircle className="w-5 h-5" />
          Novo Fornecedor
        </button>
      </header>

      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome, contato ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              onClick={() => setSelectedSupplier(supplier)}
              className="bg-white p-6 rounded-2xl border border-neutral-200 hover:border-neutral-900 transition-all group relative cursor-pointer"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center">
                    <Truck className="w-5 h-5 text-neutral-400" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-lg font-bold text-neutral-900 truncate">{supplier.name}</span>
                    <span className="text-xs text-neutral-400 uppercase tracking-wider font-bold truncate">
                      {supplier.contactName || 'Sem contato principal'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-neutral-500 text-sm">
                      <Phone className="w-4 h-4" />
                      <span>{supplier.phone}</span>
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-neutral-500 text-sm">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{supplier.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {(isAdmin || user?.role === 'GERENTE') && (
                <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(supplier);
                    }}
                    className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSupplierToDelete(supplier.id);
                    }}
                    className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {filteredSuppliers.length === 0 && (
            <div className="col-span-full py-20 text-center text-neutral-400 italic">Nenhum fornecedor encontrado.</div>
          )}
        </div>
      </div>

      {/* Modal Novo Fornecedor */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-neutral-900">
                {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h2>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingSupplier(null);
                  setNewSupplier({ 
                    name: '', 
                    contactName: '', 
                    email: '', 
                    phone: '', 
                    website: '', 
                    address: '', 
                    observations: '',
                    paymentMethod: 'pix',
                    paymentTerms: 'credito_avista',
                    discount: 0
                  });
                }} 
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>

            <form onSubmit={handleAddSupplier} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Nome da Empresa</label>
                  <input
                    type="text"
                    required
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: Fornecedor de Tecidos"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Nome do Contato</label>
                  <input
                    type="text"
                    value={newSupplier.contactName}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contactName: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: Maria Silva"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Email</label>
                  <input
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="contato@fornecedor.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Telefone</label>
                  <input
                    type="text"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: (11) 99999-9999"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700">Website</label>
                <input
                  type="text"
                  value={newSupplier.website}
                  onChange={(e) => setNewSupplier({ ...newSupplier, website: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                  placeholder="https://www.fornecedor.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700">Endereço</label>
                <input
                  type="text"
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                  placeholder="Rua Exemplo, 123 - Cidade, UF"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700">Observações</label>
                <textarea
                  value={newSupplier.observations}
                  onChange={(e) => setNewSupplier({ ...newSupplier, observations: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Forma de Pagamento</label>
                  <select
                    value={newSupplier.paymentMethod}
                    onChange={(e) => setNewSupplier({ ...newSupplier, paymentMethod: e.target.value as any })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                  >
                    <option value="dinheiro">Dinheiro</option>
                    <option value="pix">Pix</option>
                    <option value="credito">Crédito</option>
                    <option value="boleto">Boleto</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Condições de Pagamento</label>
                  <select
                    value={newSupplier.paymentTerms}
                    onChange={(e) => setNewSupplier({ ...newSupplier, paymentTerms: e.target.value as any })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                  >
                    <option value="credito_avista">Crédito à vista</option>
                    <option value="credito_parcelado">Crédito parcelado</option>
                    <option value="boleto_30">Boleto 30</option>
                    <option value="boleto_60">Boleto 60</option>
                    <option value="boleto_90">Boleto 90</option>
                    <option value="boleto_30_60">Boleto 30/60</option>
                    <option value="boleto_30_60_90">Boleto 30/60/90</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Desconto (%)</label>
                  <input
                    type="number"
                    value={newSupplier.discount || ''}
                    onChange={(e) => setNewSupplier({ ...newSupplier, discount: e.target.value ? parseFloat(e.target.value) : 0 })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Processando...' : (editingSupplier ? 'Salvar Alterações' : 'Cadastrar Fornecedor')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detalhes do Fornecedor */}
      {selectedSupplier && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center text-white">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900">{selectedSupplier.name}</h2>
                  <p className="text-sm text-neutral-500">Fornecedor</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleEdit(selectedSupplier);
                      setSelectedSupplier(null);
                    }}
                    className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  {(isAdmin || user?.role === 'GERENTE') && (
                    <button
                      onClick={() => setSupplierToDelete(selectedSupplier.id)}
                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                <button onClick={() => setSelectedSupplier(null)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-neutral-400" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="bg-neutral-50 p-6 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Informações de Contato</h3>
                  <div className="space-y-3">
                    {selectedSupplier.contactName && (
                      <div className="flex items-center gap-3 text-sm">
                        <FileText className="w-4 h-4 text-neutral-400" />
                        <span>{selectedSupplier.contactName}</span>
                      </div>
                    )}
                    {selectedSupplier.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="w-4 h-4 text-neutral-400" />
                        <span>{selectedSupplier.phone}</span>
                      </div>
                    )}
                    {selectedSupplier.email && (
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="w-4 h-4 text-neutral-400" />
                        <span className="truncate">{selectedSupplier.email}</span>
                      </div>
                    )}
                    {selectedSupplier.website && (
                      <div className="flex items-center gap-3 text-sm">
                        <Globe className="w-4 h-4 text-neutral-400" />
                        <a href={selectedSupplier.website} target="_blank" rel="noopener noreferrer" className="text-neutral-900 hover:underline truncate">
                          {selectedSupplier.website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-neutral-50 p-6 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Localização</h3>
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-neutral-400 mt-1" />
                    <span>{selectedSupplier.address || 'Endereço não informado'}</span>
                  </div>
                </div>
              </div>
            </div>

            {selectedSupplier.observations && (
              <div className="bg-neutral-50 p-6 rounded-2xl space-y-2">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Observações</h3>
                <p className="text-sm text-neutral-700 whitespace-pre-wrap">{selectedSupplier.observations}</p>
              </div>
            )}
            <div className="bg-neutral-50 p-6 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Informações de Pagamento</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="block text-neutral-400 font-bold">Forma</span>
                  <span className="capitalize">{selectedSupplier.paymentMethod}</span>
                </div>
                <div>
                  <span className="block text-neutral-400 font-bold">Condições</span>
                  <span className="capitalize">{selectedSupplier.paymentTerms?.replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <span className="block text-neutral-400 font-bold">Desconto</span>
                  <span>{selectedSupplier.discount || 0}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {supplierToDelete && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 text-red-600">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Excluir Fornecedor?</h3>
            </div>
            
            <p className="text-neutral-600 leading-relaxed">
              Tem certeza que deseja excluir este fornecedor? Esta ação não pode ser desfeita.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSupplierToDelete(null)}
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
