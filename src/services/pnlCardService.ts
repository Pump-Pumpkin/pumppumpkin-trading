import { supabase, userProfileService } from './supabaseClient';

// Template dimensions
const TEMPLATE_WIDTH = 1280;
const TEMPLATE_HEIGHT = 720;

// Coordinate mappings from your image map
const COORDINATES = {
  tokenSymbol: { x1: 56, y1: 127, x2: 291, y2: 192 },
  direction: { x1: 373, y1: 126, x2: 608, y2: 191 },
  leverage: { x1: 952, y1: 553, x2: 1068, y2: 657 },
  profitLoss: { x1: 188, y1: 210, x2: 446, y2: 307 },
  pnlPercentage: { x1: 479, y1: 379, x2: 608, y2: 423 },
  totalBought: { x1: 473, y1: 438, x2: 602, y2: 482 },
  totalSold: { x1: 470, y1: 489, x2: 599, y2: 533 },
  username: { x1: 77, y1: 595, x2: 386, y2: 677 }
};

interface PnlCardData {
  tokenSymbol: string;
  direction: 'Long' | 'Short';
  leverage: number;
  profitLossAmount: number; // USD
  pnlPercentage: number;
  totalBoughtUSD: number;
  totalSoldUSD: number;
  username: string;
}

interface TradeResultsData {
  tokenSymbol: string;
  direction: 'Long' | 'Short';
  leverage: number;
  entryPrice: number;
  exitPrice: number;
  positionSize: number;
  collateralAmount: number;
  grossPnL: number;
  platformFee: number;
  finalPnL: number;
  pnlPercentage: number;
  totalReturn: number;
}



function loadTemplateImage(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load PNL template image'));
    img.src = new URL('../assets/pnl-template.png', import.meta.url).href;
  });
}

async function ensureFontsReady(): Promise<void> {
  try {
    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
      await document.fonts.ready;
    }
  } catch {
    // Ignore font readiness failures
  }
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  } else {
    return `$${amount.toFixed(2)}`;  // Show 2 decimal places for exact amounts
  }
}

function formatPnL(amount: number): string {
  const sign = amount >= 0 ? '+' : '';
  if (Math.abs(amount) >= 1000000) {
    return `${sign}$${(amount / 1000000).toFixed(1)}M`;
  } else if (Math.abs(amount) >= 1000) {
    return `${sign}$${(amount / 1000).toFixed(1)}K`;
  } else {
    return `${sign}$${amount.toFixed(2)}`;  // Show 2 decimal places for exact amounts
  }
}

function formatPercentage(percentage: number): string {
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage.toFixed(1)}%`;
}

function drawTextAtPosition(
  ctx: CanvasRenderingContext2D,
  text: string,
  coords: { x1: number; y1: number; x2: number; y2: number },
  options: {
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    align?: 'left' | 'center' | 'right';
    strokeColor?: string;
    strokeWidth?: number;
  } = {}
) {
  const { 
    fontSize = 28, 
    fontWeight = '800', 
    color = '#ffffff', 
    align = 'center',
    strokeColor,
    strokeWidth = 2
  } = options;
  
  // Use a more modern, bold font stack
  ctx.font = `${fontWeight} ${fontSize}px "Segoe UI", "Roboto", "Arial Black", Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align as CanvasTextAlign;
  ctx.textBaseline = 'middle';

  let x: number;
  if (align === 'left') {
    x = coords.x1 + 10; // Add some padding from edge
  } else if (align === 'right') {
    x = coords.x2 - 10; // Add some padding from edge
  } else {
    x = (coords.x1 + coords.x2) / 2;
  }

  const y = (coords.y1 + coords.y2) / 2;
  
  // Add text stroke for better readability if specified
  if (strokeColor && strokeWidth > 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.strokeText(text, x, y);
  }
  
  ctx.fillText(text, x, y);
}

