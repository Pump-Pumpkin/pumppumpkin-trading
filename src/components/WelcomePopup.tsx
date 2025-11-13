import React from 'react';
import { X, Zap } from 'lucide-react';

interface WelcomePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDeposit: () => void;
}

export default function WelcomePopup({ isOpen, onClose, onOpenDeposit }: WelcomePopupProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Welcome to Pump Pumpkin!</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              <strong className="text-white">Trade meme tokens with leverage</strong> using your SOL balance, or <strong className="text-white">lock PPA tokens to earn instant SOL rewards</strong> for trading.
            </p>
            <p className="text-gray-300 text-sm leading-relaxed">
              Deposit SOL to start trading positions, or buy PPA tokens and lock them to get upfront SOL rewards you can use immediately.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Primary Action - Deposit */}
            <button
              onClick={() => {
                onOpenDeposit();
                onClose();
              }}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors"
              style={{ backgroundColor: '#1e7cfa' }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = '#1a6ce8';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = '#1e7cfa';
              }}
            >
              Deposit to Start Trading
            </button>
            
            {/* Secondary Action - Skip */}
            <button
              onClick={onClose}
              className="w-full py-2 px-4 bg-gray-700 text-gray-300 font-medium rounded-lg hover:bg-gray-600 hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 