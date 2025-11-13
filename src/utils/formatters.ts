/**
 * Format numbers with K, M, B suffixes for better readability
 * Examples:
 * 10,440,101.25 → 10.44M
 * 7,808,540.1449 → 7.81M
 * 15,000 → 15K
 * 850 → 850
 */
export const formatNumber = (num: number): string => {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  } else if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  } else {
    return num.toFixed(2);
  }
};

/**
 * ENHANCED: Format currency values with proper K/M/B suffixes and smart rounding
 * Examples:
 * 1,000,000,000 → $1B (not $1000M)
 * 1,500,000,000 → $1.5B
 * 999,000,000 → $999M
 * 1,200,000 → $1.2M
 * 15,000 → $15K
 */
export const formatCurrency = (num: number): string => {
  if (num >= 1_000_000_000) {
    const billions = num / 1_000_000_000;
    // Smart rounding: if it's close to a whole number, show fewer decimals
    if (billions >= 10) {
      return `$${billions.toFixed(1)}B`;
    } else {
      return `$${billions.toFixed(2)}B`;
    }
  } else if (num >= 1_000_000) {
    const millions = num / 1_000_000;
    // Don't show 1000M+ as millions, they should be billions
    if (millions >= 1000) {
      return `$${(num / 1_000_000_000).toFixed(2)}B`;
    }
    // Smart rounding for millions
    if (millions >= 100) {
      return `$${millions.toFixed(0)}M`;
    } else if (millions >= 10) {
      return `$${millions.toFixed(1)}M`;
    } else {
      return `$${millions.toFixed(2)}M`;
    }
  } else if (num >= 1_000) {
    const thousands = num / 1_000;
    if (thousands >= 100) {
      return `$${thousands.toFixed(0)}K`;
    } else {
      return `$${thousands.toFixed(1)}K`;
    }
  } else {
    return `$${num.toFixed(2)}`;
  }
};

/**
 * ENHANCED: Format token amounts with appropriate decimal places and smart rounding
 */
export const formatTokenAmount = (num: number): string => {
  if (num >= 1_000_000_000) {
    const billions = num / 1_000_000_000;
    if (billions >= 10) {
      return `${billions.toFixed(1)}B`;
    } else {
      return `${billions.toFixed(2)}B`;
    }
  } else if (num >= 1_000_000) {
    const millions = num / 1_000_000;
    // Don't show 1000M+ as millions
    if (millions >= 1000) {
      return `${(num / 1_000_000_000).toFixed(2)}B`;
    }
    if (millions >= 100) {
      return `${millions.toFixed(0)}M`;
    } else if (millions >= 10) {
      return `${millions.toFixed(1)}M`;
    } else {
      return `${millions.toFixed(2)}M`;
    }
  } else if (num >= 1_000) {
    const thousands = num / 1_000;
    if (thousands >= 100) {
      return `${thousands.toFixed(0)}K`;
    } else {
      return `${thousands.toFixed(1)}K`;
    }
  } else if (num >= 1) {
    return num.toFixed(2);
  } else if (num >= 0.01) {
    // For values between 0.01 and 1, show 2-4 decimal places
    return num.toFixed(4);
  } else if (num >= 0.0001) {
    // For very small values, show 4 decimal places max
    return num.toFixed(4);
  } else if (num > 0) {
    // For extremely small values, show as scientific notation or "~0"
    return num < 0.00001 ? "~0" : num.toFixed(4);
  } else {
    // For zero or negative, just show "0"
    return "0";
  }
};

/**
 * Format time relative to now (e.g., "1 minute ago", "2h ago", "3d ago")
 * Examples:
 * - 30 seconds ago → "30s ago"
 * - 5 minutes ago → "5m ago"
 * - 2 hours ago → "2h ago"
 * - 1 day ago → "1d ago"
 * - 3 weeks ago → "3w ago"
 * - 2 months ago → "2mo ago"
 * - 1.2 years ago → "1.2y ago"
 */
