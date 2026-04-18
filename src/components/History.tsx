import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Quote, Client } from '../types';
import { formatCurrency, formatPercent, cn } from '../lib/utils';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { updateQuoteStatus } from '../services/automations';
import { generateQuoteMessage } from '../services/whatsapp';
import { generateClientPDF, generateInternalPDF, generateInvoicePDF } from '../lib/pdf';
import { Search, Trash2, FileText, Calendar, User, Building2, Download, ExternalLink, X, MessageSquare, CheckCircle2, Clock, Play, CheckCircle, Receipt, Loader2 } from 'lucide-react';

export function History() {
  const { activeStore } = useStore();
  const { user, isAdmin, isGerente } = useAuth();
  const { addToast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!activeStore) {
      setLoading(false);
      return;
    }

    const qQ = query(
      collection(db, 'quotes'), 
      where('storeId', '==', activeStore.id),
      orderBy('date', 'desc')
    );
    const unsubscribeQ = onSnapshot(qQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quote));
      setQuotes(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quotes');
      setLoading(false);
    });

    const qC = query(
      collection(db, 'clients'),
      where('storeId', '==', activeStore.id)
    );
    const unsubscribeC = onSnapshot(qC, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clients');
    });

    return () => {
      unsubscribeQ();
      unsubscribeC();
    };
  }, [activeStore]);

  const handleDelete = async () => {
    if (!quoteToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'quotes', quoteToDelete));
      addToast('Orçamento excluído com sucesso!', 'success');
      setQuoteToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `quotes/${quoteToDelete}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusUpdate = async (quote: Quote, newStatus: Quote['status']) => {
    try {
      const client = clients.find(c => c.id === quote.clientId);
      const mainProduct = quote.items?.[0]?.productName || 'Vários itens';
      await updateQuoteStatus(quote.id, newStatus, client?.phone, mainProduct);
      if (selectedQuote?.id === quote.id) {
        setSelectedQuote({ ...quote, status: newStatus });
      }
      addToast('Status atualizado com sucesso!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `quotes/${quote.id}`);
    }
  };

  const handleSendWhatsApp = (quote: Quote) => {
    const client = clients.find(c => c.id === quote.clientId);
    if (!client?.phone) {
      addToast('Este cliente não possui telefone cadastrado.', 'error');
      return;
    }
    const message = generateQuoteMessage(quote);
    window.open(`https://wa.me/55${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const filteredQuotes = quotes.filter(q => 
    (q.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.items?.some(item => (item.productName || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!activeStore) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
          <Calendar className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
        <p className="text-neutral-500">Você precisa selecionar uma loja para ver o histórico.</p>
      </div>
    );
  }

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Histórico de Orçamentos</h1>
        <p className="text-neutral-500 mt-1">Consulte e gerencie todos os orçamentos gerados.</p>
      </header>

      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por cliente ou produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Data</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Cliente</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Produto</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Valor Total</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Status</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {filteredQuotes.map((quote) => (
                <tr key={quote.id} className="group hover:bg-neutral-50 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                      <Calendar className="w-4 h-4" />
                      {new Date(quote.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      {quote.clientType === 'PJ' ? <Building2 className="w-4 h-4 text-neutral-400" /> : <User className="w-4 h-4 text-neutral-400" />}
                      <span className="font-bold text-neutral-900">{quote.clientName}</span>
                    </div>
                  </td>
                  <td className="py-4 text-sm font-medium text-neutral-700">
                    {quote.items?.[0]?.productName || 'Vários itens'}
                    {quote.items?.length > 1 && ` (+${quote.items.length - 1})`}
                  </td>
                  <td className="py-4 text-sm font-bold text-neutral-900">{formatCurrency(quote.totalAmount)}</td>
                  <td className="py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      quote.status === 'Aprovado' ? "bg-green-100 text-green-700" :
                      quote.status === 'Em produção' ? "bg-blue-100 text-blue-700" :
                      quote.status === 'Finalizado' ? "bg-neutral-100 text-neutral-700" :
                      "bg-yellow-100 text-yellow-700"
                    )}>
                      {quote.status || 'Pendente'}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleSendWhatsApp(quote)}
                        className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-all"
                        title="Enviar WhatsApp"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setSelectedQuote(quote)}
                        className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
                        title="Ver detalhes"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      {(isAdmin || user?.role === 'GERENTE') && (
                        <button
                          onClick={() => setQuoteToDelete(quote.id)}
                          className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredQuotes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-neutral-400 italic">Nenhum orçamento encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-neutral-900">Detalhes do Orçamento</h2>
              <button onClick={() => setSelectedQuote(null)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase">Cliente</span>
                    <p className="font-bold text-neutral-900">{selectedQuote.clientName}</p>
                    <p className="text-xs text-neutral-500">{selectedQuote.clientType === 'PJ' ? `CNPJ: ${selectedQuote.cnpj}` : 'Pessoa Física'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase">Produtos</span>
                    {selectedQuote.items.map((item, idx) => (
                      <div key={idx} className="mb-4 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                        <p className="font-bold text-neutral-900">{item.productName}</p>
                        <p className="text-xs text-neutral-500">{item.quantity} unidades • {formatCurrency(item.unitPrice)}/un</p>
                        
                        {(isAdmin || isGerente) && item.productionCost && (
                          <div className="mt-2 pt-2 border-t border-neutral-200 grid grid-cols-2 gap-x-4 gap-y-1">
                            <div className="flex justify-between text-[9px] uppercase tracking-wider text-neutral-400">
                              <span>Matéria-prima:</span>
                              <span className="font-mono text-neutral-600">{formatCurrency(item.materialCost || 0)}</span>
                            </div>
                            <div className="flex justify-between text-[9px] uppercase tracking-wider text-neutral-400">
                              <span>Mão de obra:</span>
                              <span className="font-mono text-neutral-600">{formatCurrency(item.laborCost || 0)}</span>
                            </div>
                            <div className="flex justify-between text-[9px] uppercase tracking-wider text-neutral-400">
                              <span>Margem:</span>
                              <span className="font-mono text-neutral-600">{formatPercent(item.margin || 0)}</span>
                            </div>
                            <div className="flex justify-between text-[9px] uppercase tracking-wider text-neutral-400">
                              <span>Plataforma:</span>
                              <span className="font-mono text-neutral-600">{formatPercent(item.platformFee || 0)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Alterar Status</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleStatusUpdate(selectedQuote, 'Aprovado')}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
                        selectedQuote.status === 'Aprovado' ? "bg-green-900 text-white border-green-900" : "bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50"
                      )}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Aprovar
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedQuote, 'Em produção')}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
                        selectedQuote.status === 'Em produção' ? "bg-blue-900 text-white border-blue-900" : "bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50"
                      )}
                    >
                      <Play className="w-3 h-3" />
                      Produção
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedQuote, 'Finalizado')}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
                        selectedQuote.status === 'Finalizado' ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50"
                      )}
                    >
                      <CheckCircle className="w-3 h-3" />
                      Finalizar
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedQuote, 'Pendente')}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
                        selectedQuote.status === 'Pendente' || !selectedQuote.status ? "bg-yellow-600 text-white border-yellow-600" : "bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50"
                      )}
                    >
                      <Clock className="w-3 h-3" />
                      Pendente
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-neutral-900 rounded-2xl text-white space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-400">Total Orçado</span>
                  <span className="font-bold">{formatCurrency(selectedQuote.totalAmount)}</span>
                </div>
                <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs text-neutral-400">Lucro Líquido Total</span>
                  <span className="text-lg font-bold text-green-400">+{formatCurrency(selectedQuote.totalProfit)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-400">Margem Média</span>
                  <span className="text-lg font-bold text-blue-400">{formatPercent(selectedQuote.avgMargin)}</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-100 flex flex-wrap justify-end gap-3">
              <button 
                onClick={async () => {
                  try {
                    generateInvoicePDF(selectedQuote, activeStore);
                    addToast('Nota Fiscal gerada com sucesso!', 'success');
                  } catch (error) {
                    addToast('Erro ao gerar Nota Fiscal', 'error');
                  }
                }}
                className="flex items-center gap-2 px-6 py-3 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-all"
              >
                <Receipt className="w-4 h-4" />
                Gerar Nota Fiscal
              </button>
              <button 
                onClick={async () => {
                  try {
                    generateClientPDF(selectedQuote, activeStore);
                    addToast('PDF do Cliente gerado com sucesso!', 'success');
                  } catch (error) {
                    addToast('Erro ao gerar PDF do Cliente', 'error');
                  }
                }}
                className="flex items-center gap-2 px-6 py-3 bg-neutral-100 text-neutral-900 rounded-xl font-bold hover:bg-neutral-200 transition-all"
              >
                <Download className="w-4 h-4" />
                PDF Cliente
              </button>
              <button 
                onClick={async () => {
                  try {
                    generateInternalPDF(selectedQuote, activeStore);
                    addToast('PDF Interno gerado com sucesso!', 'success');
                  } catch (error) {
                    addToast('Erro ao gerar PDF Interno', 'error');
                  }
                }}
                className="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all shadow-lg"
              >
                <FileText className="w-4 h-4" />
                PDF Interno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {quoteToDelete && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 text-red-600">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Excluir Orçamento?</h3>
            </div>
            
            <p className="text-neutral-600 leading-relaxed">
              Tem certeza que deseja excluir este orçamento do histórico? Esta ação não pode ser desfeita.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setQuoteToDelete(null)}
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
