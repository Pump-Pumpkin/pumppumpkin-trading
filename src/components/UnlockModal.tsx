import React, { useState } from 'react';
import { X, Unlock, Clock, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { soundManager } from '../services/soundManager';
import { formatTokenAmount, formatCurrency } from '../utils/formatters';
import { ppaLocksService } from '../services/supabaseClient';

interface UnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  expiredLock: any; // PPALock that has expired
  solPrice: number;
  onUnlockRequested?: () => void; // Callback when unlock is requested
}

export default function UnlockModal({ isOpen, onClose, expiredLock, solPrice, onUnlockRequested }: UnlockModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);

  if (!isOpen || !expiredLock) return null;

  const handleUnlockRequest = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    soundManager.playInputChange();

    try {
      console.log('🔓 Submitting unlock request for lock:', expiredLock.id);
      
      // Create unlock request in database
      const unlockRequest = await ppaLocksService.createUnlockRequest({
        wallet_address: expiredLock.wallet_address,
        lock_id: expiredLock.id,
        ppa_amount: expiredLock.ppa_amount
      });

      if (!unlockRequest) {
        throw new Error('Failed to create unlock request - please try again');
      }
      
      console.log('✅ Unlock request submitted successfully');
      setRequestSent(true);
      soundManager.playTradeSuccess();
      
      // Call the callback to refresh data
      if (onUnlockRequested) {
        onUnlockRequested();
      }

      // Close modal after 3 seconds
      setTimeout(() => {
        onClose();
        setRequestSent(false);
      }, 3000);

    } catch (error: any) {
      console.error('❌ Failed to submit unlock request:', error);
      setSubmitError(error.message || 'Failed to submit unlock request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !requestSent) {
      onClose();
      soundManager.playClick();
    }
  };

  // Calculate values
  const ppaAmount = expiredLock.ppa_amount || 0;
  const lockDays = expiredLock.lock_days || 0;
  const solRewardEarned = expiredLock.sol_reward || 0;
  const lockedDate = new Date(expiredLock.locked_at);
  const unlockDate = new Date(expiredLock.unlocks_at);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-900 rounded-full flex items-center justify-center">
              <Unlock className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">PPA Unlock Request</h2>
              <p className="text-gray-400 text-sm">Your tokens are ready to unlock</p>
            </div>
          </div>
          {!isSubmitting && !requestSent && (
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {requestSent ? (
            /* Success State */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Unlock Request Sent!</h3>
              <p className="text-gray-400 text-sm mb-4">
                Your unlock request has been submitted successfully. You will receive your PPA tokens back once processed.
              </p>
              <div className="bg-green-900 border border-green-700 rounded-lg p-3">
                <p className="text-green-300 text-sm">
                  Processing typically takes 24-48 hours. You'll be notified when your tokens are available.
                </p>
              </div>
            </div>
          ) : (
            /* Request Form */
            <>
              {/* Lock Details */}
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Lock Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">PPA Amount:</span>
                    <span className="text-white font-bold">{formatTokenAmount(ppaAmount)} PPA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Lock Period:</span>
                    <span className="text-white">{lockDays} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Locked Date:</span>
                    <span className="text-white">{lockedDate.toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Unlock Date:</span>
                    <span className="text-white">{unlockDate.toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-600">
                    <span className="text-gray-400">SOL Earned:</span>
                    <span className="text-green-400 font-bold">{solRewardEarned.toFixed(4)} SOL</span>
                  </div>
                </div>
              </div>

              {/* Warning Notice */}
              <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-yellow-300 font-semibold text-sm mb-1">
                      Unlock Request Process
                    </h4>
                    <p className="text-yellow-200 text-sm">
                      Your unlock request will be processed by our team. This typically takes 24-48 hours. 
                      Your PPA tokens will be returned to your wallet once approved.
                    </p>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {submitError && (
                <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-red-300 font-semibold text-sm mb-1">
                        Unlock Request Failed
                      </h4>
                      <p className="text-red-200 text-sm">{submitError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnlockRequest}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Requesting...</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>Request Unlock</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 