export async function generatePnlCard(data: PnlCardData, scale: number = 2): Promise<Blob> {
  await ensureFontsReady();
  
  const templateImg = await loadTemplateImage();
  
  const canvas = document.createElement('canvas');
  canvas.width = TEMPLATE_WIDTH * scale;
  canvas.height = TEMPLATE_HEIGHT * scale;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  
  // Enable high-quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Scale context for high-DPI
  ctx.scale(scale, scale);
  
  // Draw template background
  ctx.drawImage(templateImg, 0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);
  
  // Draw token symbol
  drawTextAtPosition(ctx, data.tokenSymbol, COORDINATES.tokenSymbol, {
    fontSize: 40,
    fontWeight: '900',
    color: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1
  });
  
  // Draw direction
  drawTextAtPosition(ctx, data.direction, COORDINATES.direction, {
    fontSize: 40,
    fontWeight: '900',
    color: data.direction === 'Long' ? '#00ff88' : '#ff4444',
    strokeColor: '#000000',
    strokeWidth: 1
  });
  
  // Draw leverage
  drawTextAtPosition(ctx, `${data.leverage}x`, COORDINATES.leverage, {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1
  });
  
  // Draw profit/loss amount (main display) - Better contrast colors for blue box
  const pnlColor = data.profitLossAmount >= 0 ? '#00ff88' : '#ff3366';
  drawTextAtPosition(ctx, formatPnL(data.profitLossAmount), COORDINATES.profitLoss, {
    fontSize: 56,
    fontWeight: '900',
    color: '#ffffff', // Always white for maximum contrast on blue background
    strokeColor: pnlColor,
    strokeWidth: 3
  });
  
  // Draw PNL percentage
  drawTextAtPosition(ctx, formatPercentage(data.pnlPercentage), COORDINATES.pnlPercentage, {
    fontSize: 24,
    fontWeight: '800',
    color: data.pnlPercentage >= 0 ? '#00ff88' : '#ff3366',
    strokeColor: '#000000',
    strokeWidth: 1
  });
  
  // Draw total bought
  drawTextAtPosition(ctx, formatCurrency(data.totalBoughtUSD), COORDINATES.totalBought, {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1
  });
  
  // Draw total sold
  drawTextAtPosition(ctx, formatCurrency(data.totalSoldUSD), COORDINATES.totalSold, {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1
  });
  
  // Draw username
  drawTextAtPosition(ctx, data.username, COORDINATES.username, {
    fontSize: 32,
    fontWeight: '800',
    color: '#cccccc',
    align: 'left',
    strokeColor: '#000000',
    strokeWidth: 1
  });
  
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to generate PNG blob'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

export async function downloadPnlCard(data: PnlCardData, filename?: string): Promise<void> {
  const blob = await generatePnlCard(data, 2);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `pnl-card-${data.tokenSymbol}-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Helper function to get PNL data from a closed trading position
export async function getPnlDataFromPosition(positionId: number): Promise<PnlCardData | null> {
  try {
    // Get the trading position
    const { data: position, error: positionError } = await supabase
      .from('trading_positions')
      .select('*')
      .eq('id', positionId)
      .eq('status', 'closed')
      .single();

    if (positionError || !position) {
      console.error('Position not found or not closed:', positionError);
      return null;
    }

    // Get user profile for username
    const userProfile = await userProfileService.getProfile(position.wallet_address);
    if (!userProfile) {
      console.error('User profile not found');
      return null;
    }

    // Use current_pnl as primary source for profit/loss amount
    const profitLossAmount = position.current_pnl || 0;
    
    // Calculate PNL percentage based on collateral (standardized calculation)
    const collateralUSD = position.collateral_sol * 100; // Approximate SOL price, will be more accurate in real implementation
    const pnlPercentage = collateralUSD > 0 ? (profitLossAmount / collateralUSD) * 100 : 0;
    
    const totalBoughtUSD = position.position_value_usd;
    const totalSoldUSD = totalBoughtUSD + profitLossAmount;

    console.log('📊 PNL Card Data (using current_pnl):', {
      positionId,
      profitLossAmount,
      pnlPercentage: pnlPercentage.toFixed(2) + '%',
      totalBoughtUSD,
      totalSoldUSD,
      collateralSOL: position.collateral_sol
    });

    return {
      tokenSymbol: position.token_symbol,
      direction: position.direction as 'Long' | 'Short',
      leverage: position.leverage,
      profitLossAmount,
      pnlPercentage,
      totalBoughtUSD,
      totalSoldUSD,
      username: userProfile.username
    };
  } catch (error) {
    console.error('Error getting PNL data from position:', error);
    return null;
  }
}

// Helper function to download PNL card for a specific position
export async function downloadPnlCardForPosition(positionId: number): Promise<void> {
  const pnlData = await getPnlDataFromPosition(positionId);
  if (!pnlData) {
    throw new Error('Failed to get PNL data for position');
  }
  
  await downloadPnlCard(pnlData, `pnl-${pnlData.tokenSymbol}-${positionId}.png`);
}
