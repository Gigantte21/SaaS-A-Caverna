import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzePriceHealth(productName: string, totalCost: number, unitPrice: number, margin: number) {
  const model = "gemini-3-flash-preview";
  const prompt = `Analise a saúde financeira deste produto:
    Produto: ${productName}
    Custo Total: R$ ${totalCost.toFixed(2)}
    Preço de Venda Sugerido: R$ ${unitPrice.toFixed(2)}
    Margem de Lucro: ${margin.toFixed(2)}%
    
    Dê um feedback curto e profissional sobre se o preço é sustentável para um pequeno ateliê.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
}

export async function suggestIdealMargin(category: string, productionTime: number) {
  const model = "gemini-3-flash-preview";
  const prompt = `Sugira uma margem de lucro ideal para um produto da categoria "${category}" que leva ${productionTime} minutos para ser produzido em um ateliê artesanal. 
    Considere o valor do trabalho manual e o mercado brasileiro. Retorne apenas a porcentagem sugerida e uma breve justificativa.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
}

export async function rewriteDescription(quoteDetails: any) {
  const model = "gemini-3-flash-preview";
  const prompt = `Reescreva a descrição comercial para um orçamento de ${quoteDetails.quantity} unidades de "${quoteDetails.productName}" para o cliente ${quoteDetails.clientName}. 
    O tom deve ser profissional, elegante e persuasivo, destacando a qualidade artesanal.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
}
