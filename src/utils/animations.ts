// Animation Utilities for Premium Trading App Experience

// Enhanced Animation Classes
export const animations = {
  // Smooth number transitions
  number: (duration: number = 300) => `
    transition: all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: center;
  `,
  
  // Button press feedback
  buttonPress: `
    transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
    &:active {
      transform: scale(0.96);
    }
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    }
  `,
  
  // Elastic button with magnetic effect
  buttonElastic: `
    transition: all 250ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
    &:hover {
      transform: scale(1.05) translateY(-2px);
    }
    &:active {
      transform: scale(0.95);
      transition-duration: 100ms;
    }
  `,
  
  // Smooth tab switching
  tabSwitch: `
    transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
    &.active {
      transform: scale(1.05);
    }
  `,
  
  // Card hover effects
  cardHover: `
    transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    }
  `,
  
  // Position card glow for profit/loss
  positionGlow: (isProfit: boolean) => `
    transition: all 500ms ease-in-out;
    box-shadow: 0 0 20px ${isProfit ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'};
    animation: ${isProfit ? 'profitPulse' : 'lossPulse'} 2s ease-in-out infinite;
  `,
  
  // Staggered loading animations
  staggeredFadeIn: (delay: number) => `
    animation: fadeInUp 600ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms both;
  `,
  
  // Floating action button pulse
  fabPulse: `
    animation: fabPulse 2s ease-in-out infinite;
    &:hover {
      animation-play-state: paused;
      transform: scale(1.1);
    }
  `,
  
  // Modal entrance
  modalEntrance: `
    animation: modalSlideUp 400ms cubic-bezier(0.4, 0, 0.2, 1);
  `,
  
  // Notification slide in
  notificationSlide: `
    animation: slideInRight 500ms cubic-bezier(0.4, 0, 0.2, 1);
  `,
  
  // Price change flash
  priceFlash: (isIncrease: boolean) => `
    animation: ${isIncrease ? 'flashGreen' : 'flashRed'} 800ms ease-out;
  `,
  
  // Loading skeleton
  skeleton: `
    background: linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%);
    background-size: 200% 100%;
    animation: shimmer 2s ease-in-out infinite;
  `,
  
  // Liquidation danger pulse
  dangerPulse: `
    animation: dangerPulse 1s ease-in-out infinite;
  `,
  
  // Success celebration
  celebration: `
    animation: celebration 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  `,
  
  // Smooth slide transitions
  slideLeft: `transform: translateX(-100%); transition: transform 300ms ease-out;`,
  slideRight: `transform: translateX(100%); transition: transform 300ms ease-out;`,
  slideUp: `transform: translateY(-100%); transition: transform 300ms ease-out;`,
  slideDown: `transform: translateY(100%); transition: transform 300ms ease-out;`,
};

// Keyframe Animations (to be injected into CSS)
export const keyframes = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes modalSlideUp {
    from {
      opacity: 0;
      transform: translateY(100px) scale(0.9);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(100px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes flashGreen {
    0%, 100% { background-color: transparent; }
    50% { background-color: rgba(34, 197, 94, 0.2); }
  }
  
  @keyframes flashRed {
    0%, 100% { background-color: transparent; }
    50% { background-color: rgba(239, 68, 68, 0.2); }
  }
  
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  
  @keyframes profitPulse {
    0%, 100% { 
      box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
      transform: scale(1);
    }
    50% { 
      box-shadow: 0 0 30px rgba(34, 197, 94, 0.6);
      transform: scale(1.02);
    }
  }
  
  @keyframes lossPulse {
    0%, 100% { 
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
      transform: scale(1);
    }
    50% { 
      box-shadow: 0 0 30px rgba(239, 68, 68, 0.6);
      transform: scale(1.02);
    }
  }
  
  @keyframes fabPulse {
    0%, 100% { 
      transform: scale(1);
      box-shadow: 0 8px 32px rgba(59, 130, 246, 0.4);
    }
    50% { 
      transform: scale(1.05);
      box-shadow: 0 12px 40px rgba(59, 130, 246, 0.6);
    }
  }
  
  @keyframes dangerPulse {
    0%, 100% { 
      border-color: rgba(239, 68, 68, 0.5);
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
    }
    50% { 
      border-color: rgba(239, 68, 68, 1);
      box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
    }
  }
  
  @keyframes celebration {
    0% { transform: scale(1) rotate(0deg); }
    25% { transform: scale(1.2) rotate(10deg); }
    50% { transform: scale(1.1) rotate(-5deg); }
    75% { transform: scale(1.15) rotate(5deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  
  @keyframes sparkle {
    0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
    50% { opacity: 1; transform: scale(1) rotate(180deg); }
  }
  
  @keyframes numberCountUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  @keyframes numberCountDown {
    from { transform: translateY(-20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

// Haptic feedback utility
export const hapticFeedback = {
  light: () => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  },
  medium: () => {
    if (navigator.vibrate) {
      navigator.vibrate(25);
    }
  },
  heavy: () => {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  },
  success: () => {
    if (navigator.vibrate) {
      navigator.vibrate([10, 50, 10]);
    }
  },
  error: () => {
    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 50]);
    }
  },
  notification: () => {
    if (navigator.vibrate) {
      navigator.vibrate([20, 20, 20]);
    }
  }
};

export default animations; 