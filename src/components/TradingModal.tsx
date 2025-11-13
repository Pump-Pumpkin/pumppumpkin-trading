import React, { useState, useEffect } from "react";
import {
  X,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Wallet,
  Calculator,
  Loader2,
} from "lucide-react";
import {
  formatPrice,
  fetchSOLPrice,
  fetchTokenDetailCached,
  TokenDetailData,
} from "../services/birdeyeApi";
import {
  positionService,
  CreatePositionData,
} from "../services/positionService";
import { userProfileService } from "../services/supabaseClient";
import webSocketService, {
  openBaseQuotePriceStream,
} from "../services/birdeyeWebSocket";
import priceService from "../services/businessPlanPriceService";
import TradeLoadingModal from "./TradeLoadingModal";
import TradeSuccessModal from "./TradeSuccessModal";
import { soundManager } from "../services/soundManager";

interface TradingModalProps {
  tokenData: TokenDetailData;
  onClose: () => void;
  userSOLBalance?: number;
  walletAddress: string;
  onUpdateSOLBalance?: (newBalance: number) => void;
  onShowTerms: () => void;
  onNavigateToPositions?: () => void;
}

type OrderType = "Market Order";
type TradeDirection = "Long" | "Short";

// TRADING CONSTANTS
const TRADING_FEE_RATE = 0.003; // 0.3% trading fee
const SLIPPAGE_RATE = 0.003; // 0.3% slippage for entry prices

