import React, { useEffect, useMemo, useState } from 'react';
import { X, AlertTriangle, Clock, Wallet, Info, Eye, Download } from 'lucide-react';
import { supabase, userProfileService } from '../services/supabaseClient';
import { fetchSOLPrice, formatPrice } from '../services/birdeyeApi';
import { downloadPnlCard, generatePnlCard } from '../services/pnlCardService';
import type { TradingPosition } from '../services/positionService';
import PnlCardModal from './PnlCardModal';

interface TradeDetailsModalProps {
  positionId: number;
  onClose: () => void;
}

type TradeResults = {
  tokenSymbol: string;
  direction: 'Long' | 'Short';
  leverage: number;
  entryPrice: number;
  exitPrice: number;
  positionSize: number;
  collateralAmount: number;
  grossPnL: number;
  platformFee: number; // USD
  finalPnL: number; // USD
  pnlPercentage: number;
  totalReturn: number; // SOL
} | null;

// Fallback calculation for positions missing trade_results
function calculateFallbackResults(position: TradingPosition, solPrice: number | null): TradeResults {
  const entryPrice = Number(position.entry_price);
  const exitPrice = Number(position.close_price);
  const positionSize = Number(position.amount);
  const leverage = Number(position.leverage);
  const collateralSOL = Number(position.collateral_sol);
  const collateralAmount = collateralSOL;

  // PRIMARY: Use current_pnl if available, otherwise calculate
  let finalPnL = position.current_pnl || 0;
  let grossPnL = finalPnL;
  let platformFee = 0;
  
  // If current_pnl is missing or zero, calculate from prices
  if (!position.current_pnl && entryPrice && exitPrice) {
    console.log('🔧 Fallback: Calculating PNL from entry/exit prices');
    
    // Calculate position value in USD
    const positionValueUSD = positionSize * entryPrice;
    
    // Calculate price change percentage with leverage
    const priceChangePercent = ((exitPrice - entryPrice) / entryPrice) * 100;
    let pnlPercent = priceChangePercent * leverage;
    if (position.direction === 'Short') {
      pnlPercent = -pnlPercent;
    }
    
    // Calculate gross PnL in USD
    grossPnL = (pnlPercent / 100) * positionValueUSD;
    
    // Estimate platform fee (20% on total return for profits, 0 for liquidations)
    const totalReturnSOL = collateralSOL + (grossPnL / (solPrice || 100));
    if (position.status !== 'liquidated' && totalReturnSOL > 0) {
      const totalReturnUSD = totalReturnSOL * (solPrice || 100);
      platformFee = totalReturnUSD * 0.2;
      finalPnL = grossPnL - platformFee;
    } else {
      finalPnL = grossPnL;
    }
  } else {
    console.log('✅ Using current_pnl as primary source:', finalPnL);
    // Estimate gross PnL (reverse-engineer from final PnL)
    grossPnL = finalPnL; // Simplified - in reality fees would need to be added back
  }
  
  // Calculate percentage based on collateral
  const collateralUSD = collateralSOL * (solPrice || 100);
  const finalPnlPercent = collateralUSD > 0 ? (finalPnL / collateralUSD) * 100 : 0;
  
  const totalReturn = Math.max(0, collateralSOL + (finalPnL / (solPrice || 100)));

  return {
    tokenSymbol: position.token_symbol,
    direction: position.direction as 'Long' | 'Short',
    leverage: leverage,
    entryPrice: entryPrice,
    exitPrice: exitPrice,
    positionSize: positionSize,
    collateralAmount: collateralAmount,
    grossPnL: grossPnL,
    platformFee: platformFee,
    finalPnL: finalPnL,
    pnlPercentage: finalPnlPercent,
    totalReturn: totalReturn
  };
}

