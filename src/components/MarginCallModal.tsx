import React from 'react';
import { X, AlertTriangle, Plus, Calculator } from 'lucide-react';
import { MarginCallAlert } from '../services/positionService';
import { formatPrice } from '../services/birdeyeApi';

interface MarginCallModalProps {
  alerts: MarginCallAlert[];
  onClose: () => void;
  onDeposit: () => void;
}

export default function MarginCallModal({ alerts, onClose, onDeposit }: MarginCallModalProps) {
  if (alerts.length === 0) return null;

  // Calculate total required collateral across all margin calls
  const totalRequiredSOL = alerts.reduce((sum, alert) => sum + alert.required_collateral, 0);
  const totalPositionsAtRisk = alerts.length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-3 z-50">
      <div className="bg-gray-900 border border-red-500 rounded-lg w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h2 className="text-lg font-bold text-red-400">Margin Call Warning</h2>
            </div>
            
            <button 
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Warning Message */}
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-red-300 font-medium mb-2">
                  {totalPositionsAtRisk === 1 
                    ? 'Your position is close to liquidation!' 
                    : `${totalPositionsAtRisk} positions are close to liquidation!`
                  }
                </h3>
                <p className="text-red-200 text-sm">
                  Add more SOL collateral now to avoid automatic liquidation and protect your portfolio.
                </p>
              </div>
            </div>
          </div>

          {/* Positions at Risk */}
          <div className="mb-4">
            <h4 className="text-gray-300 font-medium mb-3 text-sm">Positions at Risk</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
              {alerts.map((alert, index) => (
                <div key={alert.position.id} className="bg-gray-800 border border-red-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-medium text-sm">
                        {alert.position.token_symbol}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        alert.position.direction === 'Long' 
                          ? 'bg-green-900 text-green-300' 
                          : 'bg-red-900 text-red-300'
                      }`}>
                        {alert.position.direction}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {alert.position.leverage}x
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-red-400 text-sm font-medium">
                        {formatPrice(alert.current_price)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Entry:</span>
                    <span className="text-gray-300">
                      {formatPrice(alert.position.entry_price)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Liquidation:</span>
                    <span className="text-red-400 font-medium">
                      {formatPrice(alert.position.liquidation_price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Collateral Calculation */}
          <div className="bg-blue-900 border border-blue-700 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-3">
              <Calculator className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-blue-300 font-medium mb-2 text-sm">Required to Reach Safe Zone</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-200 text-sm">Additional SOL needed:</span>
                    <span className="text-blue-300 font-bold text-lg">
                      {totalRequiredSOL.toFixed(4)} SOL
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-blue-200 text-xs">Target margin ratio:</span>
                    <span className="text-blue-400 text-xs">50% (Safe Zone)</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-blue-200 text-xs">Current risk level:</span>
                    <span className="text-red-400 text-xs font-medium">80%+ (Critical)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Deposit Button */}
            <button
              onClick={onDeposit}
              className="w-full text-black font-bold py-3 px-4 rounded-lg text-base transition-colors flex items-center justify-center space-x-2"
              style={{ backgroundColor: '#1e7cfa' }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = '#1a6ce8';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = '#1e7cfa';
              }}
            >
              <Plus className="w-5 h-5" />
              <span>Deposit {totalRequiredSOL.toFixed(4)} SOL</span>
            </button>

            {/* Warning about liquidation */}
            <div className="bg-orange-900 border border-orange-700 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-orange-200 text-xs">
                    <strong>Important:</strong> Positions will be automatically liquidated at 100% loss. 
                    You currently have approximately{' '}
                    <span className="font-medium text-orange-300">
                      {((1 - 0.8) * 100).toFixed(0)}% buffer remaining
                    </span>{' '}
                    before liquidation.
                  </p>
                </div>
              </div>
            </div>

            {/* Dismiss Button */}
            <button
              onClick={onClose}
              className="w-full bg-transparent border border-gray-600 hover:border-gray-500 text-gray-400 hover:text-gray-300 font-medium py-2 px-4 rounded-lg text-sm transition-colors"
            >
              I'll Monitor Manually
            </button>
          </div>

          {/* Footer Note */}
          <div className="mt-4 pt-3 border-t border-gray-700">
            <p className="text-gray-500 text-xs text-center">
              This warning appears when your margin ratio exceeds 80%. 
              Liquidation occurs automatically at 100%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 