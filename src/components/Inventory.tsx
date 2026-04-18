import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Material } from '../types';
import { useStore } from '../contexts/StoreContext';
import { useToast } from '../contexts/ToastContext';
import { Search, Plus, Minus, AlertCircle, Package } from 'lucide-react';

export function Inventory() {
  const { activeStore } = useStore();
  const { addToast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!activeStore) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'materials'), 
      where('storeId', '==', activeStore.id)
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

  const updateStock = async (id: string, delta: number) => {
    const material = materials.find(m => m.id === id);
    if (!material) return;
    
    try {
      await updateDoc(doc(db, 'materials', id), {
        stockQuantity: (material.stockQuantity || 0) + delta,
        updatedAt: new Date().toISOString()
      });
      addToast('Estoque atualizado com sucesso!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `materials/${id}`);
    }
  };

  const filteredMaterials = materials.filter(m => 
    (m.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalValue = materials.reduce((acc, m) => acc + (m.stockQuantity || 0) * m.unitCost, 0);
  const lowStockItems = materials.filter(m => (m.stockQuantity || 0) <= (m.minStockQuantity || 0));

  if (!activeStore) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
          <Package className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
        <p className="text-neutral-500">Você precisa selecionar uma loja para gerenciar o estoque.</p>
      </div>
    );
  }

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Estoque</h1>
        <p className="text-neutral-500 mt-1">Gerencie a entrada e saída de insumos.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Total de Insumos</div>
          <div className="text-3xl font-bold text-neutral-900 mt-2">{materials.length}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Valor Total em Estoque</div>
          <div className="text-3xl font-bold text-neutral-900 mt-2">R$ {totalValue.toFixed(2)}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Itens com Estoque Baixo</div>
          <div className="text-3xl font-bold text-red-600 mt-2">{lowStockItems.length}</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Material</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Estoque Atual</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Estoque Mínimo</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {filteredMaterials.map((material) => (
                <tr key={material.id} className="group hover:bg-neutral-50 transition-colors">
                  <td className="py-4 font-bold text-neutral-900">{material.name}</td>
                  <td className="py-4 text-sm font-bold text-neutral-900">
                    {material.stockQuantity} {material.unit}
                    {(material.stockQuantity || 0) <= (material.minStockQuantity || 0) && (
                      <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">BAIXO</span>
                    )}
                  </td>
                  <td className="py-4 text-sm text-neutral-500">{material.minStockQuantity} {material.unit}</td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => updateStock(material.id, -1)}
                        className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateStock(material.id, 1)}
                        className="p-2 text-neutral-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
