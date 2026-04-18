import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { QuoteStatus, FollowUpStatus } from '../types';
import { sendWhatsAppMessage, generateStatusMessage } from './whatsapp';

export async function updateQuoteStatus(quoteId: string, newStatus: QuoteStatus, phone?: string, productName?: string) {
  const quoteRef = doc(db, 'quotes', quoteId);
  await updateDoc(quoteRef, { status: newStatus });

  if (phone && productName) {
    const message = generateStatusMessage(newStatus, productName);
    if (message) {
      sendWhatsAppMessage(phone, message);
    }
  }
}

export async function checkFollowUps() {
  // Esta função seria idealmente executada em um Cloud Function ou cron job.
  // No frontend, podemos disparar ao carregar o dashboard para marcar orçamentos antigos.
  // Para simplificar, vamos apenas definir a lógica.
}
