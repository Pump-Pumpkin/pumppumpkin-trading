import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, X } from 'lucide-react';

interface TradeLoadingModalProps {
  isOpen: boolean;
  type: 'opening' | 'closing';
  tokenSymbol: string;
  direction?: 'Long' | 'Short';
  leverage?: number;
  onClose?: () => void;
  canCancel?: boolean;
}

export default function TradeLoadingModal({ 
  isOpen, 
  type, 
  tokenSymbol, 
  direction, 
  leverage,
  onClose,
  canCancel = false
}: TradeLoadingModalProps) {
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(10);

  // Progress animation over 10 seconds
  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setTimeRemaining(10);
      return;
    }

    const startTime = Date.now();
    const duration = 10000; // 10 seconds

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      
      setProgress(newProgress);
      setTimeRemaining(remaining);
      
      if (elapsed >= duration) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const isOpening = type === 'opening';
  const title = isOpening ? 'Opening Trade' : 'Closing Trade';
  const description = isOpening 
    ? 'Sampling market prices for trade execution...' 
    : 'Sampling market prices for trade execution...';
  
  const bgColor = isOpening ? 'bg-blue-900' : 'bg-yellow-900';
  const borderColor = isOpening ? 'border-blue-700' : 'border-yellow-700';
  const textColor = isOpening ? 'text-blue-400' : 'text-yellow-400';
  const progressColor = isOpening ? 'bg-blue-500' : 'bg-yellow-500';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-2 z-50">
      <div className="bg-black border border-gray-700 rounded-lg max-w-xs w-full p-4 text-center">
        {/* Close button (only if cancellable) */}
        {canCancel && onClose && (
          <div className="flex justify-end mb-4">
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading spinner */}
        <div className="mb-6">
          <div className={`w-16 h-16 mx-auto rounded-full ${bgColor} ${borderColor} border-2 flex items-center justify-center mb-4`}>
            <Loader2 className={`w-8 h-8 ${textColor} animate-spin`} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        
        {/* Token and direction info */}
        {direction && leverage && (
          <div className="flex items-center justify-center space-x-2 mb-3">
            <div className={`flex items-center space-x-1 px-3 py-1 rounded text-sm font-medium ${
              direction === 'Long' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
            }`}>
              {direction === 'Long' ? 
                <TrendingUp className="w-4 h-4" /> : 
                <TrendingDown className="w-4 h-4" />
              }
              <span>{tokenSymbol} {leverage}x {direction}</span>
            </div>
          </div>
        )}

        {/* Description */}
        <p className="text-gray-400 text-sm mb-6">{description}</p>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 text-sm">Progress</span>
            <span className="text-white text-sm font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className={`${progressColor} h-2 rounded-full transition-all duration-300 ease-out`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Time remaining */}
        <div className="text-center">
          <div className="text-gray-400 text-xs">Time remaining</div>
          <div className="text-white text-lg font-bold">{timeRemaining}s</div>
        </div>

        {/* Anti-gaming notice (subtle) */}
        <div className="mt-4 text-xs text-gray-500 opacity-70">
          Processing trade execution
        </div>
      </div>
    </div>
  );
} 