import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, getDoc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, Material, CostBase, Channel, CHANNELS, Quote, Client, QuoteItem } from '../types';
import { formatCurrency, formatPercent, cn } from '../lib/utils';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { analyzePriceHealth, suggestIdealMargin, rewriteDescription } from '../services/gemini';
import { useToast } from '../contexts/ToastContext';
import {
  Calculator,
  Users,
  ShoppingCart,
  Sparkles,
  FileText,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Search,
  Download,
  Receipt,
  ChevronRight,
  Package,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Tag,
  Info,
} from 'lucide-react';
import { generateClientPDF, generateInternalPDF } from '../lib/pdf';

// ─── helpers ────────────────────────────────────────────────────────────────

function MarginBadge({ value }: { value: number }) {
  if (value < 0)
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700">Prejuízo</span>;
  if (value < 20)
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-yellow-100 text-yellow-700">Baixa</span>;
  if (value < 40)
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700">Razoável</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-green-100 text-green-700">Boa</span>;
}

function MarginBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = value < 0 ? '#dc2626' : value < 20 ? '#d97706' : value < 40 ? '#2563eb' : '#16a34a';
  return (
    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
      <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all duration-500" />
    </div>
  );
}

// ─── tipos extras ────────────────────────────────────────────────────────────

interface PriceMode {
  type: 'auto' | 'manual';
  manualPrice?: number;
}

// ─── componente principal ────────────────────────────────────────────────────