export default function TradingModal({
  tokenData,
  onClose,
  userSOLBalance = 0,
  walletAddress,
  onUpdateSOLBalance,
  onShowTerms,
  onNavigateToPositions,
}: TradingModalProps) {
  const [tradeDirection, setTradeDirection] = useState<TradeDirection>("Long");
  const [orderType, setOrderType] = useState<OrderType>("Market Order");
  const [price, setPrice] = useState(tokenData.price.toString());
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState(2);
  const [isMaxUsed, setIsMaxUsed] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    position?: string;
  }>({});
  const [isExecutingTrade, setIsExecutingTrade] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);

  // Enhanced duplicate protection
  const [lastRequestHash, setLastRequestHash] = useState<string | null>(null);
  const [lastRequestTime, setLastRequestTime] = useState<number>(0);
  const [requestCooldown, setRequestCooldown] = useState<boolean>(false);

  // Trade loading modal state
  const [showTradeLoading, setShowTradeLoading] = useState(false);
  const [loadingTradeData, setLoadingTradeData] = useState<{
    type: "opening" | "closing";
    tokenSymbol: string;
    direction: "Long" | "Short";
    leverage: number;
  } | null>(null);

  // Trade success modal state
  const [showTradeSuccess, setShowTradeSuccess] = useState(false);

  // SOL price state for live trading
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState<boolean>(true);
  const [priceError, setPriceError] = useState<string | null>(null);

  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(
    null
  );

  // Mobile: toggle between Trade and Chart views
  const [mobileTab, setMobileTab] = useState<"trade" | "chart">("trade");

  // Live price via WS for focused token

  const [livePrice, setLivePrice] = useState<number>(tokenData.price);

  // Function to refresh user's SOL balance when balance mismatch detected
  const refreshUserBalance = async () => {
    try {
      console.log("🔄 Refreshing user SOL balance from database...");
      const userProfile = await userProfileService.getProfile(walletAddress);
      if (userProfile && onUpdateSOLBalance) {
        const dbBalance = userProfile.sol_balance;
        console.log(`💰 Updated SOL balance: ${userSOLBalance} → ${dbBalance}`);
        onUpdateSOLBalance(dbBalance);
      }
    } catch (error) {
      console.error("❌ Failed to refresh SOL balance:", error);
    }
  };

  // WebSocket live price for focused token (SOL quoted)
  useEffect(() => {
    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    let closeFn: (() => void) | null = null;

    try {
      closeFn = openBaseQuotePriceStream(
        tokenData.address,
        USDC_MINT,
        "1m",
        (d) => {
          if (typeof d?.c === "number" && isFinite(d.c) && d.c > 0) {
            setLivePrice(d.c);
          }
        }
      );
      console.log("📡 WS live price stream started for", tokenData.symbol);
    } catch (e) {
      console.warn("WS stream failed, staying on REST polling", e);
    }

    return () => {
      if (closeFn) {
        try {
          closeFn();
        } catch {}
        console.log("📡 WS live price stream closed for", tokenData.symbol);
      }
    };

    // re-open if token changes
  }, [tokenData.address, tokenData.symbol]);

  // Load SOL price on component mount
  useEffect(() => {
    const loadSOLPrice = async () => {
      setIsPriceLoading(true);
      setPriceError(null);

      try {
        const price = await fetchSOLPrice();
        setSolPrice(price);
        console.log(
          "SOL price loaded in TradingModal:",
          `$${price.toFixed(2)}`
        );
      } catch (error) {
        console.error(
          "CRITICAL: Failed to load SOL price in TradingModal:",
          error
        );
        setPriceError("Prices updating, try again in a moment");
        setSolPrice(null);
      } finally {
        setIsPriceLoading(false);
      }
    };

    loadSOLPrice();

    // Refresh SOL price every 2 minutes for conservative rate limiting
    const priceInterval = setInterval(loadSOLPrice, 120000);

    return () => clearInterval(priceInterval);
  }, []);

  // Retry price loading function
  const retryPriceLoad = () => {
    const loadSOLPrice = async () => {
      setIsPriceLoading(true);
      setPriceError(null);

      try {
        const price = await fetchSOLPrice();
        setSolPrice(price);
        console.log("SOL price retry successful:", `$${price.toFixed(2)}`);
      } catch (error) {
        console.error("SOL price retry failed:", error);
        setPriceError("Prices updating, try again in a moment");
        setSolPrice(null);
      } finally {
        setIsPriceLoading(false);
      }
    };

    loadSOLPrice();
  };

  const orderTypes: OrderType[] = ["Market Order"];

  // NEW: Calculate entry price with slippage
  const getEntryPrice = (): number => {
    const marketPrice = tokenData.price;

    if (tradeDirection === "Long") {
      // Long positions enter at higher price (unfavorable for trader)
      return marketPrice * (1 + SLIPPAGE_RATE);
    } else {
      // Short positions enter at lower price (unfavorable for trader)
      return marketPrice * (1 - SLIPPAGE_RATE);
    }
  };

  // NEW: Calculate entry price with slippage
  const getLivePrice = (): number => {
    const marketPrice = livePrice;

    if (tradeDirection === "Long") {
      // Long positions enter at higher price (unfavorable for trader)
      return livePrice * (1 + SLIPPAGE_RATE);
    } else {
      // Short positions enter at lower price (unfavorable for trader)
      return livePrice * (1 - SLIPPAGE_RATE);
    }
  };

  // Get the reference price for calculations (now uses entry price with slippage)
  const getReferencePrice = (): number => {
    if (orderType === "Market Order") {
      return getLivePrice(); // Use entry price with slippage
    } else {
      return parseFloat(price) || getLivePrice();
    }
  };

  // NEW: Calculate trading fee in SOL
  const calculateTradingFeeSOL = (): number => {
    if (!amount || !getReferencePrice() || !solPrice) {
      return 0;
    }

    const tokenAmount = parseFloat(amount);
    const entryPrice = getReferencePrice();

    // Calculate position value in USD
    const positionValueUSD = tokenAmount * entryPrice;

    // Calculate fee in USD
    const feeUSD = positionValueUSD * TRADING_FEE_RATE;

    // Convert fee to SOL
    const feeSOL = feeUSD / solPrice;

    return feeSOL;
  };

  // UPDATED: Calculate position value and collateral with fees included
  const calculatePositionInSOL = (): {
    tokenPriceInSOL: number;
    positionValueSOL: number;
    collateralSOL: number;
    tradingFeeSOL: number;
    totalRequiredSOL: number;
  } => {
    if (!amount || !getReferencePrice() || !solPrice) {
      return {
        tokenPriceInSOL: 0,
        positionValueSOL: 0,
        collateralSOL: 0,
        tradingFeeSOL: 0,
        totalRequiredSOL: 0,
      };
    }

    const tokenAmount = parseFloat(amount);
    const entryPrice = getReferencePrice();

    // Convert token price from USD to SOL
    const tokenPriceInSOL = entryPrice / solPrice;

    // Calculate position value in SOL (base position without leverage)
    const positionValueSOL = tokenAmount * tokenPriceInSOL;

    // Collateral needed in SOL = Position Value / Leverage
    const collateralSOL = positionValueSOL / leverage;

    // Calculate trading fee in SOL
    const tradingFeeSOL = calculateTradingFeeSOL();

    // Total required = Collateral + Trading Fee
    const totalRequiredSOL = collateralSOL + tradingFeeSOL;

    return {
      tokenPriceInSOL,
      positionValueSOL,
      collateralSOL,
      tradingFeeSOL,
      totalRequiredSOL,
    };
  };

  // Update the required collateral calculation to include fees
  const calculateRequiredCollateral = (): number => {
    const solCalculation = calculatePositionInSOL();
    return solCalculation.totalRequiredSOL; // Now includes fees
  };

  // Trade size calculation remains the same
  const calculateTradeSizeInSOL = (): number => {
    const solCalculation = calculatePositionInSOL();
    return solCalculation.positionValueSOL;
  };

  // Keep USD trade size for comparison
  const calculateTradeSize = (): number => {
    if (!amount || !getReferencePrice()) return 0;

    const tokenAmount = parseFloat(amount);
    const entryPrice = getReferencePrice();
    const basePositionValue = tokenAmount * entryPrice;

    return basePositionValue;
  };

  // UPDATED: Calculate liquidation price using entry price with slippage
  const calculateLiquidationPrice = (): number | null => {
    if (!amount || !getReferencePrice()) return null;

    const entryPrice = getReferencePrice(); // Already includes slippage

    if (tradeDirection === "Long") {
      return entryPrice * (1 - 1 / leverage);
    } else {
      return entryPrice * (1 + 1 / leverage);
    }
  };

  // UPDATED: Validate position size against SOL balance with fees included
  const validatePositionSize = (): string | null => {
    const totalRequiredSOL = calculateRequiredCollateral();

    if (totalRequiredSOL === 0) return null;

    console.log("Validation with Fees:", {
      userSOLBalance,
      totalRequiredSOL,
      validationPassed: userSOLBalance >= totalRequiredSOL,
      shortfall: Math.max(0, totalRequiredSOL - userSOLBalance),
    });

    if (totalRequiredSOL > userSOLBalance) {
      const shortfall = totalRequiredSOL - userSOLBalance;
      return `Need ${shortfall.toFixed(
        3
      )} more SOL to place this trade (includes fees)`;
    }

    return null;
  };

  // Validate position size
  const validatePosition = () => {
    const errors: { position?: string } = {};

    const positionError = validatePositionSize();
    if (positionError) {
      errors.position = positionError;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Auto-recalculate amount when leverage changes (if percentage was selected)
  useEffect(() => {
    if (selectedPercentage !== null && userSOLBalance > 0 && solPrice) {
      console.log(
        `🔄 Leverage changed to ${leverage}x, recalculating ${selectedPercentage}% amount...`
      );
      const timer = setTimeout(() => {
        handlePercentageClick(selectedPercentage);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [leverage, solPrice]);

  // Run validation whenever relevant values change
  useEffect(() => {
    validatePosition();
  }, [tradeDirection, amount, leverage, userSOLBalance]);

  // Generate request hash for deduplication
  const generateRequestHash = (tradeData: any): string => {
    const requestData = {
      wallet: walletAddress,
      token: tokenData.address,
      direction: tradeDirection,
      orderType: orderType,
      amount: parseFloat(amount || "0"),
      leverage: leverage,
      price: null,
      timeWindow: Math.floor(Date.now() / 5000) * 5000,
    };

    const jsonString = JSON.stringify(requestData);
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).slice(0, 16);
  };

  // Enhanced request validation
  const validateRequest = (): { valid: boolean; error?: string } => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < 2000) {
      return {
        valid: false,
        error: `Please wait ${Math.ceil(
          (2000 - timeSinceLastRequest) / 1000
        )} seconds before trying again`,
      };
    }

    const currentHash = generateRequestHash({
      wallet: walletAddress,
      token: tokenData.address,
      direction: tradeDirection,
      orderType: orderType,
      amount: amount,
      leverage: leverage,
      price: price,
    });

    if (lastRequestHash === currentHash && timeSinceLastRequest < 30000) {
      return {
        valid: false,
        error:
          "Duplicate request detected. Please modify trade parameters or wait 30 seconds.",
      };
    }

    return { valid: true };
  };

  // Enhanced cooldown management
  const startRequestCooldown = () => {
    setRequestCooldown(true);
    setTimeout(() => {
      setRequestCooldown(false);
    }, 3000);
  };

  const handleExecuteTrade = async () => {
    console.log("TRADE EXECUTION STARTED");

    // Enhanced duplicate protection
    console.log("🛡️ VALIDATING REQUEST (DUPLICATE PROTECTION)");

    const validation = validateRequest();
    if (!validation.valid) {
      console.log("❌ REQUEST BLOCKED:", validation.error);
      setTradeError(validation.error || "Request blocked");
      return;
    }

    if (isExecutingTrade || requestCooldown) {
      console.log("❌ TRADE ALREADY IN PROGRESS OR IN COOLDOWN");
      setTradeError("Trade already in progress or too soon after last attempt");
      return;
    }

    // CRITICAL CHECK: Verify user has sufficient balance before proceeding (including fees)
    const requiredCollateral = calculateRequiredCollateral();
    if (userSOLBalance < requiredCollateral) {
      console.log("❌ INSUFFICIENT BALANCE DETECTED AT FRONTEND:", {
        userBalance: userSOLBalance,
        required: requiredCollateral,
        shortfall: requiredCollateral - userSOLBalance,
      });
      setTradeError(
        `Insufficient SOL balance. You have ${userSOLBalance.toFixed(
          4
        )} SOL but need ${requiredCollateral.toFixed(4)} SOL (includes fees)`
      );
      refreshUserBalance();
      return;
    }

    // IMMEDIATELY disable button and set states
    setIsExecutingTrade(true);
    setTradeError(null);
    setTradeSuccess(null);
    startRequestCooldown();

    // Update tracking variables
    const currentTime = Date.now();
    const requestHash = generateRequestHash({
      wallet: walletAddress,
      token: tokenData.address,
      direction: tradeDirection,
      orderType: orderType,
      amount: amount,
      leverage: leverage,
      price: price,
    });

    setLastRequestHash(requestHash);
    setLastRequestTime(currentTime);

    console.log("🔒 REQUEST AUTHORIZED - PROCEEDING WITH TRADE EXECUTION");
    console.log("🔑 Request hash:", requestHash);
    console.log("⏰ Request time:", currentTime);

    // Get FRESH price from Birdeye WebSocket for maximum accuracy
    console.log(
      "GETTING FRESH PRICE FROM BIRDEYE WEBSOCKET FOR TRADE EXECUTION..."
    );
    let freshMarketPrice = tokenData.price; // Fallback to cached price

    // Try price service cache first (fast)
    const cachedPrice = priceService.getCachedPrice(tokenData.address);
    if (cachedPrice) {
      freshMarketPrice = cachedPrice;
      console.log("CACHED PRICE USED FOR TRADE:", {
        cached_price: tokenData.price,
        fresh_cached_price: freshMarketPrice,
        price_difference: freshMarketPrice - tokenData.price,
        price_change_percent:
          (
            ((freshMarketPrice - tokenData.price) / tokenData.price) *
            100
          ).toFixed(4) + "%",
        source: "Price Service Cache",
      });
    } else {
      console.log(
        "Birdeye WebSocket price not available, falling back to REST API..."
      );
      try {
        const freshTokenData = await fetchTokenDetailCached(tokenData.address);
        if (freshTokenData) {
          freshMarketPrice = freshTokenData.price;
          console.log("BIRDEYE REST API PRICE USED FOR TRADE:", {
            cached_price: tokenData.price,
            birdeye_rest_price: freshMarketPrice,
            price_difference: freshMarketPrice - tokenData.price,
            price_change_percent:
              (
                ((freshMarketPrice - tokenData.price) / tokenData.price) *
                100
              ).toFixed(4) + "%",
            source: "Birdeye REST API",
          });
        } else {
          console.log(
            "Both Birdeye WebSocket and REST API failed, using cached price:",
            tokenData.price
          );
        }
      } catch (error) {
        console.log(
          "Error fetching REST API price, using cached price:",
          error
        );
      }
    }

    // Calculate entry price with slippage based on fresh market price
    const entryPriceWithSlippage =
      tradeDirection === "Long"
        ? freshMarketPrice * (1 + SLIPPAGE_RATE)
        : freshMarketPrice * (1 - SLIPPAGE_RATE);

    console.log("ENTRY PRICE WITH SLIPPAGE CALCULATION:", {
      fresh_market_price: freshMarketPrice,
      trade_direction: tradeDirection,
      slippage_rate: SLIPPAGE_RATE,
      entry_price_with_slippage: entryPriceWithSlippage,
      slippage_amount: Math.abs(entryPriceWithSlippage - freshMarketPrice),
      slippage_percentage:
        (
          (Math.abs(entryPriceWithSlippage - freshMarketPrice) /
            freshMarketPrice) *
          100
        ).toFixed(3) + "%",
    });

    console.log("Initial Trade Parameters with Fees and Slippage:", {
      wallet_address: walletAddress,
      token_symbol: tokenData.symbol,
      token_address: tokenData.address,
      fresh_market_price_usd: freshMarketPrice,
      entry_price_with_slippage_usd: entryPriceWithSlippage,
      direction: tradeDirection,
      order_type: orderType,
      amount_input: amount,
      leverage: leverage,
      user_sol_balance: userSOLBalance,
      sol_price: solPrice,
      trading_fee_rate: TRADING_FEE_RATE,
      slippage_rate: SLIPPAGE_RATE,
    });

    if (!isFormValid()) {
      console.log("Form validation failed");
      return;
    }

    if (!validatePosition()) {
      console.log("Position validation failed");
      return;
    }

    try {
      // Step 1: Calculate all required values with fees
      console.log("STEP 1: CALCULATING ALL VALUES WITH FEES");

      const solCalculation = calculatePositionInSOL();
      const requiredCollateral = calculateRequiredCollateral();
      const tradeSizeSOL = calculateTradeSizeInSOL();
      const tradeSizeUSD = calculateTradeSize();

      console.log("🔢 ALL CALCULATIONS COMPLETE WITH FEES:", {
        RAW_INPUTS: {
          tokenAmount: parseFloat(amount),
          marketPrice: freshMarketPrice,
          entryPriceWithSlippage: entryPriceWithSlippage,
          solPrice: solPrice,
          leverage: leverage,
        },
        SOL_CALCULATION: solCalculation,
        COLLATERAL_REQUIRED: requiredCollateral,
        TRADE_SIZE_SOL: tradeSizeSOL,
        TRADE_SIZE_USD: tradeSizeUSD,
        FEE_BREAKDOWN: {
          trading_fee_sol: solCalculation.tradingFeeSOL,
          trading_fee_usd: solCalculation.tradingFeeSOL * (solPrice ?? 0),
          fee_rate: TRADING_FEE_RATE,
        },
        VALIDATION: {
          user_balance: userSOLBalance,
          required: requiredCollateral,
          sufficient: userSOLBalance >= requiredCollateral,
          shortfall: Math.max(0, requiredCollateral - userSOLBalance),
        },
      });

      // Step 2: Build position data for database
      console.log("STEP 2: BUILDING POSITION DATA FOR DATABASE");

      const positionData: CreatePositionData = {
        wallet_address: walletAddress,
        token_address: tokenData.address,
        token_symbol: tokenData.symbol,
        direction: tradeDirection,
        order_type: orderType,
        target_price: undefined,
        fresh_market_price: freshMarketPrice, // Pass the fresh market price
        entry_price_with_slippage: entryPriceWithSlippage, // Pass the calculated entry price with slippage
        amount: parseFloat(amount),
        leverage: leverage,
        trading_fee_rate: TRADING_FEE_RATE,
        slippage_rate: SLIPPAGE_RATE,
      };

      console.log("📤 EXACT DATA BEING SENT TO DATABASE:", {
        POSITION_DATA: positionData,
        PRICING_DETAILS: {
          fresh_market_price: freshMarketPrice,
          entry_price_with_slippage: entryPriceWithSlippage,
          price_difference: entryPriceWithSlippage - freshMarketPrice,
          slippage_applied: SLIPPAGE_RATE,
        },
        FEE_DETAILS: {
          trading_fee_rate: TRADING_FEE_RATE,
          expected_fee_sol: solCalculation.tradingFeeSOL,
          expected_fee_usd: solCalculation.tradingFeeSOL * (solPrice ?? 0),
        },
      });

      // Step 3: Send to atomic backend with enhanced error handling
      console.log(
        "STEP 3: SENDING TO ATOMIC BACKEND (positionService.createPosition)"
      );

      const position = await positionService.createPosition(positionData);

      console.log("BACKEND RESPONSE:", {
        POSITION_CREATED: position,
        POSITION_ID: position.id,
        STATUS: position.status,
      });

      // Step 4: Check balance update
      console.log("STEP 4: CHECKING BALANCE UPDATES");

      const updatedProfile = await userProfileService.getProfile(walletAddress);
      if (updatedProfile && onUpdateSOLBalance) {
        const actualDeduction = userSOLBalance - updatedProfile.sol_balance;
        const calculationMatch =
          Math.abs(actualDeduction - requiredCollateral) < 0.001;

        console.log("BALANCE UPDATE ANALYSIS WITH FEES:", {
          BEFORE_TRADE: {
            ui_balance: userSOLBalance,
            ui_predicted_requirement: requiredCollateral,
          },
          AFTER_TRADE: {
            new_db_balance: updatedProfile.sol_balance,
            actual_deduction: actualDeduction,
          },
          MATCH_ANALYSIS: {
            calculation_matches: calculationMatch,
            difference: actualDeduction - requiredCollateral,
            percentage_difference:
              (
                ((actualDeduction - requiredCollateral) / requiredCollateral) *
                100
              ).toFixed(2) + "%",
          },
        });

        onUpdateSOLBalance(updatedProfile.sol_balance);
      }

      console.log("TRADE EXECUTION COMPLETED SUCCESSFULLY");

      // Show success modal for Market Orders
      if (orderType === "Market Order") {
        setShowTradeSuccess(true);
      } else {
        setTradeSuccess(
          `Limit order placed successfully! Order ID: ${position.id}`
        );
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      console.error("TRADE EXECUTION ERROR");
      console.error("Error details:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      // Enhanced error handling with specific messages
      let errorMessage =
        "Trade failed, please check your details and try again";

      if (error.message?.includes("Request already in progress")) {
        errorMessage =
          "Another request is being processed. Please wait a moment.";
      } else if (error.message?.includes("already have an active position")) {
        errorMessage =
          "You already have an active position for this token. Please close it first.";
      } else if (error.message?.includes("Duplicate request detected")) {
        errorMessage =
          "Duplicate request detected. Please wait before retrying.";
      } else if (error.message?.includes("Insufficient SOL balance")) {
        errorMessage = error.message;
        console.log(
          "🔄 Refreshing SOL balance after insufficient funds error..."
        );
        refreshUserBalance();
      } else if (
        error.message?.includes("Position size") &&
        error.message?.includes("exceeds limit")
      ) {
        errorMessage = error.message;
        console.log("🔄 Refreshing SOL balance after position size error...");
        refreshUserBalance();
      } else {
        console.log(
          "🔄 Refreshing SOL balance after trade error to ensure UI accuracy..."
        );
        refreshUserBalance();
      }

      setTradeError(errorMessage);

      // Reset tracking on error to allow retry after cooldown
      setTimeout(() => {
        setLastRequestHash(null);
        setLastRequestTime(0);
      }, 5000);
    } finally {
      setIsExecutingTrade(false);
      console.log("🏁 TRADE EXECUTION PROCESS ENDED 🏁");
    }
  };

  const formatTradeSize = () => {
    const tradeSize = calculateTradeSize();
    return tradeSize.toFixed(2);
  };

  const isFormValid = () => {
    const basicValidation =
      orderType === "Market Order"
        ? amount && parseFloat(amount) > 0
        : amount && price && parseFloat(amount) > 0 && parseFloat(price) > 0;

    const positionValidation = !validationErrors.position;
    const priceValidation = solPrice !== null && !isPriceLoading && !priceError;
    const executionValidation = !isExecutingTrade && !requestCooldown;

    return (
      basicValidation &&
      positionValidation &&
      priceValidation &&
      executionValidation
    );
  };

  const handlePriceChange = (value: string) => {
    setPrice(value);
    if (value.length > 0) {
      soundManager.playInputChange();
    }
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    setIsMaxUsed(false);
    setSelectedPercentage(null);
    if (validationErrors.position) {
      setValidationErrors((prev) => ({ ...prev, position: undefined }));
    }
  };

  const handleLeverageChange = (value: number) => {
    if (value !== leverage) {
      setLeverage(value);

      if (selectedPercentage !== null) {
        handlePercentageClick(selectedPercentage);
      } else if (isMaxUsed) {
        handlePercentageClick(100);
      }
    }
  };

  // UPDATED: Calculate max position size including fees
  const getMaxPositionSize = (): number => {
    if (userSOLBalance === 0 || !solPrice) return 0;

    const entryPrice = getEntryPrice(); // Use entry price with slippage
    if (entryPrice === 0) return 0;

    // Convert token price to SOL terms
    const tokenPriceInSOL = entryPrice / solPrice;

    // Use 95% of balance to leave room for calculations
    const availableSOL = userSOLBalance * 0.95;

    // We need to solve for token amount where:
    // availableSOL = collateral + trading_fee
    // collateral = (tokenAmount * tokenPriceInSOL) / leverage
    // trading_fee = (tokenAmount * entryPrice * TRADING_FEE_RATE) / solPrice

    // Combined: availableSOL = (tokenAmount * tokenPriceInSOL / leverage) + (tokenAmount * entryPrice * TRADING_FEE_RATE / solPrice)
    // Factor out tokenAmount: availableSOL = tokenAmount * (tokenPriceInSOL / leverage + entryPrice * TRADING_FEE_RATE / solPrice)

    const costPerToken =
      tokenPriceInSOL / leverage + (entryPrice * TRADING_FEE_RATE) / solPrice;
    const maxTokenAmount = availableSOL / costPerToken;

    console.log("🔢 MAX POSITION CALCULATION WITH FEES:", {
      userSOLBalance: userSOLBalance.toFixed(4),
      availableSOL: availableSOL.toFixed(4),
      entryPrice: entryPrice.toFixed(6),
      leverage: leverage,
      tradingFeeRate: TRADING_FEE_RATE,
      costPerToken: costPerToken.toFixed(8),
      maxTokenAmount: maxTokenAmount.toFixed(6),
    });

    return Math.max(0, maxTokenAmount);
  };

  // Continuing from where the code was cut off...

  const handlePercentageClick = (percentage: number) => {
    const maxAmount = getMaxPositionSize();
    const percentAmount = maxAmount * (percentage / 100);

    console.log(`🔢 ${percentage}% calculation with fees:`, {
      currentLeverage: `${leverage}x`,
      maxPossibleAmount: maxAmount.toFixed(6),
      percentageAmount: percentAmount.toFixed(6),
      userSOLBalance: userSOLBalance.toFixed(4),
      solPrice: solPrice?.toFixed(2),
      entryPrice: getEntryPrice().toFixed(6),
    });

    if (percentAmount > 0) {
      setAmount(percentAmount.toFixed(6));
      setIsMaxUsed(percentage === 100);
      setSelectedPercentage(percentage);

      // Clear validation errors when amount changes
      if (validationErrors.position) {
        setValidationErrors((prev) => ({ ...prev, position: undefined }));
      }

      // Sound feedback for button clicks (only for manual clicks, not auto-recalculation)
      if (document.activeElement?.tagName === "BUTTON") {
        soundManager.playInputChange();
      }
    } else {
      console.warn(
        `⚠️ Cannot calculate ${percentage}% - insufficient balance or missing price data`
      );
    }
  };

  // Dynamic percentage buttons configuration with enhanced styling
  const percentageButtons = [
    {
      label: "10%",
      value: 10,
      baseColor: "bg-blue-600 hover:bg-blue-500",
      activeColor: "bg-blue-400 hover:bg-blue-300",
      description: "10% of max collateral",
    },
    {
      label: "25%",
      value: 25,
      baseColor: "bg-blue-600 hover:bg-blue-500",
      activeColor: "bg-blue-400 hover:bg-blue-300",
      description: "25% of max collateral",
    },
    {
      label: "50%",
      value: 50,
      baseColor: "bg-blue-600 hover:bg-blue-500",
      activeColor: "bg-blue-400 hover:bg-blue-300",
      description: "50% of max collateral",
    },
    {
      label: "MAX",
      value: 100,
      baseColor: "bg-orange-600 hover:bg-orange-500",
      activeColor: "bg-orange-400 hover:bg-orange-300",
      description: "100% of max collateral",
    },
  ];

  const handleOrderTypeChange = (newOrderType: OrderType) => {
    soundManager.playSwitch();
    setOrderType(newOrderType);

    // If MAX has been used, recalculate max amount for new order type
    if (isMaxUsed) {
      handlePercentageClick(100);
    }
  };

  // Get liquidation price calculation for display
  const liquidationPrice = calculateLiquidationPrice();

	return (
		<div className="fixed inset-0 bg-black bg-opacity-90 text-white flex items-center justify-center p-4 z-50">
			<div className="bg-black border border-gray-800 rounded-xl w-full max-w-[96vw] max-h-[95vh] overflow-hidden">
				<div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 h-full">
					{/* Mobile tabs: switch between Trade and Chart */}
					<div className="md:hidden col-span-1">
						<div className="flex bg-gray-900 rounded-xl p-1">
							<button
								className={`flex-1 py-3 rounded-lg text-sm font-bold ${
								  mobileTab === "trade"
								    ? "bg-blue-600 text-white"
								    : "text-gray-300"
								}`}
								onClick={() => setMobileTab("trade")}
							>
								Trade
							</button>
							<button
								className={`flex-1 py-3 rounded-lg text-sm font-bold ${
								  mobileTab === "chart"
								    ? "bg-blue-600 text-white"
								    : "text-gray-300"
								}`}
								onClick={() => setMobileTab("chart")}
							>
								Chart
							</button>
						</div>
					</div>
					{/* Left: Dynamic Birdeye Chart */}
					<div className={`rounded-xl overflow-hidden bg-gray-900 border border-gray-800 md:col-span-8 col-span-1 ${mobileTab === "chart" ? "block" : "hidden"} md:block`}>
						<iframe
							title={`Chart-${tokenData.symbol}`}
							src={`https://birdeye.so/tv-widget/${tokenData.address}?chain=solana&theme=dark`}
							className="w-full h-[360px] md:h-[80vh]"
							frameBorder="0"
							allowFullScreen
						/>
					</div>
					{/* Right: Existing trade UI */}
					<div className={`md:col-span-4 col-span-1 pr-1 md:max-h-[80vh] max-h-[70dvh] overflow-y-auto ${mobileTab === "trade" ? "block" : "hidden"} md:block`}>
          {/* Header with close button */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              {/* Token Icon */}
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-800 flex items-center justify-center">
                {tokenData.logoURI ? (
                  <img
                    src={tokenData.logoURI}
                    alt={tokenData.symbol}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = "none";
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) {
                        fallback.style.display = "flex";
                      }
                    }}
                  />
                ) : null}
                <span
                  className={`text-lg font-bold text-white ${
                    tokenData.logoURI ? "hidden" : "flex"
                  }`}
                >
                  {tokenData.symbol.charAt(0)}
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-bold">{tokenData.symbol}</h2>
                <div className="flex items-center space-x-2">
                  <p className="text-gray-400 text-lg">
                    {formatPrice(livePrice)}
                  </p>
                  {tokenData.isLoading && (
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                soundManager.playModalClose();
                onClose();
              }}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-7 h-7" />
            </button>
          </div>

          {/* Trade Direction Tabs */}
          <div className="flex mb-6 bg-gray-900 rounded-xl p-2">
            <button
              onClick={() => {
                if (tradeDirection !== "Long") {
                  soundManager.playDirectionSelect();
                  setTradeDirection("Long");
                }
              }}
              className={`flex-1 py-4 px-4 text-lg font-bold rounded-xl transition-colors ${
                tradeDirection === "Long"
                  ? "text-black bg-green-500"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>Long</span>
              </div>
            </button>
            <button
              onClick={() => {
                if (tradeDirection !== "Short") {
                  soundManager.playDirectionSelect();
                  setTradeDirection("Short");
                }
              }}
              className={`flex-1 py-4 px-4 text-lg font-bold rounded-xl transition-colors ${
                tradeDirection === "Short"
                  ? "text-black bg-red-500"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <TrendingDown className="w-5 h-5" />
                <span>Short</span>
              </div>
            </button>
          </div>

          {/* Form */}
          <div className="space-y-5">
            {/* Order Type: Market Order Only */}
            <div className="text-center bg-gray-900 border border-gray-700 rounded-xl px-4 py-4">
              <span className="text-white text-lg">Market Order</span>
              <p className="text-gray-400 text-sm mt-1">
                Execute immediately at market price
              </p>
            </div>

            {/* Available Balances */}
            <div className="w-full">
              <div className="text-center bg-gray-900 rounded-xl p-4">
                <div className="flex items-center justify-center mb-2">
                  <Wallet className="w-5 h-5 text-gray-400 mr-2" />
                  <p className="text-gray-400 text-sm">Available SOL Balance</p>
                </div>
                <p className="text-white text-lg font-bold">
                  {userSOLBalance.toFixed(3)} SOL
                </p>
              </div>
            </div>

            {/* Entry Price Display with Slippage
            {amount && parseFloat(amount) > 0 && (
              <div className="bg-purple-900 border border-purple-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-400 text-sm">Market Price</span>
                  <span className="text-purple-300 text-sm font-bold">
                    {formatPrice(livePrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-purple-400 text-sm">
                    Entry Price ({tradeDirection === "Long" ? "+" : "-"}0.3%
                    slippage)
                  </span>
                  <span className="text-purple-300 text-sm font-bold">
                    {formatPrice(getLivePrice())}
                  </span>
                </div>
                <div className="text-center mt-2 pt-2 border-t border-purple-800">
                  <span className="text-purple-500 text-xs">
                    {tradeDirection === "Long"
                      ? "Entering higher (unfavorable)"
                      : "Entering lower (unfavorable)"}
                  </span>
                </div>
              </div>
            )} */}

            {/* Quantity Input with Percentage Buttons */}
            <div>
              <input
                type="number"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder={`Amount (${tokenData.symbol})`}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400 transition-all text-center"
                step="0.01"
              />

              {/* Percentage Buttons */}
              <div className="grid grid-cols-4 gap-3 mt-4">
                {percentageButtons.map((button) => (
                  <button
                    key={button.value}
                    onClick={() => handlePercentageClick(button.value)}
                    className={`${
                      selectedPercentage === button.value
                        ? button.activeColor
                        : button.baseColor
                    } text-white py-3 px-4 rounded-lg transition-all duration-200 text-sm font-bold border-2 ${
                      selectedPercentage === button.value
                        ? "border-white shadow-lg"
                        : "border-gray-600"
                    } hover:border-white`}
                    title={button.description}
                  >
                    {button.label}
                  </button>
                ))}
              </div>

              {/* Collateral Preview for Percentage Buttons */}
              {userSOLBalance > 0 && solPrice && (
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {percentageButtons.map((button) => {
                    const maxAmount = getMaxPositionSize();
                    const percentAmount = maxAmount * (button.value / 100);
                    const entryPrice = getEntryPrice();

                    if (!entryPrice || !solPrice)
                      return (
                        <div key={button.value} className="text-center">
                          <span className="text-gray-500 text-xs">-</span>
                        </div>
                      );

                    const tokenPriceInSOL = entryPrice / solPrice;
                    const positionValueSOL = percentAmount * tokenPriceInSOL;
                    const collateralSOL = positionValueSOL / leverage;
                    const feeSOL =
                      (percentAmount * entryPrice * TRADING_FEE_RATE) /
                      solPrice;
                    const totalSOL = collateralSOL + feeSOL;

                    return (
                      <div key={button.value} className="text-center">
                        <span className="text-gray-400 text-xs">
                          {totalSOL > 0 ? `${totalSOL.toFixed(3)} SOL` : "-"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Leverage Slider */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-lg">Leverage</span>
                <span className="text-white text-2xl font-bold">
                  {leverage}x
                </span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="2"
                  max="100"
                  value={leverage}
                  onChange={(e) =>
                    handleLeverageChange(parseInt(e.target.value))
                  }
                  className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-2">
                  <span>2x</span>
                  <span>50x</span>
                  <span>100x</span>
                </div>
              </div>
            </div>

            {/* Trade Size Display - Shows leveraged position value */}
            {amount && parseFloat(amount) > 0 && solPrice && (
              <div className="text-center bg-blue-900 border border-blue-700 rounded-lg p-2">
                <p className="text-blue-400 text-xs">
                  Trade Size ({leverage}x Leveraged)
                </p>
                <p className="text-blue-300 text-xl font-bold">
                  {calculateTradeSizeInSOL().toFixed(4)} SOL
                </p>
                <p className="text-blue-500 text-xs">
                  ≈ ${(calculateTradeSizeInSOL() * solPrice).toFixed(2)} USD
                </p>
              </div>
            )}

            {/* Cost Breakdown Display */}
            {amount && parseFloat(amount) > 0 && solPrice && (
              <div className="bg-gray-900 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">
                    Collateral Required
                  </span>
                  <span className="text-white text-sm font-bold">
                    {calculatePositionInSOL().collateralSOL.toFixed(4)} SOL
                  </span>
                </div>
                {/* <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">
                    Trading Fee (0.3%)
                  </span>
                  <span className="text-red-400 text-sm font-bold">
                    {calculatePositionInSOL().tradingFeeSOL.toFixed(4)} SOL
                  </span>
                </div> */}
                <div className="border-t border-gray-700 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm font-bold">
                      Total Required
                    </span>
                    <span className="text-white text-sm font-bold">
                      {calculateRequiredCollateral().toFixed(4)} SOL
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-500 text-xs">
                      ≈ ${(calculateRequiredCollateral() * solPrice).toFixed(2)}{" "}
                      USD
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Position Size Validation Error */}
            {validationErrors.position && (
              <div className="bg-red-900 border border-red-700 rounded-lg p-2">
                <div className="flex items-center text-red-400 text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1 flex-shrink-0" />
                  <span>{validationErrors.position}</span>
                </div>
              </div>
            )}

            {/* Liquidation Price Display */}
            {liquidationPrice && amount && (
              <div className="bg-orange-900 border border-orange-700 rounded-lg p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <AlertTriangle className="w-3 h-3 text-orange-400 mr-1" />
                    <span className="text-orange-400 text-xs">
                      Liquidation Price
                    </span>
                  </div>
                  <span className="text-orange-300 text-sm font-bold">
                    {formatPrice(liquidationPrice)}
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {tradeError && (
              <div className="bg-red-900 border border-red-700 rounded-lg p-3 mb-3">
                <p className="text-red-300 text-sm">{tradeError}</p>
              </div>
            )}

            {/* Success Message */}
            {tradeSuccess && (
              <div className="bg-green-900 border border-green-700 rounded-lg p-3 mb-3">
                <p className="text-green-300 text-sm">{tradeSuccess}</p>
              </div>
            )}

            {/* SOL Price Status */}
            {isPriceLoading && (
              <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-2 mb-3">
                <div className="flex items-center text-yellow-400 text-xs">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  <span>Loading price data for live trading...</span>
                </div>
              </div>
            )}

            {priceError && (
              <div className="bg-red-900 border border-red-700 rounded-lg p-2 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-red-400 text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1 flex-shrink-0" />
                    <span>{priceError}</span>
                  </div>
                  <button
                    onClick={retryPriceLoad}
                    className="text-red-300 hover:text-red-100 text-xs underline"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Execute Trade Button */}
            <button
              onClick={handleExecuteTrade}
              disabled={!isFormValid()}
              className="w-full text-black font-medium py-3 px-4 rounded-lg text-base transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              style={{
                backgroundColor: !isFormValid() ? "#374151" : "#1e7cfa",
                color: !isFormValid() ? "#9ca3af" : "black",
              }}
              onMouseEnter={(e) => {
                if (isFormValid()) {
                  (e.target as HTMLElement).style.backgroundColor = "#1a6ce8";
                }
              }}
              onMouseLeave={(e) => {
                if (isFormValid()) {
                  (e.target as HTMLElement).style.backgroundColor = "#1e7cfa";
                }
              }}
            >
              {isExecutingTrade ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Position...</span>
                </>
              ) : requestCooldown ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>Please Wait...</span>
                </>
              ) : isPriceLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading SOL Price...</span>
                </>
              ) : priceError ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>Price Error - Trading Disabled</span>
                </>
              ) : !solPrice ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>No Price Data - Trading Disabled</span>
                </>
              ) : (
                <span>Execute Trade</span>
              )}
            </button>
          </div>

          {/* Terms */}
          <p className="text-gray-600 text-xs mt-3 text-center">
            By Trading You Agree To Our{" "}
            <span
              style={{ color: "#1e7cfa" }}
              className="underline cursor-pointer hover:text-blue-300 transition-colors"
              onClick={onShowTerms}
            >
              Terms Of Service
            </span>
          </p>

          {/* Custom Styles for Slider */}
          <style>{`
            .slider::-webkit-slider-thumb {
              appearance: none;
              height: 16px;
              width: 16px;
              border-radius: 50%;
              background: #1e7cfa;
              cursor: pointer;
              border: 2px solid #ffffff;
            }
            
            .slider::-moz-range-thumb {
              height: 16px;
              width: 16px;
              border-radius: 50%;
              background: #1e7cfa;
              cursor: pointer;
              border: 2px solid #ffffff;
            }
          `}</style>
					</div>
				</div>
				</div>

				{/* Trade Loading Modal */}
				<TradeLoadingModal
					isOpen={showTradeLoading}
					type={loadingTradeData?.type || "opening"}
					tokenSymbol={loadingTradeData?.tokenSymbol || ""}
					direction={loadingTradeData?.direction}
					leverage={loadingTradeData?.leverage}
					onClose={() => {
						setShowTradeLoading(false);
						setLoadingTradeData(null);
						onClose();
					}}
					canCancel={false}
				/>

				{/* Trade Success Modal */}
				<TradeSuccessModal
					isOpen={showTradeSuccess}
					tokenSymbol={tokenData.symbol}
					direction={tradeDirection}
					leverage={leverage}
					amount={amount}
					onManagePosition={() => {
						setShowTradeSuccess(false);
						onClose();
						if (onNavigateToPositions) {
							onNavigateToPositions();
						}
					}}
					onClose={() => {
						setShowTradeSuccess(false);
						onClose();
					}}
				/>
			</div>
		);
	}
