export interface Store {
  id: string;
  name: string;
  fantasyName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  address?: string;
  zipCode?: string;
  neighborhood?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  observations?: string;
}

export interface CostBase {
  id?: string;
  storeId: string;
  fixedCosts: number;
  productiveHours: number;
  profitGoal: number;
  hourlyRate: number;
}

export interface Material {
  id: string;
  storeId: string;
  name: string;
  unit: string;
  purchasePrice: number;
  purchaseQuantity: number;
  unitCost: number;
  isPackage?: boolean;
  packageQuantity?: number;
  supplierId?: string;
  createdAt: string;
  updatedAt?: string;
  stockQuantity: number;
  minStockQuantity: number;
}

export interface ProductMaterial {
  materialId: string;
  quantity: number;
}

export interface FinishingOption {
  id: string;
  name: string;
  description?: string;
  additionalValue: number;
}

export interface Accessory {
  id: string;
  name: string;
  additionalValue: number;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  category: string;
  materials: ProductMaterial[];
  productionTime: number;
  packagingCost: number;
  isPackage?: boolean;
  packageQuantity?: number;
  finishingOptions?: FinishingOption[];
  accessories?: Accessory[];
}

export interface Client {
  id: string;
  storeId: string;
  name: string;
  type: 'PF' | 'PJ';
  document: string; // CPF or CNPJ
  phone: string;
  email: string;
  city: string;
  state: string;
  observations?: string;
  totalSpent?: number;
  lastPurchase?: string;
  quoteCount?: number;
}

export type QuoteStatus = 'Pendente' | 'Aprovado' | 'Em produção' | 'Finalizado';
export type FollowUpStatus = 'Pendente' | 'Realizado' | 'Nenhum';

export interface QuoteItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  basePrice: number;
  finishingValue: number;
  accessoriesValue: number;
  selectedFinishingIds: string[];
  selectedAccessoryIds: string[];
  finishingNames?: string[];
  accessoryNames?: string[];
  customMargin?: number | null;
  // Snapshots for historical accuracy
  materialCost?: number;
  laborCost?: number;
  productionCost?: number;
  margin?: number;
  platformFee?: number;
}

export interface Quote {
  id: string;
  storeId: string;
  date: string;
  expiryDate: string;
  clientId?: string; // Linked client
  clientName: string;
  clientType: 'PF' | 'PJ';
  cnpj?: string;
  items: QuoteItem[];
  totalAmount: number;
  totalProfit: number;
  avgMargin: number;
  channel: string;
  platformFee: number;
  status: QuoteStatus;
  followUpStatus: FollowUpStatus;
  description?: string;
}

export interface Supplier {
  id: string;
  storeId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  observations?: string;
  createdAt: string;
  paymentMethod?: 'dinheiro' | 'pix' | 'credito' | 'boleto';
  paymentTerms?: 'credito_avista' | 'credito_parcelado' | 'boleto_30' | 'boleto_60' | 'boleto_90' | 'boleto_30_60' | 'boleto_30_60_90';
  discount?: number;
}

export type UserRole = 'ADMIN' | 'GERENTE' | 'OPERADOR';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  storeIds: string[]; // Stores the user has access to
  status: 'pendente' | 'aprovado' | 'bloqueado';
  createdAt: string;
}

export type Channel = 'Shopee' | 'Mercado Livre' | 'Instagram' | 'Venda Direta' | 'Atacado';

export const CHANNELS: Record<Channel, number> = {
  'Shopee': 20,
  'Mercado Livre': 18,
  'Instagram': 0,
  'Venda Direta': 0,
  'Atacado': 5,
};
