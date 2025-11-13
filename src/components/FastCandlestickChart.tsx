import React, { useState, useEffect, useRef, useCallback } from 'react';
import priceService from '../services/businessPlanPriceService';
import { fetchTokenDetailCached } from '../services/birdeyeApi';

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface FastCandlestickChartProps {
  tokenAddress: string;
  tokenSymbol: string;
  className?: string;
  height?: number;
}

export default function FastCandlestickChart({ 
  tokenAddress, 
  tokenSymbol, 
  className = '',
  height = 200
}: FastCandlestickChartProps) {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const chartRef = useRef<SVGSVGElement>(null);
  const lastPriceUpdateRef = useRef<number>(0);

  // Initialize chart with historical data and start live updates
  useEffect(() => {
    if (!tokenAddress) return;

    const initializeChart = async () => {
      setIsLoading(true);
      
      try {
        // Get initial token data for starting price
        const tokenData = await fetchTokenDetailCached(tokenAddress);
        if (tokenData) {
          const startPrice = tokenData.price;
          setCurrentPrice(startPrice);
          
          // Create initial 1-minute candles (last 20 minutes)
          const now = Date.now();
          const initialCandles: CandleData[] = [];
          
          for (let i = 19; i >= 0; i--) {
            const candleTime = now - (i * 60000); // 1 minute intervals
            const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
            const candlePrice = startPrice * (1 + variation);
            
            initialCandles.push({
              time: candleTime,
              open: candlePrice,
              high: candlePrice * (1 + Math.random() * 0.01),
              low: candlePrice * (1 - Math.random() * 0.01),
              close: candlePrice,
              volume: Math.random() * 1000000
            });
          }
          
          setCandles(initialCandles);
          console.log(`📊 FAST CHART: Initialized ${initialCandles.length} 1-minute candles for ${tokenSymbol}`);
        }
      } catch (error) {
        console.error('❌ Error initializing chart:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeChart();
  }, [tokenAddress, tokenSymbol]);

  // Subscribe to 20Hz price updates
  useEffect(() => {
    if (!tokenAddress || isLoading) return;

    console.log(`⚡ FAST CHART: Starting BLAZING FAST 20Hz updates for ${tokenSymbol}`);
    
    const unsubscribe = priceService.subscribeToPrice(tokenAddress, (newPrice: number) => {
      if (!newPrice || newPrice <= 0) return;
      
      const now = Date.now();
      
      // Throttle updates to prevent overwhelming the UI (still very fast at ~10Hz for chart)
      if (now - lastPriceUpdateRef.current < 100) return;
      lastPriceUpdateRef.current = now;
      
      setCurrentPrice(newPrice);
      
      setCandles(prev => {
        if (prev.length === 0) return prev;
        
        const updated = [...prev];
        const lastCandle = updated[updated.length - 1];
        const currentMinute = Math.floor(now / 60000) * 60000;
        const lastCandleMinute = Math.floor(lastCandle.time / 60000) * 60000;
        
        if (currentMinute === lastCandleMinute) {
          // Update current minute candle
          const updatedCandle: CandleData = {
            ...lastCandle,
            high: Math.max(lastCandle.high, newPrice),
            low: Math.min(lastCandle.low, newPrice),
            close: newPrice
          };
          updated[updated.length - 1] = updatedCandle;
        } else {
          // Start new minute candle
          const newCandle: CandleData = {
            time: currentMinute,
            open: lastCandle.close,
            high: newPrice,
            low: newPrice,
            close: newPrice,
            volume: Math.random() * 1000000
          };
          updated.push(newCandle);
          
          // Keep only last 20 candles
          if (updated.length > 20) {
            updated.shift();
          }
        }
        
        return updated;
      });
      
      // Calculate price change from last complete candle (more accurate for short timeframes)
      setCandles(prev => {
        if (prev.length > 1) {
          // Use the previous candle's close as reference (not the very first candle)
          const referencePrice = prev[prev.length - 2].close;
          const change = ((newPrice - referencePrice) / referencePrice) * 100;
          // Cap the percentage change to prevent crazy numbers
          const cappedChange = Math.max(-50, Math.min(50, change));
          setPriceChange(cappedChange);
        }
        return prev;
      });
    });

    return () => {
      console.log(`📊 FAST CHART: Unsubscribing from BLAZING FAST 20Hz updates for ${tokenSymbol}`);
      unsubscribe();
    };
  }, [tokenAddress, tokenSymbol, isLoading]);

  // Generate candlestick chart SVG
  const generateCandlesticks = useCallback(() => {
    if (candles.length === 0) return null;
    
    const padding = 40;
    const chartWidth = 400 - (padding * 2);
    const chartHeight = height - (padding * 2);
    
    const prices = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    
    const candleWidth = chartWidth / candles.length * 0.7;
    const candleSpacing = chartWidth / candles.length;
    
    return candles.map((candle, index) => {
      const x = padding + (index * candleSpacing) + (candleSpacing / 2);
      const openY = padding + ((maxPrice - candle.open) / priceRange) * chartHeight;
      const closeY = padding + ((maxPrice - candle.close) / priceRange) * chartHeight;
      const highY = padding + ((maxPrice - candle.high) / priceRange) * chartHeight;
      const lowY = padding + ((maxPrice - candle.low) / priceRange) * chartHeight;
      
      const isGreen = candle.close >= candle.open;
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.abs(closeY - openY) || 1;
      
      return (
        <g key={candle.time} className="candle">
          {/* Wick */}
          <line
            x1={x}
            y1={highY}
            x2={x}
            y2={lowY}
            stroke={isGreen ? '#00ff88' : '#ff4444'}
            strokeWidth="1.5"
            className="transition-all duration-100 ease-out"
            style={{
              filter: 'drop-shadow(0 0 2px currentColor)',
            }}
          />
          
          {/* Body */}
          <rect
            x={x - candleWidth / 2}
            y={bodyTop}
            width={candleWidth}
            height={bodyHeight}
            fill={isGreen ? 'url(#greenGradient)' : 'url(#redGradient)'}
            stroke={isGreen ? '#00ff88' : '#ff4444'}
            strokeWidth="1"
            className="transition-all duration-100 ease-out hover:opacity-90"
            style={{
              filter: index === candles.length - 1 ? 'drop-shadow(0 0 6px currentColor)' : 'drop-shadow(0 0 2px rgba(0,0,0,0.3))'
            }}
          />
        </g>
      );
    });
  }, [candles, height]);

  // Format price for display
  const formatPrice = (price: number): string => {
            // Show exactly 4 significant digits for chart tooltips
        if (price >= 1000) {
          return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (price >= 1) {
          return `$${price.toPrecision(4)}`;
        } else if (price > 0) {
          const precision4 = price.toPrecision(4);
          const asNumber = parseFloat(precision4);
          
          if (asNumber >= 0.0001) {
            return `$${asNumber}`;
          } else {
            const magnitude = Math.floor(Math.log10(asNumber));
            const decimalPlaces = Math.abs(magnitude) + 3;
            return `$${asNumber.toFixed(decimalPlaces)}`;
          }
        } else {
          return '$0.00';
        }
  };

  return (
    <div className={`bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-600 shadow-xl p-6 ${className}`}>


      {/* SVG Chart */}
      <div className="relative bg-black/30 rounded-xl overflow-hidden border border-gray-600/30 shadow-inner">
        <svg
          ref={chartRef}
          className="w-full"
          style={{ height: `${height}px` }}
          viewBox="0 0 400 240"
        >
          {/* Background Grid */}
          <defs>
            <pattern id="grid-pattern" width="40" height="30" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.2"/>
            </pattern>
            
            {/* Professional gradients for candles */}
            <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00ff88" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.6"/>
            </linearGradient>
            <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff4444" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.6"/>
            </linearGradient>
            
            {/* Professional border gradient */}
            <linearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00ff88" stopOpacity="0.5"/>
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.2"/>
              <stop offset="100%" stopColor="#ff4444" stopOpacity="0.5"/>
            </linearGradient>
          </defs>
          <rect width="400" height="200" fill="url(#grid-pattern)" />
          
          {/* Professional border glow */}
          <rect 
            x="1" y="1" 
            width="398" height="198" 
            fill="none" 
            stroke="url(#borderGradient)" 
            strokeWidth="1"
            opacity="0.3"
          />
          
          {/* Price Grid Lines */}
          {candles.length > 0 && (() => {
            const prices = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const priceRange = maxPrice - minPrice || 1;
            
            return [0.25, 0.5, 0.75].map(ratio => {
              const y = 40 + (ratio * (height - 80));
              const price = maxPrice - (ratio * priceRange);
              return (
                <g key={ratio}>
                  <line x1="40" y1={y} x2="360" y2={y} stroke="#4b5563" strokeWidth="0.5" opacity="0.3" />
                  <text x="365" y={y + 3} fill="#9ca3af" fontSize="10" textAnchor="start">
                    {formatPrice(price)}
                  </text>
                </g>
              );
            });
          })()}
          
          {/* Candlesticks */}
          {generateCandlesticks()}
          
          {/* Loading State */}
          {isLoading && (
            <text x="200" y="120" fill="#9ca3af" fontSize="14" textAnchor="middle">
              Loading chart data...
            </text>
          )}
        </svg>

      </div>
      

    </div>
  );
} 