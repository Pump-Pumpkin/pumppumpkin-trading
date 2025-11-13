import React, { useState, useEffect } from 'react';
import { Share2, X, TrendingUp } from 'lucide-react';

interface ShareGainsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: () => void;
  isProfit: boolean;
  pnlAmount: number;
  tokenSymbol: string;
  leverage: number;
  direction: 'Long' | 'Short';
  collateralAmount: number;
}

export default function ShareGainsPopup({ 
  isOpen, 
  onClose, 
  onShare, 
  isProfit, 
  pnlAmount, 
  tokenSymbol, 
  leverage, 
  direction,
  collateralAmount
}: ShareGainsPopupProps) {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowAnimation(true);
    } else {
      setShowAnimation(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handleShareClick = () => {
    onShare();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]">
      <div className={`bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full p-6 text-center transform transition-all duration-500 ${
        showAnimation ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}>
        
        {/* Close button */}
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-gray-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Icon */}
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-blue-600">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Main message */}
        <h2 className="text-xl font-bold mb-3 text-white">
          Trade Complete
        </h2>

        <p className="text-gray-300 text-sm mb-4">
          Share your trading results
        </p>

        {/* Trade details */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
          <p className={`text-xl font-bold mb-1 ${pnlAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {pnlAmount >= 0 ? '+' : ''}{formatCurrency(pnlAmount)}
          </p>
          <p className="text-gray-400 text-sm">
            {tokenSymbol} • {leverage}x {direction}
          </p>
        </div>

        {/* Call to action */}
        <p className="text-gray-300 text-sm mb-6">
          Share your trading results
        </p>



        {/* Action buttons */}
        <div className="space-y-3">
          {/* Share button */}
          <button
            onClick={handleShareClick}
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors"
            style={{ backgroundColor: '#1e7cfa' }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = '#1a6ce8';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = '#1e7cfa';
            }}
          >
            <div className="flex items-center justify-center space-x-2">
              <Share2 className="w-5 h-5" />
              <span>
                {collateralAmount > 0.1 
                  ? `Share to X and get ${(collateralAmount * 0.05).toFixed(4)} SOL`
                  : 'Share My Trade'
                }
              </span>
            </div>
          </button>

          {/* Skip button */}
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-700 text-gray-300 font-medium rounded-lg hover:bg-gray-600 hover:text-white transition-colors"
          >
            Maybe Later
          </button>
        </div>

        {/* Small encouragement text */}
        <p className="text-gray-400 text-xs mt-4">
          Share your trading experience with others
        </p>
      </div>
    </div>
  );
} 