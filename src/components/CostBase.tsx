import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CostBase } from '../types';
import { formatCurrency, formatPercent } from '../lib/utils';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Save, Info, Calculator, Loader2, AlertCircle, TrendingUp, Clock, DollarSign } from 'lucide-react';

export function CostBaseSettings() {
  const { activeStore } = useStore();
  const { user, isAdmin, isOperador } = useAuth();
  const { addToast } = useToast();
  const [costs, setCosts] = useState<CostBase>({
    fixedCosts: 0, productiveHours: 0, profitGoal: 0, hourlyRate: 0, storeId: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeStore) { setLoading(false); return; }
    getDoc(doc(db, 'costBases', activeStore.id)).then(snap => {
      setCosts(snap.exists() ? snap.data() as CostBase : { fixedCosts: 0, productiveHours: 0, profitGoal: 0, hourlyRate: 0, storeId: activeStore.id });
      setLoading(false);
    }).catch(e => { handleFirestoreError(e, OperationType.GET, `costBases/${activeStore.id}`); setLoading(false); });
  }, [activeStore]);

  const hourlyRate = costs.productiveHours > 0 ? costs.fixedCosts / costs.productiveHours : 0;
  const dailyRate = hourlyRate * 8;
  const weeklyRate = hourlyRate * 40;
  const minPricePerHour = hourlyRate * (1 + (costs.profitGoal || 0) / 100);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;
    setSaving(true);
    try {
      const updated = { ...costs, hourlyRate, storeId: activeStore.id };
      await setDoc(doc(db, 'costBases', activeStore.id), updated);
      setCosts(updated);
      addToast('Base de custos salva com sucesso!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `costBases/${activeStore.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (!activeStore) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center"><Calculator className="w-8 h-8 text-neutral-400" /></div>
      <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
      <p className="text-neutral-500">Você precisa selecionar uma loja para configurar a base de custos.</p>
    </div>
  );

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Base de Custos</h1>
        <p className="text-neutral-500 mt-1">Configure os parâmetros fundamentais para sua precificação.</p>
      </header>

      <form onSubmit={handleSave} className="bg-white p-10 rounded-3xl border border-neutral-200 shadow-sm space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">Custos Fixos Mensais <Info className="w-4 h-4 text-neutral-400" /></label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium">R$</span>
              <input type="number" value={costs.fixedCosts || ''} onChange={(e) => setCosts({ ...costs, fixedCosts: Number(e.target.value) })}
                className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none font-medium" placeholder="0,00" required />
            </div>
            <p className="text-[10px] text-neutral-400">Aluguel, luz, internet, MEI, etc.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">Horas Produtivas Mensais <Info className="w-4 h-4 text-neutral-400" /></label>
            <div className="relative">
              <input type="number" value={costs.productiveHours || ''} onChange={(e) => setCosts({ ...costs, productiveHours: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none font-medium" placeholder="Ex: 160" required />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-medium">horas</span>
            </div>
            <p className="text-[10px] text-neutral-400">Tempo real dedicado à produção por mês.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">Meta de Lucro (%) <Info className="w-4 h-4 text-neutral-400" /></label>
            <div className="relative">
              <input type="number" value={costs.profitGoal || ''} onChange={(e) => setCosts({ ...costs, profitGoal: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none font-medium" placeholder="Ex: 30" required />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium">%</span>
            </div>
            <p className="text-[10px] text-neutral-400">Margem de lucro desejada sobre o custo de produção.</p>
          </div>

          <div className="bg-neutral-900 p-6 rounded-2xl flex flex-col justify-center gap-2 text-white shadow-lg">
            <div className="flex items-center gap-2 text-neutral-400 text-xs font-bold uppercase tracking-wider">
              <Calculator className="w-4 h-4" /> Valor da Hora Trabalhada
            </div>
            <span className="text-3xl font-bold">{formatCurrency(hourlyRate)}</span>
            <p className="text-[10px] text-neutral-500">Calculado automaticamente com base nos custos fixos.</p>
          </div>
        </div>

        {/* Indicadores calculados */}
        {costs.fixedCosts > 0 && costs.productiveHours > 0 && (
          <div className="pt-6 border-t border-neutral-100 space-y-4">
            <h3 className="text-sm font-bold text-neutral-600 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Indicadores calculados</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Hora / custo', value: formatCurrency(hourlyRate), sub: 'apenas cobrir gastos', icon: Clock },
                { label: 'Hora / com lucro', value: formatCurrency(minPricePerHour), sub: `com ${costs.profitGoal}% de margem`, icon: TrendingUp },
                { label: 'Diária (8h)', value: formatCurrency(dailyRate), sub: 'custo puro', icon: DollarSign },
                { label: 'Semana (40h)', value: formatCurrency(weeklyRate), sub: 'custo puro', icon: Calculator },
              ].map((item, i) => (
                <div key={i} className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
                  <div className="flex items-center gap-1.5 text-neutral-400 mb-2"><item.icon className="w-3.5 h-3.5" /><span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span></div>
                  <p className="text-lg font-black text-neutral-900">{item.value}</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>

            {/* Análise de viabilidade */}
            <div className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${hourlyRate < 20 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">
                  {hourlyRate < 20 ? 'Custo por hora baixo — atenção!' : 'Base de custo saudável'}
                </p>
                <p className="text-xs opacity-80">
                  {hourlyRate < 20
                    ? `Sua hora custa R$ ${hourlyRate.toFixed(2)}, o que pode indicar que os custos fixos são baixos — mas certifique-se de incluir todos os gastos para não ter prejuízo.`
                    : `Com ${costs.productiveHours}h mensais e R$ ${costs.fixedCosts.toLocaleString('pt-BR')} em custos fixos, cada hora precisa gerar pelo menos ${formatCurrency(hourlyRate)} para cobrir despesas.`}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="pt-6 border-t border-neutral-100">
          {(!isAdmin && user?.role === 'OPERADOR') ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl text-sm font-medium flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" /> Você não tem permissão para alterar a base de custos.
            </div>
          ) : (
            <button type="submit" disabled={saving}
              className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all font-bold shadow-sm disabled:opacity-50">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Salvar Configurações
            </button>
          )}
        </div>
      </form>

      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex gap-4">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0"><Info className="w-5 h-5 text-blue-600" /></div>
        <div className="space-y-1">
          <h3 className="font-bold text-blue-900 text-sm">Por que isso é importante?</h3>
          <p className="text-blue-700 text-xs leading-relaxed">
            Saber o valor da sua hora é o primeiro passo para não ter prejuízo. Muitos artesãos esquecem de incluir o custo do tempo,
            o que acaba "comendo" o lucro real no final do mês. Com a meta de lucro definida aqui, o sistema calculará automaticamente
            o preço sugerido de cada produto — mas você pode sempre sobrescrever com um preço manual e ver as margens em tempo real.
          </p>
        </div>
      </div>
    </div>
  );
}
