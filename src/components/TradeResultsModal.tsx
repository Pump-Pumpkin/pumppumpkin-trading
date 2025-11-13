import { useRef } from 'react';
import { CheckCircle, XCircle, TrendingUp, TrendingDown, X, Share2 } from 'lucide-react';

interface TradeResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tradeData: {
    tokenSymbol: string;
    direction: 'Long' | 'Short';
    leverage: number;
    entryPrice: number;
    exitPrice: number;
    positionSize: number;
    collateralAmount: number;
    grossPnL?: number;    // Gross P&L before fees (optional for backward compatibility)
    platformFee?: number; // 20% platform fee on total return (optional for backward compatibility)
    finalPnL: number;     // Net P&L after fees
    pnlPercentage: number;
    totalReturn: number;  // Collateral + Net P&L returned to user
  } | null;
}

export default function TradeResultsModal({ isOpen, onClose, tradeData }: TradeResultsModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (!isOpen || !tradeData) return null;

  const isProfit = tradeData.finalPnL >= 0;
  const resultColor = isProfit ? 'text-green-400' : 'text-red-400';
  const resultBg = isProfit ? 'bg-green-900' : 'bg-red-900';
  const resultBorder = isProfit ? 'border-green-700' : 'border-red-700';
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPrice = (price: number) => {
    if (price === 0) return '$0.00';
    
    // Show exactly 4 significant digits for trade results
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

  // Generate shareable image with trade results
  const generateShareImage = async (): Promise<string> => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Canvas not available');

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // Set canvas size for social media (1200x630 for optimal sharing)
    canvas.width = 1200;
    canvas.height = 630;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 630);

    // Add subtle pattern overlay
    ctx.fillStyle = 'rgba(30, 124, 250, 0.05)';
    for (let i = 0; i < 1200; i += 40) {
      for (let j = 0; j < 630; j += 40) {
        ctx.fillRect(i, j, 2, 2);
      }
    }

    // Main content area with border
    ctx.strokeStyle = isProfit ? '#10b981' : '#ef4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, 1120, 550);

    // Logo area (top left)
    ctx.fillStyle = '#1e7cfa';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('PUMP PUMPKIN', 80, 120);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.fillText('Leveraged Trading Platform', 80, 150);

    // Main P&L display (center)
    ctx.textAlign = 'center';
    ctx.fillStyle = isProfit ? '#10b981' : '#ef4444';
    ctx.font = 'bold 72px Arial';
    const pnlText = `${isProfit ? '+' : ''}${formatCurrency(tradeData.finalPnL)}`;
    ctx.fillText(pnlText, 600, 280);

    // Percentage
    ctx.font = 'bold 48px Arial';
    const percentText = `${isProfit ? '+' : ''}${tradeData.pnlPercentage.toFixed(1)}%`;
    ctx.fillText(percentText, 600, 340);

    // Trade details
    ctx.fillStyle = '#ffffff';
    ctx.font = '32px Arial';
    ctx.textAlign = 'left';
    
    ctx.fillText(`${tradeData.tokenSymbol} • ${tradeData.leverage}x ${tradeData.direction}`, 80, 420);
    ctx.fillText(`Entry: ${formatPrice(tradeData.entryPrice)}`, 80, 460);
    ctx.fillText(`Exit: ${formatPrice(tradeData.exitPrice)}`, 80, 500);

    // Success message
    ctx.fillStyle = '#9ca3af';
    ctx.font = '28px Arial';
    ctx.textAlign = 'center';
    const message = isProfit ? 'SICK GAINS!' : 'NEXT TIME!';
    ctx.fillText(message, 600, 440);

    // Call to action
    ctx.fillStyle = '#1e7cfa';
    ctx.font = 'bold 32px Arial';
    ctx.fillText('Start Trading at pumppumpkin.io', 600, 520);

    // Convert canvas to data URL
    return canvas.toDataURL('image/png', 0.9);
  };

  // Handle sharing
  const handleShare = async () => {
    try {
      const imageDataUrl = await generateShareImage();
      
      // Convert data URL to blob
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      
      const shareText = isProfit 
        ? `Just scored massive gains trading ${tradeData.tokenSymbol}! Check out my sick gains\n\nStart your own trading journey:`
        : `Took a hit on ${tradeData.tokenSymbol} but learning every day!\n\nJoin the action:`;
      
      const shareUrl = 'https://pumppumpkin.io';

      if (navigator.share && navigator.canShare) {
        // Use native sharing if available
        const file = new File([blob], 'trade-results.png', { type: 'image/png' });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Pump Pumpkin Trading Results',
            text: shareText,
            url: shareUrl,
            files: [file]
          });
        } else {
          // Fallback to text sharing
          await navigator.share({
            title: 'Pump Pumpkin Trading Results',
            text: `${shareText}\n${shareUrl}`
          });
        }
      } else {
        // Fallback: Copy to clipboard and download image
        const shareContent = `${shareText}\n${shareUrl}`;
        
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareContent);
        }
        
        // Trigger image download
        const link = document.createElement('a');
        link.download = 'pump-pumpkin-trade-results.png';
        link.href = imageDataUrl;
        link.click();
        
        alert('Share text copied to clipboard and image downloaded!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      alert('Sharing failed, but your results look amazing!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-2 z-50">
      <div className="bg-black border border-gray-700 rounded-lg max-w-xs w-full p-4 text-center">
        {/* Close button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Result icon */}
        <div className="mb-6">
          <div className={`w-16 h-16 mx-auto rounded-full ${resultBg} ${resultBorder} border-2 flex items-center justify-center mb-4`}>
            {isProfit ? (
              <CheckCircle className="w-8 h-8 text-green-400" />
            ) : (
              <XCircle className="w-8 h-8 text-red-400" />
            )}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white mb-2">
          {isProfit ? 'Trade Closed - Profit!' : 'Trade Closed - Loss'}
        </h2>
        
        {/* Token and direction info */}
        <div className="flex items-center justify-center space-x-2 mb-4">
          <div className={`flex items-center space-x-1 px-3 py-1 rounded text-sm font-medium ${
            tradeData.direction === 'Long' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
          }`}>
            {tradeData.direction === 'Long' ? 
              <TrendingUp className="w-4 h-4" /> : 
              <TrendingDown className="w-4 h-4" />
            }
            <span>{tradeData.tokenSymbol} {tradeData.leverage}x {tradeData.direction}</span>
          </div>
        </div>

        {/* Final P&L Display */}
        <div className={`border rounded-lg p-4 mb-4 ${resultBg} ${resultBorder}`}>
          <p className="text-gray-300 text-xs mb-1">Final P&L</p>
          <p className={`text-3xl font-bold ${resultColor} mb-1`}>
            {isProfit ? '+' : ''}{formatCurrency(tradeData.finalPnL)}
          </p>
          <p className={`text-sm ${resultColor}`}>
            {isProfit ? '+' : ''}{tradeData.pnlPercentage.toFixed(1)}% return
          </p>
        </div>

        {/* Trade Details */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Entry Price:</span>
            <span className="text-white">{formatPrice(tradeData.entryPrice)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Exit Price:</span>
            <span className="text-white">{formatPrice(tradeData.exitPrice)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Position Size:</span>
            <span className="text-white">{tradeData.positionSize.toFixed(3)} {tradeData.tokenSymbol}</span>
          </div>
          
          {/* Platform Fee Breakdown - Only show if there's a fee */}
          {tradeData.platformFee && tradeData.platformFee > 0 && (
            <div className="border-t border-gray-700 pt-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Gross Profit:</span>
                <span className="text-green-400">+{formatCurrency(tradeData.grossPnL || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-orange-400">Platform Fee (20%):</span>
                <span className="text-orange-400">-{formatCurrency(tradeData.platformFee)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium border-t border-gray-700 pt-1 mt-1">
                <span className="text-gray-300">Net Profit:</span>
                <span className="text-green-400">+{formatCurrency(tradeData.finalPnL)}</span>
              </div>
            </div>
          )}
          
          <div className="border-t border-gray-700 pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Original Collateral:</span>
              <span className="text-white">{tradeData.collateralAmount.toFixed(4)} SOL</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total Returned:</span>
              <span className={`font-medium ${tradeData.totalReturn > tradeData.collateralAmount ? 'text-green-400' : tradeData.totalReturn < tradeData.collateralAmount ? 'text-red-400' : 'text-white'}`}>
                {tradeData.totalReturn.toFixed(4)} SOL
              </span>
            </div>
          </div>
        </div>

        {/* Success message */}
        <p className="text-gray-400 text-sm mb-4">
          {isProfit 
            ? 'Great job! Your trade was profitable.' 
            : 'Trade completed. Better luck next time!'
          }
        </p>

        {/* Share section */}
        <div className="mb-4">
          <p className="text-gray-300 text-sm mb-3 text-center">
            {isProfit ? 'Flex those gains!' : 'Share your journey!'}
          </p>
          
          {/* Share button - styled like connect wallet */}
          <button
            onClick={handleShare}
            className="w-full mb-3 py-3 px-4 rounded-lg text-base font-medium transition-all duration-200 flex items-center justify-center space-x-2 border-2"
            style={{ 
              background: 'linear-gradient(135deg, #1e7cfa 0%, #0ea5e9 100%)',
              borderColor: '#1e7cfa',
              color: 'white',
              boxShadow: '0 4px 20px rgba(30, 124, 250, 0.3)'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.transform = 'translateY(-2px)';
              (e.target as HTMLElement).style.boxShadow = '0 8px 30px rgba(30, 124, 250, 0.4)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.transform = 'translateY(0)';
              (e.target as HTMLElement).style.boxShadow = '0 4px 20px rgba(30, 124, 250, 0.3)';
            }}
          >
            <Share2 className="w-5 h-5" />
            <span>Share My {isProfit ? 'Sick Gains' : 'Trading Journey'}</span>
          </button>
          
          <p className="text-gray-500 text-xs text-center">
            {isProfit 
              ? 'Show everyone your winning trade!'
              : 'Every trader has ups and downs - share the journey!'
            }
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full text-black font-medium py-3 px-4 rounded-lg text-base transition-colors"
          style={{ backgroundColor: '#1e7cfa' }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = '#1a6ce8';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = '#1e7cfa';
          }}
        >
          Continue Trading
        </button>
        
        {/* Hidden canvas for image generation */}
        <canvas 
          ref={canvasRef} 
          style={{ display: 'none' }}
          width={1200} 
          height={630}
        />
      </div>
    </div>
  );
} 