export default function TradeDetailsModal({ positionId, onClose }: TradeDetailsModalProps) {
  const [position, setPosition] = useState<TradingPosition | null>(null);
  const [tradeResults, setTradeResults] = useState<TradeResults>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [username, setUsername] = useState<string>('Trader');
  const [isUsingFallbackResults, setIsUsingFallbackResults] = useState(false);
  
  // PNL Card states
  const [showPnlPreview, setShowPnlPreview] = useState(false);
  const [pnlCardImage, setPnlCardImage] = useState<string | null>(null);
  const [pnlCardData, setPnlCardData] = useState<any>(null);
  const [isPnlCardGenerating, setIsPnlCardGenerating] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [{ data, error: err }, price] = await Promise.all([
          supabase.from('trading_positions').select('*').eq('id', positionId).single(),
          fetchSOLPrice().catch(() => null)
        ]);

        if (err) throw err;
        if (!data) throw new Error('Trade not found');

        if (!mounted) return;
        setPosition(data as TradingPosition);
        setSolPrice(typeof price === 'number' ? price : null);

        // Try to use trade_results JSON first, then fallback with current_pnl prioritization
        let tr: TradeResults | null = null;
        let usingFallback = false;
        
        // Try to parse trade_results first
        if ((data as TradingPosition).trade_results) {
          try {
            tr = JSON.parse((data as TradingPosition).trade_results as any) as TradeResults;
            console.log('✅ Using trade_results JSON data');
          } catch (e) {
            console.warn('⚠️ Failed to parse trade_results JSON, using fallback');
          }
        }
        
        // If trade_results is missing or invalid, use fallback calculation
        if (!tr && (data.status === 'closed' || data.status === 'liquidated')) {
          const position = data as TradingPosition;
          
          // Only mark as "estimated" if BOTH trade_results AND current_pnl are missing/unreliable
          const hasReliableData = position.current_pnl !== null && position.current_pnl !== undefined;
          
          if (hasReliableData) {
            console.log('✅ Using current_pnl as reliable source for position', positionId);
            usingFallback = false; // Don't show "Estimated" - we have reliable current_pnl
          } else {
            console.log('⚠️ Using estimated calculation (no reliable data) for position', positionId);
            usingFallback = true; // Show "Estimated" - we're truly estimating
          }
          
          tr = calculateFallbackResults(position, price);
        }
        
        setTradeResults(tr);
        setIsUsingFallbackResults(usingFallback);

        // Get username for PNL card
        try {
          const userProfile = await userProfileService.getProfile((data as TradingPosition).wallet_address);
          if (userProfile && mounted) {
            setUsername(userProfile.username);
          }
        } catch (e) {
          console.warn('Failed to load username for PNL card:', e);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load trade details');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [positionId]);

  const durationLabel = useMemo(() => {
    if (!position?.created_at || !position?.closed_at) return '-';
    const start = new Date(position.created_at).getTime();
    const end = new Date(position.closed_at).getTime();
    const ms = Math.max(0, end - start);
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) return `${hrs}h ${remMins}m`;
    return `${remMins}m`;
  }, [position?.created_at, position?.closed_at]);

  const approxCollateralUSD = useMemo(() => {
    if (!position || !solPrice) return null;
    return Number(position.collateral_sol) * solPrice;
  }, [position, solPrice]);

  const pnlColor = (value?: number | null) =>
    typeof value === 'number' ? (value >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-400';

  // PNL Card functions
  const generatePnlCardData = () => {
    if (!position || !tradeResults) return null;

    // Calculate total bought and sold amounts using exact USD amounts with decimals
    const positionValueUSD = tradeResults.positionSize * tradeResults.entryPrice;
    const totalBoughtUSD = positionValueUSD;
    const totalSoldUSD = positionValueUSD + tradeResults.finalPnL;

    return {
      tokenSymbol: position.token_symbol,
      direction: position.direction as 'Long' | 'Short',
      leverage: position.leverage,
      profitLossAmount: tradeResults.finalPnL, // Exact USD amount with decimals
      pnlPercentage: tradeResults.pnlPercentage, // This is the "Final PnL after fee" percentage
      totalBoughtUSD,
      totalSoldUSD,
      username
    };
  };

  // Generate and preview PNL card
  const handleGeneratePnlCard = async () => {
    try {
      const pnlData = generatePnlCardData();
      if (!pnlData) {
        alert('PNL card can only be generated for completed trades with results.');
        return;
      }

      // Show loading state
      setIsPnlCardGenerating(true);
      setShowPnlPreview(true);

      const blob = await generatePnlCard(pnlData);
      const imageUrl = URL.createObjectURL(blob);
      setPnlCardData(pnlData);
      setPnlCardImage(imageUrl);
      setIsPnlCardGenerating(false); // Hide loading
    } catch (error) {
      console.error('Error generating PNL card:', error);
      setIsPnlCardGenerating(false);
      setShowPnlPreview(false);
      alert('Failed to generate PNL card. Please try again.');
    }
  };

  // Download PNL card
  const handleDownloadPnlCard = async () => {
    try {
      const pnlData = generatePnlCardData();
      if (!pnlData) return;

      const isProfit = tradeResults && tradeResults.finalPnL >= 0;
      const filename = `${position?.token_symbol || 'Trade'}-${position?.direction || ''}-${isProfit ? 'profit' : 'loss'}-${Date.now()}.png`;
      await downloadPnlCard(pnlData, filename);
    } catch (error) {
      console.error('Error downloading PNL card:', error);
      alert('Failed to download PNL card. Please try again.');
    }
  };

  // Close PNL preview
  const closePnlPreview = () => {
    setShowPnlPreview(false);
    setIsPnlCardGenerating(false);
    if (pnlCardImage) {
      URL.revokeObjectURL(pnlCardImage);
      setPnlCardImage(null);
    }
    setPnlCardData(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pnlCardImage) {
        URL.revokeObjectURL(pnlCardImage);
      }
    };
  }, [pnlCardImage]);

  // Check if we can show PNL card button
  const canShowPnlCard = position && tradeResults && (position.status === 'closed' || position.status === 'liquidated');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 text-white flex items-center justify-center p-3 sm:p-4 z-50">
      <div className="bg-black border border-gray-800 rounded-lg sm:rounded-xl w-full max-w-[95vw] sm:max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gray-800 flex items-center justify-center text-lg font-bold">
                {position?.token_symbol ? position.token_symbol[0] : '?'}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg sm:text-xl font-bold">{position?.token_symbol || '—'}</h2>
                  {position && (
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${position.status === 'liquidated' ? 'bg-red-600/30 text-red-300' : 'bg-gray-700 text-gray-200'}`}>
                      {position.status}
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-xs sm:text-sm">Position #{position?.id ?? positionId}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          {isLoading && (
            <p className="text-gray-400">Loading trade details…</p>
          )}
          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 mb-4 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-300 mt-0.5" />
              <span className="text-red-200 text-sm">{error}</span>
            </div>
          )}

          {position && (
            <div className="space-y-3 sm:space-y-4">
              {/* Basic Info with PNL Card Button */}
              <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left side - Trade info */}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-300 font-semibold">{position.direction}</span>
                    <span className="px-2 py-0.5 rounded bg-purple-600/20 text-purple-300 font-semibold">{position.leverage}x</span>
                    <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-200 font-semibold">{position.order_type}</span>
                  </div>
                  
                  {/* Right side - PNL Card Button */}
                  {canShowPnlCard && (
                    <button
                      onClick={handleGeneratePnlCard}
                      className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border flex-shrink-0"
                      style={{ 
                        background: 'linear-gradient(135deg, #1e7cfa 0%, #0ea5e9 100%)',
                        borderColor: '#1e7cfa',
                        color: 'white',
                        boxShadow: '0 2px 10px rgba(30, 124, 250, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                        (e.target as HTMLElement).style.boxShadow = '0 4px 15px rgba(30, 124, 250, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(0)';
                        (e.target as HTMLElement).style.boxShadow = '0 2px 10px rgba(30, 124, 250, 0.3)';
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Share PNL</span>
                      <span className="sm:hidden">PNL</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Entry */}
              <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3 sm:p-4">
                <h3 className="font-semibold mb-2 sm:mb-3">Entry</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-500">Entry time</div>
                    <div>{position.created_at ? new Date(position.created_at).toLocaleString() : '—'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Entry price (USD)</div>
                    <div>{formatPrice(Number(position.entry_price))}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Amount (base)</div>
                    <div>{Number(position.amount).toFixed(6)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Position value (USD)</div>
                    <div>${Number(position.position_value_usd).toFixed(2)}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-gray-500 flex items-center space-x-1">
                      <Wallet className="w-3 h-3" />
                      <span>Collateral locked</span>
                      {solPrice && <span className="text-gray-500">(≈ USD)</span>}
                    </div>
                    <div>
                      {Number(position.collateral_sol).toFixed(4)} SOL
                      {approxCollateralUSD !== null && (
                        <span className="text-gray-400 ml-2">≈ ${approxCollateralUSD.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Liquidation price</div>
                    <div>{formatPrice(Number(position.liquidation_price))}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Margin-call price</div>
                    <div>{position.margin_call_price ? formatPrice(Number(position.margin_call_price)) : '—'}</div>
                  </div>
                </div>
              </div>

              {/* Exit */}
              {(position.status === 'closed' || position.status === 'liquidated') && (
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3 sm:p-4">
                  <h3 className="font-semibold mb-2 sm:mb-3">Exit</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500 flex items-center space-x-1"><Clock className="w-3 h-3" /><span>Close time</span></div>
                      <div>{position.closed_at ? new Date(position.closed_at).toLocaleString() : '—'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Close price (USD)</div>
                      <div>{position.close_price ? formatPrice(Number(position.close_price)) : '—'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Duration</div>
                      <div>{durationLabel}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Close reason</div>
                      <div className="capitalize">{position.close_reason || '—'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Results */}
              {tradeResults && (
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <h3 className="font-semibold">Results</h3>
                    {isUsingFallbackResults && (
                      <span className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded border border-yellow-700">
                        Estimated
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500">Gross PnL (USD)</div>
                      <div className={pnlColor(tradeResults.grossPnL)}>
                        {tradeResults.grossPnL >= 0 ? '+' : '-'}${Math.abs(tradeResults.grossPnL).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Final PnL after fee (USD)</div>
                      <div className={pnlColor(tradeResults.finalPnL)}>
                        {tradeResults.finalPnL >= 0 ? '+' : '-'}${Math.abs(tradeResults.finalPnL).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">PnL %</div>
                      <div className={pnlColor(tradeResults.pnlPercentage)}>
                        {tradeResults.pnlPercentage.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Total return (SOL)</div>
                      <div>{tradeResults.totalReturn.toFixed(6)} SOL</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 flex items-start space-x-2">
                    <Info className="w-3 h-3 mt-0.5" />
                    <span>
                      {isUsingFallbackResults 
                        ? 'Results are estimated due to missing trade data. Calculations may not reflect exact fees applied.' 
                        : 'Platform fee (20%) is applied on total return for non-liquidations. Values are from recorded trade data.'
                      }
                    </span>
                  </div>
                </div>
              )}


            </div>
          )}
        </div>
      </div>

      {/* PNL Card Modal */}
      <PnlCardModal
        isOpen={showPnlPreview}
        onClose={closePnlPreview}
        pnlCardImage={pnlCardImage}
        pnlCardData={pnlCardData}
        isLoading={isPnlCardGenerating}
      />
    </div>
  );
}



