import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote, Store } from '../types';
import { formatCurrency, formatPercent } from './utils';

export const generateClientPDF = (quote: Quote, store: Store | null) => {
  try {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text(store?.fantasyName || store?.name || 'Orçamento', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Data: ${new Date(quote.date).toLocaleDateString()}`, 14, 30);
    doc.text(`Validade: ${new Date(quote.expiryDate).toLocaleDateString()}`, 14, 35);
    
    // Client Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Dados do Cliente', 14, 50);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Nome: ${quote.clientName}`, 14, 57);
    if (quote.cnpj) {
      doc.text(`Documento: ${quote.cnpj}`, 14, 62);
    }

    // Items
    autoTable(doc, {
      startY: 75,
      head: [['Produto', 'Quantidade', 'Valor Unitário', 'Total']],
      body: quote.items.map(item => {
        const details = [
          item.finishingNames?.length ? `Acabamentos: ${item.finishingNames.join(', ')}` : '',
          item.accessoryNames?.length ? `Acessórios: ${item.accessoryNames.join(', ')}` : ''
        ].filter(Boolean).join('\n');
        
        return [
          { content: item.productName + (details ? '\n' + details : ''), styles: { fontSize: 9 } },
          item.quantity.toString(),
          formatCurrency(item.unitPrice),
          formatCurrency(item.totalPrice)
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: [20, 20, 20] }
    });

    // Total
    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`Total do Orçamento: ${formatCurrency(quote.totalAmount)}`, 14, finalY + 15);

    const safeName = quote.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`Orcamento_${safeName}.pdf`);
  } catch (error) {
    console.error('Error generating Client PDF:', error);
    throw error;
  }
};

export const generateInternalPDF = (quote: Quote, store: Store | null) => {
  try {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Orçamento Interno', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Data: ${new Date(quote.date).toLocaleDateString()}`, 14, 30);
    doc.text(`Canal: ${quote.channel}`, 14, 35);
    
    // Client Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Dados do Cliente', 14, 50);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Nome: ${quote.clientName}`, 14, 57);
    if (quote.cnpj) {
      doc.text(`Documento: ${quote.cnpj}`, 14, 62);
    }

    // Items
    autoTable(doc, {
      startY: 75,
      head: [['Produto', 'Qtd', 'Preço Unit.', 'Total Venda']],
      body: quote.items.map(item => {
        const details = [
          item.finishingNames?.length ? `Acabamentos: ${item.finishingNames.join(', ')}` : '',
          item.accessoryNames?.length ? `Acessórios: ${item.accessoryNames.join(', ')}` : ''
        ].filter(Boolean).join('\n');
        
        return [
          { content: item.productName + (details ? '\n' + details : ''), styles: { fontSize: 9 } },
          item.quantity.toString(),
          formatCurrency(item.unitPrice),
          formatCurrency(item.totalPrice)
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: [20, 20, 20] }
    });

    // Financials
    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Resumo Financeiro', 14, finalY + 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Total Geral: ${formatCurrency(quote.totalAmount)}`, 14, finalY + 22);
    doc.text(`Lucro Líquido Total: ${formatCurrency(quote.totalProfit)}`, 14, finalY + 27);
    doc.text(`Margem Média: ${formatPercent(quote.avgMargin)}`, 14, finalY + 32);

    const safeName = quote.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`Interno_${safeName}.pdf`);
  } catch (error) {
    console.error('Error generating Internal PDF:', error);
    throw error;
  }
};

export const generateInvoicePDF = (quote: Quote, store: Store | null) => {
  try {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(24);
    doc.text('NOTA FISCAL DE SERVIÇO / PRODUTO', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Emissão: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Número: ${Math.floor(Math.random() * 10000).toString().padStart(5, '0')}`, 14, 35);
    
    // Emitente (Store)
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Emitente', 14, 50);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Razão Social: ${store?.name || 'Empresa Emissora'}`, 14, 57);
    if (store?.fantasyName) doc.text(`Nome Fantasia: ${store.fantasyName}`, 14, 62);
    if (store?.email) doc.text(`Email: ${store.email}`, 14, 67);
    if (store?.phone) doc.text(`Telefone: ${store.phone}`, 14, 72);

    // Destinatário (Client)
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Destinatário', 105, 50);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Nome: ${quote.clientName}`, 105, 57);
    if (quote.cnpj) {
      doc.text(`Documento: ${quote.cnpj}`, 105, 62);
    }

    // Items
    autoTable(doc, {
      startY: 85,
      head: [['Descrição', 'Quantidade', 'Valor Unitário', 'Valor Total']],
      body: quote.items.map(item => {
        const details = [
          item.finishingNames?.length ? `Acabamentos: ${item.finishingNames.join(', ')}` : '',
          item.accessoryNames?.length ? `Acessórios: ${item.accessoryNames.join(', ')}` : ''
        ].filter(Boolean).join('\n');
        
        return [
          { content: item.productName + (details ? '\n' + details : ''), styles: { fontSize: 9 } },
          item.quantity.toString(),
          formatCurrency(item.unitPrice),
          formatCurrency(item.totalPrice)
        ];
      }),
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] }
    });

    // Total
    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`VALOR TOTAL DA NOTA: ${formatCurrency(quote.totalAmount)}`, 14, finalY + 15);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Este documento é uma representação de nota fiscal gerada pelo sistema.', 14, 280);

    const safeName = quote.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`NF_${safeName}.pdf`);
  } catch (error) {
    console.error('Error generating Invoice PDF:', error);
    throw error;
  }
};
