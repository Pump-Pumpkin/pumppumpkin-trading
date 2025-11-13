// Smart text handling utilities for dynamic API content

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const getResponsiveTextClass = (text: string, baseClass: string = 'text-base'): string => {
  const length = text.length;
  
  if (length <= 10) return 'text-lg';
  if (length <= 20) return 'text-base';
  if (length <= 40) return 'text-sm';
  return 'text-xs';
};

export const formatTokenName = (name: string): string => {
  // Handle very long token names
  if (name.length > 25) {
    return truncateText(name, 25);
  }
  return name;
};

export const formatTokenSymbol = (symbol: string): string => {
  // Handle very long symbols
  if (symbol.length > 15) {
    return truncateText(symbol, 15);
  }
  return symbol.toUpperCase();
};

export const formatDescription = (description: string, isMobile: boolean = true): string => {
  const maxLength = isMobile ? 150 : 300;
  return truncateText(description, maxLength);
};

export const getSmartPriceTextClass = (priceString: string): string => {
  // Adjust text size based on price string length
  const length = priceString.length;
  
  if (length <= 8) return 'text-3xl';  // Short prices like $1.23
  if (length <= 12) return 'text-2xl'; // Medium prices like $1,234.56
  if (length <= 16) return 'text-xl';  // Long prices like $1,234,567.89
  return 'text-lg';                    // Very long prices
};

export const breakLongWords = (text: string, maxWordLength: number = 15): string => {
  return text.replace(new RegExp(`\\S{${maxWordLength},}`, 'g'), (match) => {
    return match.replace(new RegExp(`(.{${maxWordLength}})`, 'g'), '$1​'); // Zero-width space
  });
}; 