import React, { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, Material, ProductMaterial } from '../types';
import { formatCurrency } from '../lib/utils';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Plus, Trash2, Box, Search, PlusCircle, X, Clock, Package, Edit2, Loader2 } from 'lucide-react';

export function Products() {
  const { activeStore } = useStore();
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    category: '',
    materials: [],
    productionTime: 0,
    packagingCost: 0,
    isPackage: false,
    packageQuantity: 1,
    finishingOptions: [],
    accessories: [],
  });
  const [materialSearchTerm, setMaterialSearchTerm] = useState('');
  const [isMaterialDropdownOpen, setIsMaterialDropdownOpen] = useState(false);

  // Finishing/Accessories local state for adding
  const [newFinishing, setNewFinishing] = useState({ name: '', description: '', additionalValue: 0 });
  const [newAccessory, setNewAccessory] = useState({ name: '', additionalValue: 0 });

  const [isDeleting, setIsDeleting] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const filteredMaterials = materials.filter(m => 
    !newProduct.materials?.some(pm => pm.materialId === m.id) &&
    (m.name || '').toLowerCase().includes(materialSearchTerm.toLowerCase())
  );

  useEffect(() => {
    if (!activeStore) {
      setLoading(false);
      return;
    }

    const qP = query(
      collection(db, 'products'), 
      where('storeId', '==', activeStore.id),
      orderBy('name', 'asc')
    );
    const unsubscribeP = onSnapshot(qP, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setLoading(false);
    });

    const qM = query(
      collection(db, 'materials'), 
      where('storeId', '==', activeStore.id),
      orderBy('name', 'asc')
    );
    const unsubscribeM = onSnapshot(qM, (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'materials');
    });

    return () => {
      unsubscribeP();
      unsubscribeM();
    };
  }, [activeStore]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !newProduct.name || !newProduct.category) return;

    try {
      const productData = {
        ...newProduct,
        storeId: activeStore.id,
        updatedAt: new Date().toISOString()
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: new Date().toISOString()
        });
      }
      setNewProduct({ 
        name: '', 
        category: '', 
        materials: [], 
        productionTime: 0, 
        packagingCost: 0, 
        isPackage: false, 
        packageQuantity: 1,
        finishingOptions: [],
        accessories: []
      });
      setEditingProduct(null);
      setIsModalOpen(false);
      addToast(editingProduct ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!', 'success');
    } catch (error) {
      handleFirestoreError(error, editingProduct ? OperationType.UPDATE : OperationType.CREATE, editingProduct ? `products/${editingProduct.id}` : 'products');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      ...product,
      finishingOptions: product.finishingOptions || [],
      accessories: product.accessories || [],
    });
    setIsModalOpen(true);
  };

  const addMaterialToProduct = (materialId: string) => {
    if (!materialId) return;
    const exists = newProduct.materials?.find(m => m.materialId === materialId);
    if (exists) return;

    setNewProduct({
      ...newProduct,
      materials: [...(newProduct.materials || []), { materialId, quantity: 0 }]
    });
  };

  const updateMaterialQuantity = (materialId: string, quantity: number) => {
    setNewProduct({
      ...newProduct,
      materials: newProduct.materials?.map(m => 
        m.materialId === materialId ? { ...m, quantity } : m
      )
    });
  };

  const removeMaterialFromProduct = (materialId: string) => {
    setNewProduct({
      ...newProduct,
      materials: newProduct.materials?.filter(m => m.materialId !== materialId)
    });
  };

  const addFinishingOption = () => {
    if (!newFinishing.name) return;
    const option = { ...newFinishing, id: crypto.randomUUID() };
    setNewProduct({
      ...newProduct,
      finishingOptions: [...(newProduct.finishingOptions || []), option]
    });
    setNewFinishing({ name: '', description: '', additionalValue: 0 });
  };

  const removeFinishingOption = (id: string) => {
    setNewProduct({
      ...newProduct,
      finishingOptions: newProduct.finishingOptions?.filter(o => o.id !== id)
    });
  };

  const addAccessory = () => {
    if (!newAccessory.name) return;
    const accessory = { ...newAccessory, id: crypto.randomUUID() };
    setNewProduct({
      ...newProduct,
      accessories: [...(newProduct.accessories || []), accessory]
    });
    setNewAccessory({ name: '', additionalValue: 0 });
  };

  const removeAccessory = (id: string) => {
    setNewProduct({
      ...newProduct,
      accessories: newProduct.accessories?.filter(a => a.id !== id)
    });
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'products', productToDelete));
      addToast('Produto excluído com sucesso!', 'success');
      setProductToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${productToDelete}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!activeStore) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
          <Package className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
        <p className="text-neutral-500">Você precisa selecionar uma loja para gerenciar os produtos.</p>
      </div>
    );
  }

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Produtos</h1>
          <p className="text-neutral-500 mt-1">Cadastre seus produtos e defina sua composição.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all font-bold shadow-sm"
        >
          <PlusCircle className="w-5 h-5" />
          Novo Produto
        </button>
      </header>

      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar produto ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white p-6 rounded-2xl border border-neutral-200 hover:border-neutral-900 transition-all group relative">
              {(isAdmin || user?.role === 'GERENTE') && (
                <button
                  onClick={() => setProductToDelete(product.id)}
                  className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center">
                    <Box className="w-5 h-5 text-neutral-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold text-neutral-900">{product.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400 uppercase tracking-wider font-bold">{product.category}</span>
                      {product.isPackage && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          Pacote com {product.packageQuantity}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-neutral-500">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">{product.productionTime} min</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-500">
                    <Package className="w-4 h-4" />
                    <span className="text-sm font-medium">{product.materials?.length || 0} materiais</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
                  <button
                    onClick={() => handleEdit(product)}
                    className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Embalagem</span>
                  <span className="text-sm font-bold text-neutral-900">{formatCurrency(product.packagingCost)}</span>
                </div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-20 text-center text-neutral-400 italic">Nenhum produto cadastrado.</div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-neutral-900">Novo Produto</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Nome do Produto</label>
                  <input
                    type="text"
                    required
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: Caneca Personalizada"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Categoria</label>
                  <input
                    type="text"
                    required
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: Presentes"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Tempo de Produção (minutos)</label>
                  <input
                    type="number"
                    required
                    value={newProduct.productionTime || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, productionTime: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="Ex: 30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Custo de Embalagem</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProduct.packagingCost || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, packagingCost: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProduct.isPackage || false}
                    onChange={(e) => setNewProduct({ ...newProduct, isPackage: e.target.checked })}
                    className="w-5 h-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                  />
                  <span className="text-sm font-bold text-neutral-700">Este produto é um pacote/kit?</span>
                </label>

                {newProduct.isPackage && (
                  <div className="space-y-2 pt-2 border-t border-neutral-200">
                    <label className="text-sm font-bold text-neutral-700">Quantidade de itens no pacote</label>
                    <input
                      type="number"
                      min="2"
                      required={newProduct.isPackage}
                      value={newProduct.packageQuantity || ''}
                      onChange={(e) => setNewProduct({ ...newProduct, packageQuantity: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                      placeholder="Ex: 10"
                    />
                    <p className="text-xs text-neutral-500">
                      O custo total dos materiais e produção será dividido por essa quantidade ao calcular o preço unitário.
                    </p>
                  </div>
                )}
              </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-neutral-700">Adicionar Materiais</label>
                    <div className="flex items-center gap-2 w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus-within:ring-2 focus-within:ring-neutral-900">
                      <Search className="text-neutral-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Pesquisar material..."
                        className="bg-transparent border-none outline-none flex-1 text-sm"
                        value={materialSearchTerm}
                        onChange={(e) => setMaterialSearchTerm(e.target.value)}
                      />
                    </div>
                    
                    <div className="bg-white border border-neutral-200 rounded-xl max-h-48 overflow-y-auto">
                      {filteredMaterials.length > 0 ? (
                        filteredMaterials.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-0 flex items-center justify-between"
                            onClick={() => {
                              addMaterialToProduct(m.id);
                              setMaterialSearchTerm('');
                            }}
                          >
                            <span className="font-medium text-neutral-900">{m.name}</span>
                            <span className="text-xs text-neutral-400 uppercase font-bold">{m.unit}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-neutral-500 text-center">
                          Nenhum material encontrado.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-neutral-100">
                    <label className="text-sm font-bold text-neutral-700">Materiais Selecionados</label>
                    {newProduct.materials?.length === 0 && (
                      <p className="text-sm text-neutral-500 italic">Nenhum material selecionado.</p>
                    )}
                    {newProduct.materials?.map((pm) => {
                    const material = materials.find(m => m.id === pm.materialId);
                    return (
                      <div key={pm.materialId} className="flex items-center gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                        <div className="flex-1">
                          <span className="text-sm font-bold text-neutral-900">{material?.name}</span>
                          <div className="text-[10px] text-neutral-400 uppercase font-bold">{material?.unit}</div>
                        </div>
                        <div className="w-32">
                          <input
                            type="number"
                            step="0.01"
                            value={pm.quantity || ''}
                            onChange={(e) => updateMaterialQuantity(pm.materialId, Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm text-center font-bold outline-none focus:ring-2 focus:ring-neutral-900"
                            placeholder="Qtd"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMaterialFromProduct(pm.materialId)}
                          className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                  {newProduct.materials?.length === 0 && (
                    <div className="text-center py-6 border-2 border-dashed border-neutral-100 rounded-2xl text-neutral-400 text-xs italic">
                      Nenhum material adicionado ainda.
                    </div>
                  )}
                </div>

                {/* Finishing Options Section */}
                <div className="space-y-4 pt-6 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Acabamentos</label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Nome"
                      value={newFinishing.name}
                      onChange={(e) => setNewFinishing({ ...newFinishing, name: e.target.value })}
                      className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                    <input
                      type="number"
                      placeholder="Valor Adicional"
                      value={newFinishing.additionalValue || ''}
                      onChange={(e) => setNewFinishing({ ...newFinishing, additionalValue: Number(e.target.value) })}
                      className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                    <button
                      type="button"
                      onClick={addFinishingOption}
                      className="px-4 py-2 bg-neutral-100 text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {newProduct.finishingOptions?.map((option) => (
                      <div key={option.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                        <div>
                          <p className="text-sm font-bold text-neutral-900">{option.name}</p>
                          <p className="text-xs text-neutral-500">{formatCurrency(option.additionalValue)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFinishingOption(option.id)}
                          className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Accessories Section */}
                <div className="space-y-4 pt-6 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Acessórios</label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Nome"
                      value={newAccessory.name}
                      onChange={(e) => setNewAccessory({ ...newAccessory, name: e.target.value })}
                      className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                    <input
                      type="number"
                      placeholder="Valor Adicional"
                      value={newAccessory.additionalValue || ''}
                      onChange={(e) => setNewAccessory({ ...newAccessory, additionalValue: Number(e.target.value) })}
                      className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                    <button
                      type="button"
                      onClick={addAccessory}
                      className="px-4 py-2 bg-neutral-100 text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {newProduct.accessories?.map((accessory) => (
                      <div key={accessory.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                        <div>
                          <p className="text-sm font-bold text-neutral-900">{accessory.name}</p>
                          <p className="text-xs text-neutral-500">{formatCurrency(accessory.additionalValue)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAccessory(accessory.id)}
                          className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg"
                >
                  Cadastrar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 text-red-600">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Excluir Produto?</h3>
            </div>
            
            <p className="text-neutral-600 leading-relaxed">
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setProductToDelete(null)}
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
