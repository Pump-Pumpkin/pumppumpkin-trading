import { fetchTokenDetailCached } from './birdeyeApi';

// Simplified price service with 1-second updates
class SimplifiedPriceService {
  private priceCallbacks: Map<string, Set<(price: number) => void>> = new Map();
  private activeTokens: Set<string> = new Set();
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  
  // 1-second update intervals
  private readonly UPDATE_INTERVAL = 1000; // 1 second
  private readonly CACHE_DURATION = 1000; // 1 second cache
  
  constructor() {
    console.log('💰 Price Service: Initialized with 1-second intervals');
  }
  
  // Subscribe to price updates
  subscribeToPrice(tokenAddress: string, callback: (price: number) => void): () => void {
    console.log(`📊 Subscribing to price updates for: ${tokenAddress.slice(0, 8)}...`);
    
    if (!this.priceCallbacks.has(tokenAddress)) {
      this.priceCallbacks.set(tokenAddress, new Set());
    }
    
    this.priceCallbacks.get(tokenAddress)!.add(callback);
    this.activeTokens.add(tokenAddress);
    
    // Start updates if not running
    if (!this.isRunning) {
      this.startUpdates();
    }
    
    // Get immediate price if cached
    const cached = this.priceCache.get(tokenAddress);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      setTimeout(() => callback(cached.price), 0);
    }
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.priceCallbacks.get(tokenAddress);
      if (callbacks) {
        callbacks.delete(callback);
        
        if (callbacks.size === 0) {
          this.priceCallbacks.delete(tokenAddress);
          this.activeTokens.delete(tokenAddress);
          console.log(`📊 Unsubscribed from: ${tokenAddress.slice(0, 8)}...`);
        }
      }
      
      // Stop updates if no active tokens
      if (this.activeTokens.size === 0) {
        this.stopUpdates();
      }
    };
  }
  
  // Subscribe to multiple tokens at once
  subscribeToMultiplePrices(
    subscriptionId: string,
    tokenAddresses: string[],
    callback: (prices: { [address: string]: number }) => void
  ): () => void {
    console.log(`📊 Subscribing to ${tokenAddresses.length} tokens with ID: ${subscriptionId}`);
    
    const unsubscribeFunctions: (() => void)[] = [];
    const collectedPrices: { [address: string]: number } = {};
    
    // Subscribe to each token individually
    tokenAddresses.forEach(tokenAddress => {
      const unsubscribe = this.subscribeToPrice(tokenAddress, (price: number) => {
        collectedPrices[tokenAddress] = price;
        
        // Call the callback with all collected prices
        if (Object.keys(collectedPrices).length > 0) {
          callback({ ...collectedPrices });
        }
      });
      
      unsubscribeFunctions.push(unsubscribe);
    });
    
    // Return function to unsubscribe from all
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }
  
  private startUpdates(): void {
    if (this.isRunning) return;
    
    console.log('🚀 Starting price updates every 1 second');
    this.isRunning = true;
    
    this.updateInterval = setInterval(() => {
      this.updateAllPrices();
    }, this.UPDATE_INTERVAL);
  }
  
  private stopUpdates(): void {
    if (!this.isRunning) return;
    
    console.log('⏹️ Stopping price updates');
    this.isRunning = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  private async updateAllPrices(): Promise<void> {
    if (this.activeTokens.size === 0) return;
    
    const activeTokensList = Array.from(this.activeTokens);
    console.log(`🔄 Updating prices for ${activeTokensList.length} tokens`);
    
    // Update tokens sequentially to be gentle on the API
    for (const tokenAddress of activeTokensList) {
      try {
        // Check cache first
        const cached = this.priceCache.get(tokenAddress);
        const now = Date.now();
        
        if (cached && now - cached.timestamp < this.CACHE_DURATION) {
          continue; // Skip if cache is fresh
        }
        
        // Fetch fresh price
        const tokenData = await fetchTokenDetailCached(tokenAddress);
        
        if (tokenData && typeof tokenData.price === 'number') {
          // Update cache
          this.priceCache.set(tokenAddress, {
            price: tokenData.price,
            timestamp: now
          });
          
          // Notify callbacks
            const callbacks = this.priceCallbacks.get(tokenAddress);
          if (callbacks) {
              callbacks.forEach(callback => {
                try {
                callback(tokenData.price);
              } catch (error) {
                console.error('Error in price callback:', error);
                }
              });
          }
            }
          
        // Small delay between API calls to be respectful
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.error(`❌ Error fetching price for ${tokenAddress.slice(0,8)}:`, error.message);
        }
      }
  }
    
  // Get current cached price
  getCachedPrice(tokenAddress: string): number | null {
    const cached = this.priceCache.get(tokenAddress);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.price;
    }
    return null;
  }
  
  // Force refresh a specific token
  async forceRefreshPrice(tokenAddress: string): Promise<number | null> {
    try {
      const tokenData = await fetchTokenDetailCached(tokenAddress);
      if (tokenData && typeof tokenData.price === 'number') {
        this.priceCache.set(tokenAddress, {
          price: tokenData.price,
          timestamp: Date.now()
        });
        return tokenData.price;
      }
    } catch (error) {
      console.error(`Error force refreshing price for ${tokenAddress}:`, error);
    }
    return null;
  }
}

// Export singleton instance
const priceService = new SimplifiedPriceService();
export default priceService; 