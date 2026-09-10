export interface User {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'agent';
  active: boolean;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  commission: number;
  cost: number;
  stock: number | null;
  link: string;
  active: boolean;
}

export interface City {
  id: number;
  name: string;
  price: number;
}

export type OrderStatus = 'Nouvelle' | 'Confirmée' | 'Rappel' | 'Appel-1' | 'Annulée' | string;
export type DeliveryStatus = '' | 'Expédier vers' | 'Livrée' | 'Retour' | 'Out Of Stock' | string;

export interface Order {
  id: number;
  date: string;
  confirmedAt: string;
  customerName: string;
  phone: string;
  city: string;
  address: string;
  productId: number | null;
  productName: string;
  qty: number;
  price: number;
  commission: number;
  deliveryFee: number;
  agent: string;
  source: string;
  status: OrderStatus;
  delivery: DeliveryStatus;
  upsell: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdSpend {
  id: number;
  date: string;
  productName: string;
  source: string;
  agent: string;
  amount: number;
  note: string;
}

export interface HistoryEntry {
  id: number;
  at: string;
  user: string;
  action: string;
  entity: string;
  entityId: number | string;
  summary: string;
}

export interface Settings {
  storeName: string;
  currency: string;
  perDelivered: number;
  perUpsell: number;
  bonusThreshold: number;
  bonusAmount: number;
  sources: string[];
}

export interface BootstrapData {
  user: User;
  settings: Settings;
  orders: Order[];
  products: Product[];
  cities: City[];
  users: User[];
  adspend: AdSpend[];
  history: HistoryEntry[];
}

export const ORDER_STATUSES = ['Nouvelle', 'Confirmée', 'Rappel', 'Appel-1', 'Annulée'] as const;
export const DELIVERY_STATUSES = ['', 'Expédier vers', 'Livrée', 'Retour', 'Out Of Stock'] as const;

export const DELIVERED = 'Livrée';
export const CANCELLED = 'Annulée';
