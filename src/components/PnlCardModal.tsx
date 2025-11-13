import { X, Download, Share } from 'lucide-react';
import { downloadPnlCard } from '../services/pnlCardService';

interface PnlCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  pnlCardImage: string | null;
  pnlCardData: any;
  isLoading?: boolean;
}

export default function PnlCardModal({ isOpen, onClose, pnlCardImage, pnlCardData, isLoading = false }: PnlCardModalProps) {
  if (!isOpen) return null;

  const handleDownloadPnlCard = async () => {
    try {
      const isProfit = pnlCardData.profitLossAmount >= 0;
      const filename = `${pnlCardData.tokenSymbol}-${pnlCardData.direction}-${isProfit ? 'profit' : 'loss'}-${Date.now()}.png`;
      await downloadPnlCard(pnlCardData, filename);
    } catch (error) {
      console.error('Error downloading PNL card:', error);
    }
  };

  const shareToTwitter = async () => {
    const isProfit = pnlCardData.profitLossAmount >= 0;
    const tweetText = `Just ${isProfit ? 'made gains' : 'closed a trade'} on @pumppumpkin! 💪 ${pnlCardData.tokenSymbol} ${pnlCardData.leverage}x ${pnlCardData.direction} #Trading #Crypto`;
    
    try {
      // Try native share first (mobile with image)
      if (navigator.share && pnlCardImage) {
        const response = await fetch(pnlCardImage);
        const blob = await response.blob();
        const file = new File([blob], 'pnl-card.png', { type: 'image/png' });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            text: tweetText,
            files: [file]
          });
          return;
        }
      }
      
      // Fallback for desktop: download + open Twitter
      await handleDownloadPnlCard();
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
      
      // Show toast-like alert for desktop users
      setTimeout(() => {
        alert('📎 Image downloaded! Attach it to your tweet on Twitter.');
      }, 500);
      
    } catch (error) {
      console.error('Error sharing to Twitter:', error);
      // Fallback to just opening Twitter
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4 z-[60]">
      <div className="bg-black border border-gray-700 rounded-lg max-w-4xl w-full p-6 text-center">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">
            {isLoading ? 'Generating PNL Card...' : 'Your PNL Card'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="mb-6 flex flex-col items-center justify-center py-16">
            {/* Animated Spinner */}
            <div className="relative mb-6">
              <div className="w-16 h-16 border-4 border-gray-600 border-t-orange-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-yellow-400 rounded-full animate-ping opacity-20"></div>
            </div>
            
            {/* Loading Text */}
            <div className="text-center">
              <p className="text-white text-lg font-medium mb-2">Creating your PNL card...</p>
              <p className="text-gray-400 text-sm">This may take a few seconds</p>
            </div>
          </div>
        ) : (
          <>
            {/* PNL Card Preview */}
            <div className="mb-6 flex justify-center">
              <img 
                src={pnlCardImage || undefined} 
                alt="PNL Card Preview" 
                className="max-w-full max-h-[60vh] rounded-lg border border-gray-600"
                style={{ imageRendering: 'crisp-edges' }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={shareToTwitter}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
              >
                <Share className="w-5 h-5" />
                <span>Share to 𝕏</span>
              </button>
              
              <button
                onClick={handleDownloadPnlCard}
                className="flex items-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
              >
                <Download className="w-5 h-5" />
                <span>Download</span>
              </button>
              
              <button
                onClick={onClose}
                className="flex items-center space-x-2 px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
              >
                <X className="w-5 h-5" />
                <span>Close</span>
              </button>
            </div>

            <p className="text-gray-400 text-sm mt-4">
              Share this PNL card on social media to flex your trading skills!
            </p>
          </>
        )}
      </div>
    </div>
  );
}
