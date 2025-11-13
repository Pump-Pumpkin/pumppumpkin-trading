import React, { useState, useEffect } from 'react';

interface LivePriceProps {
  price: number | string;
  previousPrice?: number;
  symbol?: string;
  className?: string;
  showChange?: boolean;
}

export default function LivePrice({ 
  price, 
  previousPrice, 
  symbol = '', 
  className = '', 
  showChange = false 
}: LivePriceProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'same'>('same');

  const numericPrice = typeof price === 'string' ? parseFloat(price.replace('$', '')) : price;
  const numericPrevious = previousPrice || numericPrice;

  useEffect(() => {
    if (previousPrice && numericPrice !== numericPrevious) {
      setIsUpdating(true);
      setPriceDirection(numericPrice > numericPrevious ? 'up' : 'down');
      
      const timer = setTimeout(() => {
        setIsUpdating(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [price, previousPrice, numericPrice, numericPrevious]);

  const formatPrice = (value: number): string => {
    if (value === 0) return '$0.00';
    
    if (value >= 1000) {
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (value >= 1) {
      // For prices >= $1, show 4 significant digits
      return `$${value.toPrecision(4)}`;
    } else if (value > 0) {
      // For small prices, show exactly 4 significant digits
      const precision4 = value.toPrecision(4);
      const asNumber = parseFloat(precision4);
      
      // Convert to decimal notation (avoid scientific notation)
      if (asNumber >= 0.0001) {
        return `$${asNumber}`;
      } else {
        // For very small numbers, calculate exact decimal places needed
        const magnitude = Math.floor(Math.log10(asNumber));
        const decimalPlaces = Math.abs(magnitude) + 3;
        return `$${asNumber.toFixed(decimalPlaces)}`;
      }
    } else {
      return '$0.00';
    }
  };

  const getUpdateClasses = (): string => {
    if (!isUpdating) return '';
    
    switch (priceDirection) {
      case 'up':
        return 'animate-pulse bg-green-500/20 text-green-400';
      case 'down':
        return 'animate-pulse bg-red-500/20 text-red-400';
      default:
        return 'animate-pulse bg-blue-500/20 text-blue-400';
    }
  };

  return (
    <span 
      className={`
        ${className}
        ${getUpdateClasses()}
        transition-all duration-300 ease-in-out
        rounded px-1
      `}
    >
      {typeof price === 'string' ? price : formatPrice(numericPrice)}
      {symbol && ` ${symbol}`}
    </span>
  );
} 