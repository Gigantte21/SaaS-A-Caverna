import React, { useState, useRef } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { Store } from '../types';
import { useStore } from '../contexts/StoreContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Store as StoreIcon, X, MapPin, Phone, Mail, FileText, Upload, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export function Stores() {
  const { stores } = useStore();
  const { addToast } = useToast();
  const { isAdmin, user } = useAuth();
  const isGerente = user?.role === 'GERENTE';
  const canEdit = isAdmin || isGerente;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<Store>>({
    name: '',
    fantasyName: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    address: '',
    zipCode: '',
    neighborhood: '',
    logo: '',
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
    observations: ''
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `logos/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      setFormData(prev => ({ ...prev, logo: downloadURL }));
    } catch (error) {
      console.error('Erro ao fazer upload do logo:', error);
      addToast('Erro ao fazer upload do logo. Tente novamente.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStore) {
        await updateDoc(doc(db, 'stores', editingStore.id), formData);
      } else {
        await addDoc(collection(db, 'stores'), formData);
      }
      setIsModalOpen(false);
      setEditingStore(null);
      setFormData({ 
        name: '', 
        fantasyName: '', 
        phone: '', 
        email: '', 
        city: '', 
        state: '', 
        address: '',
        zipCode: '',
        neighborhood: '',
        logo: '',
        primaryColor: '#000000',
        secondaryColor: '#ffffff',
        observations: '' 
      });
      addToast(editingStore ? 'Loja atualizada com sucesso!' : 'Loja cadastrada com sucesso!', 'success');
    } catch (error) {
      handleFirestoreError(error, editingStore ? OperationType.UPDATE : OperationType.CREATE, editingStore ? `stores/${editingStore.id}` : 'stores');
    }
  };

  const handleDelete = async () => {
    if (!storeToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'stores', storeToDelete));
      addToast('Loja excluída com sucesso!', 'success');
      setStoreToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stores/${storeToDelete}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const openEdit = (store: Store) => {
    setEditingStore(store);
    setFormData({
      ...store,
      primaryColor: store.primaryColor || '#000000',
      secondaryColor: store.secondaryColor || '#ffffff',
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Lojas</h1>
          <p className="text-neutral-500 mt-1">Gerencie suas unidades e empresas.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingStore(null);
              setFormData({ 
                name: '', 
                fantasyName: '', 
                phone: '', 
                email: '', 
                city: '', 
                state: '', 
                address: '',
                zipCode: '',
                neighborhood: '',
                logo: '',
                primaryColor: '#000000',
                secondaryColor: '#ffffff',
                observations: '' 
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all font-bold shadow-lg shadow-neutral-200"
          >
            <Plus className="w-5 h-5" />
            Nova Loja
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stores.map((store) => (
          <div key={store.id} className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            {store.primaryColor && (
              <div 
                className="absolute top-0 left-0 w-full h-1" 
                style={{ backgroundColor: store.primaryColor }}
              />
            )}
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-900 overflow-hidden">
                {store.logo ? (
                  <img src={store.logo} alt={store.fantasyName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <StoreIcon className="w-6 h-6" />
                )}
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {canEdit && (
                  <button
                    onClick={() => openEdit(store)}
                    className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setStoreToDelete(store.id)}
                    className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-lg text-neutral-900">{store.name}</h3>
                <p className="text-sm text-neutral-500">{store.fantasyName}</p>
              </div>

              <div className="space-y-2 pt-4 border-t border-neutral-50">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <MapPin className="w-3.5 h-3.5" />
                  {store.city}, {store.state}
                </div>
                {store.phone && (
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Phone className="w-3.5 h-3.5" />
                    {store.phone}
                  </div>
                )}
                {store.email && (
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Mail className="w-3.5 h-3.5" />
                    {store.email}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-neutral-900">
                {editingStore ? 'Editar Loja' : 'Nova Loja'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Logo da Loja</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-2xl flex items-center justify-center overflow-hidden relative group">
                      {formData.logo ? (
                        <>
                          <img src={formData.logo} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, logo: '' }))}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                        <StoreIcon className="w-8 h-8 text-neutral-300" />
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-neutral-900" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-bold hover:bg-neutral-50 transition-all disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        {formData.logo ? 'Alterar Logo' : 'Subir Logo'}
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <p className="text-[10px] text-neutral-400">
                        PNG, JPG ou SVG. Recomendado 512x512px.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Logo (URL opcional)</label>
                  <input
                    type="url"
                    value={formData.logo}
                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="https://exemplo.com/logo.png"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700">Cor Primária</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="w-12 h-12 p-1 bg-neutral-50 border border-neutral-200 rounded-xl cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none uppercase"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700">Cor Secundária</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.secondaryColor}
                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                        className="w-12 h-12 p-1 bg-neutral-50 border border-neutral-200 rounded-xl cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.secondaryColor}
                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                        className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none uppercase"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Razão Social</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: A Caverna Personalizados LTDA"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Nome Fantasia</label>
                  <input
                    required
                    type="text"
                    value={formData.fantasyName}
                    onChange={(e) => setFormData({ ...formData, fantasyName: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: A Caverna"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700">Telefone</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                      placeholder="loja@email.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Endereço</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Rua, Número, Complemento"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700">Bairro</label>
                    <input
                      type="text"
                      value={formData.neighborhood}
                      onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700">CEP</label>
                    <input
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                      placeholder="00000-000"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700">Cidade</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700">Estado</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                      placeholder="UF"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Observações</label>
                  <textarea
                    value={formData.observations}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none min-h-[100px]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-900 rounded-xl font-bold hover:bg-neutral-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all shadow-lg"
                >
                  Salvar Loja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {storeToDelete && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 text-red-600">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Excluir Loja?</h3>
            </div>
            
            <p className="text-neutral-600 leading-relaxed">
              Tem certeza que deseja excluir esta loja? Todos os dados vinculados a ela permanecerão no banco, mas não serão acessíveis por esta loja.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStoreToDelete(null)}
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
