import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Quote, CHANNELS, Channel } from '../types';
import { formatCurrency, formatPercent, cn } from '../lib/utils';
import { useStore } from '../contexts/StoreContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, PieChart, Pie, Legend,
} from 'recharts';
import { TrendingUp, DollarSign, PieChart as PieIcon, Clock, ArrowRight, TrendingDown, ShoppingBag, AlertTriangle, CheckCircle2, Package } from 'lucide-react';

function StatCard({ label, value, sub, icon: Icon, color = 'text-neutral-900', bg = '' }: any) {
  return (
    <div className={`bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex flex-col gap-3 ${bg}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-500">{label}</span>
        <Icon className={cn('w-5 h-5', color)} />
      </div>
      <span className={cn('text-2xl font-bold', color)}>{value}</span>
      {sub && <span className="text-xs text-neutral-400">{sub}</span>}
    </div>
  );
}

function MarginBadge({ value }: { value: number }) {
  if (value < 0) return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700">Prejuízo</span>;
  if (value < 20) return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-yellow-100 text-yellow-700">Baixa</span>;
  if (value < 40) return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700">Razoável</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-green-100 text-green-700">Boa</span>;
}

const STATUS_COLORS: Record<string, string> = {
  'Pendente': 'bg-yellow-100 text-yellow-700',
  'Aprovado': 'bg-green-100 text-green-700',
  'Em produção': 'bg-blue-100 text-blue-700',
  'Finalizado': 'bg-neutral-100 text-neutral-700',
};

export function Dashboard() {
  const { activeStore } = useStore();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7' | '30' | '90' | 'all'>('30');

  useEffect(() => {
    if (!activeStore) { setLoading(false); setQuotes([]); return; }
    const q = query(collection(db, 'quotes'), where('storeId', '==', activeStore.id), orderBy('date', 'desc'), limit(200));
    const unsub = onSnapshot(q, snap => {
      setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quote)));
      setLoading(false);
    }, e => { handleFirestoreError(e, OperationType.LIST, 'quotes'); setLoading(false); });
    return () => unsub();
  }, [activeStore]);

  // filtrar por período
  const cutoff = period === 'all' ? null : new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000);
  const filtered = cutoff ? quotes.filter(q => new Date(q.date) >= cutoff) : quotes;

  const totalRevenue = filtered.reduce((a, q) => a + (q.totalAmount || 0), 0);
  const totalProfit = filtered.reduce((a, q) => a + (q.totalProfit || 0), 0);
  const avgMargin = filtered.length > 0 ? filtered.reduce((a, q) => a + (q.avgMargin || 0), 0) / filtered.length : 0;
  const pendentes = filtered.filter(q => q.status === 'Pendente').length;
  const aprovados = filtered.filter(q => q.status === 'Aprovado' || q.status === 'Em produção').length;
  const conversionRate = filtered.length > 0 ? (aprovados / filtered.length) * 100 : 0;

  // canal mais rentável
  const byChannel = filtered.reduce((acc: any, q) => {
    const ch = q.channel || 'Outro';
    if (!acc[ch]) acc[ch] = { revenue: 0, profit: 0, count: 0 };
    acc[ch].revenue += q.totalAmount || 0;
    acc[ch].profit += q.totalProfit || 0;
    acc[ch].count++;
    return acc;
  }, {});
  const channelData = Object.entries(byChannel).map(([name, v]: any) => ({ name, ...v, margin: v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0 }));

  // produtos mais vendidos
  const productStats = filtered.reduce((acc: any, q) => {
    (q.items || []).forEach(item => {
      if (!acc[item.productName]) acc[item.productName] = { qty: 0, revenue: 0 };
      acc[item.productName].qty += item.quantity;
      acc[item.productName].revenue += item.totalPrice;
    });
    return acc;
  }, {});
  const chartData = Object.entries(productStats).map(([name, v]: any) => ({ name, ...v })).sort((a: any, b: any) => b.qty - a.qty).slice(0, 6);

  // evolução por semana (últimas 8 semanas)
  const weeklyData = (() => {
    const weeks: any = {};
    filtered.forEach(q => {
      const d = new Date(q.date);
      const monday = new Date(d);
      monday.setDate(d.getDate() - d.getDay() + 1);
      const key = monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!weeks[key]) weeks[key] = { week: key, revenue: 0, profit: 0 };
      weeks[key].revenue += q.totalAmount || 0;
      weeks[key].profit += q.totalProfit || 0;
    });
    return Object.values(weeks).slice(-8);
  })();

  const COLORS = ['#171717', '#404040', '#737373', '#a3a3a3', '#d4d4d4', '#e5e5e5'];

  if (loading) return (
    <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">{[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-neutral-200 rounded-2xl" />)}</div>
      <div className="h-96 bg-neutral-200 rounded-2xl" />
    </div>
  );

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Dashboard</h1>
          <p className="text-neutral-500 mt-1">Visão geral do desempenho do seu ateliê.</p>
        </div>
        <div className="flex bg-neutral-100 p-1 rounded-xl gap-1">
          {([['7', '7d'], ['30', '30d'], ['90', '90d'], ['all', 'Tudo']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setPeriod(v)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all', period === v ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-neutral-700')}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Faturamento" value={formatCurrency(totalRevenue)} sub={`${filtered.length} orçamento${filtered.length !== 1 ? 's' : ''}`} icon={DollarSign} />
        <StatCard label="Lucro Líquido" value={formatCurrency(totalProfit)} sub={`${formatPercent(avgMargin)} margem média`} icon={TrendingUp} color={totalProfit < 0 ? 'text-red-600' : 'text-green-600'} />
        <StatCard label="Margem Média" value={formatPercent(avgMargin)} sub={avgMargin >= 30 ? 'Excelente!' : avgMargin >= 15 ? 'Razoável' : 'Atenção!'} icon={PieIcon} color={avgMargin < 15 ? 'text-red-500' : avgMargin < 30 ? 'text-yellow-600' : 'text-green-600'} />
        <StatCard label="Taxa de Conversão" value={`${conversionRate.toFixed(0)}%`} sub={`${aprovados} aprovados / ${pendentes} pendentes`} icon={CheckCircle2} color={conversionRate < 30 ? 'text-yellow-600' : 'text-green-600'} />
      </div>

      {/* Alerta de atenção */}
      {avgMargin < 15 && filtered.length > 0 && (
        <div className="p-5 bg-yellow-50 border border-yellow-200 rounded-2xl flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-yellow-800">Atenção: margem média baixa ({formatPercent(avgMargin)})</p>
            <p className="text-sm text-yellow-700 mt-0.5">Revise o preço dos seus produtos ou utilize o modo "preço manual" nos orçamentos para analisar a rentabilidade de cada item.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Produtos mais vendidos */}
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Package className="w-5 h-5 text-neutral-400" />
            <h2 className="text-lg font-bold">Produtos Mais Orçados</h2>
          </div>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-neutral-400 italic text-sm">Nenhum dado ainda.</div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f5f5f5" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f5f5f5' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    formatter={(v: any, name: string) => [name === 'qty' ? `${v} un` : formatCurrency(v), name === 'qty' ? 'Qtd' : 'Receita']} />
                  <Bar dataKey="qty" radius={[0, 4, 4, 0]} barSize={18}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Evolução semanal */}
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-neutral-400" />
            <h2 className="text-lg font-bold">Evolução Semanal</h2>
          </div>
          {weeklyData.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-neutral-400 italic text-sm">Nenhum dado ainda.</div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    formatter={(v: any) => [formatCurrency(v)]} />
                  <Legend formatter={(v) => v === 'revenue' ? 'Faturamento' : 'Lucro'} />
                  <Line type="monotone" dataKey="revenue" stroke="#171717" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="profit" stroke="#16a34a" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Canal mais rentável */}
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <ShoppingBag className="w-5 h-5 text-neutral-400" />
            <h2 className="text-lg font-bold">Desempenho por Canal</h2>
          </div>
          {channelData.length === 0 ? (
            <div className="text-center text-neutral-400 italic text-sm py-10">Nenhum dado ainda.</div>
          ) : (
            <div className="space-y-3">
              {channelData.sort((a: any, b: any) => b.revenue - a.revenue).map((ch: any, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                  <div>
                    <p className="font-bold text-neutral-900 text-sm">{ch.name}</p>
                    <p className="text-[11px] text-neutral-400">{ch.count} orçamento{ch.count !== 1 ? 's' : ''} • Taxa {CHANNELS[ch.name as Channel] ?? 0}%</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-black text-neutral-900">{formatCurrency(ch.revenue)}</p>
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[11px] text-neutral-400">lucro:</span>
                      <span className={cn('text-[11px] font-bold', ch.profit < 0 ? 'text-red-600' : 'text-green-600')}>{formatCurrency(ch.profit)}</span>
                      <MarginBadge value={ch.margin} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimos orçamentos */}
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Últimos Orçamentos</h2>
            <button className="text-xs font-bold text-neutral-400 hover:text-neutral-900 flex items-center gap-1 transition-colors">Ver todos <ArrowRight className="w-3 h-3" /></button>
          </div>
          <div className="space-y-3">
            {quotes.slice(0, 6).map(quote => (
              <div key={quote.id} className="flex items-center justify-between p-4 rounded-xl border border-neutral-100 hover:bg-neutral-50 transition-colors">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-neutral-900">
                      {quote.items?.[0]?.productName || 'Vários itens'}{quote.items?.length > 1 && ` (+${quote.items.length - 1})`}
                    </span>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider', STATUS_COLORS[quote.status || 'Pendente'])}>
                      {quote.status || 'Pendente'}
                    </span>
                  </div>
                  <span className="text-xs text-neutral-500">{quote.clientName} • {new Date(quote.date).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-neutral-900">{formatCurrency(quote.totalAmount)}</span>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <MarginBadge value={quote.avgMargin} />
                  </div>
                </div>
              </div>
            ))}
            {quotes.length === 0 && <div className="text-center py-10 text-neutral-400 italic">Nenhum orçamento ainda.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