export function Pricing() {
  const { activeStore } = useStore();
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [costs, setCosts] = useState<CostBase | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientType, setClientType] = useState<'PF' | 'PJ'>('PF');
  const [cnpj, setCnpj] = useState('');
  const [channel, setChannel] = useState<Channel>('Venda Direta');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);

  // Items
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Modal item state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedFinishes, setSelectedFinishes] = useState<string[]>([]);
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [priceMode, setPriceMode] = useState<PriceMode>({ type: 'auto' });
  const [customMargin, setCustomMargin] = useState<number | null>(null);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // AI state
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDescription, setAiDescription] = useState('');

  // Quote state
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [generatedQuote, setGeneratedQuote] = useState<Quote | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteSuccess, setQuoteSuccess] = useState('');

  useEffect(() => {
    if (!activeStore) { setLoading(false); return; }

    const qP = query(collection(db, 'products'), where('storeId', '==', activeStore.id), orderBy('name', 'asc'));
    const unsubP = onSnapshot(qP, s => { setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product))); setLoading(false); }, e => { handleFirestoreError(e, OperationType.LIST, 'products'); setLoading(false); });

    const qM = query(collection(db, 'materials'), where('storeId', '==', activeStore.id), orderBy('name', 'asc'));
    const unsubM = onSnapshot(qM, s => setMaterials(s.docs.map(d => ({ id: d.id, ...d.data() } as Material))), e => handleFirestoreError(e, OperationType.LIST, 'materials'));

    const qC = query(collection(db, 'clients'), where('storeId', '==', activeStore.id), orderBy('name', 'asc'));
    const unsubC = onSnapshot(qC, s => setClients(s.docs.map(d => ({ id: d.id, ...d.data() } as Client))), e => handleFirestoreError(e, OperationType.LIST, 'clients'));

    getDoc(doc(db, 'costBases', activeStore.id)).then(snap => {
      setCosts(snap.exists() ? snap.data() as CostBase : { fixedCosts: 0, productiveHours: 0, profitGoal: 0, hourlyRate: 0, storeId: activeStore.id });
    }).catch(e => handleFirestoreError(e, OperationType.GET, `costBases/${activeStore.id}`));

    return () => { unsubP(); unsubM(); unsubC(); };
  }, [activeStore]);

  // ── cálculo central ─────────────────────────────────────────────────────

  const calculateItemCosts = (item: Partial<QuoteItem> & { priceModeOverride?: PriceMode }) => {
    const product = products.find(p => p.id === item.productId);
    if (!product || !costs) return null;

    const materialCost = (product.materials || []).reduce((acc, pm) => {
      const mat = materials.find(m => m.id === pm.materialId);
      return acc + (Number(mat?.unitCost) || 0) * (Number(pm.quantity) || 0);
    }, 0);

    const laborCost = ((Number(product.productionTime) || 0) / 60) * (Number(costs.hourlyRate) || 0);
    const packCost = Number(product.packagingCost) || 0;
    const totalProductionCost = materialCost + laborCost + packCost;

    const platformFeePercent = Number(CHANNELS[channel]) || 0;

    const finishingValue = (product.finishingOptions || [])
      .filter(o => item.selectedFinishingIds?.includes(o.id))
      .reduce((acc, o) => acc + (Number(o.additionalValue) || 0), 0);

    const accessoriesValue = (product.accessories || [])
      .filter(a => item.selectedAccessoryIds?.includes(a.id))
      .reduce((acc, a) => acc + (Number(a.additionalValue) || 0), 0);

    const mode = item.priceModeOverride ?? (item as any).priceModeData ?? { type: 'auto' };

    let baseUnitPrice: number;
    let realMarginOnPrice: number; // margem real sobre preço de venda (%)
    let marginOnCost: number; // margem sobre custo

    if (mode.type === 'manual' && mode.manualPrice != null && mode.manualPrice > 0) {
      // Preço digitado manualmente → calcula margens de volta
      baseUnitPrice = mode.manualPrice - finishingValue - accessoriesValue;
      const totalSalePrice = mode.manualPrice;
      const platformFeeVal = totalSalePrice * (platformFeePercent / 100);
      const profit = totalSalePrice - totalProductionCost - platformFeeVal;
      realMarginOnPrice = totalSalePrice > 0 ? (profit / totalSalePrice) * 100 : 0;
      marginOnCost = totalProductionCost > 0 ? (profit / totalProductionCost) * 100 : 0;
    } else {
      // Automático: usa margem configurada
      const margin = item.customMargin !== undefined && item.customMargin !== null
        ? Number(item.customMargin)
        : (Number(costs.profitGoal) || 0);
      const divisor = 1 - (platformFeePercent / 100) - (margin / 100);
      baseUnitPrice = divisor > 0 ? totalProductionCost / divisor : totalProductionCost * 2;
      const totalSalePrice = baseUnitPrice + finishingValue + accessoriesValue;
      const platformFeeVal = totalSalePrice * (platformFeePercent / 100);
      const profit = totalSalePrice - totalProductionCost - platformFeeVal;
      realMarginOnPrice = totalSalePrice > 0 ? (profit / totalSalePrice) * 100 : 0;
      marginOnCost = totalProductionCost > 0 ? (profit / totalProductionCost) * 100 : 0;
    }

    const unitPrice = (isFinite(baseUnitPrice) ? baseUnitPrice : 0) + finishingValue + accessoriesValue;
    const qty = Number(item.quantity) || 1;
    const totalPrice = unitPrice * qty;
    const platformFeeVal = totalPrice * (platformFeePercent / 100);
    const totalCost = totalProductionCost * qty;
    const itemProfit = totalPrice - totalCost - platformFeeVal;

    const isPackage = !!product.isPackage;
    const packageQuantity = Number(product.packageQuantity) || 1;
    const pricePerItem = isPackage ? unitPrice / packageQuantity : unitPrice;

    return {
      productId: product.id,
      productName: product.name || 'Produto sem nome',
      quantity: qty,
      unitPrice: isFinite(unitPrice) ? unitPrice : 0,
      totalPrice: isFinite(totalPrice) ? totalPrice : 0,
      basePrice: isFinite(baseUnitPrice) ? baseUnitPrice : 0,
      finishingValue: isFinite(finishingValue) ? finishingValue : 0,
      accessoriesValue: isFinite(accessoriesValue) ? accessoriesValue : 0,
      selectedFinishingIds: item.selectedFinishingIds || [],
      selectedAccessoryIds: item.selectedAccessoryIds || [],
      finishingNames: (product.finishingOptions || []).filter(o => item.selectedFinishingIds?.includes(o.id)).map(o => o.name),
      accessoryNames: (product.accessories || []).filter(a => item.selectedAccessoryIds?.includes(a.id)).map(a => a.name),
      itemProfit: isFinite(itemProfit) ? itemProfit : 0,
      itemTotalCost: isFinite(totalCost) ? totalCost : 0,
      itemPlatformFee: isFinite(platformFeeVal) ? platformFeeVal : 0,
      isPackage,
      packageQuantity,
      pricePerItem: isFinite(pricePerItem) ? pricePerItem : 0,
      customMargin: item.customMargin ?? null,
      priceModeData: mode,
      // métricas de análise
      materialCost,
      laborCost,
      productionCost: totalProductionCost,
      margin: realMarginOnPrice,
      marginOnCost,
      platformFee: platformFeePercent,
      // breakdown %
      materialPct: totalPrice > 0 ? (materialCost / totalPrice) * 100 : 0,
      laborPct: totalPrice > 0 ? (laborCost / totalPrice) * 100 : 0,
      packPct: totalPrice > 0 ? (packCost / totalPrice) * 100 : 0,
      feePct: totalPrice > 0 ? (platformFeeVal / totalPrice) * 100 : 0,
      profitPct: totalPrice > 0 ? (itemProfit / totalPrice) * 100 : 0,
    };
  };

  // Resultado do item atual no modal
  const currentItemResults = calculateItemCosts({
    productId: selectedProductId,
    quantity,
    selectedFinishingIds: selectedFinishes,
    selectedAccessoryIds: selectedAccessories,
    customMargin: customMargin !== null ? customMargin : undefined,
    priceModeOverride: priceMode,
  } as any);

  const allItemsResults = quoteItems
    .map(item => calculateItemCosts({ ...item, priceModeOverride: (item as any).priceModeData }))
    .filter(Boolean) as any[];

  const totalAmount = allItemsResults.reduce((acc, r) => acc + r.totalPrice, 0);
  const totalProfit = allItemsResults.reduce((acc, r) => acc + r.itemProfit, 0);
  const totalCostAll = allItemsResults.reduce((acc, r) => acc + r.itemTotalCost, 0);
  const avgMargin = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;

  // ── handlers ────────────────────────────────────────────────────────────

  const resetModal = () => {
    setSelectedProductId('');
    setQuantity(1);
    setSelectedFinishes([]);
    setSelectedAccessories([]);
    setCustomMargin(null);
    setPriceMode({ type: 'auto' });
    setEditingItemId(null);
    setAiAnalysis('');
  };

  const handleAddItem = () => {
    if (!currentItemResults) return;
    const newItem: QuoteItem & { priceModeData?: PriceMode } = {
      id: editingItemId || Math.random().toString(36).substr(2, 9),
      productId: currentItemResults.productId,
      productName: currentItemResults.productName,
      quantity: currentItemResults.quantity,
      unitPrice: currentItemResults.unitPrice,
      totalPrice: currentItemResults.totalPrice,
      basePrice: currentItemResults.basePrice,
      finishingValue: currentItemResults.finishingValue,
      accessoriesValue: currentItemResults.accessoriesValue,
      selectedFinishingIds: currentItemResults.selectedFinishingIds,
      selectedAccessoryIds: currentItemResults.selectedAccessoryIds,
      finishingNames: currentItemResults.finishingNames,
      accessoryNames: currentItemResults.accessoryNames,
      customMargin: priceMode.type === 'auto' ? customMargin : null,
      materialCost: currentItemResults.materialCost,
      laborCost: currentItemResults.laborCost,
      productionCost: currentItemResults.productionCost,
      margin: currentItemResults.margin,
      platformFee: currentItemResults.platformFee,
      priceModeData: priceMode,
    };
    if (editingItemId) {
      setQuoteItems(prev => prev.map(i => i.id === editingItemId ? newItem : i));
    } else {
      setQuoteItems(prev => [...prev, newItem]);
    }
    resetModal();
    setIsAddingItem(false);
  };

  const handleEditItem = (item: QuoteItem & { priceModeData?: PriceMode }) => {
    setSelectedProductId(item.productId);
    setQuantity(item.quantity);
    setSelectedFinishes(item.selectedFinishingIds);
    setSelectedAccessories(item.selectedAccessoryIds);
    setCustomMargin(item.customMargin ?? null);
    setPriceMode(item.priceModeData ?? { type: 'auto' });
    setEditingItemId(item.id);
    setIsAddingItem(true);
  };

  const handleUpdateItemQuantity = (id: string, delta: number) => {
    setQuoteItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const newQty = Math.max(1, item.quantity + delta);
      const r = calculateItemCosts({ ...item, quantity: newQty, priceModeOverride: (item as any).priceModeData } as any);
      return r ? { ...item, quantity: newQty, unitPrice: r.unitPrice, totalPrice: r.totalPrice } : item;
    }));
  };

  const handleRemoveItem = (index: number) => setQuoteItems(prev => prev.filter((_, i) => i !== index));

  const handleAnalyze = async () => {
    if (!currentItemResults) return;
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;
    setAiLoading(true);
    try {
      const analysis = await analyzePriceHealth(product.name, currentItemResults.itemTotalCost, currentItemResults.unitPrice, currentItemResults.margin);
      setAiAnalysis(analysis || '');
    } catch { setAiAnalysis('Erro ao analisar preço.'); }
    setAiLoading(false);
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClientId(client.id);
    setClientName(client.name);
    setClientType(client.type);
    if (client.type === 'PJ') setCnpj(client.document);
    setClientSearch(client.name);
    setShowClientList(false);
  };

  const handleGenerateQuote = async () => {
    if (isGenerating) return;
    setQuoteError('');
    setQuoteSuccess('');
    if (!activeStore) { setQuoteError('Nenhuma loja ativa.'); return; }
    if (quoteItems.length === 0) { setQuoteError('Adicione pelo menos um item.'); return; }
    if (!clientName.trim()) { setQuoteError('Nome do cliente é obrigatório.'); return; }

    setIsGenerating(true);
    try {
      const quoteData: any = {
        storeId: activeStore.id,
        date: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        clientName: clientName.trim(),
        clientType,
        items: allItemsResults.map(r => ({
          id: Math.random().toString(36).substr(2, 9),
          productId: r.productId, productName: r.productName,
          quantity: r.quantity, unitPrice: r.unitPrice, totalPrice: r.totalPrice,
          basePrice: r.basePrice, finishingValue: r.finishingValue, accessoriesValue: r.accessoriesValue,
          selectedFinishingIds: r.selectedFinishingIds, selectedAccessoryIds: r.selectedAccessoryIds,
          finishingNames: r.finishingNames, accessoryNames: r.accessoryNames,
          customMargin: r.customMargin, materialCost: r.materialCost, laborCost: r.laborCost,
          productionCost: r.productionCost, margin: r.margin, platformFee: r.platformFee,
          priceModeData: r.priceModeData,
        })),
        totalAmount: isFinite(totalAmount) ? totalAmount : 0,
        totalProfit: isFinite(totalProfit) ? totalProfit : 0,
        avgMargin: isFinite(avgMargin) ? avgMargin : 0,
        channel, status: 'Pendente', followUpStatus: 'Pendente',
        createdBy: user?.id || 'unknown', createdByName: user?.name || 'Sistema',
      };
      if (selectedClientId) quoteData.clientId = selectedClientId;
      if (clientType === 'PJ' && cnpj) quoteData.cnpj = cnpj;

      const hasPermission = isAdmin || (user?.storeIds && user.storeIds.includes(activeStore.id));
      if (!hasPermission) throw new Error('Sem permissão para gerar orçamentos nesta loja.');

      const docRef = await addDoc(collection(db, 'quotes'), quoteData);
      setGeneratedQuote({ ...quoteData, id: docRef.id } as Quote);
      setQuoteSuccess('Orçamento criado com sucesso!');
      setShowQuoteModal(true);

      try {
        const first = allItemsResults[0];
        const desc = await rewriteDescription({ productName: first.productName, clientName, quantity: first.quantity });
        setAiDescription(desc || '');
      } catch { /* optional */ }

      setQuoteItems([]);
      setSelectedClientId('');
      setClientName('');
      setCnpj('');
      setClientSearch('');
    } catch (error: any) {
      let msg = error.message || 'Erro ao gerar orçamento.';
      try { const p = JSON.parse(msg); if (p.error) msg = p.error; } catch { }
      setQuoteError(msg);
      handleFirestoreError(error, OperationType.CREATE, 'quotes');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── guards ───────────────────────────────────────────────────────────────

  if (!activeStore) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center"><Calculator className="w-8 h-8 text-neutral-400" /></div>
      <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
      <p className="text-neutral-500">Você precisa selecionar uma loja para realizar orçamentos.</p>
    </div>
  );

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  if (!costs) return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <AlertCircle className="w-12 h-12 text-neutral-300" />
      <h2 className="text-xl font-bold text-neutral-900">Configure sua Base de Custos primeiro</h2>
      <p className="text-neutral-500 max-w-xs">Defina seus custos fixos e horas produtivas antes de precificar.</p>
    </div>
  );

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-neutral-400">
            <Calculator className="w-5 h-5" />
            <span className="text-sm font-bold uppercase tracking-widest">Calculadora de Orçamentos</span>
          </div>
          <h1 className="text-4xl font-black text-neutral-900 tracking-tight">Novo Orçamento</h1>
        </div>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel)}
          className="px-4 py-3 bg-white border-2 border-neutral-100 rounded-2xl text-sm font-bold text-neutral-700 outline-none focus:border-neutral-900 transition-all shadow-sm"
        >
          {Object.keys(CHANNELS).map(c => <option key={c} value={c}>{c} ({CHANNELS[c as Channel]}%)</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Form */}
        <div className="lg:col-span-2 space-y-8">
          {/* Cliente */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-neutral-100 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center"><Users className="w-5 h-5 text-white" /></div>
              <h2 className="text-xl font-bold text-neutral-900">Dados do Cliente</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 relative">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Buscar ou Nome do Cliente</label>
                <div className="relative">
                  <input type="text" value={clientSearch}
                    onChange={(e) => { setClientSearch(e.target.value); setClientName(e.target.value); setShowClientList(true); }}
                    onFocus={() => setShowClientList(true)}
                    placeholder="Ex: João Silva ou Empresa ABC"
                    className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 placeholder-neutral-300 outline-none focus:bg-white focus:border-neutral-900 transition-all"
                  />
                  <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
                </div>
                {showClientList && clientSearch && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-neutral-100 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
                    {clients.filter(c => (c.name || '').toLowerCase().includes(clientSearch.toLowerCase())).map(client => (
                      <button key={client.id} onClick={() => handleSelectClient(client)}
                        className="w-full px-5 py-4 text-left hover:bg-neutral-50 flex items-center justify-between group transition-colors">
                        <div>
                          <p className="font-bold text-neutral-900">{client.name}</p>
                          <p className="text-xs text-neutral-400">{client.type} • {client.document || 'Sem documento'}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-200 group-hover:text-neutral-400" />
                      </button>
                    ))}
                    {clients.filter(c => (c.name || '').toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                      <div className="px-5 py-4 text-sm text-neutral-400 italic">Nenhum cliente encontrado. Continue digitando para cadastrar novo.</div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Tipo de Cliente</label>
                <div className="flex bg-neutral-50 p-1 rounded-2xl border-2 border-transparent focus-within:border-neutral-900 transition-all">
                  {(['PF', 'PJ'] as const).map(t => (
                    <button key={t} onClick={() => setClientType(t)}
                      className={cn('flex-1 py-3 rounded-xl text-sm font-bold transition-all', clientType === t ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-neutral-600')}>
                      {t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                    </button>
                  ))}
                </div>
              </div>
              {clientType === 'PJ' && (
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">CNPJ (Opcional)</label>
                  <input type="text" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00"
                    className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 placeholder-neutral-300 outline-none focus:bg-white focus:border-neutral-900 transition-all" />
                </div>
              )}
            </div>
          </div>

          {/* Itens */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-neutral-100 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center"><Package className="w-5 h-5 text-white" /></div>
                <h2 className="text-xl font-bold text-neutral-900">Itens do Orçamento</h2>
              </div>
              <button onClick={() => { resetModal(); setIsAddingItem(true); }}
                className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all flex items-center gap-2">
                <Plus className="w-4 h-4" /> Adicionar Item
              </button>
            </div>

            {quoteItems.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-neutral-100 rounded-[32px] space-y-3">
                <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mx-auto"><Package className="w-6 h-6 text-neutral-200" /></div>
                <p className="text-neutral-400 text-sm font-medium">Nenhum item adicionado ainda.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {quoteItems.map((item, index) => {
                  const r = calculateItemCosts({ ...item, priceModeOverride: (item as any).priceModeData } as any);
                  const isManual = (item as any).priceModeData?.type === 'manual';
                  return (
                    <div key={item.id} className="group flex items-center justify-between p-5 bg-neutral-50 rounded-2xl border border-neutral-100 hover:border-neutral-200 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-row sm:flex-col items-center gap-1 bg-white p-1 rounded-xl border border-neutral-100">
                          <button onClick={() => handleUpdateItemQuantity(item.id, -1)} className="p-1 hover:bg-neutral-50 rounded">
                            <ArrowRight className="w-3 h-3 text-neutral-400 rotate-180" />
                          </button>
                          <div className="w-8 h-8 flex items-center justify-center font-black text-neutral-900 text-sm">{item.quantity}</div>
                          <button onClick={() => handleUpdateItemQuantity(item.id, 1)} className="p-1 hover:bg-neutral-50 rounded">
                            <Plus className="w-3 h-3 text-neutral-400" />
                          </button>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-neutral-900">{r?.productName}</p>
                            {isManual && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">Preço Manual</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 mt-0.5">
                            <span>{formatCurrency(r?.unitPrice || 0)} / un</span>
                            <span className={cn('font-bold', (r?.margin || 0) < 0 ? 'text-red-500' : (r?.margin || 0) < 20 ? 'text-yellow-600' : 'text-green-600')}>
                              {(r?.margin || 0).toFixed(1)}% margem
                            </span>
                          </div>
                          <MarginBar value={r?.margin || 0} />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-black text-neutral-900">{formatCurrency(r?.totalPrice || 0)}</p>
                          <p className={cn('text-xs font-bold', (r?.itemProfit || 0) < 0 ? 'text-red-500' : 'text-green-600')}>
                            lucro: {formatCurrency(r?.itemProfit || 0)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEditItem(item as any)} className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors"><FileText className="w-5 h-5" /></button>
                          <button onClick={() => handleRemoveItem(index)} className="p-2 text-neutral-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-neutral-100 space-y-8 sticky top-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center"><Receipt className="w-5 h-5 text-white" /></div>
              <h2 className="text-xl font-bold text-neutral-900">Resumo</h2>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400 font-bold uppercase tracking-wider">Faturamento</span>
                <span className="text-neutral-900 font-black">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400 font-bold uppercase tracking-wider">Custo Total</span>
                <span className="text-neutral-900 font-black">{formatCurrency(totalCostAll)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400 font-bold uppercase tracking-wider">Lucro Total</span>
                <span className={cn('font-black', totalProfit < 0 ? 'text-red-600' : 'text-green-600')}>{formatCurrency(totalProfit)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-neutral-400 font-bold uppercase tracking-wider">Margem Média</span>
                <MarginBadge value={avgMargin} />
              </div>
              <MarginBar value={avgMargin} />
              <div className="h-px bg-neutral-100" />
              <div className="flex justify-between items-end">
                <span className="text-neutral-400 font-bold uppercase tracking-wider text-xs mb-1">Total Geral</span>
                <span className="text-3xl font-black text-neutral-900">{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {quoteError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-medium flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{quoteError}
              </div>
            )}

            <button onClick={handleGenerateQuote} disabled={isGenerating || quoteItems.length === 0}
              className="w-full py-5 bg-neutral-900 text-white rounded-2xl font-black text-lg hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-neutral-200">
              {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <><FileText className="w-6 h-6" /> Gerar Orçamento</>}
            </button>
            <p className="text-[10px] text-center text-neutral-400 font-bold uppercase tracking-widest">
              Válido por 5 dias • Taxa {CHANNELS[channel]}% ({channel})
            </p>

            {quoteItems.length > 0 && (
              <div className="pt-8 border-t border-neutral-100 space-y-4">
                <div className="flex items-center gap-2 text-neutral-900">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Análise de Saúde</span>
                </div>
                <div className="p-4 bg-neutral-50 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase">Margem Média</span>
                    <MarginBadge value={avgMargin} />
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    <span className="font-bold text-neutral-900">{formatPercent(avgMargin)}</span> sobre o preço de venda.{' '}
                    {avgMargin < 0 ? ' Atenção: prejuízo! Revise o preço dos itens.' :
                      avgMargin < 20 ? ' Margem baixa — considere aumentar o preço ou reduzir custos.' :
                        avgMargin < 40 ? ' Margem razoável. Há espaço para crescimento.' :
                          ' Excelente! Preço competitivo com ótima rentabilidade.'}
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-white rounded-xl p-2 text-center border border-neutral-100">
                      <p className="text-[10px] text-neutral-400">Custo/Venda</p>
                      <p className="text-sm font-black">{totalAmount > 0 ? ((totalCostAll / totalAmount) * 100).toFixed(0) : 0}%</p>
                    </div>
                    <div className="bg-white rounded-xl p-2 text-center border border-neutral-100">
                      <p className="text-[10px] text-neutral-400">Itens</p>
                      <p className="text-sm font-black">{quoteItems.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal Adicionar/Editar Item ─────────────────────────────── */}
      {isAddingItem && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl p-8 space-y-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
                  {editingItemId ? <FileText className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                </div>
                <h2 className="text-xl font-bold text-neutral-900">{editingItemId ? 'Editar Item' : 'Adicionar Item'}</h2>
              </div>
              <button onClick={() => { setIsAddingItem(false); resetModal(); }} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Produto + Quantidade */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Produto</label>
                  <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 transition-all">
                    <option value="">Selecione um produto</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Quantidade</label>
                  <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Margem Personalizada (%)</label>
                  <input type="number" value={priceMode.type === 'auto' && customMargin !== null ? customMargin : ''}
                    onChange={(e) => { setPriceMode({ type: 'auto' }); setCustomMargin(e.target.value === '' ? null : Number(e.target.value)); }}
                    placeholder={`Padrão (${costs?.profitGoal ?? 0}%)`}
                    disabled={priceMode.type === 'manual'}
                    className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 transition-all disabled:opacity-40" />
                </div>
              </div>

              {/* ── MODO PREÇO MANUAL ─── */}
              <div className="rounded-2xl border-2 border-neutral-100 overflow-hidden">
                <div className="flex">
                  <button onClick={() => setPriceMode({ type: 'auto' })}
                    className={cn('flex-1 py-3 text-sm font-bold transition-all', priceMode.type === 'auto' ? 'bg-neutral-900 text-white' : 'bg-neutral-50 text-neutral-400 hover:text-neutral-700')}>
                    Calcular automaticamente
                  </button>
                  <button onClick={() => setPriceMode({ type: 'manual', manualPrice: currentItemResults?.unitPrice || 0 })}
                    className={cn('flex-1 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2', priceMode.type === 'manual' ? 'bg-neutral-900 text-white' : 'bg-neutral-50 text-neutral-400 hover:text-neutral-700')}>
                    <Tag className="w-4 h-4" /> Definir preço manualmente
                  </button>
                </div>

                {priceMode.type === 'manual' && (
                  <div className="p-5 bg-blue-50 border-t border-blue-100 space-y-3">
                    <label className="text-xs font-bold text-blue-700 uppercase tracking-wider">Preço de venda por unidade (R$)</label>
                    <input
                      type="number" min="0" step="0.5"
                      value={priceMode.manualPrice ?? ''}
                      onChange={(e) => setPriceMode({ type: 'manual', manualPrice: parseFloat(e.target.value) || 0 })}
                      placeholder="0,00"
                      className="w-full px-5 py-4 bg-white border-2 border-blue-200 rounded-2xl text-neutral-900 text-xl font-black outline-none focus:border-blue-500 transition-all"
                    />
                    <p className="text-[11px] text-blue-600 flex items-center gap-1">
                      <Info className="w-3 h-3" /> As margens e lucros serão calculados automaticamente com base neste preço.
                    </p>
                  </div>
                )}
              </div>

              {/* Acabamentos */}
              {selectedProduct?.finishingOptions && selectedProduct.finishingOptions.length > 0 && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Acabamentos</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedProduct.finishingOptions.map(opt => (
                      <button key={opt.id}
                        onClick={() => setSelectedFinishes(prev => prev.includes(opt.id) ? prev.filter(id => id !== opt.id) : [...prev, opt.id])}
                        className={cn('p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between',
                          selectedFinishes.includes(opt.id) ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-100 bg-neutral-50 text-neutral-600 hover:border-neutral-200')}>
                        <div><p className="text-sm font-bold">{opt.name}</p><p className="text-[10px] text-neutral-400">+{formatCurrency(opt.additionalValue)}</p></div>
                        {selectedFinishes.includes(opt.id) && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Acessórios */}
              {selectedProduct?.accessories && selectedProduct.accessories.length > 0 && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Acessórios</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedProduct.accessories.map(acc => (
                      <button key={acc.id}
                        onClick={() => setSelectedAccessories(prev => prev.includes(acc.id) ? prev.filter(id => id !== acc.id) : [...prev, acc.id])}
                        className={cn('p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between',
                          selectedAccessories.includes(acc.id) ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-100 bg-neutral-50 text-neutral-600 hover:border-neutral-200')}>
                        <div><p className="text-sm font-bold">{acc.name}</p><p className="text-[10px] text-neutral-400">+{formatCurrency(acc.additionalValue)}</p></div>
                        {selectedAccessories.includes(acc.id) && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Painel de Análise do Item ── */}
              {currentItemResults && selectedProductId && (
                <div className="rounded-2xl bg-neutral-50 border border-neutral-100 overflow-hidden">
                  <div className="p-5 space-y-4">
                    <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">Análise do item</p>

                    {/* Métricas principais */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Custo Total', value: formatCurrency(currentItemResults.productionCost), icon: ShoppingCart, sub: 'mat + MO + embal.' },
                        { label: 'Preço Unitário', value: formatCurrency(currentItemResults.unitPrice), icon: DollarSign, sub: 'ao cliente' },
                        { label: 'Lucro/Un.', value: formatCurrency(currentItemResults.itemProfit / currentItemResults.quantity), icon: currentItemResults.itemProfit >= 0 ? TrendingUp : TrendingDown, sub: currentItemResults.itemProfit >= 0 ? 'positivo' : 'negativo', color: currentItemResults.itemProfit >= 0 ? 'text-green-600' : 'text-red-600' },
                        { label: 'Margem Real', value: `${currentItemResults.margin.toFixed(1)}%`, icon: Calculator, sub: 'sobre preço', color: currentItemResults.margin < 0 ? 'text-red-600' : currentItemResults.margin < 20 ? 'text-yellow-600' : 'text-green-600' },
                      ].map((m, i) => (
                        <div key={i} className="bg-white rounded-xl p-3 border border-neutral-100 text-center">
                          <p className="text-[10px] text-neutral-400 mb-1">{m.label}</p>
                          <p className={cn('text-sm font-black', m.color || 'text-neutral-900')}>{m.value}</p>
                          <p className="text-[9px] text-neutral-400 mt-0.5">{m.sub}</p>
                        </div>
                      ))}
                    </div>

                    {/* Breakdown da composição */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase">Composição do preço</p>
                      {[
                        { label: 'Materiais', pct: currentItemResults.materialPct, color: '#171717' },
                        { label: 'Mão de obra', pct: currentItemResults.laborPct, color: '#404040' },
                        { label: 'Embalagem', pct: currentItemResults.packPct, color: '#737373' },
                        { label: `Taxa ${channel}`, pct: currentItemResults.feePct, color: '#a3a3a3' },
                        { label: 'Lucro', pct: currentItemResults.profitPct, color: currentItemResults.profitPct < 0 ? '#dc2626' : '#16a34a' },
                      ].filter(i => i.pct > 0.1).map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[11px] text-neutral-500 w-24 flex-shrink-0">{item.label}</span>
                          <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                            <div style={{ width: `${Math.max(0, Math.min(100, item.pct))}%`, background: item.color }} className="h-full rounded-full transition-all duration-500" />
                          </div>
                          <span className="text-[11px] font-bold text-neutral-700 w-10 text-right">{item.pct.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>

                    {/* Alerta de margem */}
                    {currentItemResults.margin < 0 && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs font-medium flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        Preço abaixo do custo! Prejuízo de {formatCurrency(Math.abs(currentItemResults.itemProfit / currentItemResults.quantity))} por unidade.
                      </div>
                    )}
                    {currentItemResults.margin >= 0 && currentItemResults.margin < 20 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-xl text-yellow-700 text-xs font-medium flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        Margem baixa. Para um negócio sustentável, recomenda-se pelo menos 30%.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* IA */}
              {selectedProductId && (
                <div className="flex gap-2">
                  <button onClick={handleAnalyze} disabled={aiLoading || !currentItemResults}
                    className="flex-1 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Analisar com IA
                  </button>
                </div>
              )}
              {aiAnalysis && (
                <div className="p-4 bg-neutral-50 rounded-2xl text-sm text-neutral-600 leading-relaxed border border-neutral-100">
                  <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-neutral-400" /><span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Análise IA</span></div>
                  {aiAnalysis}
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div className="pt-6 border-t border-neutral-100 flex items-center justify-between">
              <div className="text-left">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Total do Item</p>
                <p className="text-2xl font-black text-neutral-900">{formatCurrency(currentItemResults?.totalPrice || 0)}</p>
                {currentItemResults && (
                  <p className={cn('text-xs font-bold', currentItemResults.margin < 0 ? 'text-red-500' : 'text-green-600')}>
                    {currentItemResults.margin.toFixed(1)}% de margem
                  </p>
                )}
              </div>
              <button onClick={handleAddItem} disabled={!selectedProductId}
                className="px-8 py-4 bg-neutral-900 text-white rounded-2xl font-black hover:bg-black transition-all disabled:opacity-50">
                {editingItemId ? 'Salvar Alterações' : 'Confirmar Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Orçamento Gerado ───────────────────────────────── */}
      {showQuoteModal && generatedQuote && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl p-10 space-y-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-neutral-900 rounded-2xl flex items-center justify-center text-white font-black text-2xl">Q</div>
                <div>
                  <h2 className="text-3xl font-black text-neutral-900">Orçamento Gerado</h2>
                  <p className="text-sm text-neutral-400 font-bold uppercase tracking-widest mt-1">Válido até {new Date(generatedQuote.expiryDate).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <button onClick={() => setShowQuoteModal(false)} className="p-2 hover:bg-neutral-100 rounded-full"><X className="w-6 h-6 text-neutral-400" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="md:col-span-2 space-y-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Itens do Orçamento</h3>
                  <div className="border border-neutral-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-neutral-50 border-b border-neutral-100">
                        <tr>
                          <th className="px-5 py-3 text-[10px] font-black text-neutral-400 uppercase">Item</th>
                          <th className="px-5 py-3 text-[10px] font-black text-neutral-400 uppercase text-center">Qtd</th>
                          <th className="px-5 py-3 text-[10px] font-black text-neutral-400 uppercase text-right">Unitário</th>
                          <th className="px-5 py-3 text-[10px] font-black text-neutral-400 uppercase text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {generatedQuote.items.map((item, i) => (
                          <tr key={i}>
                            <td className="px-5 py-4">
                              <p className="font-bold text-neutral-900 text-sm">{item.productName}</p>
                              {(item as any).priceModeData?.type === 'manual' && <span className="text-[10px] text-blue-600 font-bold">Preço manual</span>}
                            </td>
                            <td className="px-5 py-4 text-center font-bold text-neutral-900 text-sm">{item.quantity}</td>
                            <td className="px-5 py-4 text-right text-neutral-500 text-sm">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-5 py-4 text-right font-black text-neutral-900 text-sm">{formatCurrency(item.totalPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Resumo financeiro expandido */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Custo Total', value: formatCurrency(totalCostAll || generatedQuote.items.reduce((a, i) => a + (i.productionCost || 0) * i.quantity, 0)) },
                    { label: 'Lucro Total', value: formatCurrency(generatedQuote.totalProfit), color: generatedQuote.totalProfit < 0 ? 'text-red-600' : 'text-green-600' },
                    { label: 'Margem Média', value: formatPercent(generatedQuote.avgMargin), color: generatedQuote.avgMargin < 20 ? 'text-yellow-600' : 'text-green-600' },
                  ].map((s, i) => (
                    <div key={i} className="bg-neutral-50 rounded-2xl p-4 text-center border border-neutral-100">
                      <p className="text-[10px] text-neutral-400 font-bold uppercase mb-1">{s.label}</p>
                      <p className={cn('text-lg font-black', s.color || 'text-neutral-900')}>{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className="p-6 bg-neutral-50 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-neutral-900 mb-2">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Descrição Inteligente</span>
                  </div>
                  <p className="text-sm text-neutral-600 leading-relaxed italic">
                    "{generatedQuote.description || aiDescription || 'Este orçamento foi cuidadosamente calculado para oferecer o melhor custo-benefício para o seu projeto.'}"
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-neutral-900 p-8 rounded-[32px] text-white space-y-6">
                  <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Resumo Financeiro</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-neutral-400">Total Bruto</span>
                      <span className="font-black text-lg">{formatCurrency(generatedQuote.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-neutral-400">Canal ({generatedQuote.channel})</span>
                      <span className="font-bold">+{CHANNELS[generatedQuote.channel as Channel]}%</span>
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="flex justify-between items-end">
                      <span className="text-xs text-neutral-400 mb-1">Total Final</span>
                      <span className="text-3xl font-black">{formatCurrency(generatedQuote.totalAmount)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button onClick={() => { try { generateClientPDF(generatedQuote, activeStore); addToast('PDF gerado!', 'success'); } catch { addToast('Erro ao gerar PDF', 'error'); } }}
                    className="w-full py-4 bg-neutral-100 text-neutral-900 rounded-2xl font-black text-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2">
                    <Download className="w-5 h-5" /> Baixar PDF Cliente
                  </button>
                  <button onClick={() => { try { generateInternalPDF(generatedQuote, activeStore); addToast('PDF gerado!', 'success'); } catch { addToast('Erro ao gerar PDF', 'error'); } }}
                    className="w-full py-4 bg-neutral-50 text-neutral-400 rounded-2xl font-bold text-xs hover:bg-neutral-100 transition-all flex items-center justify-center gap-2">
                    <FileText className="w-4 h-4" /> Relatório Interno
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-8 border-t border-neutral-100">
              <button onClick={() => { setShowQuoteModal(false); setQuoteItems([]); setClientName(''); setClientSearch(''); setSelectedClientId(''); setCnpj(''); }}
                className="px-10 py-4 bg-neutral-900 text-white rounded-2xl font-black text-lg hover:bg-black transition-all shadow-xl shadow-neutral-200">
                Concluir e Novo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
