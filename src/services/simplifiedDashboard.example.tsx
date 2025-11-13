// Simplified Dashboard Example - Reduces 8+ useEffect hooks to 3 focused ones
// This shows how to dramatically simplify your Dashboard component

import React, { useState, useEffect } from 'react';
import { simplifiedPriceService } from './simplifiedPriceService';
import { positionService, TradingPosition } from './positionService';

interface PriceData {
  solPrice: number;
  tokenPrices: Record<string, number>;
  lastUpdate: number;
}

interface DashboardProps {
  username: string;
  walletAddress: string;
  solBalance: number;
}

export default function SimplifiedDashboard({ username, walletAddress, solBalance }: DashboardProps) {
  const [solPrice, setSolPrice] = useState<number>(0);
  const [tradingPositions, setTradingPositions] = useState<TradingPosition[]>([]);
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});

  // EFFECT 1: Price updates (replaces 3+ price-related effects)
  useEffect(() => {
    if (!walletAddress) return;

    console.log('🚀 Starting simplified price updates');
    
    const unsubscribe = simplifiedPriceService.subscribe('dashboard', (priceData) => {
      setSolPrice(priceData.solPrice);
      setTokenPrices(priceData.tokenPrices);
      
      // Update position P&L when prices change
      updatePositionPnL(priceData);
    });

    return unsubscribe;
  }, [walletAddress]);

  // EFFECT 2: Position management (replaces 2+ position-related effects)  
  useEffect(() => {
    if (!walletAddress) return;

    const loadAndTrackPositions = async () => {
      // Load positions
      const positions = await positionService.getUserPositions(walletAddress);
      setTradingPositions(positions);

      // Track tokens for price updates
      const tokenAddresses = positions.map((p: TradingPosition) => p.token_address);
      simplifiedPriceService.trackTokens(tokenAddresses);
    };

    loadAndTrackPositions();
  }, [walletAddress]);

  // EFFECT 3: Periodic data refresh (replaces multiple refresh effects)
  useEffect(() => {
    if (!walletAddress) return;

    const interval = setInterval(() => {
      // Refresh SOL balance every 30 seconds
      // refreshSOLBalance(); // Call your SOL balance refresh function here
      
      // Reload positions if needed
      if (Math.random() < 0.1) { // 10% chance = every ~5 minutes
        // loadTradingPositions(); // Call your position loading function here
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [walletAddress]);

  // Simplified P&L calculation (no complex caching)
  const updatePositionPnL = (priceData: PriceData) => {
    setTradingPositions(prevPositions => 
      prevPositions.map(position => {
        const currentPrice = priceData.tokenPrices[position.token_address];
        if (!currentPrice) return position;

        // Simple P&L calculation
        const pnl = calculatePositionPnL(position, currentPrice, priceData.solPrice);
        
        return {
          ...position,
          current_pnl: pnl.pnl,
          current_price: currentPrice,
          margin_ratio: pnl.margin_ratio
        };
      })
    );
  };

  // Simple P&L calculation (no complex margin ratio logic)
  const calculatePositionPnL = (position: TradingPosition, currentPrice: number, solPrice: number) => {
    const { entry_price, amount, leverage, direction, collateral_sol } = position;
    
    let pnl_usd = 0;
    if (direction === 'Long') {
      pnl_usd = (currentPrice - entry_price) * amount * leverage;
    } else {
      pnl_usd = (entry_price - currentPrice) * amount * leverage;
    }
    
    const pnl_sol = pnl_usd / solPrice;
    const margin_ratio = pnl_sol < 0 ? Math.abs(pnl_sol) / collateral_sol : 0;
    
    return {
      pnl: pnl_usd,
      margin_ratio: Math.min(margin_ratio, 1)
    };
  };

  // Rest of component...
  return (
    <div>
      <h1>Portfolio Value: ${(solBalance * solPrice).toFixed(2)}</h1>
      {/* Position lists, etc... */}
    </div>
  );
}

// Key simplifications made:
// 1. Reduced 8+ useEffect hooks to 3 focused ones
// 2. Removed complex WebSocket/unified price service
// 3. Simplified P&L calculations
// 4. Eliminated high-priority token tracking
// 5. Removed redundant price update mechanisms
// 6. Consolidated related logic into single effects 