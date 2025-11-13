import React from 'react';
import { CheckCircle, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface TradeSuccessModalProps {
  isOpen: boolean;
  tokenSymbol: string;
  direction: 'Long' | 'Short';
  leverage: number;
  amount: string;
  onManagePosition: () => void;
  onClose: () => void;
}

export default function TradeSuccessModal({
  isOpen,
  tokenSymbol,
  direction,
  leverage,
  amount,
  onManagePosition,
  onClose
}: TradeSuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4 z-50">
      <div className="bg-black border border-green-700 rounded-xl max-w-sm w-full p-6 text-center">
        {/* Success Icon */}
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-900 border-2 border-green-700 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white mb-2">Trade Placed Successfully!</h2>
        
        {/* Trade Details - Simplified */}
        <div className="flex items-center justify-center mb-4">
          <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-base font-bold ${
            direction === 'Long' ? 'bg-green-900 text-green-300 border border-green-700' : 'bg-red-900 text-red-300 border border-red-700'
          }`}>
            {direction === 'Long' ? 
              <TrendingUp className="w-5 h-5" /> : 
              <TrendingDown className="w-5 h-5" />
            }
            <span>{leverage}x {tokenSymbol}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-400 text-sm mb-6">
          Your trade has been placed and is now being processed. You can monitor and manage your position in the Positions tab.
        </p>

        {/* Manage Position Button */}
        <button
          onClick={onManagePosition}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg text-base transition-colors flex items-center justify-center space-x-2 mb-3"
        >
          <span>Manage Position</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full text-gray-400 hover:text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
} 