export const formatTimeAgo = (dateInput: string | Date | number): string => {
  try {
    let date: Date;
    
    // Handle different input types
    if (typeof dateInput === 'string') {
      // Try parsing different string formats
      if (dateInput === 'Unknown' || dateInput === 'N/A' || !dateInput.trim()) {
        return 'Unknown';
      }
      
      // Handle Unix timestamp strings
      if (/^\d+$/.test(dateInput)) {
        const timestamp = parseInt(dateInput);
        // If it's in seconds, convert to milliseconds
        date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
      } else {
        date = new Date(dateInput);
      }
    } else if (typeof dateInput === 'number') {
      // Handle Unix timestamps (seconds or milliseconds)
      date = new Date(dateInput > 1000000000000 ? dateInput : dateInput * 1000);
    } else {
      date = dateInput;
    }
    
    // Validate the date
    if (isNaN(date.getTime()) || date.getFullYear() < 2020) {
      return 'Unknown';
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    // Handle future dates (shouldn't happen but just in case)
    if (diffInSeconds < 0) {
      return 'Just now';
    }
    
    // Less than 1 minute
    if (diffInSeconds < 60) {
      return diffInSeconds <= 5 ? 'Just now' : `${diffInSeconds}s ago`;
    }
    
    // Less than 1 hour
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    
    // Less than 1 day
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    
    // Less than 1 week
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }
    
    // Less than 1 month (4 weeks)
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks}w ago`;
    }
    
    // Less than 1 year
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths}mo ago`;
    }
    
    // 1 year or more
    const diffInYears = diffInDays / 365;
    if (diffInYears < 2) {
      return diffInYears < 1.1 ? '1y ago' : `${diffInYears.toFixed(1)}y ago`;
    } else {
      return `${Math.floor(diffInYears)}y ago`;
    }
    
  } catch (error) {
    console.warn('Error formatting time ago:', error);
    return 'Unknown';
  }
};

/**
 * Format creation time with enhanced relative formatting
 * This function specifically handles token creation times and provides
 * both relative time and absolute date for better context
 */
export const formatCreationTime = (dateInput: string | Date | number): {
  relative: string;
  absolute: string;
  timestamp: number;
} => {
  try {
    let date: Date;
    
    // Handle different input types
    if (typeof dateInput === 'string') {
      if (dateInput === 'Unknown' || dateInput === 'N/A' || !dateInput.trim()) {
        return {
          relative: 'Unknown',
          absolute: 'Unknown',
          timestamp: 0
        };
      }
      
      // Handle Unix timestamp strings
      if (/^\d+$/.test(dateInput)) {
        const timestamp = parseInt(dateInput);
        date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
      } else {
        date = new Date(dateInput);
      }
    } else if (typeof dateInput === 'number') {
      date = new Date(dateInput > 1000000000000 ? dateInput : dateInput * 1000);
    } else {
      date = dateInput;
    }
    
    // Validate the date
    if (isNaN(date.getTime()) || date.getFullYear() < 2020) {
      return {
        relative: 'Unknown',
        absolute: 'Unknown',
        timestamp: 0
      };
    }
    
    const relative = formatTimeAgo(date);
    const absolute = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    
    return {
      relative,
      absolute,
      timestamp: date.getTime()
    };
    
  } catch (error) {
    console.warn('Error formatting creation time:', error);
    return {
      relative: 'Unknown',
      absolute: 'Unknown',
      timestamp: 0
    };
  }
};

/**
 * Format a date for display in different contexts
 */
export const formatDate = (
  dateInput: string | Date | number,
  format: 'short' | 'medium' | 'long' | 'relative' = 'medium'
): string => {
  try {
    let date: Date;
    
    if (typeof dateInput === 'string') {
      if (dateInput === 'Unknown' || dateInput === 'N/A' || !dateInput.trim()) {
        return 'Unknown';
      }
      
      if (/^\d+$/.test(dateInput)) {
        const timestamp = parseInt(dateInput);
        date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
      } else {
        date = new Date(dateInput);
      }
    } else if (typeof dateInput === 'number') {
      date = new Date(dateInput > 1000000000000 ? dateInput : dateInput * 1000);
    } else {
      date = dateInput;
    }
    
    if (isNaN(date.getTime())) {
      return 'Unknown';
    }
    
    switch (format) {
      case 'short':
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      
      case 'medium':
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      
      case 'long':
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        });
      
      case 'relative':
        return formatTimeAgo(date);
      
      default:
        return date.toLocaleDateString('en-US');
    }
    
  } catch (error) {
    console.warn('Error formatting date:', error);
    return 'Unknown';
  }
};