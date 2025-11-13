// Simple WebSocket service for Birdeye data (no complex fallbacks)
// Note: This service is simplified - the main price service handles most price updates

interface PriceUpdateCallback {
  (tokenAddress: string, price: number): void;
}

const BIRDEYE_API_KEY = import.meta.env.VITE_BIRDEYE_API_KEY as string;

class SimpleWebSocketService {
  private ws: WebSocket | null = null;
  private priceSubscribers: Map<string, Set<PriceUpdateCallback>> = new Map();
  private isConnected = false;

  // Birdeye WebSocket endpoint
  private readonly WS_URL = 'wss://public-api.birdeye.so/socket/solana';
  private readonly API_KEY = BIRDEYE_API_KEY;

  constructor() {
    console.log('🔌 Simple WebSocket service initialized');
    this.connect();
  }

  private connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('🔗 Connecting to Birdeye WebSocket...');

    try {
      const wsUrlWithKey = `${this.WS_URL}?x-api-key=${this.API_KEY}`;
      this.ws = new WebSocket(wsUrlWithKey);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        this.resubscribeAll();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.isConnected = false;

        // Simple reconnect after 5 seconds
        setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          this.connect();
        }, 5000);
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnected = false;
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnected = false;
    }
  }

  private handleMessage(data: any): void {
    // Handle price updates from WebSocket
    if (data.type === 'price' && data.data) {
      const { address, price } = data.data;
      if (address && typeof price === 'number') {
        this.notifyPriceSubscribers(address, price);
      }
                }
  }

  private notifyPriceSubscribers(tokenAddress: string, price: number): void {
    const callbacks = this.priceSubscribers.get(tokenAddress);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(tokenAddress, price);
        } catch (error) {
          console.error('Error in price callback:', error);
        }
      });
    }
  }

  private resubscribeAll(): void {
    // Resubscribe to all tokens when connection is restored
    const tokens = Array.from(this.priceSubscribers.keys());
    tokens.forEach(tokenAddress => {
      this.subscribeToToken(tokenAddress);
    });
    }

  private subscribeToToken(tokenAddress: string): void {
    if (!this.isConnected || !this.ws) return;

    try {
      const subscribeMessage = {
        type: 'subscribe',
        data: {
          type: 'price',
          address: tokenAddress
        }
      };
      
      this.ws.send(JSON.stringify(subscribeMessage));
      console.log(`📊 Subscribed to WebSocket price updates for: ${tokenAddress.slice(0, 8)}...`);
    } catch (error) {
      console.error(`Failed to subscribe to ${tokenAddress}:`, error);
    }
  }

  // Public API
  subscribeToPrice(tokenAddress: string, callback: PriceUpdateCallback): () => void {
    if (!this.priceSubscribers.has(tokenAddress)) {
      this.priceSubscribers.set(tokenAddress, new Set());
      this.subscribeToToken(tokenAddress);
    }

    this.priceSubscribers.get(tokenAddress)!.add(callback);

    // Return unsubscribe function
    return () => {
    const callbacks = this.priceSubscribers.get(tokenAddress);
    if (callbacks) {
      callbacks.delete(callback);
      
      if (callbacks.size === 0) {
        this.priceSubscribers.delete(tokenAddress);
          // Could add unsubscribe message to WebSocket here if needed
            }
      }
    };
  }

  isWebSocketConnected(): boolean {
    return this.isConnected;
    }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.priceSubscribers.clear();
  }
}

// Export singleton
const webSocketService = new SimpleWebSocketService();
export default webSocketService;

// Legacy exports for compatibility (these now just use the simplified service)
export const jupiterWebSocket = webSocketService;
export const getJupiterPrices = () => ({
  isConnected: webSocketService.isWebSocketConnected()
}); 

// ==========================
// Birdeye WS helper functions
// ==========================

// Endpoint and subprotocol per docs
const BIRDEYE_WS_URL = 'wss://public-api.birdeye.so/socket/solana';
// Reuse the same API key string used elsewhere in the project
const BIRDEYE_WS_KEY = '9a5835740ef1448bafe50f8fbdc519ec';

