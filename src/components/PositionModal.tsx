import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { TradingPosition } from '../services/positionService';
import { formatPrice } from '../services/birdeyeApi';
import { openBaseQuotePriceStream } from '../services/birdeyeWebSocket';
import priceService from '../services/businessPlanPriceService';
import TradeLoadingModal from './TradeLoadingModal';
import TradeResultsModal from './TradeResultsModal';
import { soundManager } from '../services/soundManager';

interface PositionModalProps {
  position: TradingPosition;
  onClose: () => void;
  onClosePosition: (positionId: number) => void;
  isClosingPosition?: boolean;
  solPrice?: number;
}

// Format numbers with K, M, B prefixes
const formatCompactNumber = (num: number): string => {
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1000000000) {
    return `${sign}$${(absNum / 1000000000).toFixed(1)}B`;
  } else if (absNum >= 1000000) {
    return `${sign}$${(absNum / 1000000).toFixed(1)}M`;
  } else if (absNum >= 1000) {
    return `${sign}$${(absNum / 1000).toFixed(1)}K`;
  } else {
    return `${sign}$${absNum.toFixed(2)}`;
  }
};

export default function PositionModal({ position, onClose, onClosePosition, isClosingPosition = false, solPrice = 98.45 }: PositionModalProps) {
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [realtimePrice, setRealtimePrice] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<'details' | 'chart'>('details');
  
  // Closing trade loading modal state
  const [showClosingModal, setShowClosingModal] = useState(false);
  
  // Trade results modal state
  const [showTradeResults, setShowTradeResults] = useState(false);
  const [tradeResultsData, setTradeResultsData] = useState<{
    tokenSymbol: string;
    direction: 'Long' | 'Short';
    leverage: number;
    entryPrice: number;
    exitPrice: number;
    positionSize: number;
    collateralAmount: number;
    grossPnL?: number;    // Gross P&L before fees
    profitFee?: number;   // 20% profit fee
    finalPnL: number;     // Net P&L after fees
    pnlPercentage: number;
    totalReturn: number;
  } | null>(null);

  // Calculate real-time P&L with current price
  const calculateRealtimePnL = (currentPrice: number) => {
    const entry_price = position.entry_price;
    const amount = position.amount;
    const leverage = position.leverage;
    
    // Calculate P&L in USD - CORRECTED: Apply leverage properly
    let pnl_usd = 0;
    if (position.direction === 'Long') {
      pnl_usd = (currentPrice - entry_price) * amount * leverage; // WITH leverage multiplication!
    } else {
      pnl_usd = (entry_price - currentPrice) * amount * leverage; // WITH leverage multiplication!
    }
    
    // Calculate margin ratio
    const collateralUSD = position.collateral_sol * solPrice;
    let margin_ratio = 0;
    if (pnl_usd < 0) {
      margin_ratio = Math.abs(pnl_usd) / collateralUSD;
    }
    
    return {
      pnl: pnl_usd,
      margin_ratio: Math.min(margin_ratio, 1)
    };
  };

  // Get current P&L using real-time price if available
  const getCurrentPnL = () => {
    const currentPrice = realtimePrice || position.current_price || position.entry_price;
    const pnlData = calculateRealtimePnL(currentPrice);
    return pnlData.pnl;
  };

  // Get current margin ratio using real-time price if available
  const getCurrentMarginRatio = () => {
    const currentPrice = realtimePrice || position.current_price || position.entry_price;
    const pnlData = calculateRealtimePnL(currentPrice);
    return pnlData.margin_ratio;
  };

  // Subscribe to price service for price updates
  useEffect(() => {
    console.log(`PositionModal: Subscribing to price service for ${position.token_symbol}`);
    
    // Subscribe to price updates for this token
    const unsubscribe = priceService.subscribeToPrice(position.token_address, (newPrice: number) => {
        console.log(`PositionModal: Price update for ${position.token_symbol}: $${newPrice.toFixed(6)}`);
        setRealtimePrice(newPrice);
    });
    
    return () => {
      console.log(`🔌 PositionModal: Unsubscribing from price service for ${position.token_symbol}`);
      unsubscribe();
    };
  }, [position.token_address, position.token_symbol]);

  // Add WS live price specifically for the modal (faster than REST); keep REST as fallback
  useEffect(() => {
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    let closeFn: (() => void) | null = null;
    try {
      closeFn = openBaseQuotePriceStream(
        position.token_address,
        USDC_MINT,
        '1m',
        (d) => {
          const p = typeof d?.c === 'number' ? d.c : NaN;
          if (!Number.isFinite(p) || p <= 0) return;
          setRealtimePrice(p);
          console.debug(`📈 PositionModal WS tick ${position.token_symbol} → $${p.toFixed(6)}`);
        }
      );
      console.log('📡 PositionModal WS started for', position.token_symbol);
    } catch (e) {
      console.warn('⚠️ PositionModal WS failed, relying on REST polling', e);
    }
    return () => {
      if (closeFn) {
        try { closeFn(); } catch {}
        console.log('📴 PositionModal WS closed for', position.token_symbol);
      }
    };
  }, [position.token_address, position.token_symbol]);

  // Use real-time calculated values instead of static position values
  const currentPnL = getCurrentPnL();
  const currentMarginRatio = getCurrentMarginRatio();
  const isProfit = currentPnL >= 0;
  const marginRiskLevel = currentMarginRatio <= 0.5 ? 'safe' : currentMarginRatio <= 0.8 ? 'warning' : 'danger';

  // Check for trade results after closing modal completes
  const checkForTradeResults = async (positionId: number) => {
    try {
      console.log('🔍 PositionModal: Checking for trade results for position', positionId);
      
      // Import supabase dynamically
      const { supabase } = await import('../services/supabaseClient');
      
      // Get the position from database to check for trade results
      const { data: position, error } = await supabase
        .from('trading_positions')
        .select('trade_results')
        .eq('id', positionId)
        .single();
      
      if (error) {
        console.error('PositionModal: Error fetching position for trade results:', error);
        return;
      }
      
      if (position?.trade_results) {
        const tradeResults = JSON.parse(position.trade_results);
                  console.log('PositionModal: Found trade results for position', positionId, ':', tradeResults);
        
        setTradeResultsData(tradeResults);
        setShowTradeResults(true);
        
        // Clear trade results from database after displaying
        await supabase
          .from('trading_positions')
          .update({ trade_results: null })
          .eq('id', positionId);
          
        console.log('🧹 PositionModal: Cleared trade results from database for position', positionId);
      } else {
                  console.log('PositionModal: No trade results found for position', positionId);
      }
    } catch (error) {
      console.error('PositionModal: Error checking for trade results:', error);
    }
  };

  const handleClosePosition = async () => {
    // Position closes immediately now
    onClosePosition(position.id);
    setShowCloseConfirm(false);
    onClose();
    
    // Let Dashboard handle PNL card popup - no need for PositionModal to show TradeResultsModal
    // await checkForTradeResults(position.id); // REMOVED - Dashboard will handle this
  };

  const formatPnL = (pnl: number) => {
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}${formatCompactNumber(Math.abs(pnl))}`;
  };

  const formatPnLPercentage = (pnl: number, collateral: number) => {
    const collateralUSD = collateral * solPrice;
    const percentage = (pnl / collateralUSD) * 100;
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage.toFixed(1)}%`;
  };

  const getRiskColor = () => {
    switch (marginRiskLevel) {
      case 'safe': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'danger': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getRiskText = () => {
    switch (marginRiskLevel) {
      case 'safe': return 'Safe';
      case 'warning': return 'At Risk';
      case 'danger': return 'High Risk';
      default: return 'Unknown';
    }
  };

  if (showCloseConfirm) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center p-2 z-50">
        <div className="text-center max-w-sm w-full">
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setShowCloseConfirm(false)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mb-3">
            <div className="w-12 h-12 mx-auto">
              <AlertCircle className="w-full h-full text-yellow-400" />
            </div>
          </div>

          <h1 className="text-lg font-normal mb-1">
            Close <span style={{ color: '#1e7cfa' }}>Position?</span>
          </h1>
          
          <p className="text-gray-400 text-sm mb-1 truncate">
            {position.token_symbol} {position.leverage}x {position.direction}
          </p>
          <p className="text-gray-500 text-xs mb-3">This action cannot be undone</p>

          {/* Current P&L Display */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-2 mb-3">
            <p className="text-gray-400 text-xs mb-1">Current P&L</p>
            <p className={`text-lg font-bold ${currentPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatPnL(currentPnL)}
            </p>
            <p className={`text-xs ${currentPnL >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {formatPnLPercentage(currentPnL, position.collateral_sol)}
            </p>
          </div>

          <button
            onClick={handleClosePosition}
            disabled={isClosingPosition}
            className="w-full text-black font-medium py-2 px-3 rounded-lg text-sm transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed mb-2 flex items-center justify-center space-x-2"
            style={{ 
              backgroundColor: isClosingPosition ? '#374151' : '#1e7cfa',
              color: isClosingPosition ? '#9ca3af' : 'black'
            }}
          >
            {isClosingPosition ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Close Position</span>
              </>
            ) : (
              <span>Close Position</span>
            )}
          </button>

          <button
            onClick={() => setShowCloseConfirm(false)}
            disabled={isClosingPosition}
            className="w-full bg-transparent border border-gray-600 hover:border-gray-500 text-gray-400 hover:text-gray-300 font-medium py-2 px-3 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-2 z-50">
      <div className="text-center w-full max-w-[96vw]">
        <div className="flex justify-between items-center mb-3">
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors flex items-center space-x-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Mobile-only tabs */}
        <div className="mb-3 md:hidden">
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-bold ${mobileTab === 'details' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
              onClick={() => setMobileTab('details')}
            >
              Details
            </button>
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-bold ${mobileTab === 'chart' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
              onClick={() => setMobileTab('chart')}
            >
              Chart
            </button>
          </div>
        </div>

        {/* Desktop grid: chart left, details right. On mobile, show one based on tab. */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
          {/* Chart */}
          <div className={`rounded-xl overflow-hidden bg-gray-900 border border-gray-800 md:col-span-8 col-span-1 ${mobileTab === 'chart' ? 'block' : 'hidden'} md:block`}>
            <iframe
              title={`Chart-${position.token_symbol}`}
              src={`https://birdeye.so/tv-widget/${position.token_address}?chain=solana&theme=dark`}
              className="w-full h-[360px] md:h-[80vh]"
              frameBorder="0"
              allowFullScreen
            />
          </div>

          {/* Details panel */}
          <div className={`md:col-span-4 col-span-1 ${mobileTab === 'details' ? 'block' : 'hidden'} md:block md:max-h-[80vh] max-h-[70dvh] overflow-y-auto`}>
            {/* Token Icon */}
            <div className="mb-3">
              <div className="w-12 h-12 mx-auto">
                {position.token_image ? (
                  <img 
                    src={position.token_image} 
                    alt={position.token_symbol}
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) {
                        fallback.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div className={`w-full h-full bg-gray-800 rounded-lg flex items-center justify-center ${position.token_image ? 'hidden' : 'flex'}`}>
                  <span className="text-white text-lg font-bold">
                    {position.token_symbol.charAt(0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Title - More Compact */}
            <h1 className="text-lg font-normal mb-1 truncate">
              <span style={{ color: '#1e7cfa' }}>{position.token_symbol}</span> Position
            </h1>
            
            {/* Position Details - More Compact */}
            <div className="flex items-center justify-center space-x-1 mb-1">
              <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium ${
                position.direction === 'Long' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
              }`}>
                {position.direction === 'Long' ? 
                  <TrendingUp className="w-3 h-3" /> : 
                  <TrendingDown className="w-3 h-3" />
                }
                <span>{position.direction} {position.leverage}x</span>
              </div>
            </div>

            {/* P&L Display - More Compact */}
            <div className={`border rounded-lg p-2 mb-2 ${
              isProfit ? 'bg-green-900 border-green-700' : 'bg-red-900 border-red-700'
            }`}>
              <p className="text-gray-300 text-xs mb-1">Unrealized P&L</p>
              <p className={`text-xl font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                {formatPnL(currentPnL)}
              </p>
              <p className={`text-xs ${isProfit ? 'text-green-300' : 'text-red-300'}`}>
                {formatPnLPercentage(currentPnL, position.collateral_sol)}
              </p>
            </div>

            {/* Price Info - More Compact */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-2 mb-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-1 flex items-center justify-center space-x-1">
                    <span>Current</span>
                    {realtimePrice && (
                      <span className="text-green-400 text-xs">●</span>
                    )}
                  </p>
                  <p className="text-white text-sm font-bold truncate">
                    {formatPrice(realtimePrice || position.current_price || position.entry_price)}
                  </p>
                  {realtimePrice && (
                    <p className="text-green-400 text-xs">Live</p>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-1">Entry</p>
                  <p className="text-white text-sm font-bold truncate">
                    {formatPrice(position.entry_price)}
                  </p>
                </div>
              </div>
            </div>

            {/* Position Details - More Compact */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-2 mb-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Size:</span>
                  <span className="text-white truncate max-w-24">{position.amount.toFixed(3)} {position.token_symbol}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Collateral:</span>
                  <span className="text-white">{position.collateral_sol.toFixed(3)} SOL</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Liquidation:</span>
                  <span className="text-red-400 truncate max-w-24">{formatPrice(position.liquidation_price)}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons - More Compact */}
            <button
              onClick={() => setShowCloseConfirm(true)}
              disabled={isClosingPosition || position.status === 'closing' || position.status === 'opening'}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-medium py-2 px-3 rounded-lg text-sm transition-colors disabled:cursor-not-allowed mb-2"
            >
              Close Position
            </button>
            
            <button
              onClick={onClose}
              className="w-full bg-transparent border border-gray-600 hover:border-gray-500 text-gray-400 hover:text-gray-300 font-medium py-2 px-3 rounded-lg text-sm transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
      
      {/* Closing Trade Loading Modal */}
      <TradeLoadingModal
        isOpen={showClosingModal}
        type="closing"
        tokenSymbol={position.token_symbol}
        direction={position.direction}
        leverage={position.leverage}
        onClose={() => {
          setShowClosingModal(false);
        }}
        canCancel={false} // Don't allow cancelling during anti-gaming delay
      />
      
      {/* Trade Results Modal */}
      <TradeResultsModal
        isOpen={showTradeResults}
        onClose={() => {
          setShowTradeResults(false);
          setTradeResultsData(null);
        }}
        tradeData={tradeResultsData}
      />
    </div>
  );
} 