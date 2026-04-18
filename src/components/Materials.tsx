import React, { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Material, Supplier } from '../types';
import { formatCurrency } from '../lib/utils';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Plus, Trash2, Package, Search, PlusCircle, X, Truck, Edit2, ArrowUpDown, AlertCircle, Loader2 } from 'lucide-react';

type SortField = 'name' | 'purchasePrice' | 'unitCost' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export function Materials() {
  const { activeStore } = useStore();
  const { addToast } = useToast();
  const { isAdmin, user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isDeleting, setIsDeleting] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<string | null>(null);
  const [newMaterial, setNewMaterial] = useState<Partial<Material>>({
    name: '',
    unit: 'un',
    purchasePrice: 0,
    purchaseQuantity: 0,
    isPackage: false,
    packageQuantity: 1,
    supplierId: '',
    stockQuantity: 0,
    minStockQuantity: 0,
  });

  useEffect(() => {
    if (!activeStore) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'materials'), 
      where('storeId', '==', activeStore.id),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
      setMaterials(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'materials');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeStore]);

  useEffect(() => {
    if (!activeStore) return;

    const q = query(
      collection(db, 'suppliers'),
      where('storeId', '==', activeStore.id),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'suppliers');
    });
    return () => unsubscribe();
  }, [activeStore]);

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    const isActuallyPackage = newMaterial.isPackage || newMaterial.unit === 'pct';
    if (!activeStore || !newMaterial.name || !newMaterial.purchasePrice) return;

    // Validation
    if (!isActuallyPackage && !newMaterial.purchaseQuantity) return;
    if (isActuallyPackage && !newMaterial.packageQuantity) return;

    const quantity = isActuallyPackage ? (newMaterial.packageQuantity || 1) : newMaterial.purchaseQuantity!;
    const unitCost = newMaterial.purchasePrice / quantity;

    try {
      if (editingMaterial) {
        await updateDoc(doc(db, 'materials', editingMaterial.id), {
          ...newMaterial,
          isPackage: isActuallyPackage,
          unitCost,
          purchaseQuantity: quantity,
          supplierId: newMaterial.supplierId || null,
          stockQuantity: Number(newMaterial.stockQuantity) || 0,
          minStockQuantity: Number(newMaterial.minStockQuantity) || 0,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'materials'), { 
          ...newMaterial, 
          isPackage: isActuallyPackage,
          storeId: activeStore.id,
          unitCost,
          purchaseQuantity: quantity, // Ensure we store the total quantity
          supplierId: newMaterial.supplierId || null,
          stockQuantity: Number(newMaterial.stockQuantity) || 0,
          minStockQuantity: Number(newMaterial.minStockQuantity) || 0,
          createdAt: new Date().toISOString()
        });
      }
      setNewMaterial({ name: '', unit: 'un', purchasePrice: 0, purchaseQuantity: 0, isPackage: false, packageQuantity: 1, supplierId: '', stockQuantity: 0, minStockQuantity: 0 });
      setEditingMaterial(null);
      setIsModalOpen(false);
      addToast(editingMaterial ? 'Material atualizado com sucesso!' : 'Material cadastrado com sucesso!', 'success');
    } catch (error) {
      handleFirestoreError(error, editingMaterial ? OperationType.UPDATE : OperationType.CREATE, editingMaterial ? `materials/${editingMaterial.id}` : 'materials');
    }
  };

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    setNewMaterial({
      name: material.name,
      unit: material.unit,
      purchasePrice: material.purchasePrice,
      purchaseQuantity: material.purchaseQuantity,
      isPackage: material.isPackage,
      packageQuantity: material.packageQuantity || 1,
      supplierId: material.supplierId || '',
      stockQuantity: material.stockQuantity || 0,
      minStockQuantity: material.minStockQuantity || 0,
    });
    setIsModalOpen(true);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredMaterials = materials
    .filter(m => 
      (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (suppliers.find(s => s.id === m.supplierId)?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'purchasePrice') {
        comparison = a.purchasePrice - b.purchasePrice;
      } else if (sortField === 'unitCost') {
        comparison = a.unitCost - b.unitCost;
      } else if (sortField === 'createdAt') {
        // Assuming createdAt exists, if not fallback to id or similar
        const dateA = (a as any).createdAt || '';
        const dateB = (b as any).createdAt || '';
        comparison = dateA.localeCompare(dateB);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleDelete = async () => {
    if (!materialToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'materials', materialToDelete));
      addToast('Material excluído com sucesso!', 'success');
      setMaterialToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `materials/${materialToDelete}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!activeStore) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
          <Package className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
        <p className="text-neutral-500">Você precisa selecionar uma loja para gerenciar as matérias-primas.</p>
      </div>
    );
  }

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Matéria-prima</h1>
          <p className="text-neutral-500 mt-1">Gerencie seus insumos e custos unitários.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all font-bold shadow-sm"
        >
          <PlusCircle className="w-5 h-5" />
          Novo Insumo
        </button>
      </header>

      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
            <span className="text-xs font-bold text-neutral-400 uppercase whitespace-nowrap">Ordenar por:</span>
            <button
              onClick={() => toggleSort('name')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${sortField === 'name' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              Nome {sortField === 'name' && <ArrowUpDown className="w-3 h-3" />}
            </button>
            <button
              onClick={() => toggleSort('purchasePrice')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${sortField === 'purchasePrice' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              Preço {sortField === 'purchasePrice' && <ArrowUpDown className="w-3 h-3" />}
            </button>
            <button
              onClick={() => toggleSort('unitCost')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${sortField === 'unitCost' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              Custo Unit. {sortField === 'unitCost' && <ArrowUpDown className="w-3 h-3" />}
            </button>
            <button
              onClick={() => toggleSort('createdAt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${sortField === 'createdAt' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              Data {sortField === 'createdAt' && <ArrowUpDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Material</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Unidade</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Preço Compra</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Qtd Compra</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Custo Unitário</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Estoque</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {filteredMaterials.map((material) => (
                <tr key={material.id} className="group hover:bg-neutral-50 transition-colors">
                  <td className="py-4">
                    <div className="font-bold text-neutral-900">{material.name}</div>
                    <div className="flex items-center gap-2">
                      {material.isPackage && (
                        <div className="text-[10px] text-neutral-400 uppercase font-bold">
                          Pacote com {material.packageQuantity} itens
                        </div>
                      )}
                      {material.supplierId && (
                        <>
                          {material.isPackage && <span className="text-neutral-300">•</span>}
                          <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-bold uppercase">
                            <Truck className="w-3 h-3" />
                            <span>{suppliers.find(s => s.id === material.supplierId)?.name}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-4 text-sm text-neutral-500">{material.unit}</td>
                  <td className="py-4 text-sm font-medium">{formatCurrency(material.purchasePrice)}</td>
                  <td className="py-4 text-sm text-neutral-500">
                    {material.isPackage ? '1 Pacote' : `${material.purchaseQuantity} ${material.unit}`}
                  </td>
                  <td className="py-4">
                    <span className="px-3 py-1 bg-neutral-100 rounded-full text-xs font-bold text-neutral-700">
                      {formatCurrency(material.unitCost)} / {material.unit}
                    </span>
                  </td>
                  <td className="py-4 text-sm font-bold text-neutral-900">
                    {material.stockQuantity} {material.unit}
                    {material.stockQuantity <= (material.minStockQuantity || 0) && (
                      <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">BAIXO</span>
                    )}
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(material)}
                        className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {(isAdmin || user?.role === 'GERENTE') && (
                        <button
                          onClick={() => setMaterialToDelete(material.id)}
                          className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMaterials.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-neutral-400 italic">Nenhum material cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-neutral-900">
                {editingMaterial ? 'Editar Insumo' : 'Novo Insumo'}
              </h2>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingMaterial(null);
                  setNewMaterial({ name: '', unit: 'un', purchasePrice: 0, purchaseQuantity: 0, isPackage: false, packageQuantity: 1, supplierId: '' });
                }} 
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>

            <form onSubmit={handleAddMaterial} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Nome do Material</label>
                  <input
                    type="text"
                    required
                    value={newMaterial.name}
                    onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: Tecido Algodão"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Fornecedor (Opcional)</label>
                  <select
                    value={newMaterial.supplierId || ''}
                    onChange={(e) => setNewMaterial({ ...newMaterial, supplierId: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                  >
                    <option value="">Selecione um fornecedor</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Unidade</label>
                  <select
                    value={newMaterial.unit}
                    onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="kg">Quilograma (kg)</option>
                    <option value="g">Grama (g)</option>
                    <option value="m">Metro (m)</option>
                    <option value="cm">Centímetro (cm)</option>
                    <option value="l">Litro (l)</option>
                    <option value="ml">Mililitro (ml)</option>
                    <option value="pct">Pacote (pct)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Preço de Compra</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newMaterial.purchasePrice || ''}
                    onChange={(e) => setNewMaterial({ ...newMaterial, purchasePrice: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="isPackage"
                  checked={newMaterial.isPackage || newMaterial.unit === 'pct'}
                  onChange={(e) => setNewMaterial({ ...newMaterial, isPackage: e.target.checked })}
                  className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                />
                <label htmlFor="isPackage" className="text-sm font-bold text-neutral-700">
                  Comprar em Pacote?
                </label>
              </div>

              {newMaterial.isPackage || newMaterial.unit === 'pct' ? (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Quantidade de Itens no Pacote</label>
                  <input
                    type="number"
                    required
                    value={newMaterial.packageQuantity || ''}
                    onChange={(e) => setNewMaterial({ ...newMaterial, packageQuantity: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: 10"
                  />
                  <p className="text-xs text-neutral-500">
                    O custo unitário será calculado dividindo o preço de compra por esta quantidade.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Quantidade Comprada</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newMaterial.purchaseQuantity || ''}
                    onChange={(e) => setNewMaterial({ ...newMaterial, purchaseQuantity: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: 10"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Estoque Atual</label>
                  <input
                    type="number"
                    required
                    value={newMaterial.stockQuantity || ''}
                    onChange={(e) => setNewMaterial({ ...newMaterial, stockQuantity: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: 50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Estoque Mínimo</label>
                  <input
                    type="number"
                    required
                    value={newMaterial.minStockQuantity || ''}
                    onChange={(e) => setNewMaterial({ ...newMaterial, minStockQuantity: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: 10"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg"
                >
                  {editingMaterial ? 'Salvar Alterações' : 'Cadastrar Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {materialToDelete && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 text-red-600">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Excluir Material?</h3>
            </div>
            
            <p className="text-neutral-600 leading-relaxed">
              Tem certeza que deseja excluir este material? Esta ação não pode ser desfeita.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setMaterialToDelete(null)}
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