export type BirdeyeChartType = '1m' | '3m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';
export type BirdeyeCurrency = 'usd' | 'pair';

export interface PriceDataPayload {
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
  type?: string;
  unixTime?: number;
  symbol?: string;
  address?: string;
}

export interface BaseQuoteOhlcvData {
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
  eventType?: string;
  type?: string;
  unixTime?: number;
  baseAddress: string;
  quoteAddress: string;
}

// Open SUBSCRIBE_PRICE (simple) stream for a single address
export function openPriceStreamSimple(
  address: string,
  chartType: BirdeyeChartType,
  currency: BirdeyeCurrency,
  onPriceData: (d: PriceDataPayload) => void
): () => void {
  const url = `${BIRDEYE_WS_URL}?x-api-key=${BIRDEYE_WS_KEY}`;
  const ws = new WebSocket(url, 'echo-protocol');
  let heartbeat: number | null = null;
  let closed = false;

  const safeClose = () => {
    if (closed) return;
    closed = true;
    try {
      // Best-effort unsubscribe (per examples)
      ws.send(JSON.stringify({ type: 'UNSUBSCRIBE_PRICE' }));
    } catch {}
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    try { ws.close(); } catch {}
  };

  ws.onopen = () => {
    try {
      const msg = {
        type: 'SUBSCRIBE_PRICE',
        data: {
          queryType: 'simple',
          chartType,
          address,
          currency,
        }
      };
      ws.send(JSON.stringify(msg));
      // Heartbeat every 30s (per recommendation to keep connection healthy)
      heartbeat = window.setInterval(() => {
        try { ws.send(JSON.stringify({ type: 'PING' })); } catch {}
      }, 30000);
    } catch {
      safeClose();
    }
  };

  ws.onmessage = (evt) => {
    try {
      const m = JSON.parse(evt.data);
      if (m?.type === 'PRICE_DATA' && m.data) {
        onPriceData(m.data as PriceDataPayload);
      } else if (m?.type === 'ERROR') {
        safeClose();
      }
    } catch {
      // ignore non-JSON frames
    }
  };

  ws.onerror = () => { safeClose(); };
  ws.onclose = () => { safeClose(); };

  return safeClose;
}

// Open SUBSCRIBE_BASE_QUOTE_PRICE stream for one base-quote pair (one pair per connection)
export function openBaseQuotePriceStream(
  baseAddress: string,
  quoteAddress: string,
  chartType: BirdeyeChartType,
  onOhlcv: (d: BaseQuoteOhlcvData) => void
): () => void {
  const url = `${BIRDEYE_WS_URL}?x-api-key=${BIRDEYE_WS_KEY}`;
  const ws = new WebSocket(url, 'echo-protocol');
  let heartbeat: number | null = null;
  let closed = false;

  const safeClose = () => {
    if (closed) return;
    closed = true;
    // Docs do not show explicit unsubscribe payload for base-quote; closing socket ends the subscription.
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    try { ws.close(); } catch {}
  };

  ws.onopen = () => {
    try {
      const msg = {
        type: 'SUBSCRIBE_BASE_QUOTE_PRICE',
        data: { baseAddress, quoteAddress, chartType }
      };
      ws.send(JSON.stringify(msg));
      heartbeat = window.setInterval(() => {
        try { ws.send(JSON.stringify({ type: 'PING' })); } catch {}
      }, 30000);
    } catch {
      safeClose();
    }
  };

  ws.onmessage = (evt) => {
    try {
      const m = JSON.parse(evt.data);
      if (m?.type === 'BASE_QUOTE_PRICE_DATA' && m.data) {
        onOhlcv(m.data as BaseQuoteOhlcvData);
      } else if (m?.type === 'ERROR') {
        safeClose();
      }
    } catch {
      // ignore non-JSON frames
    }
  };

  ws.onerror = () => { safeClose(); };
  ws.onclose = () => { safeClose(); };

  return safeClose;
}
