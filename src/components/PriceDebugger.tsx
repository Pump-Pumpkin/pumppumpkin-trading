import React, { useState, useEffect } from 'react';
import { simplifiedPriceService } from '../services/simplifiedPriceService';

export default function PriceDebugger() {
  const [priceData, setPriceData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log('PriceDebugger: Starting debug component');
    
    const unsubscribe = simplifiedPriceService.subscribe('debug', (data) => {
      console.log('PriceDebugger: Received price data:', data);
      setPriceData(data);
      setIsConnected(true);
    });

    // Track SOL for testing
    simplifiedPriceService.trackTokens(['So11111111111111111111111111111111111111112']);

    return () => {
      console.log('PriceDebugger: Unsubscribing');
      unsubscribe();
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 border-2 border-green-500 text-white p-4 rounded-lg shadow-2xl max-w-xs z-[9999]">
      <div className="text-sm font-bold mb-3 flex items-center gap-2">
        Live Prices
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>SOL:</span>
          <span className="font-mono text-green-400">${priceData?.solPrice?.toFixed(2) || 'N/A'}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Tokens:</span>
          <span className="font-mono text-blue-400">{Object.keys(priceData?.tokenPrices || {}).length}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Updated:</span>
          <span className="font-mono text-yellow-400">{priceData?.lastUpdate ? new Date(priceData.lastUpdate).toLocaleTimeString() : 'N/A'}</span>
        </div>
        
        {priceData?.tokenPrices && Object.keys(priceData.tokenPrices).length > 0 && (
          <div className="border-t border-gray-600 pt-2 mt-2">
            <div className="text-gray-300 text-xs mb-1">Token Prices:</div>
            {Object.entries(priceData.tokenPrices).slice(0, 2).map(([address, price]) => (
              <div key={address} className="flex justify-between text-xs">
                <span className="truncate w-16">{address.slice(0, 8)}...</span>
                <span className="font-mono text-green-300">${(price as number).toFixed(6)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 