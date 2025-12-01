export type AtlosPayConfig = {
  merchantId: string;
  orderId: string;
  orderAmount?: number;
  orderCurrency?: string;
  userName?: string;
  userEmail?: string;
  captureEmail?: boolean;
  recurrence?: number;
  subscription?: unknown;
  resetSubscription?: boolean;
  subscriptionId?: string | null;
  postbackUrl?: string | null;
  noBuyCrypto?: boolean;
  language?: string;
  theme?: 'light' | 'dark';
  onSuccess?: (payload?: unknown) => void;
  onCanceled?: () => void;
  onCompleted?: (payload?: unknown) => void;
};

declare global {
  interface Window {
    atlos?: {
      Pay(config: AtlosPayConfig): void;
      RECURRENCE_NONE?: number;
    };
  }
}

export {};


