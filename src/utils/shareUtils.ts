// Shared utility for generating and sharing trade result images

export interface TradeShareData {
  tokenSymbol: string;
  direction: 'Long' | 'Short';
  leverage: number;
  entryPrice: number;
  exitPrice: number;
  positionSize: number;
  collateralAmount: number;
  finalPnL: number;
  pnlPercentage: number;
  totalReturn: number;
}

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



// Detect if user is on mobile device
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Handle sharing reward credit
const handleSharingReward = async (tradeData: TradeShareData, walletAddress?: string) => {
  try {
    // Check if conditions are met for reward
    if (!walletAddress) {
      console.log('ℹ️ No wallet address provided for sharing reward');
      return;
    }
    
    if (tradeData.collateralAmount <= 0.1) {
      console.log('ℹ️ Trade collateral too small for sharing reward:', tradeData.collateralAmount);
      return;
    }
    
    // Calculate 5% of collateral as reward
    const rewardAmount = tradeData.collateralAmount * 0.05;
    console.log(`🎁 Conditions met for sharing reward - crediting ${rewardAmount} SOL (5% of ${tradeData.collateralAmount} SOL)`);
    
    // Import userProfileService dynamically to avoid circular dependencies
    const { userProfileService } = await import('../services/supabaseClient');
    
    const success = await userProfileService.creditSharingReward(walletAddress, rewardAmount);
    
    if (success) {
      console.log('✅ Sharing reward credited successfully!');
      // You could show a toast notification here in the future
    } else {
      console.error('❌ Failed to credit sharing reward');
    }
    
  } catch (error) {
    console.error('💥 Error handling sharing reward:', error);
  }
};

// Handle sharing trade results to X (Twitter) - text only
export const shareTradeResults = async (tradeData: TradeShareData, walletAddress?: string) => {
  try {
    const isProfit = tradeData.finalPnL >= 0;
    
    // Create clean share text for X/Twitter (no emojis, no hashtags)
    const pnlText = `${isProfit ? '+' : ''}${formatCurrency(tradeData.finalPnL)}`;
    
    const shareText = isProfit 
      ? `Just scored ${pnlText} trading ${tradeData.tokenSymbol} with ${tradeData.leverage}x leverage on @PumpPumpkinio!\n\n${tradeData.direction} position from ${formatPrice(tradeData.entryPrice)} to ${formatPrice(tradeData.exitPrice)}\n\nStart your trading journey: https://pumppumpkin.io`
      : `Closed my ${tradeData.tokenSymbol} trade: ${pnlText} with ${tradeData.leverage}x leverage on @PumpPumpkinio\n\n${tradeData.direction} from ${formatPrice(tradeData.entryPrice)} to ${formatPrice(tradeData.exitPrice)} - Every trade is a learning experience!\n\nJoin the action: https://pumppumpkin.io`;

    const encodedText = encodeURIComponent(shareText);
    
    // Choose URL based on device type
    let xShareUrl: string;
    if (isMobile()) {
      // Mobile: Try to open native X app first, fallback to web
      xShareUrl = `twitter://post?message=${encodedText}`;
      
      // Try native app first
      const nativeWindow = window.open(xShareUrl, '_blank');
      
      // If native app fails (after 2 seconds), open web version
      setTimeout(() => {
        if (!nativeWindow || nativeWindow.closed) {
          const webUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
          window.open(webUrl, '_blank', 'noopener,noreferrer');
        }
      }, 2000);
      
      // Credit sharing reward for mobile users
      await handleSharingReward(tradeData, walletAddress);
      
      return; // Exit early for mobile
    } else {
      // Desktop: Use web intent
      xShareUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    }
    
    // Open X sharing (desktop only reaches here)
    const newWindow = window.open(xShareUrl, '_blank', 'noopener,noreferrer');
    
    if (!newWindow) {
      // Fallback if popup was blocked - copy to clipboard
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        alert('X sharing popup was blocked, but your share text has been copied to clipboard!');
      } else {
        prompt('X popup blocked - copy this text to share on X:', shareText);
      }
    }
    
    // Credit sharing reward if conditions are met
    await handleSharingReward(tradeData, walletAddress);
    
  } catch (error) {
    console.error('Error sharing to X:', error);
    
    // Fallback: copy to clipboard
    try {
      const isProfit = tradeData.finalPnL >= 0;
      const pnlText = `${isProfit ? '+' : ''}${formatCurrency(tradeData.finalPnL)}`;
      
      const fallbackText = `Just traded ${tradeData.tokenSymbol}: ${pnlText} with ${tradeData.leverage}x leverage! Start trading at https://pumppumpkin.io`;
      
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(fallbackText);
        alert('Sharing failed, but your trade text has been copied to clipboard!');
      } else {
        prompt('Sharing failed - copy this text manually:', fallbackText);
      }
    } catch (clipboardError) {
      console.error('Clipboard fallback failed:', clipboardError);
      alert('Sharing failed. Please share your results manually!');
    }
  }
}; 