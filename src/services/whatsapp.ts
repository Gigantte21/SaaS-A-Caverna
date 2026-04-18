/**
 * Envia uma mensagem via WhatsApp usando o link da API do WhatsApp.
 * @param phone O número de telefone no formato internacional (ex: 5511999999999)
 * @param message A mensagem a ser enviada
 */
export function sendWhatsAppMessage(phone: string, message: string) {
  // Remove caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
  window.open(url, '_blank');
}

export function generateQuoteMessage(quote: any) {
  return `Olá ${quote.clientName}! Segue o orçamento para *${quote.productName}* (${quote.quantity} un).
Valor Total: R$ ${(quote.unitPrice * quote.quantity).toFixed(2)}
Validade: 5 dias úteis.
Como podemos prosseguir? 😊`;
}

export function generateStatusMessage(status: string, productName: string) {
  switch (status) {
    case 'Aprovado':
      return `Seu pedido de *${productName}* foi aprovado ✅`;
    case 'Em produção':
      return `Seu pedido de *${productName}* já está em produção 🔥`;
    case 'Finalizado':
      return `Seu pedido de *${productName}* está pronto 🎉`;
    default:
      return '';
  }
}

export function generateFollowUpMessage(clientName: string) {
  return `Olá ${clientName}! Seu orçamento ainda está disponível 😊. Gostaria de tirar alguma dúvida ou confirmar o pedido?`;
}
