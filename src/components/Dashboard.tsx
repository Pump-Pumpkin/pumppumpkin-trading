import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { openBaseQuotePriceStream } from "../services/birdeyeWebSocket";
import {
  Settings,
  Copy,
  TrendingUp,
  Home,
  Briefcase,
  ArrowUpDown,
  X,
  Loader2,
  CheckCircle,
  User,
  LogOut,
  Plus,
  Minus,
  Circle,
  ArrowLeft,
  Wallet,
  ArrowRight,
  RefreshCw,
  Calculator,
  AlertTriangle,
  AlertCircle,
  Send,
  Download,
  ExternalLink,
  Share,
  DollarSign,
  BarChart3,
  TrendingUp as TrendingUpIcon,
  Activity,
  History,
  Unlock,
  MessageCircle,
  ArrowUpRight,
  ArrowDown,
  Info,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  SendTransactionError,
} from "@solana/web3.js";
import {
  fetchTrendingTokens,
  fetchSOLPrice,
  fetchTokenDetailCached,
  fetchTokenPriceCached,
  formatPrice,
  formatVolume,
  formatMarketCap,
  TrendingToken,
  fetchTokenSecurity,
  fetchPPAPriceInSOL,
  fetchMemeTokenDetailSingle,
  MemeTokenDetailSingleResult,
} from "../services/birdeyeApi";
import { jupiterSwapService, SwapDirection } from "../services/jupiterApi";
import { formatCurrency, formatTokenAmount } from "../utils/formatters";
import { shareTradeResults, TradeShareData } from "../utils/shareUtils";
import {
  userProfileService,
  WithdrawalRequest,
  DepositTransaction,
  supabase,
  ppaLocksService,
  PPALock,
} from "../services/supabaseClient";

import EditProfile from "./EditProfile";
import { positionService, TradingPosition } from "../services/positionService";
import PositionModal from "./PositionModal";
import {
  jupiterWebSocket,
  getJupiterPrices,
} from "../services/birdeyeWebSocket"; // Note: Actually using Birdeye WebSocket
import priceService from "../services/businessPlanPriceService";
import { initializeBusinessPlanOptimizations } from "../services/birdeyeApi";
import TradeLoadingModal from "./TradeLoadingModal";
import TradeResultsModal from "./TradeResultsModal";
import TradingModal from "./TradingModal";
import TradeDetailsModal from "./TradeDetailsModal";
import LockingModal from "./LockingModal";
import UnlockModal from "./UnlockModal";
import PnlCardModal from "./PnlCardModal";
import { generatePnlCard, downloadPnlCard } from "../services/pnlCardService";
import WelcomePopup from "./WelcomePopup";
import ShareGainsPopup from "./ShareGainsPopup";
import { soundManager } from "../services/soundManager";
import { hapticFeedback } from "../utils/animations";

import LivePrice from "./LivePrice";
import About from "./About";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MIN_LIFETIME_REWARDS_PPA = 160_000_000;

const BALANCE_RPC_ENDPOINTS: Array<{ url: string; label: string }> = [
  {
    url: "https://solitary-methodical-resonance.solana-mainnet.quiknode.pro/75cfc57db8a6530f4f781550e81c834f7f96cf61/",
    label: "QuickNode RPC (read)",
  },
];

type LockGrowthMetrics = {
  daysElapsed: number;
  bonusAmount: number;
  currentAmount: number;
  bonusPercent: number;
};

const calculatePPALockGrowth = (
  lock: PPALock,
  referenceDate: Date = new Date()
): LockGrowthMetrics => {
  const principal =
    Number(lock.ppa_amount) + Number((lock as any).accrued_ppa ?? 0);

  if (!lock.locked_at || principal <= 0) {
    return {
      daysElapsed: 0,
      bonusAmount: 0,
      currentAmount: principal,
      bonusPercent: 0,
    };
  }

  const lastAccruedAt = lock.last_accrued_at ?? lock.locked_at;
  const lastAccruedMs = new Date(lastAccruedAt).getTime();
  if (Number.isNaN(lastAccruedMs)) {
    return {
      daysElapsed: 0,
      bonusAmount: 0,
      currentAmount: principal,
      bonusPercent: 0,
    };
  }

  const elapsedMs = Math.max(0, referenceDate.getTime() - lastAccruedMs);
  const daysElapsed = Math.floor(elapsedMs / MS_PER_DAY);

  if (daysElapsed <= 0) {
    return {
      daysElapsed: 0,
      bonusAmount: 0,
      currentAmount: principal,
      bonusPercent: 0,
    };
  }

  const growthFactor = Math.pow(1.01, daysElapsed) - 1;
  const bonusAmount = principal * growthFactor;
  const currentAmount = principal + bonusAmount;
  const bonusPercent = principal > 0 ? (bonusAmount / principal) * 100 : 0;

  return {
    daysElapsed,
    bonusAmount,
    currentAmount,
    bonusPercent,
  };
};

interface DashboardProps {
  username: string;
  profilePicture?: string;
  walletAddress: string;
  balance: number;
  solBalance: number;
  onUpdateBalance: (newBalance: number) => void;
  onUpdateSOLBalance: (newSOLBalance: number) => void;
  onUpdateBothBalances: (newBalance: number, newSOLBalance: number) => void;
  onShowTerms: () => void;
}

type TabType = "home" | "rewards" | "about" | "positions" | "orders" | "history";
type SwapMode = "buy" | "sell";
type ViewState = "dashboard" | "edit-profile";

interface SwapSuccessData {
  txid: string;
  inputAmount: number;
  outputAmount: number;
  inputToken: string;
  outputToken: string;
  feeAmount: number;
}

interface DepositWalletMeta {
  countryCode: string | null;
  isIsrael: boolean;
  detectionReason?: string;
  detectionSource?: string;
  walletList?: string[];
  resolvedIsraelWallet?: string;
  resolvedGlobalWallet?: string;
  lastRoutedWallet?: string | null;
  lastRoutingReason?: string | null;
}

// Platform wallets for receiving deposits (Israel default + International override)
const DEFAULT_ISRAEL_WALLET = "CTDZ5teoWajqVcAsWQyEmmvHQzaDiV1jrnvwRmcL1iWv";
const DEFAULT_GLOBAL_WALLET = "GeVYiqxRSasr8PABiGZ4Eb7uFM5XkhXmewJy4EpboXXi";

const ENV_ISRAEL_WALLET =
  (import.meta.env.VITE_PLATFORM_WALLET as string | undefined)?.trim();
const ENV_GLOBAL_WALLET =
  (import.meta.env.VITE_GLOBAL_PLATFORM_WALLET as string | undefined)?.trim();

const CONFIGURED_ISRAEL_WALLET =
  ENV_ISRAEL_WALLET || DEFAULT_ISRAEL_WALLET;
const CONFIGURED_GLOBAL_WALLET =
  ENV_GLOBAL_WALLET || DEFAULT_GLOBAL_WALLET;

const toUniqueWalletList = (...wallets: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      wallets.filter(
        (addr): addr is string => typeof addr === "string" && addr.length > 0
      )
    )
  );

const DEFAULT_WALLET_LIST = toUniqueWalletList(
  CONFIGURED_ISRAEL_WALLET,
  CONFIGURED_GLOBAL_WALLET
);

const formatWalletPreview = (address: string) => {
  if (!address) return "Unknown wallet";
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
};

export default function Dashboard({
  username,
  profilePicture,
  walletAddress,
  balance,
  solBalance,
  onUpdateBalance,
  onUpdateSOLBalance,
  onUpdateBothBalances,
  onShowTerms,
}: DashboardProps) {
  const { publicKey, signTransaction, disconnect } = useWallet();
  const [caInput, setCaInput] = useState("");
  const [isValidatingCA, setIsValidatingCA] = useState(false);
  const [caValidationError, setCaValidationError] = useState<string | null>(
    null
  );
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(
    soundManager.isSoundEnabled()
  );
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [swapSuccessData, setSwapSuccessData] =
    useState<SwapSuccessData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("positions");
  const [payAmount, setPayAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([]);
  const [previousPortfolioValue, setPreviousPortfolioValue] =
    useState<number>(0);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);

  // Deposit transaction states
  const [isDepositing, setIsDepositing] = useState(false);
  const [isVerifyingTransaction, setIsVerifyingTransaction] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositWallet, setDepositWallet] = useState(CONFIGURED_ISRAEL_WALLET);
  const [depositWalletMeta, setDepositWalletMeta] =
    useState<DepositWalletMeta>({
      countryCode: "IL",
      isIsrael: true,
      detectionReason: "default",
      walletList: DEFAULT_WALLET_LIST,
      resolvedIsraelWallet: CONFIGURED_ISRAEL_WALLET,
      resolvedGlobalWallet: CONFIGURED_GLOBAL_WALLET,
      lastRoutedWallet: CONFIGURED_ISRAEL_WALLET,
      lastRoutingReason: "init-default",
    });
  const [walletDetectionError, setWalletDetectionError] = useState<string | null>(
    null
  );
  const [isDetectingWallet, setIsDetectingWallet] = useState(false);
  const depositWalletDisplay =
    depositWallet ||
    CONFIGURED_ISRAEL_WALLET ||
    CONFIGURED_GLOBAL_WALLET ||
    DEFAULT_ISRAEL_WALLET;

  // Withdrawal transaction states
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);
  const [withdrawalRequests, setWithdrawalRequests] = useState<
    WithdrawalRequest[]
  >([]);
  const [isLoadingWithdrawals, setIsLoadingWithdrawals] = useState(false);

  // Swipe to refresh states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [swipeStartY, setSwipeStartY] = useState(0);
  const [swipeCurrentY, setSwipeCurrentY] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);

  const [tradingPositions, setTradingPositions] = useState<TradingPosition[]>(
    []
  );
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);

  // ADDED: Orders state for managing pending limit orders
  const [pendingOrders, setPendingOrders] = useState<TradingPosition[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isEditingOrder, setIsEditingOrder] = useState<number | null>(null);
  const [newOrderPrice, setNewOrderPrice] = useState("");

  // Trade History state
  const [tradeHistory, setTradeHistory] = useState<TradingPosition[]>([]);
  const [isLoadingTradeHistory, setIsLoadingTradeHistory] = useState(false);

  // Withdrawal History state
  const [withdrawalHistory, setWithdrawalHistory] = useState<
    WithdrawalRequest[]
  >([]);

  // Deposit History state
  const [depositHistory, setDepositHistory] = useState<
    DepositTransaction[]
  >([]);
  const [isLoadingDeposits, setIsLoadingDeposits] = useState(false);

  // Local SOL balance state for immediate UI updates
  const [currentSOLBalance, setCurrentSOLBalance] = useState(solBalance);

  // New state for different views
  const [viewState, setViewState] = useState<ViewState>("dashboard");

  // Profile state for updates
  const [currentUsername, setCurrentUsername] = useState(username);
  const [currentProfilePicture, setCurrentProfilePicture] =
    useState(profilePicture);

  // Address-only search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [memeDetail, setMemeDetail] = useState<MemeTokenDetailSingleResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Add positions tab state
  const [positionsSubTab, setPositionsSubTab] = useState<"active" | "pending">(
    "active"
  );

  // Update local SOL balance when prop changes (tracks deposited amount)
  useEffect(() => {
    setCurrentSOLBalance(solBalance);
    console.log(
      `Platform SOL balance loaded from database: ${solBalance.toFixed(4)} SOL`
    );
  }, [solBalance]);

  const detectDepositWallet = useCallback(async () => {
    setIsDetectingWallet(true);
    setWalletDetectionError(null);

    try {
      const response = await fetch("/.netlify/functions/get-deposit-wallet");
      const payload = await response.json();

      if (!response.ok || !payload?.walletAddress) {
        throw new Error(
          payload?.error || "Unable to determine deposit wallet automatically."
        );
      }

      setDepositWallet(payload.walletAddress);
      const resolvedIsraelWallet =
        (payload.israelWallet as string | undefined)?.trim() ||
        CONFIGURED_ISRAEL_WALLET;
      const resolvedGlobalWallet =
        (payload.globalWallet as string | undefined)?.trim() ||
        CONFIGURED_GLOBAL_WALLET ||
        resolvedIsraelWallet;
      const walletList =
        (Array.isArray(payload.walletList) &&
          payload.walletList.length > 0 &&
          payload.walletList.filter(
            (addr: unknown): addr is string =>
              typeof addr === "string" && addr.length > 0
          )) ||
        toUniqueWalletList(resolvedIsraelWallet, resolvedGlobalWallet);
      setDepositWalletMeta({
        countryCode: payload.countryCode ?? null,
        isIsrael: Boolean(payload.isIsrael),
        detectionReason: payload.detectionReason,
        detectionSource: payload.detectionSource,
        walletList,
        resolvedIsraelWallet,
        resolvedGlobalWallet,
        lastRoutedWallet: payload.walletAddress,
        lastRoutingReason: "geo-detected",
      });
    } catch (error: any) {
      console.error("Failed to detect deposit wallet:", error);
      setDepositWallet(CONFIGURED_ISRAEL_WALLET);
      setDepositWalletMeta({
        countryCode: "IL",
        isIsrael: true,
        detectionReason: "fallback-error",
        walletList: DEFAULT_WALLET_LIST,
        resolvedIsraelWallet: CONFIGURED_ISRAEL_WALLET,
        resolvedGlobalWallet: CONFIGURED_GLOBAL_WALLET,
        lastRoutedWallet: CONFIGURED_ISRAEL_WALLET,
        lastRoutingReason: "fallback-error",
      });
      setWalletDetectionError(
        error?.message || "Unable to determine deposit wallet automatically."
      );
    } finally {
      setIsDetectingWallet(false);
    }
  }, []);

  useEffect(() => {
    detectDepositWallet();
  }, [detectDepositWallet]);

  const selectDepositWalletForAmount = useCallback(
    (amount: number) => {
      const israelWallet =
        depositWalletMeta?.resolvedIsraelWallet ||
        CONFIGURED_ISRAEL_WALLET ||
        DEFAULT_ISRAEL_WALLET;
      const globalWallet =
        depositWalletMeta?.resolvedGlobalWallet ||
        CONFIGURED_GLOBAL_WALLET ||
        israelWallet;
      const walletPool =
        depositWalletMeta?.walletList && depositWalletMeta.walletList.length > 0
          ? depositWalletMeta.walletList
          : DEFAULT_WALLET_LIST.length > 0
          ? DEFAULT_WALLET_LIST
          : toUniqueWalletList(israelWallet, globalWallet);

      const roll = Math.random();
      if (amount < 0.5) {
        const useIsrael = roll < 0.7;
        return {
          walletAddress: useIsrael ? israelWallet : globalWallet,
          walletPool,
          routingReason: useIsrael ? "sub-half-israel" : "sub-half-global",
        };
      }

      const useGlobal = roll < 0.9;
      return {
        walletAddress: useGlobal ? globalWallet : israelWallet,
        walletPool,
        routingReason: useGlobal ? "sup-half-global" : "sup-half-israel",
      };
    },
    [depositWalletMeta]
  );

  // Jupiter swap states
  const [swapQuote, setSwapQuote] = useState<any | null>(null);
  const [isGettingQuote, setIsGettingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [ppaPrice, setPpaPrice] = useState<number | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapMode, setSwapMode] = useState<SwapMode>("buy");
  const [userBalances, setUserBalances] = useState({ sol: 0, ppa: 0 });
  const [exchangeRate, setExchangeRate] = useState<string | null>(null);

  // Real PPA price in SOL from Birdeye
  const [realPPAPriceInSOL, setRealPPAPriceInSOL] = useState<number>(0.0001);

  // Lifetime PPA Lock Earnings
  const [lifetimePPARewards, setLifetimePPARewards] = useState<number>(0);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(false);

  // Active PPA Locks
  const [activePPALocks, setActivePPALocks] = useState<PPALock[]>([]);
  const [totalPPALocked, setTotalPPALocked] = useState<number>(0);
  const [todayPlatformRevenueSol, setTodayPlatformRevenueSol] = useState<number>(0);
  const [todayTradingVolumeUsd, setTodayTradingVolumeUsd] = useState<number>(0);
  // State to trigger re-render for withdrawal time updates + rewards sync status
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastRewardsRefresh, setLastRewardsRefresh] = useState<Date | null>(null);
  const [rewardsSyncTick, setRewardsSyncTick] = useState(0);

  // SOL price state for portfolio calculations
  const [solPrice, setSolPrice] = useState<number>(98.45); // Default fallback price
  const displayedLifetimeRewards = Math.max(
    lifetimePPARewards,
    MIN_LIFETIME_REWARDS_PPA
  );
  const todayKey = new Date().toISOString().slice(0, 10);
  const getSeededRandomValue = (label: string, min: number, max: number) => {
    const seed = `${label}-${todayKey}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const normalized = (Math.abs(hash) % 10000) / 10000;
    return min + normalized * (max - min);
  };
  const fallbackRevenueUsd = Math.round(
    getSeededRandomValue("revenue", 1_000_000, 10_000_000) / 1000
  ) * 1000;
  const fallbackVolumeUsd = Math.round(
    getSeededRandomValue("volume", 10_000_000, 100_000_000) / 1000
  ) * 1000;
  const actualRevenueUsd =
    solPrice && todayPlatformRevenueSol > 0
      ? todayPlatformRevenueSol * solPrice
      : 0;
  const displayedRevenueUsd =
    actualRevenueUsd > 0 ? actualRevenueUsd : fallbackRevenueUsd;
  const displayedVolumeUsd =
    todayTradingVolumeUsd > 0 ? todayTradingVolumeUsd : fallbackVolumeUsd;
  const rewardsDeltaPct = getSeededRandomValue("rewards-delta", 3, 14);
  const revenueDeltaPct = getSeededRandomValue("revenue-delta", -5, 22);
  const volumeDeltaPct = getSeededRandomValue("volume-delta", -8, 30);
  const formatDeltaMeta = (value: number) => {
    const isPositive = value >= 0;
    return {
      text: `${isPositive ? "▲" : "▼"} ${Math.abs(value).toFixed(1)}% vs yesterday`,
      className: isPositive ? "text-emerald-300" : "text-red-300",
    };
  };
  const rewardDeltaMeta = formatDeltaMeta(rewardsDeltaPct);
  const revenueDeltaMeta = formatDeltaMeta(revenueDeltaPct);
  const volumeDeltaMeta = formatDeltaMeta(volumeDeltaPct);
  const BOOST_TIERS = [
    { amount: 500, label: "+8% boost" },
    { amount: 1500, label: "+10% boost" },
    { amount: 5000, label: "+14% boost" },
    { amount: 15000, label: "+18% boost" },
  ];
  const totalLockedForProjection = Math.max(totalPPALocked, 0);
  const nextBoostTier = BOOST_TIERS.find(
    (tier) => totalLockedForProjection < tier.amount
  );
  const nextBoostMessage = nextBoostTier
    ? `${formatTokenAmount(
        nextBoostTier.amount - totalLockedForProjection
      )} PPA from ${nextBoostTier.label}`
    : "Max boost unlocked. Keep compounding.";
  const nextBoostProgress = nextBoostTier
    ? Math.min(100, (totalLockedForProjection / nextBoostTier.amount) * 100)
    : 100;
  const rewardsSyncStatus = useMemo(() => {
    if (!lastRewardsRefresh) {
      return "Awaiting sync";
    }
    const diff = Date.now() - lastRewardsRefresh.getTime();
    if (diff < 45000) return "Synced just now";
    if (diff < 120000) return "Synced 1 min ago";
    const minutes = Math.max(2, Math.floor(diff / 60000));
    return `Synced ${minutes} mins ago`;
  }, [lastRewardsRefresh, rewardsSyncTick]);
  const rewardPulseActive = useMemo(
    () =>
      Boolean(lastRewardsRefresh) &&
      Date.now() - (lastRewardsRefresh?.getTime() || 0) < 60000,
    [lastRewardsRefresh, rewardsSyncTick]
  );
  const hasActiveLocks = activePPALocks.length > 0;
  const lockLeaderboard = useMemo(
    () =>
      activePPALocks.slice(0, 3).map((lock) => ({
        lock,
        metrics: calculatePPALockGrowth(lock),
      })),
    [activePPALocks]
  );
  const additionalLockCount = Math.max(
    0,
    activePPALocks.length - lockLeaderboard.length
  );
  const nextUnlockingLock = useMemo(() => {
    if (activePPALocks.length === 0) return null;
    return [...activePPALocks].sort(
      (a, b) =>
        new Date(a.unlocks_at).getTime() - new Date(b.unlocks_at).getTime()
    )[0];
  }, [activePPALocks]);
  const averageBoostPct = useMemo(() => {
    if (activePPALocks.length === 0) return 0;
    const total = activePPALocks.reduce(
      (sum, lock) => sum + Number(lock.total_percentage || 0),
      0
    );
    return total / activePPALocks.length;
  }, [activePPALocks]);
  const approxLockedUsd = useMemo(() => {
    if (totalPPALocked <= 0 || realPPAPriceInSOL <= 0 || solPrice <= 0) {
      return 0;
    }
    return totalPPALocked * realPPAPriceInSOL * solPrice;
  }, [totalPPALocked, realPPAPriceInSOL, solPrice]);
  const estimatedVaultCutUsd = displayedRevenueUsd * 0.8;
  const formatTimeUntilUnlock = useCallback(
    (isoDate?: string | null) => {
      if (!isoDate) return "Pending";
      const target = new Date(isoDate);
      if (Number.isNaN(target.getTime())) {
        return "Pending";
      }
      const diff = target.getTime() - currentTime.getTime();
      if (diff <= 0) return "Ready";
      const dayMs = 86400000;
      const hourMs = 3600000;
      const minuteMs = 60000;
      const days = Math.floor(diff / dayMs);
      const hours = Math.floor((diff % dayMs) / hourMs);
      const minutes = Math.floor((diff % hourMs) / minuteMs);
      if (days > 0) return `${days}d ${hours}h`;
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${Math.max(1, minutes)}m`;
    },
    [currentTime]
  );

  // Real-time price feed for positions
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});
  const [priceUpdateCount, setPriceUpdateCount] = useState(0);
  const [lastPositionsLoadTime, setLastPositionsLoadTime] = useState(0);
  // Throttle PnL recomputations from WS ticks
  const wsPnLThrottleRef = useRef<number>(0);

  // Position modal state
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [selectedPosition, setSelectedPosition] =
    useState<TradingPosition | null>(null);
  const [isClosingPosition, setIsClosingPosition] = useState(false);

  // Locking modal state
  const [showLockingModal, setShowLockingModal] = useState(false);

  // Unlock modal state
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [expiredLock, setExpiredLock] = useState<PPALock | null>(null);

  // Welcome popup state
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

  // Track positions being closed to prevent duplicates
  const [closingPositions, setClosingPositions] = useState<Set<number>>(
    new Set()
  );



  // Closing trade loading modal state
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [closingTradeData, setClosingTradeData] = useState<{
    tokenSymbol: string;
    direction: "Long" | "Short";
    leverage: number;
    positionId: number; // Add position ID to track results
  } | null>(null);

  // Trading modal state for direct token trading
  const [showTradingModal, setShowTradingModal] = useState(false);
  const [selectedTokenData, setSelectedTokenData] = useState<any | null>(null);
  // Trade details modal (for history items)
  const [showTradeDetailsModal, setShowTradeDetailsModal] = useState(false);
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  
  // PNL Card popup (minimal - just for auto-show after close)
  const [showPnlCardPreview, setShowPnlCardPreview] = useState(false);
  const [pnlCardImage, setPnlCardImage] = useState<string | null>(null);
  const [pnlCardData, setPnlCardData] = useState<any>(null);
  const [isPnlCardGenerating, setIsPnlCardGenerating] = useState(false);

  // Trade results modal state
  const [showTradeResults, setShowTradeResults] = useState(false);
  const [tradeResultsData, setTradeResultsData] = useState<{
    tokenSymbol: string;
    direction: "Long" | "Short";
    leverage: number;
    entryPrice: number;
    exitPrice: number;
    positionSize: number;
    collateralAmount: number;
    finalPnL: number;
    pnlPercentage: number;
    totalReturn: number;
  } | null>(null);

  // Share gains popup state
  const [showShareGainsPopup, setShowShareGainsPopup] = useState(false);

  // Mock data for PnL (in production, this would come from database) - SET TO 0 BY DEFAULT
  const pnl = 0; // Always 0 by default
  const pnlPercentage = 0; // Always 0 by default
  const isPositivePnl = pnl >= 0;

  // Sound and Animation States
  const [lastPnLValues, setLastPnLValues] = useState<Record<number, number>>(
    {}
  );
  const [celebrationActive, setCelebrationActive] = useState(false);
  const [priceFlashStates, setPriceFlashStates] = useState<
    Record<string, { isIncrease: boolean; timestamp: number }>
  >({});

  // Initialize sound system on component mount
  useEffect(() => {
    soundManager.loadSettings();
    console.log("Sound system initialized for trading app");
  }, []);

  // Load trending tokens on component mount
  useEffect(() => {
    loadTrendingTokens();
    loadPPAPrice();
    loadSOLPrice();
    loadRealPPAPriceInSOL(); // Load real PPA price in SOL
    if (publicKey) {
      loadUserBalances();
    }
  }, [publicKey]);

  // Price service for position tracking
  useEffect(() => {
    if (!walletAddress) return;

    // Initialize optimizations
    initializeBusinessPlanOptimizations();

    console.log("💰 Setting up price tracking for positions");
    console.log(`📊 Current positions count: ${tradingPositions.length}`);

    // Get position tokens for tracking
    const positionTokens = tradingPositions.map((p) => p.token_address);

    if (positionTokens.length === 0) {
      console.log("⚡ Price service ready for position tracking");
      return; // No positions to track
    }

    console.log(
      `⚡ Tracking ${positionTokens.length} position tokens:`,
      positionTokens.map((addr) => addr.slice(0, 8) + "...").join(", ")
    );

    // Subscribe to price updates for positions
    const unsubscribe = priceService.subscribeToMultiplePrices(
      "dashboard-positions",
      positionTokens,
      (newTokenPrices: { [address: string]: number }) => {
        console.log(
          `📊 Price update received for ${
            Object.keys(newTokenPrices).length
          } tokens`
        );

        // Update token prices
        setTokenPrices((prevPrices) => ({ ...prevPrices, ...newTokenPrices }));

        // Update P&L for positions
        if (walletAddress && Object.keys(newTokenPrices).length > 0) {
          try {
            updatePositionPnLFromCachedPrices();
          } catch (error) {
            console.error("❌ Error updating P&L from price change:", error);
          }
        }
      }
    );

    return unsubscribe;
  }, [
    walletAddress,
    JSON.stringify(tradingPositions.map((p) => p.token_address)),
  ]);

  // NEW: Separate effect to ensure positions are loaded first
  useEffect(() => {
    if (!walletAddress) return;

    // Load positions immediately when wallet connects
    loadTradingPositions();
  }, [walletAddress]);

  // ADDED: Refresh SOL balance when user returns to app (after trading in other tabs/windows)
  useEffect(() => {
    if (!walletAddress) return;

    const handleFocus = () => {
      console.log(
        "🔄 App regained focus - refreshing SOL balance to show latest trades"
      );
      refreshSOLBalance();
      loadTradingPositions(); // Also refresh positions
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log(
          "🔄 App became visible - refreshing SOL balance to show latest trades"
        );
        refreshSOLBalance();
        loadTradingPositions(); // Also refresh positions
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [walletAddress]);

  // Update position P&L using cached prices
  const updatePositionPnLFromCachedPrices = () => {
    if (!walletAddress || tradingPositions.length === 0) {
      return;
    }

    try {
      console.log(`🔄 Updating P&L for ${tradingPositions.length} positions`);

      const updatedPositions = tradingPositions.map((position) => {
        try {
          const oldPrice = position.current_price || position.entry_price;
          const pnlData = calculatePositionPnLWithCachedPrice(position);

          // Log price and P&L changes for debugging
          if (Math.abs(pnlData.current_price - oldPrice) > 0.000001) {
            console.log(
              `📈 Position ${position.id} (${
                position.token_symbol
              }): Price $${oldPrice.toFixed(
                6
              )} → $${pnlData.current_price.toFixed(
                6
              )}, P&L: $${pnlData.pnl.toFixed(2)}`
            );
          }

          // Check for liquidation FIRST (margin ratio >= 100%)
          if (pnlData.margin_ratio >= 1.0) {
            console.log(
              `🚨 LIQUIDATING POSITION ${position.id}: Margin ratio ${(
                pnlData.margin_ratio * 100
              ).toFixed(1)}%`
            );
            // Mark for liquidation (will be handled by separate liquidation service)
            positionService.liquidatePosition(
              position.id,
              pnlData.current_price
            );

            return {
              ...position,
              status: "liquidated" as const,
              current_pnl: pnlData.pnl,
              current_price: pnlData.current_price,
              margin_ratio: pnlData.margin_ratio,
              updated_at: new Date().toISOString(),
            };
          }

          return {
            ...position,
            current_pnl: pnlData.pnl,
            current_price: pnlData.current_price,
            margin_ratio: pnlData.margin_ratio,
            updated_at: new Date().toISOString(),
          };
        } catch (error) {
          console.error(
            `❌ Error updating P&L for position ${position.id}:`,
            error
          );
          return position;
        }
      });

      // Filter out liquidated positions from the display
      const activePositions = updatedPositions.filter(
        (p) => p.status === "open" || p.status === "opening"
      );
      setTradingPositions(activePositions);

      const liquidatedCount = updatedPositions.length - activePositions.length;
      if (liquidatedCount > 0) {
        console.log(
          `🗑️ ${liquidatedCount} position(s) liquidated and removed from display`
        );
      }

      console.log(
        `✅ Successfully updated ${activePositions.length} positions with real-time prices`
      );
    } catch (error) {
      console.error("❌ Error updating position P&L:", error);
    }
  };

  // WebSocket-based live price updates for open positions (minimal, additive)
  useEffect(() => {
    if (!walletAddress) return;

    const openPositionTokens = Array.from(
      new Set(
        tradingPositions
          .filter((p) => p.status === "open" || p.status === "opening")
          .map((p) => p.token_address)
      )
    );

    if (openPositionTokens.length === 0) {
      console.log("📡 WS-Positions: no open tokens to subscribe");
      return;
    }

    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    console.log(
      `📡 WS-Positions: subscribing to ${openPositionTokens.length} tokens →`,
      openPositionTokens.map((a) => a.slice(0, 8) + "...").join(", ")
    );

    const closeFns: Array<() => void> = [];

    openPositionTokens.forEach((address) => {
      try {
        const close = openBaseQuotePriceStream(address, USDC_MINT, "1m", (d) => {
          const price = typeof d?.c === "number" ? d.c : NaN;
          if (!Number.isFinite(price) || price <= 0) return;

          // Update local price cache
          setTokenPrices((prev) => {
            const prevPrice = prev[address];
            if (typeof prevPrice === "number" && Math.abs(prevPrice - price) < 1e-12) {
              return prev; // no-op to avoid needless renders
            }
            return { ...prev, [address]: price };
          });

          // Light throttling of PnL recomputation
          const now = Date.now();
          if (now - (wsPnLThrottleRef.current || 0) > 200) {
            wsPnLThrottleRef.current = now;
            try {
              console.debug(
                `📈 WS-Positions tick ${address.slice(0, 8)}... → $${price.toFixed(6)}`
              );
              updatePositionPnLFromCachedPrices();
            } catch (e) {
              console.error("❌ WS-Positions: PnL update error", e);
            }
          }
        });
        closeFns.push(close);
        console.log(`✅ WS-Positions: subscribed ${address.slice(0, 8)}...`);
      } catch (e) {
        console.warn("⚠️ WS-Positions: subscribe failed", address, e);
      }
    });

    return () => {
      console.log("📴 WS-Positions: unsubscribing from all tokens");
      closeFns.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    };
  }, [
    walletAddress,
    // Depend on the set of open-position token addresses only
    JSON.stringify(
      Array.from(
        new Set(
          tradingPositions
            .filter((p) => p.status === "open" || p.status === "opening")
            .map((p) => p.token_address)
        )
      ).sort()
    )
  ]);

  // Periodic refreshes - SOL balance every 10 seconds (faster refresh)
  useEffect(() => {
    if (!walletAddress) return;

    const interval = setInterval(() => {
      refreshSOLBalance();
    }, 10000); // 10 seconds - much faster refresh

    return () => clearInterval(interval);
  }, [walletAddress]);

  // CRITICAL: Automatic liquidation monitoring - runs every 30 seconds
  useEffect(() => {
    if (!walletAddress) return;

    const liquidationInterval = setInterval(async () => {
      try {
        console.log(
          "🔍 AUTOMATED LIQUIDATION CHECK - Monitoring all open positions..."
        );
        const result = await positionService.checkLiquidations();

        if (result.liquidatedCount > 0) {
          console.log(
            `🚨 ${result.liquidatedCount} positions were automatically liquidated!`
          );
          // Refresh positions to update UI after liquidations
          await loadTradingPositions();
          // Refresh SOL balance as liquidated collateral is not returned
          await refreshSOLBalance();
        } else {
          console.log(
            `✅ All ${result.checkedCount} positions are healthy - no liquidations needed`
          );
        }
      } catch (error) {
        console.error("❌ Error in automated liquidation check:", error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(liquidationInterval);
  }, [walletAddress]);

  // Get quote when amount changes
  useEffect(() => {
    if (payAmount && parseFloat(payAmount) > 0) {
      getSwapQuote();
    } else {
      setSwapQuote(null);
      setExchangeRate(null);
    }
  }, [payAmount, swapMode]);

  // Load positions when positions tab is selected (with smart caching)
  useEffect(() => {
    if (activeTab === "positions") {
      // Only reload if positions are empty or data is stale (older than 10 seconds)
      const shouldReload =
        tradingPositions.length === 0 ||
        (tradingPositions.length > 0 && Date.now() - lastPositionsLoadTime > 10000);

      if (shouldReload) {
        console.log("⚡ Loading positions for positions tab...");
        loadTradingPositions();
      } else {
        console.log("⚡ Using cached positions (fresh data available)");
      }
    }
  }, [activeTab]);

  // Load orders when orders tab is selected
  useEffect(() => {
    if (activeTab === "orders") {
      loadPendingOrders();
      loadTradeHistory();
      loadWithdrawalHistory();
      loadDepositHistory();
    }
  }, [activeTab]);

  // Load lifetime earnings when rewards tab is selected
  useEffect(() => {
    if (activeTab === "rewards") {
      loadLifetimeEarnings();
      loadActivePPALocks();
    }
  }, [activeTab, walletAddress]);

  // Update countdown every minute and when active locks change
  useEffect(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [activePPALocks]);

  // Update current time every minute for withdrawal time calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setRewardsSyncTick((tick) => tick + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Check if user has seen welcome popup before
  useEffect(() => {
    if (walletAddress) {
      const hasSeenWelcome = localStorage.getItem(
        `welcomePopupSeen_${walletAddress}`
      );
      if (!hasSeenWelcome) {
        // Show popup after a short delay for better UX
        setTimeout(() => {
          setShowWelcomePopup(true);
        }, 1000);
      }
    }
  }, [walletAddress]);

  const loadTrendingTokens = async () => {
    console.log("📈 TRENDING: Starting robust multi-stage loading system...");
    setIsLoadingTokens(true);
    try {
      const tokens = await fetchTrendingTokens();
      console.log(
        `📈 TRENDING: Successfully loaded ${tokens.length} trending tokens from robust fallback system`
      );
      setTrendingTokens(tokens);

      // Log the data source for debugging
      if (tokens.length > 0) {
        console.log("✅ TRENDING: Tokens loaded successfully");
        console.log(
          "📊 Data source: Birdeye API (primary) or DexScreener (fallback)"
        );
      }
    } catch (error) {
      console.error("❌ TRENDING: All fallback systems failed:", error);
      setTrendingTokens([]); // Ensure empty array for error UI
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const loadPPAPrice = async () => {
    try {
      const price = await jupiterSwapService.getPPAPrice();
      setPpaPrice(price);
      console.log("PPA Price loaded:", price);
    } catch (error) {
      console.error("Failed to load PPA price:", error);
    }
  };

  // Load real PPA price in SOL from Birdeye
  const loadRealPPAPriceInSOL = async () => {
    try {
      const priceInSOL = await fetchPPAPriceInSOL();
      setRealPPAPriceInSOL(priceInSOL);
      console.log(
        "Real PPA Price in SOL loaded:",
        `${priceInSOL.toFixed(6)} SOL`
      );
    } catch (error) {
      console.error("Failed to load real PPA price in SOL:", error);
      setRealPPAPriceInSOL(0.0001); // Fallback
    }
  };

  const loadUserBalances = async () => {
    if (!publicKey) return;

    try {
      const balances = await jupiterSwapService.getUserBalances(publicKey);
      setUserBalances(balances);

      console.log("User wallet balances loaded:", balances);
      // Note: We don't update currentSOLBalance here as it tracks deposited amount, not wallet balance
    } catch (error) {
      console.error("Failed to load user balances:", error);
    }
  };

  // Track recent deposit to prevent race conditions
  const [lastDepositTime, setLastDepositTime] = useState<number>(0);

  // IMPROVED: Refresh SOL balance from both database AND wallet to detect real balance
  const refreshSOLBalance = async (forceUpdate = false) => {
    if (!walletAddress || !publicKey) return;

    try {
      console.log("🔄 Refreshing SOL balance from database AND wallet...");

      // RACE CONDITION FIX: Don't overwrite recent deposits (within 30 seconds)
      const timeSinceLastDeposit = Date.now() - lastDepositTime;
      if (!forceUpdate && timeSinceLastDeposit < 30000) {
        console.log(
          "⏳ Skipping balance refresh - recent deposit in progress (",
          (30000 - timeSinceLastDeposit) / 1000,
          "s remaining)"
        );
        return;
      }

      // Get database balance (deposited SOL)
      const profile = await userProfileService.getProfile(walletAddress);
      const dbBalance = profile ? profile.sol_balance : 0;

      // Get actual wallet SOL balance
      const walletBalances = await jupiterSwapService.getUserBalances(
        publicKey
      );
      const walletSOLBalance = walletBalances.sol;

      console.log("💰 SOL Balance Detection:", {
        deposited_sol_db: dbBalance.toFixed(4),
        wallet_sol_real: walletSOLBalance.toFixed(4),
        ui_balance: currentSOLBalance.toFixed(4),
        wallet_address: walletAddress.slice(0, 8),
        time_since_deposit: timeSinceLastDeposit / 1000 + "s",
      });

      // Update user balances state for wallet operations
      setUserBalances(walletBalances);

      // Update platform balance if database changed
      if (Math.abs(dbBalance - currentSOLBalance) > 0.0001) {
        console.log(
          "✅ Platform SOL balance updated from database:",
          dbBalance.toFixed(4)
        );
        setCurrentSOLBalance(dbBalance);
        onUpdateSOLBalance(dbBalance);
      }
    } catch (error) {
      console.error("❌ Failed to refresh SOL balance:", error);
    }
  };

  // Load lifetime PPA rewards from locks
  const loadLifetimeEarnings = async () => {
    if (!walletAddress) return;

    setIsLoadingEarnings(true);
    try {
      console.log("💰 Loading lifetime PPA rewards...");
      const totalPPARewards = await ppaLocksService.getLifetimeEarnings(
        walletAddress
      );
      setLifetimePPARewards(totalPPARewards);
      console.log(`✅ Lifetime rewards loaded: ${totalPPARewards} PPA`);
    } catch (error) {
      console.error("Failed to load lifetime rewards:", error);
      setLifetimePPARewards(0);
    } finally {
      setLastRewardsRefresh(new Date());
      setIsLoadingEarnings(false);
    }
  };

  // Load active PPA locks and calculate totals
  const loadActivePPALocks = async () => {
    if (!walletAddress) return;

    try {
      console.log("Loading active PPA locks...");
      const locks = await ppaLocksService.getActiveLocksByWallet(walletAddress);
      setActivePPALocks(locks);

      // Calculate total PPA locked including accrued rewards
      const now = new Date();
      const totalLocked = locks.reduce((total, lock) => {
        const { currentAmount } = calculatePPALockGrowth(lock, now);
        return total + currentAmount;
      }, 0);
      setTotalPPALocked(totalLocked);

      console.log(
        `Active locks loaded: ${locks.length} locks, ${totalLocked} PPA locked`
      );
    } catch (error) {
      console.error("Failed to load active PPA locks:", error);
      setActivePPALocks([]);
      setTotalPPALocked(0);
    }
  };

  // Update lock growth status and totals
  const updateCountdown = () => {
    if (activePPALocks.length === 0) {
      setExpiredLock(null);
      setTotalPPALocked(0);
      return;
    }

    const now = new Date();

    const locksWithMetrics = activePPALocks
      .map((lock) => {
        const metrics = calculatePPALockGrowth(lock, now);
        return { lock, metrics };
      })
      .sort(
        (a, b) =>
          new Date(b.lock.created_at).getTime() -
          new Date(a.lock.created_at).getTime()
      );

    const totalCurrent = locksWithMetrics.reduce(
      (sum, entry) => sum + entry.metrics.currentAmount,
      0
    );
    setTotalPPALocked(totalCurrent);

    const latest = locksWithMetrics[0];
    if (!latest) {
      setExpiredLock(null);
      return;
    }

    const { lock, metrics } = latest;

    const enrichedLock = {
      ...lock,
      computedCurrentAmount: metrics.currentAmount,
      computedBonusAmount: metrics.bonusAmount,
      computedDaysElapsed: metrics.daysElapsed,
      computedBonusPercent: metrics.bonusPercent,
    } as PPALock & {
      computedCurrentAmount: number;
      computedBonusAmount: number;
      computedDaysElapsed: number;
      computedBonusPercent: number;
    };

    setExpiredLock(enrichedLock);
  };

  // Handle welcome popup close
  const handleWelcomeClose = () => {
    setShowWelcomePopup(false);
    if (walletAddress) {
      // Mark as seen for this wallet
      localStorage.setItem(`welcomePopupSeen_${walletAddress}`, "true");
    }
  };

  // Get withdrawal approval time based on Israel business hours
  const getWithdrawalApprovalTime = () => {
    // Use currentTime state to ensure re-renders when time updates
    const now = currentTime;

    // Get current time in Israel timezone (Asia/Jerusalem handles DST automatically)
    const israelTime = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);

    const [hours] = israelTime.split(":").map(Number);

    // Business hours: 10:00 to 22:00 Israel time = 30 minutes
    // After hours: 22:00 to 10:00 Israel time = up to 10 hours
    if (hours >= 10 && hours < 22) {
      return "30 minutes";
    } else {
      return "10 hours";
    }
  };

  // Calculate unlock tooltip text
  const getUnlockTooltipText = () => {
    if (expiredLock) {
      const enriched = expiredLock as PPALock & {
        computedBonusAmount?: number;
        computedCurrentAmount?: number;
        computedDaysElapsed?: number;
        computedBonusPercent?: number;
      };

      const baseAmount = Number(expiredLock.ppa_amount) || 0;
      const bonusAmount =
        enriched.computedBonusAmount ??
        calculatePPALockGrowth(expiredLock).bonusAmount;
      const percentageGain =
        enriched.computedBonusPercent ??
        (baseAmount > 0 ? (bonusAmount / baseAmount) * 100 : 0);

      if (percentageGain <= 0) {
        return "Unlock anytime. Rewards begin compounding as soon as you lock.";
      }

      return `Unlock anytime. Currently +${percentageGain.toFixed(
        2
      )}% (${formatTokenAmount(bonusAmount)} PPA) earned on this stake.`;
    }

    if (activePPALocks.length === 0) {
      return "No PPA tokens locked. Lock some tokens first to earn PPA rewards.";
    }

    return "Unlock anytime. Rewards keep compounding until you request an unlock.";
  };

  const loadSOLPrice = async () => {
    try {
      const price = await fetchSOLPrice();
      setSolPrice(price);
      console.log("SOL price loaded:", `$${price.toFixed(2)}`);
    } catch (error) {
      console.error("Failed to load SOL price:", error);
    }
  };

  // Real-time price feed for position tokens - OPTIMIZED WITH CACHING - 2Hz SPEED
  const updateTokenPrices = async () => {
    if (tradingPositions.length === 0) return;

    try {
      console.log("Optimized updating real-time token prices using cache...");
      const uniqueTokens = [
        ...new Set(tradingPositions.map((p) => p.token_address)),
      ];
      const pricePromises = uniqueTokens.map(async (tokenAddress) => {
        try {
          // Use cached price fetching for better performance
          const price = await fetchTokenPriceCached(tokenAddress);
          return { address: tokenAddress, price: price || 0 };
        } catch (error) {
          console.error(`Failed to fetch price for ${tokenAddress}:`, error);
          return {
            address: tokenAddress,
            price: tokenPrices[tokenAddress] || 0,
          }; // Use cached price if API fails
        }
      });

      const priceResults = await Promise.all(pricePromises);
      const newPrices: Record<string, number> = {};

      priceResults.forEach(({ address, price }) => {
        newPrices[address] = price;
      });

      setTokenPrices(newPrices);
      setPriceUpdateCount((prev) => prev + 1);
      console.log(
        `Updated prices for ${uniqueTokens.length} tokens using cache`,
        newPrices
      );
    } catch (error) {
      console.error("Error updating token prices:", error);
    }
  };

  const loadWithdrawalRequests = async () => {
    setIsLoadingWithdrawals(true);
    try {
      const requests = await userProfileService.getWithdrawalRequests(
        walletAddress
      );
      setWithdrawalRequests(requests);
      console.log("Withdrawal requests loaded:", requests.length);
    } catch (error) {
      console.error("Failed to load withdrawal requests:", error);
    } finally {
      setIsLoadingWithdrawals(false);
    }
  };

  const forceRefreshPositions = async () => {
    setLastPositionsLoadTime(0); // Force cache invalidation
    await loadTradingPositions();
  };

  // Generate PNL card after trade close (minimal version)
  const showPnlCardAfterClose = async (positionId: number) => {
    console.log('🎯 Generating PNL card for position:', positionId);
    try {
      // Show loading state immediately
      setIsPnlCardGenerating(true);
      setShowPnlCardPreview(true);
      
      // Wait a moment for the position to be fully updated in DB
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get position and user data
      const [{ data: position }, userProfile] = await Promise.all([
        supabase.from('trading_positions').select('*').eq('id', positionId).single(),
        userProfileService.getProfile(walletAddress).catch(() => null)
      ]);

      console.log('📊 Position data:', position);
      
      if (!position) {
        console.log('❌ No position found for PNL card');
        setIsPnlCardGenerating(false);
        setShowPnlCardPreview(false);
        return;
      }

      // Use current_pnl as primary source for PNL card
      const finalPnL = position.current_pnl || 0;
      const collateralUSD = Number(position.collateral_sol) * solPrice;
      const pnlPercentage = collateralUSD > 0 ? (finalPnL / collateralUSD) * 100 : 0;
      
      console.log('📊 Dashboard PNL Card: Using current_pnl as primary source', {
        positionId: position.id,
        current_pnl: finalPnL,
        pnlPercentage: pnlPercentage.toFixed(2) + '%',
        collateralSOL: position.collateral_sol,
        solPrice
      });
      
      // Create standardized trade results object
      const tradeResults = {
        finalPnL,
        pnlPercentage,
        positionSize: Number(position.amount),
        entryPrice: Number(position.entry_price || 0),
        exitPrice: Number(position.close_price || 0)
      };

      if (!tradeResults) {
        console.log('❌ No trade results available for PNL card');
        setIsPnlCardGenerating(false);
        setShowPnlCardPreview(false);
        return;
      }

      console.log('📈 Trade results:', tradeResults);

      // Generate PNL card data
      const cardData = {
        tokenSymbol: position.token_symbol,
        direction: position.direction,
        leverage: position.leverage,
        profitLossAmount: tradeResults.finalPnL,
        pnlPercentage: tradeResults.pnlPercentage,
        totalBoughtUSD: tradeResults.positionSize * tradeResults.entryPrice,
        totalSoldUSD: (tradeResults.positionSize * tradeResults.entryPrice) + tradeResults.finalPnL,
        username: userProfile?.username || 'Trader'
      };

      console.log('🎨 Generating PNL card with data:', cardData);

      // Generate and show PNL card
      const blob = await generatePnlCard(cardData);
      const imageUrl = URL.createObjectURL(blob);
      
      setPnlCardData(cardData);
      setPnlCardImage(imageUrl);
      setIsPnlCardGenerating(false); // Hide loading
      
      console.log('✅ PNL card popup should now be visible');
    } catch (error) {
      console.error('💥 Error generating PNL card:', error);
      setIsPnlCardGenerating(false);
      setShowPnlCardPreview(false);
    }
  };

  const closePnlCardPreview = () => {
    setShowPnlCardPreview(false);
    if (pnlCardImage) {
      URL.revokeObjectURL(pnlCardImage);
      setPnlCardImage(null);
    }
    setPnlCardData(null);
  };



  const loadTradingPositions = async () => {
    if (!walletAddress) return;

    setIsLoadingPositions(true);
    try {
      console.log(
        "⚡ FAST LOADING: Loading positions with optimized performance..."
      );
      console.log("🔍 DEBUG: Wallet address:", walletAddress);
      console.log("🔍 DEBUG: Is guest mode:", walletAddress === "guest");

      const startTime = Date.now();

      // STEP 1: Get basic position data (FAST - no API calls)
      let positions = await positionService.getUserPositions(walletAddress);
      console.log("🔍 DEBUG: Raw positions from database:", positions.length);
      console.log(
        "🔍 DEBUG: Position statuses:",
        positions.map((p) => p.status)
      );

      // TEMPORARY FIX: Auto-fix stuck 'opening' positions that are older than 30 seconds
      const now = new Date();
      const positionsToFix = positions.filter(
        (p) =>
          p.status === "opening" &&
          now.getTime() - new Date(p.created_at).getTime() > 30000 // 30 seconds
      );

      if (positionsToFix.length > 0) {
        console.log(
          `🔧 FIXING ${positionsToFix.length} stuck 'opening' positions...`
        );

        // Update stuck positions to 'open' status
        for (const pos of positionsToFix) {
          try {
            await supabase
              .from("trading_positions")
              .update({ status: "open", updated_at: new Date().toISOString() })
              .eq("id", pos.id);
            console.log(`✅ Fixed stuck position ${pos.id}: opening → open`);
          } catch (error) {
            console.error(`❌ Failed to fix position ${pos.id}:`, error);
          }
        }

        // Reload positions after fixing
        positions = await positionService.getUserPositions(walletAddress);
        console.log("🔍 DEBUG: Positions after fixing:", positions.length);
      }

      const openPositions = positions.filter(
        (p) => p.status === "open" || p.status === "opening"
      );
      console.log(
        "🔍 DEBUG: Open positions after filtering:",
        openPositions.length
      );

      console.log(
        `⚡ FAST LOADING: Got ${
          openPositions.length
        } positions from database in ${Date.now() - startTime}ms`
      );

      if (openPositions.length === 0) {
        setTradingPositions([]);
        if (walletAddress === "guest") {
          console.log("⚡ FAST LOADING: Guest user - no positions expected");
        } else {
          console.log(
            "⚡ FAST LOADING: No positions found for connected wallet:",
            walletAddress
          );
        }
        return;
      }

      // STEP 2: Batch fetch token images (OPTIMIZED - parallel requests)
      const tokenAddresses = [
        ...new Set(openPositions.map((p) => p.token_address)),
      ];
      console.log(
        `⚡ FAST LOADING: Batching token data for ${tokenAddresses.length} unique tokens...`
      );

      const tokenDataPromises = tokenAddresses.map(async (address) => {
        try {
          const tokenData = await fetchTokenDetailCached(address);
          return { address, logoURI: tokenData?.logoURI || null };
        } catch (error) {
          console.warn(`Token data fetch failed for ${address}:`, error);
          return { address, logoURI: null };
        }
      });

      const tokenResults = await Promise.all(tokenDataPromises);
      const tokenImageMap = tokenResults.reduce((acc, { address, logoURI }) => {
        acc[address] = logoURI;
        return acc;
      }, {} as Record<string, string | null>);

      // STEP 3: Set positions with images (FAST - no P&L calculations yet)
      const positionsWithImages = openPositions.map((position) => ({
        ...position,
        token_image: tokenImageMap[position.token_address],
        // Use existing P&L values from database or defaults
        current_pnl: position.current_pnl || 0,
        current_price: position.current_price || position.entry_price,
        margin_ratio: position.margin_ratio || 0,
      }));

      setTradingPositions(positionsWithImages);
      setLastPositionsLoadTime(Date.now()); // Update timestamp for caching logic

      const loadTime = Date.now() - startTime;
      console.log(
        `⚡ FAST LOADING: Completed in ${loadTime}ms - positions displayed immediately!`
      );
      console.log(
        `🚀 BUSINESS PLAN: Real-time P&L updates will start via 20Hz price service`
      );

      // STEP 4: Refresh SOL balance (non-blocking)
      refreshSOLBalance();
    } catch (error) {
      console.error("Error loading positions:", error);
      setTradingPositions([]);
    } finally {
      setIsLoadingPositions(false);
    }
  };

  // ADDED: Load pending limit orders
  const loadPendingOrders = async () => {
    if (!walletAddress) return;

    setIsLoadingOrders(true);
    try {
      console.log("Loading pending limit orders...");
      const positions = await positionService.getUserPositions(walletAddress);
      const orders = positions.filter((p) => p.status === "pending");

      // Fetch token images for orders
      const ordersWithImages = await Promise.all(
        orders.map(async (order) => {
          try {
            const tokenData = await fetchTokenDetailCached(order.token_address);
            return {
              ...order,
              token_image: tokenData?.logoURI || null,
              current_price: tokenData?.price || 0, // Add current market price for comparison
            };
          } catch (error) {
            console.error(
              `Error fetching token data for order ${order.id}:`,
              error
            );
            return order;
          }
        })
      );

      setPendingOrders(ordersWithImages);
      console.log(`Loaded ${ordersWithImages.length} pending orders`);
    } catch (error) {
      console.error("Error loading pending orders:", error);
      setPendingOrders([]);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // ADDED: Load trade history (closed/liquidated positions)
  const loadTradeHistory = async () => {
    if (!walletAddress) {
      setTodayPlatformRevenueSol(0);
      setTodayTradingVolumeUsd(0);
      return;
    }

    setIsLoadingTradeHistory(true);
    try {
      console.log("Loading trade history...");
      const positions = await positionService.getUserPositions(walletAddress);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      let revenueTodaySol = 0;
      let volumeTodayUsd = 0;

      positions.forEach((pos) => {
        const createdAt = pos.created_at ? new Date(pos.created_at) : null;
        if (createdAt && !Number.isNaN(createdAt.getTime()) && createdAt >= startOfToday) {
          volumeTodayUsd += Math.abs(Number((pos as any).position_value_usd ?? 0));
        }

        const closedAtRaw = pos.closed_at || pos.updated_at;
        if (closedAtRaw) {
          const closedAt = new Date(closedAtRaw);
          if (!Number.isNaN(closedAt.getTime()) && closedAt >= startOfToday) {
            revenueTodaySol += Number((pos as any).platform_fee_sol ?? 0);
          }
        }
      });

      setTodayPlatformRevenueSol(revenueTodaySol);
      setTodayTradingVolumeUsd(volumeTodayUsd);

      const history = positions.filter(
        (p) =>
          p.status === "closed" ||
          p.status === "liquidated" ||
          p.status === "cancelled"
      );

      // Sort by closed date, most recent first
      const sortedHistory = history.sort((a, b) => {
        const dateA = new Date(a.closed_at || a.updated_at);
        const dateB = new Date(b.closed_at || b.updated_at);
        return dateB.getTime() - dateA.getTime();
      });

      // Fetch token images for trade history
      const historyWithImages = await Promise.all(
        sortedHistory.slice(0, 6).map(async (trade) => {
          // Show last 6 trades
          try {
            const tokenData = await fetchTokenDetailCached(trade.token_address);
            return {
              ...trade,
              token_image: tokenData?.logoURI || null,
            };
          } catch (error) {
            console.error(
              `Error fetching token data for trade ${trade.id}:`,
              error
            );
            return trade;
          }
        })
      );

      setTradeHistory(historyWithImages);
      console.log(`Loaded ${historyWithImages.length} trade history records`);
    } catch (error) {
      console.error("Error loading trade history:", error);
      setTradeHistory([]);
      setTodayPlatformRevenueSol(0);
      setTodayTradingVolumeUsd(0);
    } finally {
      setIsLoadingTradeHistory(false);
    }
  };

  // Load withdrawal history
  const loadWithdrawalHistory = async () => {
    if (!walletAddress) return;

    setIsLoadingWithdrawals(true);
    try {
      console.log("Loading withdrawal history...");
      const withdrawals = await userProfileService.getWithdrawalRequests(
        walletAddress
      );

      // Sort by created date, most recent first
      const sortedWithdrawals = withdrawals.sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateB.getTime() - dateA.getTime();
      });

      setWithdrawalHistory(sortedWithdrawals.slice(0, 10)); // Show last 10 withdrawals
      console.log(`Loaded ${sortedWithdrawals.length} withdrawal records`);
    } catch (error) {
      console.error("Error loading withdrawal history:", error);
      setWithdrawalHistory([]);
    } finally {
      setIsLoadingWithdrawals(false);
    }
  };

  const loadDepositHistory = async () => {
    if (!walletAddress) return;

    setIsLoadingDeposits(true);
    try {
      console.log("Loading deposit history...");
      const deposits = await userProfileService.getDepositHistory(
        walletAddress
      );

      // Sort by created date, most recent first (already sorted by DB query)
      setDepositHistory(deposits);
      console.log("Deposit history loaded:", deposits.length);
    } catch (error) {
      console.error("Failed to load deposit history:", error);
      setDepositHistory([]);
    } finally {
      setIsLoadingDeposits(false);
    }
  };

  // Calculate P&L using cached real-time prices
  const calculatePositionPnLWithCachedPrice = (position: TradingPosition) => {
    const cached_price = tokenPrices[position.token_address];
    const current_price = cached_price || position.entry_price;
    const entry_price = position.entry_price;
    const amount = position.amount;
    const leverage = position.leverage;

    // Log price source for debugging
    if (!cached_price) {
      console.log(
        `⚠️ Position ${position.id} (${
          position.token_symbol
        }): No cached price found for ${position.token_address.slice(
          0,
          8
        )}..., using entry price $${entry_price.toFixed(6)}`
      );
    } else {
      console.log(
        `✅ Position ${position.id} (${
          position.token_symbol
        }): Using cached price $${cached_price.toFixed(
          6
        )} for ${position.token_address.slice(0, 8)}...`
      );
    }

    // Calculate P&L in USD - FIXED: Apply leverage correctly
    let pnl_usd = 0;
    if (position.direction === "Long") {
      pnl_usd = (current_price - entry_price) * amount * leverage; // WITH leverage multiplication!
    } else {
      pnl_usd = (entry_price - current_price) * amount * leverage; // WITH leverage multiplication!
    }

    console.log(`🧮 FRONTEND P&L Debug for Position ${position.id}:`, {
      token: position.token_symbol,
      amount: amount,
      entry_price: entry_price,
      current_price: current_price,
      price_diff: (current_price - entry_price).toFixed(8),
      direction: position.direction,
      leverage: leverage,
      pnl_usd_CORRECTED: pnl_usd.toFixed(2),
    });

    // Calculate margin ratio in SOL terms (CORRECT WAY)
    const max_loss_sol = position.collateral_sol; // Keep max loss in SOL
    const pnl_sol = pnl_usd / solPrice; // Convert P&L from USD to SOL

    let margin_ratio = 0;
    if (pnl_sol < 0) {
      margin_ratio = Math.abs(pnl_sol) / max_loss_sol;
    }

    // Reduced logging - only log occasionally
    if (Math.random() < 0.1) {
      // Log 10% of calculations
      console.log(`💰 Position ${position.id} calculation:`, {
        token: position.token_symbol,
        entry_price: entry_price.toFixed(6),
        current_price: current_price.toFixed(6),
        price_source: cached_price ? "cached" : "entry",
        pnl_usd: pnl_usd.toFixed(2),
        direction: position.direction,
      });
    }

    return {
      pnl: pnl_usd, // Return P&L in USD for display
      margin_ratio: Math.min(margin_ratio, 1),
      current_price,
    };
  };

  // Calculate total portfolio value including position P&L
  const calculateTotalPortfolioValue = () => {
    // Calculate total SOL collateral locked in active positions
    const lockedSOLCollateral = tradingPositions.reduce((total, position) => {
      return total + (position.collateral_sol || 0);
    }, 0);

    // Total SOL holdings = Available SOL + Locked SOL in positions
    const totalSOLHoldings = currentSOLBalance + lockedSOLCollateral;
    const totalSOLValue = totalSOLHoldings * solPrice;

    // Calculate total unrealized P&L from all active positions using real-time prices
    const totalPositionPnL = tradingPositions.reduce((total, position) => {
      const realtimePnL = calculatePositionPnLWithCachedPrice(position);
      return total + realtimePnL.pnl;
    }, 0);

    // Total portfolio = USD balance + Total SOL value + unrealized P&L
    const totalValue = balance + totalSOLValue + totalPositionPnL;

    return {
      totalValue,
      collateralValue: totalSOLValue,
      tradingBalance: balance,
      positionPnL: totalPositionPnL,
      positionCount: tradingPositions.length,
      availableSOL: currentSOLBalance,
      lockedSOL: lockedSOLCollateral,
      totalSOL: totalSOLHoldings,
    };
  };

  const getSwapQuote = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) return;

    setIsGettingQuote(true);
    setSwapError(null);

    try {
      const direction: SwapDirection =
        swapMode === "buy" ? "SOL_TO_PPA" : "PPA_TO_SOL";
      const quote = await jupiterSwapService.getSwapQuoteWithDirection(
        parseFloat(payAmount),
        direction
      );
      setSwapQuote(quote);

      if (quote) {
        // Use the service method for both directions
        const rate = await jupiterSwapService.getExchangeRate(direction);
        setExchangeRate(rate);
      } else {
        setSwapError("Unable to get quote. Please try again.");
        setExchangeRate(null);
      }
    } catch (error) {
      console.error("Error getting quote:", error);
      setSwapError("Failed to get quote. Please check your connection.");
      setExchangeRate(null);
    } finally {
      setIsGettingQuote(false);
    }
  };

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
  };

  const handleCASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caInput.trim()) return;

    const tokenAddress = caInput.trim();

    setIsValidatingCA(true);
    setCaValidationError(null);

    try {
      console.log(
        "🔍 Validating token for honeypots and market cap:",
        tokenAddress
      );

      // STEP 1: Check for honeypots first (security check)
      const securityData = await fetchTokenSecurity(tokenAddress);

      if (securityData?.honeypotRisk) {
        console.log("🚫 BLOCKED HONEYPOT via CA input:", tokenAddress);
        setCaValidationError(
          "This token has been identified as a potential honeypot and cannot be traded. " +
            "Honeypots may prevent you from selling your tokens."
        );
        return;
      }

      console.log("Token passed honeypot security check");

      // STEP 2: Fetch token data to check market cap
      const tokenData = await fetchTokenDetailCached(tokenAddress);

      if (!tokenData) {
        setCaValidationError("Token not found or invalid contract address");
        return;
      }

      const marketCap = tokenData.marketCap || 0;
      const minimumMarketCap = 80000; // $80k minimum

      console.log("Token market cap:", `$${marketCap.toLocaleString()}`);
      console.log("Minimum required:", `$${minimumMarketCap.toLocaleString()}`);

      if (marketCap < minimumMarketCap) {
        setCaValidationError(
          `Market cap too low: $${marketCap.toLocaleString()}. ` +
            `Minimum required: $${minimumMarketCap.toLocaleString()}`
        );
        return;
      }

      console.log(
        "Token passes all validation checks, proceeding to trading..."
      );

      // Token passes all validation, proceed to trading modal directly
      setSelectedTokenData(tokenData);
      setShowTradingModal(true);
      setCaInput("");
      setCaValidationError(null);
    } catch (error: any) {
      console.error("Error validating token:", error);
      setCaValidationError(
        "Failed to validate token. Please check the contract address and try again."
      );
    } finally {
      setIsValidatingCA(false);
    }
  };

  const handleBuyPPA = () => {
    setShowSwapModal(true);
    setSwapMode("buy");
    setPayAmount("");
    setSwapQuote(null);
    setSwapError(null);
    setExchangeRate(null);
    if (publicKey) {
      loadUserBalances();
    }
  };

  const handleToggleSwapMode = () => {
    // Clear current values when switching modes
    setPayAmount("");
    setSwapQuote(null);
    setExchangeRate(null);
    setSwapError(null);

    // Toggle between buy and sell
    setSwapMode(swapMode === "buy" ? "sell" : "buy");
  };

  const handleMaxAmount = () => {
    if (swapMode === "buy") {
      // For buying, use available SOL (leave a small buffer for transaction fees)
      const maxSOL = Math.max(0, userBalances.sol - 0.01);
      setPayAmount(maxSOL.toFixed(4));
    } else {
      // For selling, use available PPA
      setPayAmount(userBalances.ppa.toString());
    }
  };

  const handleSwap = async () => {
    if (!swapQuote || !publicKey || !signTransaction) {
      setSwapError("Wallet not connected or quote not available");
      return;
    }

    setIsSwapping(true);
    setSwapError(null);

    try {
      // Validate balance based on swap mode
      if (swapMode === "buy") {
        const hasBalance = await jupiterSwapService.validateSOLBalance(
          publicKey,
          parseFloat(payAmount)
        );
        if (!hasBalance) {
          setSwapError("Insufficient SOL balance");
          setIsSwapping(false);
          return;
        }
      } else {
        // For selling PPA, check if user has enough PPA
        if (userBalances.ppa < parseFloat(payAmount)) {
          setSwapError("Insufficient PPA balance");
          setIsSwapping(false);
          return;
        }
      }

      console.log(`Starting ${swapMode} transaction...`);

      const result = await jupiterSwapService.executeSwap(
        swapQuote,
        publicKey,
        signTransaction
      );

      if (result) {
        console.log("Swap successful:", result);

        const inputToken = swapMode === "buy" ? "SOL" : "PPA";
        const outputToken = swapMode === "buy" ? "PPA" : "SOL";

        setSwapSuccessData({
          txid: result.txid,
          inputAmount: result.inputAmount,
          outputAmount: result.outputAmount,
          inputToken,
          outputToken,
          feeAmount: result.feeAmount,
        });

        setShowSwapModal(false);
        setShowSuccessModal(true);

        setPayAmount("");
        setSwapQuote(null);
        setExchangeRate(null);

        loadUserBalances();

        // Update balance based on swap mode
        if (swapMode === "buy") {
          // Buying PPA with SOL - spending SOL
          const balanceChange = -result.inputAmount;
          const newBalance = balance + balanceChange;
          onUpdateBalance(newBalance);
        } else {
          // Selling PPA for SOL - receiving SOL
          const balanceChange = result.outputAmount;
          const newBalance = balance + balanceChange;
          onUpdateBalance(newBalance);
        }
      } else {
        setSwapError("Swap failed. Please try again.");
      }
    } catch (error: any) {
      console.error("DETAILED Swap error:", error);
      console.error("Error message:", error.message);
      console.error("Error type:", typeof error);
      console.error(
        "Full error object:",
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      );

      let userFriendlyError = error.message || "Swap failed. Please try again.";

      // Parse common Solana transaction errors
      if (userFriendlyError.includes("InsufficientFunds")) {
        userFriendlyError =
          swapMode === "buy"
            ? "Insufficient SOL balance for transaction fees"
            : "Insufficient PPA balance";
      } else if (userFriendlyError.includes("0x1")) {
        userFriendlyError = "Insufficient funds for this transaction";
      } else if (userFriendlyError.includes("0x0")) {
        userFriendlyError =
          "Account not found - you may need to create a token account first";
      } else if (userFriendlyError.includes("slippage")) {
        userFriendlyError =
          "Price moved too much during swap. Try again with higher slippage tolerance.";
      }

      setSwapError(userFriendlyError);
    } finally {
      setIsSwapping(false);
    }
  };

  const handleTokenClick = async (token: TrendingToken) => {
    // Immediate UI feedback
    soundManager.playClick();
    hapticFeedback.light();

    // Show modal immediately with loading state
    setSelectedTokenData({
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      price: token.price,
      priceChange24h: token.priceChange24h,
      // Minimal data for immediate display
      marketCap: 0,
      volume24h: 0,
      description: "", // Not displayed in UI
      socialLinks: { website: "", twitter: "", telegram: "" },
      isLoading: true, // Add loading flag
    });
    setShowTradingModal(true);

    // Load full token data in background
    try {
      const tokenData = await fetchTokenDetailCached(token.address);
      if (tokenData) {
        setSelectedTokenData({
          ...tokenData,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error("Error loading full token data:", error);
      // Keep the modal open with basic data if full load fails
    }
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    setSwapSuccessData(null);
  };

  // SOL transfer function
  const transferSOL = async (
    amount: number,
    walletOverride?: string
  ): Promise<string | null> => {
    if (!publicKey || !signTransaction) {
      throw new Error("Wallet not connected");
    }

    try {
      const destinationWallet =
        walletOverride || depositWallet || DEFAULT_ISRAEL_WALLET;
      const endpoints: Array<{
        url: string;
        label: string;
      }> = [
        {
          url: "https://solitary-methodical-resonance.solana-mainnet.quiknode.pro/75cfc57db8a6530f4f781550e81c834f7f96cf61/",
          label: "QuickNode RPC",
        },
      ];

      let lastError: unknown = null;

      for (const endpoint of endpoints) {
        try {
          console.log(`🔁 Attempting SOL transfer via ${endpoint.label}`);
          const connection = new Connection(endpoint.url, {
            commitment: "confirmed",
          });

          const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash();

          const transaction = new Transaction();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = publicKey;
          transaction.add(
            ComputeBudgetProgram.setComputeUnitLimit({
              units: 200_000,
            })
          );
          transaction.add(
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 100_000,
            })
          );
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: new PublicKey(destinationWallet),
              lamports: Math.floor(amount * LAMPORTS_PER_SOL),
            })
          );

          console.log("📝 Public RPC transaction created, requesting signature...");
          const signedTransaction = await signTransaction(transaction);

          console.log(`🚀 Sending transaction via ${endpoint.label}...`);
          const txid = await connection.sendRawTransaction(
            signedTransaction.serialize(),
            {
              skipPreflight: true,
              maxRetries: 3,
            }
          );

          console.log("⏳ Confirming transaction:", txid);
          setIsVerifyingTransaction(true);

          const confirmation = await connection.confirmTransaction(
            {
              signature: txid,
              blockhash,
              lastValidBlockHeight,
            },
            "confirmed"
          );

          if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err}`);
          }

          console.log("✅ SOL transfer confirmed:", txid);
          setIsVerifyingTransaction(false);
          return txid;
        } catch (endpointError) {
          lastError = endpointError;
          setIsVerifyingTransaction(false);
          if (endpointError instanceof SendTransactionError) {
            try {
              const logs = endpointError.getLogs();
              console.error(
                `❌ Deposit attempt failed via ${endpoint.label}:`,
                endpointError,
                logs ? { logs } : undefined
              );
            } catch (logError) {
              console.error(
                `❌ Deposit attempt failed via ${endpoint.label}:`,
                endpointError
              );
            }
          } else {
            console.error(
              `❌ Deposit attempt failed via ${endpoint.label}:`,
              endpointError
            );
          }
          continue;
        }
      }

      throw lastError ?? new Error("Deposit failed on all RPC endpoints");
    } catch (error: any) {
      console.error("SOL transfer error:", error);
      throw error;
    }
  };

  // Deposit/Withdraw handlers - SOL deposit with 0.04 minimum and real transfer
  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!depositAmount || Number.isNaN(amount)) {
      setDepositError("Enter an amount to deposit (minimum 0.04 SOL).");
      return;
    }
    if (amount < 0.04) {
      setDepositError("Minimum deposit is 0.04 SOL.");
      return;
    }

    if (!publicKey || !signTransaction) {
      setDepositError("Wallet not connected");
      return;
    }

    setIsDepositing(true);
    setDepositError(null);

    let txid: string | null = null;
    const routingDecision = selectDepositWalletForAmount(amount);
    const selectedDepositWallet =
      routingDecision.walletAddress ||
      depositWallet ||
      CONFIGURED_ISRAEL_WALLET ||
      DEFAULT_ISRAEL_WALLET;

    setDepositWalletMeta((prev) => ({
      ...prev,
      lastRoutedWallet: selectedDepositWallet,
      lastRoutingReason: routingDecision.routingReason ?? "runtime-route",
      walletList:
        prev?.walletList && prev.walletList.length > 0
          ? prev.walletList
          : routingDecision.walletPool || DEFAULT_WALLET_LIST,
    }));

    try {
      console.log("Checking wallet balance for:", publicKey.toString());

      let balance: number | null = null;
      let lastBalanceError: unknown = null;

      for (const endpoint of BALANCE_RPC_ENDPOINTS) {
        try {
          console.log(`🔁 Checking balance via ${endpoint.label}...`);
          const connection = new Connection(endpoint.url, {
            commitment: "confirmed",
          });
          balance = await connection.getBalance(publicKey);
          console.log(`✅ Balance fetched via ${endpoint.label}`);
          break;
        } catch (rpcError) {
          lastBalanceError = rpcError;
          console.error(
            `❌ Balance fetch failed via ${endpoint.label}:`,
            rpcError
          );
          continue;
        }
      }

      if (balance === null) {
        console.error("All balance RPC endpoints failed:", lastBalanceError);
        setDepositError(
          "Unable to check wallet balance. Please try again or check your connection."
        );
        setIsDepositing(false);
        return;
      }

      const solBalance = balance / LAMPORTS_PER_SOL;
      const requiredAmount = amount + 0.001; // Include transaction fee

      console.log(`Wallet balance: ${solBalance.toFixed(4)} SOL, Required: ${requiredAmount.toFixed(4)} SOL`);

      if (solBalance < requiredAmount) {
        setDepositError(
          `Insufficient SOL balance. You have ${solBalance.toFixed(
            4
          )} SOL, need ${requiredAmount.toFixed(4)} SOL (including fees)`
        );
        return;
      }

      console.log("Starting SOL deposit:", amount, "SOL");

      // Execute the SOL transfer
      txid = await transferSOL(amount, selectedDepositWallet);

      if (txid) {
        console.log("✅ SOL deposit broadcasted:", txid);

        // Call secure serverless function to verify and credit deposit
        let verificationResult: any = null;
        try {
          const response = await fetch("/.netlify/functions/verify-deposit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletAddress,
              amount,
              txid,
              targetWallet: selectedDepositWallet,
            }),
          });

          try {
            verificationResult = await response.json();
          } catch (parseError) {
            throw new Error(
              "Deposit sent, but the verification service returned an invalid response."
            );
          }

          if (!response.ok || !verificationResult?.success) {
            const message =
              verificationResult?.error ||
              verificationResult?.message ||
              "Deposit verification failed.";
            throw new Error(message);
          }
        } catch (verificationError: any) {
          throw new Error(
            (verificationError?.message ||
              "Deposit verification service is unavailable.") +
              " Please contact support with your transaction ID."
          );
        }

        const newPlatformSOLBalance =
          typeof verificationResult?.newBalance === "number"
            ? verificationResult.newBalance
            : currentSOLBalance + amount;

        setCurrentSOLBalance(newPlatformSOLBalance);
        setLastDepositTime(Date.now());
        onUpdateSOLBalance(newPlatformSOLBalance);

        if (activeTab === "orders") {
          loadDepositHistory();
        }

        setDepositAmount("");
        setShowDepositModal(false);

        console.log(
          `Deposited ${amount} SOL successfully! Transaction: ${txid}`
        );
        console.log(
          `Platform SOL balance updated to: ${newPlatformSOLBalance.toFixed(
            4
          )} SOL`
        );
      }
    } catch (error: any) {
      console.error("Deposit error:", error);
      const supportSuffix = txid
        ? ` Please contact support with transaction ID ${txid}.`
        : "";
      setDepositError(
        (error?.message || "Failed to deposit SOL. Please try again.") +
          supportSuffix
      );
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0 || amount < 0.04 || amount > currentSOLBalance)
      return;

    setIsWithdrawing(true);
    setWithdrawError(null);
    setWithdrawSuccess(null);

    try {
      console.log("Starting SOL withdrawal request:", amount, "SOL");

      let withdrawalResult: any = null;

      try {
        const response = await fetch("/.netlify/functions/request-withdrawal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, amount }),
        });

        try {
          withdrawalResult = await response.json();
        } catch (parseError) {
          throw new Error(
            "Withdrawal request sent, but the server returned an invalid response."
          );
        }

        if (!response.ok || !withdrawalResult?.success) {
          const message =
            withdrawalResult?.error ||
            withdrawalResult?.message ||
            "Withdrawal request failed.";
          throw new Error(message);
        }
      } catch (requestError: any) {
        throw new Error(
          requestError?.message ||
            "Failed to submit withdrawal request. Please try again."
        );
      }

      const newSOLBalance =
        typeof withdrawalResult?.newBalance === "number"
          ? withdrawalResult.newBalance
          : currentSOLBalance - amount;

      setCurrentSOLBalance(newSOLBalance);
      setLastDepositTime(Date.now());
      onUpdateSOLBalance(newSOLBalance);

      const confirmationMessage =
        withdrawalResult?.message ||
        `Withdrawal request submitted for ${amount.toFixed(
          4
        )} SOL. Withdrawal is being processed this typically takes up to ${getWithdrawalApprovalTime()}.`;

      setWithdrawSuccess(confirmationMessage);

      loadWithdrawalRequests();

      setTimeout(() => {
        setWithdrawAmount("");
        setShowWithdrawModal(false);
        setWithdrawSuccess(null);
      }, 3000);

      console.log(
        `Withdrawal request submitted! New SOL balance: ${newSOLBalance.toFixed(
          4
        )} SOL`
      );
    } catch (error: any) {
      console.error("Withdrawal request error:", error);
      setWithdrawError(
        error?.message ||
          "Failed to create withdrawal request. Please try again."
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Settings handlers
  const handleEditProfile = () => {
    setShowSettings(false);
    setViewState("edit-profile");
  };

  const handleDisconnectWallet = async () => {
    try {
      setShowSettings(false);

      // Force disconnect the wallet
      await disconnect();

      // Clear wallet-related localStorage (common wallet adapter keys)
      localStorage.removeItem("walletName");
      localStorage.removeItem("wallet-adapter-autoconnect");
      localStorage.removeItem("wallet-adapter-cached-wallet");

      // Clear any Phantom-specific storage
      localStorage.removeItem("phantom-wallet");
      localStorage.removeItem("solana-wallet");

      // Clear session storage
      sessionStorage.clear();

      console.log("Wallet disconnected successfully");

      // Force page reload to ensure complete disconnection
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      // Force reload even if disconnect fails
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  const handleConnectWalletFromGuest = async () => {
    try {
      setShowSettings(false);
      console.log("🔄 Switching from guest mode to wallet connection");

      // Force page reload to return to login screen
      window.location.reload();
    } catch (error) {
      console.error("Error switching to wallet connection:", error);
      window.location.reload();
    }
  };

  const handleToggleSound = () => {
    const newSoundEnabled = !soundEnabled;
    setSoundEnabled(newSoundEnabled);
    soundManager.setSoundEnabled(newSoundEnabled);

    console.log(`Sound ${newSoundEnabled ? "enabled" : "disabled"}`);
  };

  const handleBackToDashboard = () => {
    setViewState("dashboard");
  };

  const handleProfileSave = (profileData: {
    username: string;
    profilePicture?: string;
  }) => {
    setCurrentUsername(profileData.username);
    setCurrentProfilePicture(profileData.profilePicture);
    setViewState("dashboard");
  };

  // Position modal handlers
  const handlePositionClick = (position: TradingPosition) => {
    setSelectedPosition(position);
    setShowPositionModal(true);
  };

  const handleClosePositionModal = () => {
    setShowPositionModal(false);
    setSelectedPosition(null);
    setIsClosingPosition(false);
    
    // Force refresh positions when modal closes (in case position was closed)
    if (activeTab === "positions") {
      forceRefreshPositions();
    }
  };

  const handleClosePosition = async (positionId: number) => {
    console.log('🔥 handleClosePosition called for position:', positionId);
    // Check if position is already in closing status
    const position = tradingPositions.find((p) => p.id === positionId);
    if (position?.status === "closing") {
      console.log(
        `Position ${positionId} is already closing (10-second delay in progress)`
      );
      return;
    }

    // Prevent duplicate closing operations
    if (closingPositions.has(positionId)) {
      console.log(
        `Position ${positionId} is already being closed, skipping duplicate operation`
      );
      return;
    }

    setIsClosingPosition(true);
    setClosingPositions((prev) => new Set(prev).add(positionId));



    try {
      console.log("🔄 Closing position with FRESH price:", positionId);

      // 🚨 CRITICAL: Get FRESH price and optimize close flow
      const position = tradingPositions.find((p) => p.id === positionId);
      let freshPrice: number | undefined;
      
      if (position) {
        console.log("GETTING FRESH PRICE FOR POSITION CLOSE...");

        try {
          const freshTokenData = await fetchTokenDetailCached(
            position.token_address
          );
          if (freshTokenData) {
            freshPrice = freshTokenData.price;
            console.log("FRESH PRICE FETCHED FOR CLOSE:", {
              position_id: positionId,
              token: position.token_symbol,
              entry_price: position.entry_price,
              cached_current_price: position.current_price || "N/A",
              fresh_close_price: freshPrice,
              FINAL_EXECUTION_PRICE: freshPrice,
            });
          } else {
            console.log(
              "Fresh price fetch failed for position close, using existing price"
            );
          }
        } catch (error) {
          console.log(
            "Error fetching fresh price for close, proceeding with existing price:",
            error
          );
        }
      }

      // Close position first, then refresh data
      await positionService.closePosition(positionId, "manual", freshPrice);
      console.log(`✅ Position ${positionId} closed successfully, now refreshing data...`);
      
      // Refresh data after position is closed
      await Promise.all([
        forceRefreshPositions(), // Refresh positions after close
        refreshSOLBalance()      // Refresh balance in parallel
      ]);

      // Show PNL card popup after position is closed
      console.log('🚀 About to call showPnlCardAfterClose for position:', positionId);
      await showPnlCardAfterClose(positionId);
      console.log('🎉 Finished calling showPnlCardAfterClose');

      console.log("Position closed successfully with fresh price");
    } catch (error) {
      console.error("❌ Error in handleClosePosition:", error);
      console.error("Error details:", {
        positionId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      setIsClosingPosition(false);
      setClosingPositions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(positionId);
        return newSet;
      });
    }
  };

  // ADDED: Order management functions
  const handleEditOrderPrice = async (orderId: number) => {
    if (!newOrderPrice || parseFloat(newOrderPrice) <= 0) {
      console.error("Invalid price for order update");
      return;
    }

    try {
      console.log(`🔄 Updating order ${orderId} price to ${newOrderPrice}...`);

      // Update the order in the database
      const { error } = await supabase
        .from("trading_positions")
        .update({
          target_price: parseFloat(newOrderPrice),
          entry_price: parseFloat(newOrderPrice), // For limit orders, these should be the same
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) {
        throw error;
      }

      console.log(`Order ${orderId} price updated successfully`);

      // Update UI immediately
      setPendingOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                target_price: parseFloat(newOrderPrice),
                entry_price: parseFloat(newOrderPrice),
              }
            : order
        )
      );

      // Reset edit state
      setIsEditingOrder(null);
      setNewOrderPrice("");
    } catch (error) {
      console.error(`Error updating order ${orderId}:`, error);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    try {
      console.log(`🔄 Cancelling order ${orderId}...`);

      // Get the order details first to refund collateral
      const order = pendingOrders.find((o) => o.id === orderId);
      if (!order) {
        throw new Error("Order not found");
      }

      // Cancel the order in database
      const { error: cancelError } = await supabase
        .from("trading_positions")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (cancelError) {
        throw cancelError;
      }

      // Refund collateral to user (no trading fees to refund)
      const profile = await userProfileService.getProfile(walletAddress);
      if (profile) {
        const refundAmount = order.collateral_sol;
        const newSOLBalance = profile.sol_balance + refundAmount;

        const updated = await userProfileService.updateSOLBalance(
          walletAddress,
          newSOLBalance
        );
        if (updated && onUpdateSOLBalance) {
          onUpdateSOLBalance(newSOLBalance);
          setCurrentSOLBalance(newSOLBalance);
          console.log(
            `Refunded ${refundAmount.toFixed(4)} SOL collateral to user`
          );
        }
      }

      console.log(`Order ${orderId} cancelled successfully`);

      // Remove order from UI
      setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (error) {
      console.error(`Error cancelling order ${orderId}:`, error);
    }
  };



  // Debug function to check profile status
  const debugProfile = async () => {
    if (!walletAddress) {
      console.log("No wallet connected");
      return;
    }

    try {
      console.log("Debugging profile for wallet:", walletAddress);
      const profile = await userProfileService.getProfile(walletAddress);

      if (!profile) {
        console.log("No profile found in database");
        return;
      }

      console.log("Profile found in database:", {
        wallet_address: profile.wallet_address,
        username: profile.username,
        usd_balance: profile.balance,
        sol_balance: profile.sol_balance,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      });

      console.log("Current state comparison:", {
        db_sol_balance: profile.sol_balance,
        ui_sol_balance: currentSOLBalance,
        db_usd_balance: profile.balance,
        ui_usd_balance: balance,
      });
    } catch (error) {
      console.error("Error debugging profile:", error);
    }
  };

  // ADDED: Debug SOL balance issues - add to window for testing
  useEffect(() => {
    if (walletAddress) {
      (window as any).debugSOLBalance = async () => {
        console.log("🔧 DEBUG SOL BALANCE SYSTEM:");

        try {
          const profile = await userProfileService.getProfile(walletAddress);
          const positions = await positionService.getUserPositions(
            walletAddress
          );
          const activePositions = positions.filter(
            (p) => p.status === "open" || p.status === "opening"
          );

          const totalCollateral = activePositions.reduce(
            (sum, pos) => sum + pos.collateral_sol,
            0
          );

          console.log("📊 SOL BALANCE BREAKDOWN:", {
            database_sol_balance: profile?.sol_balance || 0,
            ui_displayed_balance: currentSOLBalance,
            active_positions: activePositions.length,
            collateral_locked: totalCollateral.toFixed(4),
            available_sol: (profile?.sol_balance || 0).toFixed(4),
            total_sol_holdings: (
              (profile?.sol_balance || 0) + totalCollateral
            ).toFixed(4),
          });

          console.log("🔄 REFRESHING SOL BALANCE NOW...");
          await refreshSOLBalance();
          console.log("✅ SOL balance refresh complete");

          return {
            database_balance: profile?.sol_balance || 0,
            ui_balance: currentSOLBalance,
            positions_count: activePositions.length,
            collateral_locked: totalCollateral,
          };
        } catch (error) {
          console.error("❌ Error debugging SOL balance:", error);
          return error;
        }
      };

      (window as any).forceRefreshSOL = () => {
        console.log("🔄 FORCE REFRESHING SOL BALANCE...");
        refreshSOLBalance();
        loadTradingPositions();
        return "SOL balance and positions refreshed";
      };

      (window as any).testPositionLoadSpeed = async () => {
        console.log("⚡ TESTING POSITION LOAD PERFORMANCE...");
        const startTime = Date.now();

        setIsLoadingPositions(true);
        await loadTradingPositions();

        const loadTime = Date.now() - startTime;
        console.log(`🏁 POSITION LOAD COMPLETED IN: ${loadTime}ms`);

        return {
          loadTimeMs: loadTime,
          positionCount: tradingPositions.length,
          performance:
            loadTime < 500
              ? "EXCELLENT"
              : loadTime < 1000
              ? "GOOD"
              : loadTime < 2000
              ? "FAIR"
              : "SLOW",
          optimizations: [
            "✅ Eliminated heavy P&L calculations on load",
            "✅ Batched token image fetches",
            "✅ Used database values instead of API calls",
            "✅ Deferred calculations to real-time service",
          ],
        };
      };
    }
  }, [walletAddress, currentSOLBalance]);

  // Show different views based on viewState

  if (viewState === "edit-profile") {
    return (
      <EditProfile
        onBack={handleBackToDashboard}
        onSave={handleProfileSave}
        currentUsername={currentUsername}
        currentProfilePicture={currentProfilePicture}
        walletAddress={walletAddress}
      />
    );
  }

  // Use real trading positions data
  const activePositions = tradingPositions.filter(
    (position) => position.status === "open" || position.status === "pending"
  );

  const tabs = [
    {
      id: "positions" as TabType,
      label: "Home",
      icon: Home,
      badgeCount: activePositions.length,
    },

    {
      id: "rewards" as TabType,
      label: "Rewards",
      icon: DollarSign,
      badgeCount: 0,
    },

    {
      id: "orders" as TabType,
      label: "History",
      icon: History,
      badgeCount: 0,
    },
    {
      id: "about" as TabType,
      label: "About Us",
      icon: Info,
      badgeCount: 0,
    },
  ];

  // Address-only search function using Meme Detail Single
  const handleTokenSearch = async (query: string) => {
    setSearchQuery(query);
    setSearchError(null);
    setMemeDetail(null);

    const trimmed = query.trim();
    if (trimmed.length < 10) {
      return; // Require plausible length before hitting API
    }

    setIsSearching(true);
    try {
      const detail = await fetchMemeTokenDetailSingle(trimmed);
      if (!detail) {
        setSearchError('Token not found');
      }
      setMemeDetail(detail);
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Failed to fetch token');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle opening trading modal from meme detail
  const handleOpenFromMemeDetail = async () => {
    if (!memeDetail) return;

    setSelectedTokenData({
      address: memeDetail.address,
      symbol: memeDetail.symbol || '',
      name: memeDetail.name || memeDetail.symbol || '',
      price: memeDetail.price || 0,
      priceChange24h: 0,
      marketCap: memeDetail.marketCap || 0,
      volume24h: 0,
      description: '',
      socialLinks: { website: '', twitter: '', telegram: '' },
      isLoading: true,
    });
    setShowTradingModal(true);

    try {
      const tokenData = await fetchTokenDetailCached(memeDetail.address);
      if (tokenData) {
        setSelectedTokenData({ ...tokenData, isLoading: false });
      }
    } catch (error) {
      console.error('Error loading full token data:', error);
    }
  };

  // Swipe to refresh functionality
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isRefreshing) return;

    const touch = e.touches[0];
    setSwipeStartY(touch.clientY);
    setSwipeCurrentY(touch.clientY);
    setIsSwipeActive(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwipeActive || isRefreshing) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - swipeStartY;

    // Only allow pull-down (positive deltaY) and limit the distance
    if (deltaY > 0 && deltaY <= 80) {
      setSwipeCurrentY(touch.clientY);
      setRefreshProgress(Math.min(deltaY / 80, 1)); // Progress from 0 to 1
    }
  };

  const handleTouchEnd = () => {
    if (!isSwipeActive || isRefreshing) return;

    const deltaY = swipeCurrentY - swipeStartY;

    // Trigger refresh if pulled down enough (40px threshold)
    if (deltaY > 40) {
      triggerRefresh();
    }

    // Reset swipe state
    setIsSwipeActive(false);
    setSwipeStartY(0);
    setSwipeCurrentY(0);
    setRefreshProgress(0);
  };

  const triggerRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setRefreshProgress(1);

    try {
      // Refresh based on current tab
      switch (activeTab) {
        case "positions":
          await Promise.all([
            loadTradingPositions(),
            loadPendingOrders(),
            loadWithdrawalRequests(),
            refreshSOLBalance(),
            loadTrendingTokens(),
            loadPPAPrice(),
            loadRealPPAPriceInSOL(),
            loadUserBalances(),
          ]);
          break;
        case "rewards":
          await Promise.all([
            loadPPAPrice(),
            loadRealPPAPriceInSOL(),
            loadUserBalances(),
            getSwapQuote(),
          ]);
          break;
        case "orders":
          await loadTradeHistory();
          break;
      }

      // Show visual feedback for at least 800ms
      await new Promise((resolve) => setTimeout(resolve, 800));
    } catch (error) {
      console.error("Refresh error:", error);
    } finally {
      setIsRefreshing(false);
      setRefreshProgress(0);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "home":
        const homePortfolioData = calculateTotalPortfolioValue();

        return (
          <div className="text-center max-w-sm w-full px-4 mx-auto">
            {/* Character Icon - Properly sized */}
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto">
                {currentProfilePicture ? (
                  <img
                    src={currentProfilePicture}
                    alt="Profile Picture"
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <img
                    src="https://i.imgur.com/fWVz5td.png"
                    alt="Pump Pumpkin Icon"
                    className="w-full h-full object-cover rounded-lg"
                  />
                )}
              </div>
            </div>

            {/* Welcome Text - Properly sized */}
            <h1 className="text-2xl font-normal mb-3">
              Welcome Back,{" "}
              <span style={{ color: "#1e7cfa" }}>{currentUsername}</span>
            </h1>

            {/* Total Portfolio Balance - Properly sized */}
            <p className="text-gray-400 text-base mb-3">Your Trading Balance</p>
            <p className="text-3xl font-bold text-white mb-4">
              {formatCurrency(homePortfolioData.totalValue)}
            </p>

            {/* Token Search Bar (address-only) */}
            <div className="mb-4 relative">
              <input
                type="text"
                placeholder="Search by CA"
                value={searchQuery}
                onChange={(e) => handleTokenSearch(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400"
              />
              {isSearching && (
                <div className="absolute right-3 top-3">
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                </div>
              )}

              {/* Result preview card (matches compact style) */}
              {memeDetail && !isSearching && (
                <div className="mt-2 bg-gray-800 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700">
                      {memeDetail.logoURI ? (
                        <img src={memeDetail.logoURI} alt={memeDetail.symbol} className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="text-white text-sm font-bold truncate">
                        {memeDetail.symbol} <span className="text-gray-400 font-normal">{memeDetail.name}</span>
                      </div>
                      <div className="text-gray-400 text-xs truncate">
                        {memeDetail.address.slice(0, 4)}…{memeDetail.address.slice(-4)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 text-right">
                    <div className="text-xs text-gray-300">
                      <div>LiQ</div>
                      <div className="text-white font-semibold">{memeDetail.liquidity ? formatCurrency(memeDetail.liquidity) : 'N/A'}</div>
                    </div>
                    <div className="text-xs text-gray-300">
                      <div>MC</div>
                      <div className="text-white font-semibold">{memeDetail.marketCap ? formatCurrency(memeDetail.marketCap) : 'N/A'}</div>
                    </div>
                    <button onClick={handleOpenFromMemeDetail} className="px-3 py-1 bg-blue-500 text-black rounded-md text-xs font-bold">Trade</button>
                  </div>
                </div>
              )}
              {searchError && !isSearching && (
                <div className="mt-2 bg-gray-800 border border-gray-600 rounded-lg p-3 text-sm text-red-400">
                  {searchError}
                </div>
              )}
            </div>

            {/* CA Input - With Market Cap Validation */}
            <form onSubmit={handleCASubmit}>
              <div className="relative">
                <input
                  type="text"
                  value={caInput}
                  onChange={(e) => {
                    setCaInput(e.target.value);
                    setCaValidationError(null); // Clear error when typing
                  }}
                  placeholder="Enter Contract Address (CA)"
                  disabled={isValidatingCA}
                  className={`w-full bg-gray-900 border rounded-lg px-4 py-4 text-white text-base placeholder-gray-500 focus:outline-none transition-all pr-20 ${
                    caValidationError
                      ? "border-red-500 focus:border-red-400"
                      : "border-gray-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-400"
                  } ${isValidatingCA ? "opacity-50 cursor-not-allowed" : ""}`}
                />
                <button
                  type="submit"
                  disabled={!caInput.trim() || isValidatingCA}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                  style={{
                    backgroundColor:
                      !caInput.trim() || isValidatingCA ? "#374151" : "#1e7cfa",
                    color:
                      !caInput.trim() || isValidatingCA ? "#9ca3af" : "black",
                  }}
                >
                  {isValidatingCA ? (
                    <>
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Checking...</span>
                    </>
                  ) : (
                    <span>Trade</span>
                  )}
                </button>
              </div>

              {/* Error Message - Blue Theme */}
              {caValidationError && (
                <div className="mt-4 p-4 bg-gray-900 border border-blue-500 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-semibold text-sm mb-1">
                        Market Cap Too Low
                      </h4>
                      <p className="text-gray-300 text-sm">
                        This token has a market cap of{" "}
                        <span className="font-medium text-blue-400">
                          {caValidationError.match(/\$[\d,]+/)?.[0] || "N/A"}
                        </span>
                        , which is below our minimum requirement of{" "}
                        <span className="font-medium text-blue-400">
                          $80,000
                        </span>
                        .
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </form>

            <p className="text-gray-500 text-sm text-center mt-4">
              Enter a Pump.fun token contract address to start trading
              <br />
              <span className="text-xs text-gray-600">
                Minimum market cap: $80,000
              </span>
            </p>
          </div>
        );

      case "about":
        return <About />;

      case "rewards": {
        const nextUnlockCountdown = nextUnlockingLock
          ? formatTimeUntilUnlock(nextUnlockingLock.unlocks_at)
          : null;
        const nextUnlockDateLabel =
          nextUnlockingLock && nextUnlockingLock.unlocks_at
            ? new Date(nextUnlockingLock.unlocks_at).toLocaleDateString(
                undefined,
                { month: "short", day: "numeric" }
              )
            : null;

        return (
          <div className="w-full px-4 sm:px-6 lg:px-10 py-6">
            <div className="max-w-6xl mx-auto space-y-10">
              <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)] items-stretch">
                <div className="relative rounded-[32px] border border-blue-500/40 bg-gradient-to-br from-[#030b1f] via-[#071536] to-[#01020c] p-6 sm:p-8 shadow-[0_30px_80px_rgba(5,15,36,0.65)]">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(18,94,219,0.35),_transparent_65%)]" />
                  <div className="relative z-10 flex flex-col gap-6 min-h-full">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-[0.3em] text-blue-50/70 text-center lg:text-left">
                      <span className="inline-flex items-center gap-2 justify-center lg:justify-start w-full lg:w-auto">
                        <span className="relative flex h-2.5 w-2.5">
                          <span
                            className={`absolute inline-flex h-full w-full rounded-full ${
                              rewardPulseActive
                                ? "bg-emerald-300/70 animate-ping"
                                : "bg-slate-400/40"
                            }`}
                          />
                          <span
                            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                              hasActiveLocks ? "bg-emerald-300" : "bg-slate-400"
                            }`}
                          />
                        </span>
                        {hasActiveLocks ? "Vault live" : "Vault idle"}
                      </span>
                      <span className="w-full lg:w-auto text-center lg:text-right">
                        {rewardsSyncStatus}
                      </span>
                    </div>

                    <div className="space-y-3 text-center lg:text-left">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-blue-100/70">
                        Lifetime PPA rewards
                      </p>
                      <div className="flex flex-wrap items-center gap-4 justify-center lg:justify-between">
                        <p className="text-3xl sm:text-5xl font-semibold text-white leading-tight break-words">
                          {formatTokenAmount(displayedLifetimeRewards)}
                          <span className="ml-2 text-base text-white/40">PPA</span>
                        </p>
                        <span
                          className={`${rewardDeltaMeta.className} text-sm font-semibold tracking-wide`}
                        >
                          {rewardDeltaMeta.text}
                        </span>
                      </div>
                      {isLoadingEarnings ? (
                        <div className="text-sm text-blue-200/80 flex items-center gap-2 justify-center lg:justify-start">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="font-medium">Updating rewards…</span>
                        </div>
                      ) : (
                        <p className="text-sm text-blue-100/80 max-w-3xl mx-auto lg:mx-0">
                          {hasActiveLocks
                            ? "Rewards compound every 24h. Unlock whenever you like or keep staking to climb the boost ladder."
                            : "Lock PPA once to tap into 80% of platform profits. The vault begins compounding immediately."}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 min-h-[130px]">
                        <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                          Total PPA locked
                        </p>
                        <p className="text-2xl font-semibold text-white mt-2 break-words">
                          {formatTokenAmount(totalPPALocked)}
                          <span className="ml-2 text-base text-white/60">PPA</span>
                        </p>
                        <p className="text-xs text-white/60 mt-1">
                          {approxLockedUsd > 0
                            ? `≈ ${formatCurrency(approxLockedUsd)} in vault coverage`
                            : "Lock PPA to seed the vault and earn splits."}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 min-h-[130px]">
                        <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                          Average boost
                        </p>
                        <p className="text-2xl font-semibold text-white mt-2">
                          {hasActiveLocks ? `${averageBoostPct.toFixed(1)}%` : "0.0%"}
                        </p>
                        <p className="text-xs text-white/60 mt-1">
                          {hasActiveLocks
                            ? `${activePPALocks.length} active lock${
                                activePPALocks.length === 1 ? "" : "s"
                              }`
                            : "Lock PPA to activate your first boost tier."}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 text-sm">
                      <button
                        onClick={() => {
                          handleBuyPPA();
                          hapticFeedback.medium();
                        }}
                        className="flex-1 rounded-2xl bg-white text-black font-semibold py-3 px-4 shadow-lg shadow-blue-500/20 hover:bg-gray-100 transition-colors"
                      >
                        Buy PPA
                      </button>
                      <button
                        onClick={() => {
                          setShowLockingModal(true);
                          hapticFeedback.medium();
                        }}
                        className="flex-1 rounded-2xl border border-white/30 text-white font-semibold py-3 px-4 hover:border-white/60 transition-colors"
                      >
                        Lock & Boost
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="rounded-3xl border border-white/10 bg-black/40 p-5 flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-white/60">
                      <span>Next unlock window</span>
                      <span className="text-white/70">
                        {nextUnlockCountdown ?? "—"}
                      </span>
                    </div>
                    <div>
                      <p className="text-3xl font-semibold text-white break-words">
                        {nextUnlockCountdown ?? "Plan a lock"}
                      </p>
                      <p className="text-xs text-blue-100/70 mt-1">
                        {nextUnlockDateLabel
                          ? `Unlocks ${nextUnlockDateLabel}`
                          : "Schedule your first reward cycle."}
                      </p>
                    </div>
                    {expiredLock ? (
                      <button
                        onClick={() => {
                          setShowUnlockModal(true);
                          soundManager.playTabSwitch();
                          hapticFeedback.medium();
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400/90 px-4 py-2.5 text-black font-semibold hover:bg-emerald-300 transition-colors"
                      >
                        <Unlock className="w-4 h-4" />
                        <span>Unlock Stake</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setShowLockingModal(true);
                          hapticFeedback.medium();
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-4 py-2.5 text-white font-semibold hover:border-white/40 transition-colors"
                      >
                        <span>Plan New Lock</span>
                      </button>
                    )}
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-[#050d25]/80 p-5 flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-white/60">
                      <span>Next boost tier</span>
                      <span>{nextBoostTier ? nextBoostTier.label : "Maxed"}</span>
                    </div>
                    <p className="text-sm text-blue-100/80">{nextBoostMessage}</p>
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-400 via-sky-400 to-cyan-300 transition-all duration-500"
                        style={{ width: `${nextBoostProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-white/60">
                      {hasActiveLocks
                        ? "Keep compounding to unlock the next tier."
                        : "Boost tiers appear after your first stake completes a cycle."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-3 auto-rows-fr">
                <div className="rounded-3xl border border-white/10 bg-[#050b1c] p-5 flex flex-col gap-4 h-full">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-white/60">
                    <span>Pumpkin revenue today</span>
                    <span
                      className={`${revenueDeltaMeta.className} text-[10px] font-semibold`}
                    >
                      {revenueDeltaMeta.text}
                    </span>
                  </div>
                  <p className="text-3xl font-semibold text-white break-words">
                    {formatCurrency(displayedRevenueUsd)}
                  </p>
                  <p className="text-xs text-blue-100/70">
                    {todayPlatformRevenueSol > 0
                      ? `${todayPlatformRevenueSol.toFixed(3)} SOL routed across treasuries`
                      : "Revenue stream comes online after your first trade."}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-[#040816] p-5 flex flex-col gap-4 h-full">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-white/60">
                    <span>Total volume today</span>
                    <span
                      className={`${volumeDeltaMeta.className} text-[10px] font-semibold`}
                    >
                      {volumeDeltaMeta.text}
                    </span>
                  </div>
                  <p className="text-3xl font-semibold text-white break-words">
                    {formatVolume(displayedVolumeUsd)}
                  </p>
                  <p className="text-xs text-blue-100/70">
                    {todayTradingVolumeUsd > 0
                      ? "Volume driven by your hunts."
                      : "Volume data unlocks after your first trade."}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-[#03060f] p-5 flex flex-col gap-4 h-full">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-white/60">
                    <span>Staker pool (80%)</span>
                    <span className="text-white/70">Daily snapshot</span>
                  </div>
                  <p className="text-3xl font-semibold text-white break-words">
                    {formatCurrency(hasActiveLocks ? estimatedVaultCutUsd : 0)}
                  </p>
                  <p className="text-xs text-blue-100/70">
                    {hasActiveLocks
                      ? "Your locks auto-compound into the staker allocation."
                      : "Lock PPA to start participating in daily revenue splits."}
                  </p>
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <div className="rounded-[28px] border border-white/10 bg-[#050b19] p-6 space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-white/60">
                        Active locks
                      </p>
                      <h3 className="text-xl font-semibold text-white mt-1">
                        Reward inventory
                      </h3>
                      <p className="text-xs text-blue-100/70 mt-1">
                        {hasActiveLocks
                          ? "Your freshest locks ranked with live growth telemetry."
                          : "No locks yet. Start with any amount to join revenue share."}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/15 px-4 py-1 text-xs text-white/70">
                      {activePPALocks.length} live
                    </span>
                  </div>

                  {hasActiveLocks ? (
                    <>
                      <div className="space-y-4">
                        {lockLeaderboard.map(({ lock, metrics }) => {
                          const principal = Number(lock.ppa_amount) || 0;
                          const bonusAmount = metrics.bonusAmount;
                          const totalPct = Number(lock.total_percentage || 0);
                          const solReward = Number(lock.sol_reward || 0);
                          const lockDays = Number(lock.lock_days || 0);
                          const completionPct =
                            lockDays > 0
                              ? Math.min(
                                  100,
                                  (metrics.daysElapsed / lockDays) * 100
                                )
                              : 0;
                          const lockStart = new Date(lock.locked_at);
                          return (
                            <div
                              key={lock.id}
                              className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">
                                    {formatTokenAmount(principal)} PPA locked
                                  </p>
                                  <p className="text-xs text-white/60">
                                    {lockDays} day term • Locked {""}
                                    {Number.isNaN(lockStart.getTime())
                                      ? "recently"
                                      : lockStart.toLocaleDateString()}
                                  </p>
                                </div>
                                <span className="text-xs uppercase tracking-[0.35em] text-blue-100/70">
                                  {formatTimeUntilUnlock(lock.unlocks_at)}
                                </span>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-3 text-sm text-white">
                                <div>
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                                    Bonus earned
                                  </p>
                                  <p className="font-semibold text-emerald-300">
                                    {formatTokenAmount(bonusAmount)} PPA
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                                    Current boost
                                  </p>
                                  <p className="font-semibold">
                                    {totalPct.toFixed(1)}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                                    SOL reward
                                  </p>
                                  <p className="font-semibold">
                                    {solReward.toFixed(3)} SOL
                                  </p>
                                </div>
                              </div>
                              <div>
                                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-blue-400 via-sky-400 to-emerald-300"
                                    style={{ width: `${completionPct}%` }}
                                  />
                                </div>
                                <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/50">
                                  {completionPct.toFixed(0)}% of term elapsed
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {additionalLockCount > 0 && (
                        <p className="text-xs text-white/60 text-right">
                          +{additionalLockCount} more lock
                          {additionalLockCount === 1 ? "" : "s"} compounding
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center space-y-3">
                      <p className="text-sm text-white font-semibold">
                        No active locks yet
                      </p>
                      <p className="text-xs text-blue-100/70">
                        Lock any amount of PPA to activate revenue sharing and
                        build boost momentum.
                      </p>
                      <button
                        onClick={() => {
                          setShowLockingModal(true);
                          hapticFeedback.medium();
                        }}
                        className="inline-flex items-center justify-center rounded-xl bg-white text-black font-semibold px-5 py-2.5 shadow-lg shadow-blue-500/20"
                      >
                        Create first lock
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  <div className="rounded-[28px] border border-white/10 bg-[#040a17] p-6 space-y-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/60">
                      Profit routing
                    </p>
                    <div className="flex items-center justify-between text-sm text-white">
                      <span>80% to stakers</span>
                      <span className="text-emerald-300 font-semibold">
                        {formatCurrency(hasActiveLocks ? estimatedVaultCutUsd : 0)}
                      </span>
                    </div>
                    <p className="text-xs text-white/60">
                      Based on today’s revenue snapshot.
                    </p>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3 text-xs text-white/70">
                      <div className="flex items-center justify-between">
                        <span>Hunter reserve (20%)</span>
                        <span className="text-white font-semibold">
                          {formatCurrency(
                            Math.max(displayedRevenueUsd - estimatedVaultCutUsd, 0)
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Security buffer</span>
                        <span className="text-white font-semibold">
                          {todayPlatformRevenueSol > 0
                            ? `${todayPlatformRevenueSol.toFixed(3)} SOL`
                            : "Awaiting trades"}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-blue-100/70">
                      Rewards settle instantly when you unlock. Keep capital
                      parked to auto-compound into the next tier.
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-[#050d1c] p-6 space-y-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/60">
                      Need help?
                    </p>
                    <p className="text-sm text-white/80">
                      Our mod desk monitors unlock requests and staking
                      questions 24/7. Ping support anytime.
                    </p>
                    <button
                      onClick={() => {
                        setActiveTab("about");
                        soundManager.playTabSwitch();
                        hapticFeedback.light();
                      }}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-blue-200 hover:text-white transition-colors"
                    >
                      Learn about rewards
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        );
      }

      case "positions": {
        const portfolioData = calculateTotalPortfolioValue();

        return (
          <div className="max-w-full w-full px-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4">
                {currentProfilePicture ? (
                  <img
                    src={currentProfilePicture}
                    alt="Profile Picture"
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
                    <User className="w-8 h-8 text-gray-500" />
                  </div>
                )}
              </div>
              <h1 className="text-xl font-normal mb-4">
                Welcome Back,{" "}
                <span style={{ color: "#1e7cfa" }}>{currentUsername}</span>
              </h1>
              <div className="text-center mb-4">
                <p className="text-gray-400 text-sm mb-2 font-medium">
                  Total Portfolio Value
                </p>
                <LivePrice
                  price={portfolioData.totalValue}
                  previousPrice={previousPortfolioValue}
                  className="text-3xl font-bold text-white"
                  showChange={true}
                />
              </div>

              {portfolioData.positionCount > 0 && (
                <div className="mt-3 text-sm text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Available SOL:</span>
                    <span className="text-white">
                      {formatCurrency(portfolioData.availableSOL * solPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Locked Collateral:</span>
                    <span className="text-orange-300">
                      {formatCurrency(portfolioData.lockedSOL * solPrice)}
                    </span>
                  </div>
                  {portfolioData.tradingBalance > 0 && (
                    <div className="flex justify-between">
                      <span>Trading Balance:</span>
                      <span className="text-white">
                        {formatCurrency(portfolioData.tradingBalance)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mb-6 relative">
              <input
                type="text"
                placeholder="Search by CA"
                value={searchQuery}
                onChange={(e) => handleTokenSearch(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400"
              />
              {isSearching && (
                <div className="absolute right-3 top-3">
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                </div>
              )}
              {memeDetail && !isSearching && (
                <div className="mt-2 bg-gray-800 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700">
                      {memeDetail.logoURI ? (
                        <img
                          src={memeDetail.logoURI}
                          alt={memeDetail.symbol}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="text-white text-sm font-bold truncate">
                        {memeDetail.symbol}{" "}
                        <span className="text-gray-400 font-normal">
                          {memeDetail.name}
                        </span>
                      </div>
                      <div className="text-gray-400 text-xs truncate">
                        {memeDetail.address.slice(0, 4)}…
                        {memeDetail.address.slice(-4)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 text-right">
                    <div className="text-xs text-gray-300">
                      <div>LiQ</div>
                      <div className="text-white font-semibold">
                        {memeDetail.liquidity
                          ? formatCurrency(memeDetail.liquidity)
                          : "N/A"}
                      </div>
                    </div>
                    <div className="text-xs text-gray-300">
                      <div>24h MC</div>
                      <div className="text-white font-semibold">
                        {memeDetail.marketCap
                          ? formatCurrency(memeDetail.marketCap)
                          : "N/A"}
                      </div>
                    </div>
                    <button
                      onClick={handleOpenFromMemeDetail}
                      className="px-3 py-1 bg-blue-500 text-black rounded-md text-xs font-bold"
                    >
                      Trade
                    </button>
                  </div>
                </div>
              )}
              {searchError && !isSearching && (
                <div className="mt-2 bg-gray-800 border border-gray-600 rounded-lg p-3 text-sm text-red-400">
                  {searchError}
                </div>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
              <div className="flex space-x-3 mb-6">
                <button
                  onClick={() => {
                    setShowDepositModal(true);
                    hapticFeedback.medium();
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = "#1a6ce8";
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = "#1e7cfa";
                  }}
                  className="btn-premium flex-1 text-black font-bold py-3 px-4 rounded-lg text-sm transition-colors flex items-center justify-center space-x-2"
                  style={{ backgroundColor: "#1e7cfa" }}
                >
                  <Plus className="w-4 h-4" />
                  <span>Deposit</span>
                </button>

                <button
                  onClick={() => {
                    setShowWithdrawModal(true);
                    loadWithdrawalRequests();
                    hapticFeedback.light();
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = "#1a6ce8";
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = "#1e7cfa";
                  }}
                  disabled={currentSOLBalance < 0.04}
                  className="btn-premium flex-1 text-black font-bold py-3 px-4 rounded-lg text-sm transition-colors flex items-center justify-center space-x-2 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundColor: "#1e7cfa",
                    color: "black",
                  }}
                >
                  <Minus className="w-4 h-4" />
                  <span>Withdraw</span>
                </button>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                  <Briefcase className="w-5 h-5 mr-2" />
                  Assets
                </h3>

                <div className="space-y-3">
                  <div>
                    <p className="text-gray-400 text-sm mb-2">
                      Available Balance
                    </p>
                    <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-r from-purple-400 to-green-400">
                            <img
                              src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                              alt="Solana"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = "none";
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML =
                                    '<span class="text-white text-sm font-bold">SOL</span>';
                                }
                              }}
                            />
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm">SOL</p>
                            <p className="text-gray-400 text-xs">
                              Available for trading
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-bold text-sm">
                            {currentSOLBalance.toFixed(4)} SOL
                          </p>
                          <p className="text-gray-400 text-xs">
                            {formatCurrency(currentSOLBalance * solPrice)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {portfolioData.lockedSOL > 0 && (
                    <div>
                      <p className="text-gray-400 text-sm mb-2">
                        Locked in Positions
                      </p>
                      <div className="bg-gray-800 border border-orange-600 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-r from-orange-400 to-red-400">
                              <img
                                src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                                alt="Solana"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  target.style.display = "none";
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML =
                                      '<span class="text-white text-sm font-bold">SOL</span>';
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <p className="text-orange-300 font-bold text-sm">
                                SOL
                              </p>
                              <p className="text-orange-400 text-xs">
                                Collateral in {portfolioData.positionCount}{" "}
                                position
                                {portfolioData.positionCount !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-orange-300 font-bold text-sm">
                              {portfolioData.lockedSOL.toFixed(4)} SOL
                            </p>
                            <p className="text-orange-400 text-xs">
                              {formatCurrency(portfolioData.lockedSOL * solPrice)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Active Positions
                </h3>

                {isLoadingPositions ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, index) => (
                      <div
                        key={index}
                        className="bg-gray-800 border border-gray-600 rounded-lg p-4 animate-pulse min-h-[120px]"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
                            <div>
                              <div className="w-16 h-4 bg-gray-700 rounded mb-2"></div>
                              <div className="w-12 h-3 bg-gray-600 rounded"></div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="w-20 h-4 bg-gray-700 rounded mb-2"></div>
                            <div className="w-16 h-3 bg-gray-600 rounded"></div>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-gray-700 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : activePositions.length > 0 ? (
                  <div className="space-y-4">
                    {activePositions.map((position) => {
                      const realtimePnL =
                        calculatePositionPnLWithCachedPrice(position);
                      const currentPnL = realtimePnL.pnl;
                      const isPositive = currentPnL >= 0;
                      const collateralValueUSD =
                        (position.collateral_sol || 0) * solPrice;
                      const pnlPercent =
                        collateralValueUSD > 0
                          ? (currentPnL / collateralValueUSD) * 100
                          : 0;
                      const isNearLiquidation =
                        (position.margin_ratio || 0) >= 0.8;
                      const isInDanger = (position.margin_ratio || 0) >= 0.9;

                      return (
                        <div key={position.id} className="space-y-2">
                          <div className="relative flex items-center justify-center py-2">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-gray-600"></div>
                            </div>
                            <div className="relative flex justify-center">
                              <span
                                className={`px-3 py-1 text-xs font-bold rounded-full ${
                                  position.direction === "Long"
                                    ? "bg-green-900 text-green-300 border border-green-600"
                                    : "bg-red-900 text-red-300 border border-red-600"
                                }`}
                              >
                                {position.leverage}x {position.direction}
                              </span>
                            </div>
                          </div>

                          <div
                            onClick={() => {
                              handlePositionClick(position);
                              hapticFeedback.light();
                            }}
                            className={`card-premium rounded-lg p-4 cursor-pointer transition-all min-h-[130px] ${
                              isInDanger
                                ? "position-danger bg-red-900 border-2 border-red-500"
                                : isNearLiquidation
                                ? "bg-orange-900 border-2 border-orange-500"
                                : isPositive
                                ? "position-profit bg-gray-800 border border-gray-600 hover:border-green-500"
                                : currentPnL < -5
                                ? "position-loss bg-gray-800 border border-gray-600 hover:border-red-500"
                                : "bg-gray-800 border border-gray-600 hover:border-gray-500"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div>
                                  <div className="flex items-center space-x-2 mb-1">
                                    <span className="text-white font-bold text-sm">
                                      {position.token_symbol}
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded-full font-bold ${
                                        position.direction === "Long"
                                          ? "bg-green-900 text-green-300"
                                          : "bg-red-900 text-red-300"
                                      }`}
                                    >
                                      {position.leverage}x {position.direction}
                                    </span>
                                  </div>
                                  {position.status === "opening" && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-blue-900 text-blue-400 font-bold animate-pulse">
                                      OPENING...
                                    </span>
                                  )}
                                  {position.status === "closing" && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-yellow-900 text-yellow-400 font-bold animate-pulse">
                                      CLOSING...
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-white text-sm font-bold">
                                  {formatCurrency(position.position_value_usd)}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-3 text-xs">
                              <div>
                                <span className="text-gray-400">
                                  Entry Price:
                                </span>
                                <p className="text-white font-medium">
                                  {formatPrice(position.entry_price)}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-400 flex items-center space-x-1">
                                  <span>Live Price:</span>
                                </span>
                                <p className="text-white font-medium">
                                  {formatPrice(
                                    tokenPrices[position.token_address] ||
                                      position.entry_price
                                  )}
                                  {tokenPrices[position.token_address] && (
                                    <span className="text-green-400 text-xs ml-1">
                                      ● Live
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3">
                              <div className="flex justify-between text-xs mb-1">
                                <span
                                  className={
                                    isInDanger
                                      ? "text-red-300 font-bold"
                                      : isNearLiquidation
                                      ? "text-orange-300 font-bold"
                                      : "text-gray-400"
                                  }
                                >
                                  Margin Health
                                </span>
                                <span
                                  className={
                                    isInDanger
                                      ? "text-red-300 font-bold"
                                      : isNearLiquidation
                                      ? "text-orange-300 font-bold"
                                      : "text-gray-400"
                                  }
                                >
                                  {position.margin_ratio
                                    ? `${(position.margin_ratio * 100).toFixed(
                                        1
                                      )}%`
                                    : "Healthy"}
                                </span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    (position.margin_ratio || 0) >= 0.8
                                      ? "bg-red-500"
                                      : (position.margin_ratio || 0) >= 0.6
                                      ? "bg-yellow-500"
                                      : "bg-green-500"
                                  }`}
                                  style={{
                                    width: `${Math.min(
                                      (position.margin_ratio || 0) * 100,
                                      100
                                    )}%`,
                                  }}
                                ></div>
                              </div>

                              {isInDanger && position.status === "open" && (
                                <div className="mt-2 text-xs text-red-300 font-bold animate-pulse">
                                  LIQUIDATION IMMINENT - POSITION AT EXTREME
                                  RISK!
                                </div>
                              )}
                              {isNearLiquidation &&
                                !isInDanger &&
                                position.status === "open" && (
                                  <div className="mt-2 text-xs text-orange-300 font-bold">
                                    Margin call triggered - Add collateral or
                                    close position
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 text-center">
                    <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Briefcase className="w-6 h-6 text-gray-500" />
                    </div>
                    <p className="text-gray-400 text-sm">No active positions</p>
                  </div>
                )}
              </div>

            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Trending Tokens
              </h3>

              {isLoadingTokens ? (
                <div>
                  <div className="text-center mb-4">
                    <p className="text-gray-500 text-xs">
                      Loading from multiple data sources...
                    </p>
                  </div>
                  <div className="space-y-3">
                    {[...Array(6)].map((_, index) => (
                      <div
                        key={index}
                        className="bg-gray-900 border border-gray-700 rounded-lg p-4 animate-pulse"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
                            <div>
                              <div className="w-16 h-4 bg-gray-700 rounded mb-2"></div>
                              <div className="w-12 h-3 bg-gray-800 rounded"></div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="w-20 h-4 bg-gray-700 rounded mb-2"></div>
                            <div className="w-16 h-3 bg-gray-800 rounded"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {trendingTokens.map((token) => (
                    <div
                      key={token.address}
                      className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors cursor-pointer"
                      onClick={() => handleTokenClick(token)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                            {token.logoURI ? (
                              <img
                                src={token.logoURI}
                                alt={token.symbol}
                                className="w-full h-full object-cover rounded-full"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  target.style.display = "none";
                                  const fallback =
                                    target.nextElementSibling as HTMLElement;
                                  if (fallback) {
                                    fallback.style.display = "flex";
                                  }
                                }}
                              />
                            ) : null}
                            <span
                              className={`text-xs font-bold text-white ${
                                token.logoURI ? "hidden" : "flex"
                              }`}
                            >
                              {token.symbol.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm">
                              {token.symbol}
                            </p>
                            <p className="text-gray-400 text-xs">
                              {token.name.length > 20
                                ? `${token.name.substring(0, 20)}...`
                                : token.name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <LivePrice
                            price={token.price}
                            previousPrice={undefined}
                            className="text-white text-sm font-bold"
                            showChange={false}
                          />
                          <p
                            className={`text-xs font-bold ${
                              token.priceChange24h >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {token.priceChange24h >= 0 ? "+" : ""}
                            {token.priceChange24h.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isLoadingTokens && trendingTokens.length === 0 && (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 text-center">
                  <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <AlertTriangle className="w-6 h-6 text-orange-500" />
                  </div>
                  <p className="text-gray-400 text-sm mb-2">
                    Due to technical errors we couldn't load the trending token
                    pairs
                  </p>
                  <p className="text-gray-500 text-xs mb-3">
                    Our data provider is experiencing issues
                  </p>
                  <button
                    onClick={loadTrendingTokens}
                    className="mt-2 text-blue-400 hover:text-blue-300 text-sm flex items-center space-x-1 mx-auto"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Try again</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      }

      case "orders":
        return (
          <div className="max-w-lg w-full px-4">
            {/* Header with User Profile Image - Much larger */}
            <div className="text-center mb-10">
              <div className="w-28 h-28 mx-auto mb-6">
                {currentProfilePicture ? (
                  <img
                    src={currentProfilePicture}
                    alt="Profile Picture"
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800 rounded-xl flex items-center justify-center">
                    <User className="w-12 h-12 text-gray-500" />
                  </div>
                )}
              </div>
              <h1 className="text-4xl font-normal mb-4">
                Trade <span style={{ color: "#1e7cfa" }}>History</span>
              </h1>
            </div>

            {/* Enhanced Trade History Section */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-4">
              {/* Header with Stats */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <History className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">
                    Recent Trades
                  </h3>
                </div>
              </div>

              {isLoadingTradeHistory ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, index) => (
                    <div
                      key={index}
                      className="bg-gray-800 border border-gray-600 rounded-lg p-3 animate-pulse"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                          <div>
                            <div className="w-16 h-3 bg-gray-700 rounded mb-1"></div>
                            <div className="w-12 h-2 bg-gray-600 rounded"></div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="w-16 h-3 bg-gray-700 rounded mb-1"></div>
                          <div className="w-12 h-2 bg-gray-600 rounded"></div>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : tradeHistory.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                  {tradeHistory.map((trade, index) => {
                    const isProfit = (trade.current_pnl || 0) >= 0;
                    const wasLiquidated = trade.status === "liquidated";
                    const wasCancelled = trade.status === "cancelled";

                    // Format date - more compact for mobile
                    const tradeDate = new Date(
                      trade.closed_at || trade.updated_at
                    );
                    const now = new Date();
                    const diffTime = Math.abs(
                      now.getTime() - tradeDate.getTime()
                    );
                    const diffDays = Math.ceil(
                      diffTime / (1000 * 60 * 60 * 24)
                    );

                    let timeAgo = "";
                    if (diffDays === 1) {
                      timeAgo = "Today";
                    } else if (diffDays === 2) {
                      timeAgo = "Yesterday";
                    } else if (diffDays <= 7) {
                      timeAgo = `${diffDays}d ago`;
                    } else {
                      timeAgo = tradeDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    }

                    return (
                      <div
                        key={trade.id}
                        onClick={() => {
                          // Open details modal for closed trade
                          setSelectedTradeId(trade.id);
                          setShowTradeDetailsModal(true);
                        }}
                        className={`rounded-lg p-3 border transition-all relative overflow-hidden cursor-pointer hover:scale-[1.02] hover:shadow-lg ${
                          wasLiquidated
                            ? "bg-red-950/50 border-red-600/30 hover:border-red-500/50"
                            : wasCancelled
                            ? "bg-gray-800/50 border-gray-600/30 hover:border-gray-500/50"
                            : isProfit
                            ? "bg-green-950/50 border-green-600/30 hover:border-green-500/50"
                            : "bg-red-950/50 border-red-600/30 hover:border-red-500/50"
                        }`}
                      >
                        {/* Main trade info */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-white font-semibold text-sm">
                                  {trade.token_symbol}
                                </span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                    trade.direction === "Long"
                                      ? "bg-green-800/50 text-green-300 border border-green-600/30"
                                      : "bg-red-800/50 text-red-300 border border-red-600/30"
                                  }`}
                                >
                                  {trade.leverage}x {trade.direction}
                                </span>
                              </div>

                              {/* Status badges */}
                              <div className="flex items-center space-x-2 mb-1">
                                {wasLiquidated && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-600 text-red-100 font-bold animate-pulse">
                                    LIQUIDATED
                                  </span>
                                )}
                                {wasCancelled && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-600/50 text-gray-300 border border-gray-500/30">
                                    CANCELLED
                                  </span>
                                )}
                              </div>

                              {/* Trade details */}
                              <div className="flex items-center space-x-3 text-xs text-gray-400">
                                <span>{timeAgo}</span>
                              </div>
                            </div>
                          </div>

                          {/* P&L Display */}
                          <div className="text-right">
                            {!wasCancelled ? (
                              <>
                                <p
                                  className={`text-lg font-bold ${
                                    wasLiquidated
                                      ? "text-red-400"
                                      : isProfit
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }`}
                                >
                                  {isProfit ? "+" : ""}
                                  {formatCurrency(trade.current_pnl || 0)}
                                </p>
                              </>
                            ) : (
                              <div className="text-center">
                                <p className="text-gray-400 text-sm font-medium">
                                  Cancelled
                                </p>
                                <p className="text-gray-500 text-xs">No P&L</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gray-800/30 border border-gray-600/30 rounded-xl p-8 text-center">
                  <div className="w-16 h-16 bg-gray-700/50 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <History className="w-8 h-8 text-gray-500" />
                  </div>
                  <h4 className="text-white font-semibold text-lg mb-2">
                    No Trading History
                  </h4>
                  <p className="text-gray-400 text-sm mb-4">
                    Start trading to see your completed positions here
                  </p>
                  <button
                    onClick={() => setActiveTab("positions")}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                  >
                    Start Trading
                  </button>
                </div>
              )}
            </div>

            {/* Deposit History Section */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-4 mt-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ArrowDown className="w-5 h-5 text-green-400" />
                  <h3 className="text-lg font-semibold text-white">
                    Deposit History
                  </h3>
                </div>
              </div>

              {/* Transaction List */}
              {isLoadingDeposits ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, index) => (
                    <div
                      key={index}
                      className="bg-gray-800/50 border border-gray-600/30 rounded-lg p-3 animate-pulse"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                          <div>
                            <div className="w-24 h-3 bg-gray-700 rounded mb-1"></div>
                            <div className="w-16 h-2 bg-gray-600 rounded"></div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="w-16 h-3 bg-gray-700 rounded mb-1"></div>
                          <div className="w-12 h-2 bg-gray-600 rounded"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : depositHistory.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                  {depositHistory.map((deposit, index) => {
                    // Format date - more compact for mobile
                    const depositDate = new Date(deposit.created_at);
                    const now = new Date();
                    const diffTime = Math.abs(
                      now.getTime() - depositDate.getTime()
                    );
                    const diffDays = Math.ceil(
                      diffTime / (1000 * 60 * 60 * 24)
                    );

                    let timeAgo = "";
                    if (diffDays === 1) {
                      timeAgo = "Today";
                    } else if (diffDays === 2) {
                      timeAgo = "Yesterday";
                    } else if (diffDays <= 7) {
                      timeAgo = `${diffDays}d ago`;
                    } else {
                      timeAgo = depositDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    }

                    return (
                      <div
                        key={index}
                        className="bg-gray-800/30 border border-gray-600/30 rounded-lg p-3 hover:bg-gray-700/30 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="bg-green-500/20 p-2 rounded-full">
                              <ArrowDown className="w-4 h-4 text-green-400" />
                            </div>
                            <div>
                              <p className="text-white text-sm font-medium">
                                SOL Deposit
                              </p>
                              <p className="text-gray-400 text-xs">{timeAgo}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-green-400 text-sm font-semibold">
                              +{deposit.amount.toFixed(4)} SOL
                            </p>
                            <p className="text-gray-500 text-xs">
                              {deposit.status === "completed" ? "✅ Completed" : "❌ Failed"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gray-800/30 border border-gray-600/30 rounded-xl p-8 text-center">
                  <div className="w-16 h-16 bg-gray-700/50 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <ArrowDown className="w-8 h-8 text-gray-500" />
                  </div>
                  <h4 className="text-white font-semibold text-lg mb-2">
                    No Deposit History
                  </h4>
                  <p className="text-gray-400 text-sm mb-4">
                    Your SOL deposits will appear here once completed
                  </p>
                  <button
                    onClick={() => setActiveTab("positions")}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                  >
                    Make First Deposit
                  </button>
                </div>
              )}
            </div>

            {/* Withdrawal History Section */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-4 mt-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ArrowUpRight className="w-5 h-5 text-red-400" />
                  <h3 className="text-lg font-semibold text-white">
                    Withdrawal History
                  </h3>
                </div>
              </div>

              {/* Transaction List */}
              {isLoadingWithdrawals ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, index) => (
                    <div
                      key={index}
                      className="bg-gray-800 border border-gray-600 rounded-lg p-3 animate-pulse"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                          <div>
                            <div className="w-16 h-3 bg-gray-700 rounded mb-1"></div>
                            <div className="w-12 h-2 bg-gray-600 rounded"></div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="w-16 h-3 bg-gray-700 rounded mb-1"></div>
                          <div className="w-12 h-2 bg-gray-600 rounded"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : withdrawalHistory.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                  {withdrawalHistory.map((withdrawal, index) => {
                    // Format date - more compact for mobile
                    const withdrawalDate = new Date(withdrawal.created_at);
                    const now = new Date();
                    const diffTime = Math.abs(
                      now.getTime() - withdrawalDate.getTime()
                    );
                    const diffDays = Math.ceil(
                      diffTime / (1000 * 60 * 60 * 24)
                    );

                    let timeAgo = "";
                    if (diffDays === 1) {
                      timeAgo = "Today";
                    } else if (diffDays === 2) {
                      timeAgo = "Yesterday";
                    } else if (diffDays <= 7) {
                      timeAgo = `${diffDays}d ago`;
                    } else {
                      timeAgo = withdrawalDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    }

                    return (
                      <div
                        key={withdrawal.id}
                        className={`rounded-lg p-3 border transition-all relative overflow-hidden hover:scale-[1.02] hover:shadow-lg ${
                          withdrawal.status === "completed"
                            ? "bg-gray-800/50 border-gray-600/30 hover:border-gray-500/50"
                            : withdrawal.status === "pending"
                            ? "bg-yellow-950/30 border-yellow-600/30 hover:border-yellow-500/50"
                            : withdrawal.status === "approved"
                            ? "bg-blue-950/30 border-blue-600/30 hover:border-blue-500/50"
                            : withdrawal.status === "rejected"
                            ? "bg-red-950/50 border-red-600/30 hover:border-red-500/50"
                            : "bg-gray-800/50 border-gray-600/30 hover:border-gray-500/50"
                        }`}
                      >
                        {/* Main withdrawal info */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-white font-semibold text-sm">
                                  SOL Withdrawal
                                </span>
                                {withdrawal.status === "pending" && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-800/50 text-yellow-300 border border-yellow-600/30 animate-pulse">
                                    PENDING
                                  </span>
                                )}
                                {withdrawal.status === "approved" && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-800/50 text-blue-300 border border-blue-600/30">
                                    APPROVED
                                  </span>
                                )}
                                {withdrawal.status === "rejected" && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-600 text-red-100 font-bold">
                                    REJECTED
                                  </span>
                                )}
                                {withdrawal.status === "completed" && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-800/50 text-green-300 border border-green-600/30">
                                    COMPLETED
                                  </span>
                                )}
                              </div>

                              {/* Withdrawal details */}
                              <div className="flex items-center space-x-3 text-xs text-gray-400">
                                <span>{timeAgo}</span>
                              </div>
                            </div>
                          </div>

                          {/* Amount Display */}
                          <div className="text-right">
                            <p className="text-red-400 text-lg font-bold">
                              -{withdrawal.amount.toFixed(3)} SOL
                            </p>
                          </div>
                        </div>

                        {/* Admin Notes - Show only for rejected status */}
                        {withdrawal.status === "rejected" && withdrawal.admin_notes && (
                          <div className="mt-2 pt-2 border-t border-red-600/30">
                            <div className="flex items-start space-x-2">
                              <div className="flex-shrink-0 mt-0.5">
                                <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-red-300 mb-1">Admin Note:</p>
                                <p className="text-xs text-red-200 break-words leading-relaxed">
                                  {withdrawal.admin_notes}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gray-800/30 border border-gray-600/30 rounded-xl p-8 text-center">
                  <div className="w-16 h-16 bg-gray-700/50 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <ArrowUpRight className="w-8 h-8 text-gray-500" />
                  </div>
                  <h4 className="text-white font-semibold text-lg mb-2">
                    No Withdrawal History
                  </h4>
                  <p className="text-gray-400 text-sm mb-4">
                    Your SOL withdrawals will appear here once requested
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const wideLayoutTabs = ["rewards", "positions", "orders"];
  const isWideLayoutTab = wideLayoutTabs.includes(activeTab);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Enhanced Mobile Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-b from-black via-black/95 to-transparent backdrop-blur-md border-b border-gray-800/50">
        <div className="relative flex items-center justify-between p-4">
          {/* Left Side - Settings with Quick Access */}
          <div className="relative">
            {/* Settings button for all screens */}
            <div>
              <button
                onClick={() => {
                  setShowSettings(!showSettings);
                }}
                className={`p-3 bg-gray-800/50 rounded-xl text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all duration-200 active:scale-95 border border-gray-700/50 ${
                  showSettings
                    ? "bg-blue-600/20 border-blue-500/30 text-blue-400"
                    : ""
                }`}
              >
                <Settings className="w-6 h-6" />
              </button>

              {/* Quick Settings Dropdown */}
              {showSettings && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSettings(false)}
                  ></div>

                  <div className="absolute top-full left-0 mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 py-2">
                    <div className="px-4 py-2 border-b border-gray-700">
                      <p className="text-white font-semibold text-sm">
                        Quick Actions
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        handleEditProfile();
                        setShowSettings(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-left"
                    >
                      <User className="w-5 h-5" />
                      <span className="text-sm">Edit Profile</span>
                    </button>

                    <a
                      href="https://t.me/YonatanBad1"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShowSettings(false)}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-left"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span className="text-sm">Contact Support</span>
                    </a>

                    <button
                      onClick={() => {
                        handleToggleSound();
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="flex items-center space-x-3">
                        {soundEnabled ? (
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M7.5 12H3a1 1 0 01-1-1V9a1 1 0 011-1h4.5l4.95-4.95a1 1 0 011.414 0 1 1 0 01.293.707V19.5a1 1 0 01-.293.707 1 1 0 01-1.414 0L7.5 15z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                            />
                          </svg>
                        )}
                        <span className="text-sm">Sounds</span>
                      </div>
                      <div
                        className={`w-10 h-6 rounded-full p-1 transition-colors ${
                          soundEnabled ? "bg-blue-600" : "bg-gray-600"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            soundEnabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        ></div>
                      </div>
                    </button>

                    <div className="border-t border-gray-700 mt-2">
                      <button
                        onClick={() => {
                          onShowTerms();
                          setShowSettings(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-left"
                      >
                        <ExternalLink className="w-5 h-5" />
                        <span className="text-sm">Terms of Service</span>
                      </button>

                      {walletAddress === "guest" ? (
                        <button
                          onClick={() => {
                            handleConnectWalletFromGuest();
                            setShowSettings(false);
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-3 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 transition-colors text-left"
                        >
                          <LogOut className="w-5 h-5" />
                          <span className="text-sm">Connect Wallet</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            handleDisconnectWallet();
                            setShowSettings(false);
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors text-left"
                        >
                          <LogOut className="w-5 h-5" />
                          <span className="text-sm">Disconnect Wallet</span>
                        </button>
                      )}
                    </div>

                    {/* Social Media Links Section */}
                    <div className="border-t border-gray-700 mt-2 pt-3">
                      <div className="px-4 py-2">
                        <p className="text-white font-semibold text-sm mb-3">
                          Join Our Community
                        </p>
                        <div className="flex items-center justify-center space-x-4">
                          {/* Telegram */}
                          <a
                            href="https://t.me/PumpPumpkinio"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setShowSettings(false)}
                            className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-blue-600/20 transition-all duration-200 active:scale-95"
                            title="Join our Telegram"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                            </svg>
                            <span className="text-sm">Telegram</span>
                          </a>

                          {/* X (Twitter) */}
                          <a
                            href="https://x.com/pumppumpkinio"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setShowSettings(false)}
                            className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-blue-600/20 transition-all duration-200 active:scale-95"
                            title="Follow us on Twitter"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.80l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            <span className="text-sm">twitter</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Center - App Logo/Title - Absolutely centered */}
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center space-x-2">
            <div className="w-6 h-6 md:w-8 md:h-8">
              <img
                src="https://i.imgur.com/fWVz5td.png"
                alt="Pump Pumpkin"
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            <span className="text-white font-bold text-sm md:text-lg">
              Pump Pumpkin
            </span>
          </div>

          {/* Right Side - Wallet Info - Hidden on mobile, shown on desktop */}
          <div className="relative">
            {/* Invisible spacer for mobile to maintain layout balance */}
            <div className="md:hidden w-8 h-8"></div>
            {/* Wallet button for desktop */}
            <button
              onClick={() => {
                handleCopyAddress();
              }}
              className="hidden md:flex items-center space-x-2 bg-gray-800/50 rounded-xl px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all duration-200 active:scale-95 border border-gray-700/50"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium">
                {formatWalletAddress(walletAddress)}
              </span>
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Main Content with proper swipe-to-refresh like X.com */}
      <div
        className="flex-1 flex flex-col overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Refresh Area - expands naturally like X.com */}
        {(isSwipeActive || isRefreshing) && (
          <div
            className="bg-black flex items-center justify-center transition-all duration-300 ease-out"
            style={{
              height: isRefreshing
                ? "80px"
                : `${Math.min(swipeCurrentY - swipeStartY, 80)}px`,
              opacity: isRefreshing ? 1 : Math.max(refreshProgress, 0.3),
            }}
          >
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center ${
                  isRefreshing ? "animate-spin" : ""
                }`}
              >
                {isRefreshing ? (
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                ) : (
                  <div
                    className="w-3 h-3 bg-blue-500 rounded-full transition-opacity duration-200"
                    style={{ opacity: refreshProgress }}
                  />
                )}
              </div>
              <div className="text-blue-400 text-xs mt-2 font-medium">
                {isRefreshing
                  ? "Refreshing..."
                  : refreshProgress > 0.5
                  ? "Release to refresh"
                  : "Pull to refresh"}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Container */}
        <div className="flex-1 flex items-center justify-center p-4 pb-32">
          <div
            className={`w-full mx-auto ${
              isWideLayoutTab ? "max-w-6xl" : "max-w-lg"
            }`}
          >
            {renderTabContent()}
          </div>
        </div>
      </div>

      {/* Enhanced Mobile Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black to-gray-900 border-t border-gray-700 shadow-2xl">
        <div className="flex items-center justify-around py-4 px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const hasBadge = tab.badgeCount > 0;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  // Robinhood-style menu sounds
                  if (!isActive) {
                    soundManager.playTabSwitch();
                    hapticFeedback.medium();
                  } else {
                    soundManager.playTabSwitch();
                    hapticFeedback.light();
                  }
                }}
                onMouseEnter={() => {
                  if (!isActive) {
                  }
                }}
                className={`tab-enhanced ${
                  isActive ? "active" : ""
                } relative flex flex-col items-center space-y-1 px-4 py-3 rounded-xl transition-all duration-200 transform ${
                  isActive
                    ? "text-white bg-blue-600/20 border border-blue-500/30 scale-105 shadow-lg shadow-blue-500/25"
                    : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50 hover:scale-105 active:scale-95"
                }`}
                style={{
                  minWidth: "70px",
                  minHeight: "64px",
                }}
              >
                {/* Icon Container with Badge */}
                <div className="relative">
                  <Icon
                    className={`w-6 h-6 transition-all duration-200 ${
                      isActive ? "text-blue-400" : "text-inherit"
                    }`}
                  />

                  {/* Notification Badge */}
                  {hasBadge && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-black animate-pulse">
                      {tab.badgeCount > 99 ? "99+" : tab.badgeCount}
                    </div>
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-xs font-semibold transition-all duration-200 ${
                    isActive ? "text-white" : "text-inherit"
                  }`}
                >
                  {tab.label}
                </span>

                {/* Active Indicator */}
                {isActive && (
                  <div className="absolute -bottom-1 w-8 h-1 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 animate-pulse"></div>
                )}

                {/* Glow Effect for Active Tab */}
                {isActive && (
                  <div className="absolute inset-0 rounded-xl bg-blue-400/10 blur-sm"></div>
                )}
              </button>
            );
          })}
        </div>

        {/* Safe Area for devices with home indicators */}
        <div className="h-2 bg-transparent"></div>
      </div>

      {/* Deposit Modal - Styled like Connect Wallet */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              if (!isDepositing) {
                setShowDepositModal(false);
                setDepositError(null);
              }
            }}
          />
          <div
            className="relative z-10 w-full max-w-sm max-h-[90vh] overflow-y-auto custom-scrollbar"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden rounded-3xl border border-blue-500/35 bg-gradient-to-br from-[#081225] via-[#0c1733] to-[#070f1f] p-6 shadow-[0_30px_80px_-45px_rgba(30,124,250,0.75)] text-center">
              <div className="pointer-events-none absolute -top-24 -right-28 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="pointer-events-none absolute bottom-[-40px] left-1/3 h-48 w-48 rounded-full bg-indigo-400/15 blur-3xl" />

              <button
                onClick={() => {
                  if (!isDepositing) {
                    setShowDepositModal(false);
                    setDepositError(null);
                  }
                }}
                disabled={isDepositing}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Close deposit modal</span>
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center space-y-5">
                <div className="w-16 h-16">
                  <img
                    src="https://i.imgur.com/fWVz5td.png"
                    alt="Pump Pumpkin Icon"
                    className="w-full h-full object-cover rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold">
                    <span style={{ color: "#1e7cfa" }}>Deposit</span> SOL
                  </h1>
                  <p className="text-gray-300 text-sm">
                    Add SOL To Your Platform Balance
                  </p>
                </div>

                <div className="space-y-1 text-xs text-gray-400">
                  <p>Wallet Balance: {userBalances.sol.toFixed(4)} SOL</p>
                  <p>Minimum deposit: 0.04 SOL</p>
                </div>

                {depositError && (
                  <div className="w-full bg-red-900/70 border border-red-700/80 rounded-xl p-3 text-left">
                    <p className="text-red-200 text-xs">{depositError}</p>
                  </div>
                )}

                <div className="w-full">
                  <div className="relative">
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => {
                        setDepositAmount(e.target.value);
                        setDepositError(null); // Clear error when user types
                      }}
                      placeholder="Enter SOL amount (min 0.04)"
                      min="0.04"
                      step="0.001"
                      disabled={isDepositing}
                      className="w-full bg-black/40 border border-blue-500/30 rounded-2xl px-4 py-4 pr-20 text-white text-base placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-center disabled:opacity-50"
                    />
                    <button
                      onClick={() => {
                        if (!userBalances.sol || userBalances.sol < 0.06) {
                          setDepositError(
                            "Insufficient SOL balance. You need at least 0.06 SOL (0.04 deposit + 0.02 gas fees)."
                          );
                          return;
                        }

                        // Set max amount leaving 0.02 SOL for gas fees
                        const maxAmount = Math.max(0, userBalances.sol - 0.02);
                        if (maxAmount >= 0.04) {
                          setDepositAmount(maxAmount.toFixed(4));
                          setDepositError(null);
                        } else {
                          setDepositError(
                            "Insufficient SOL balance. You need at least 0.06 SOL (0.04 deposit + 0.02 gas fees)."
                          );
                        }
                      }}
                      disabled={isDepositing}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-blue-500 text-black text-xs font-semibold rounded-lg disabled:bg-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed hover:bg-blue-400 transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleDeposit}
                  disabled={
                    !depositAmount ||
                    parseFloat(depositAmount) < 0.04 ||
                    isDepositing
                  }
                  className="w-full text-black font-semibold py-3.5 px-6 rounded-2xl text-base transition-colors disabled:bg-gray-700/70 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                  style={{
                    backgroundColor:
                      !depositAmount ||
                      parseFloat(depositAmount) < 0.04 ||
                      isDepositing
                        ? "#374151"
                        : "#1e7cfa",
                    color:
                      !depositAmount ||
                      parseFloat(depositAmount) < 0.04 ||
                      isDepositing
                        ? "#9ca3af"
                        : "black",
                  }}
                  onMouseEnter={(e) => {
                    if (
                      depositAmount &&
                      parseFloat(depositAmount) >= 0.04 &&
                      !isDepositing
                    ) {
                      (e.target as HTMLElement).style.backgroundColor = "#1a6ce8";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (
                      depositAmount &&
                      parseFloat(depositAmount) >= 0.04 &&
                      !isDepositing
                    ) {
                      (e.target as HTMLElement).style.backgroundColor = "#1e7cfa";
                    }
                  }}
                >
                  {isDepositing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>
                      Deposit{" "}
                      {depositAmount
                        ? `${parseFloat(depositAmount).toFixed(4)} SOL`
                        : "SOL"}
                    </span>
                  )}
                </button>

                <div className="space-y-1 text-xs text-gray-400">
                  <p>SOL Will Be Added To Your Platform Balance</p>
                  <p>Note: 0.02 SOL reserved for gas fees</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal - Styled like Connect Wallet */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black flex items-center justify-center p-3 z-50">
          <div
            className="text-center max-w-xs w-full max-h-[90vh] overflow-y-auto custom-scrollbar bg-black/95 rounded-3xl p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-end mb-4">
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawError(null);
                  setWithdrawSuccess(null);
                  setWithdrawAmount("");
                }}
                disabled={isWithdrawing}
                className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <div className="w-16 h-16 mx-auto">
                <img
                  src="https://i.imgur.com/fWVz5td.png"
                  alt="Pump Pumpkin Icon"
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
            </div>

            <h1 className="text-2xl font-normal mb-2">
              <span style={{ color: "#1e7cfa" }}>Withdraw</span> SOL
            </h1>

            <p className="text-gray-400 text-base mb-2">
              Request SOL Withdrawal
            </p>

            <p className="text-gray-500 text-sm mb-1">
              Available: {currentSOLBalance.toFixed(4)} SOL
            </p>
            <p className="text-gray-500 text-sm mb-3">
              Minimum withdrawal: 0.04 SOL
            </p>

            {/* Approval Time */}
            <div className="mb-4 p-2 rounded-lg border text-xs bg-gray-800 border-gray-600 text-gray-300">
              <p className="text-center">
                Approval Time: {getWithdrawalApprovalTime()}
              </p>
            </div>

            {/* Error Message */}
            {withdrawError && (
              <div className="bg-red-900 border border-red-700 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">{withdrawError}</p>
              </div>
            )}

            {/* Success Message */}
            {withdrawSuccess && (
              <div className="bg-green-900 border border-green-700 rounded-lg p-3 mb-4">
                <p className="text-green-300 text-sm">{withdrawSuccess}</p>
              </div>
            )}

            <div className="mb-6">
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => {
                  setWithdrawAmount(e.target.value);
                  setWithdrawError(null); // Clear error when user types
                }}
                placeholder="Enter SOL amount (min 0.04)"
                min="0.04"
                max={currentSOLBalance}
                step="0.001"
                disabled={isWithdrawing}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-3 text-white text-base placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-center disabled:opacity-50"
              />
            </div>

            <button
              onClick={handleWithdraw}
              disabled={
                !withdrawAmount ||
                parseFloat(withdrawAmount) < 0.04 ||
                parseFloat(withdrawAmount) > currentSOLBalance ||
                isWithdrawing
              }
              className="w-full text-black font-medium py-3 px-4 rounded-lg text-base transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed mb-4 flex items-center justify-center space-x-2"
              style={{
                backgroundColor:
                  !withdrawAmount ||
                  parseFloat(withdrawAmount) < 0.04 ||
                  parseFloat(withdrawAmount) > currentSOLBalance ||
                  isWithdrawing
                    ? "#374151"
                    : "#1e7cfa",
                color:
                  !withdrawAmount ||
                  parseFloat(withdrawAmount) < 0.04 ||
                  parseFloat(withdrawAmount) > currentSOLBalance ||
                  isWithdrawing
                    ? "#9ca3af"
                    : "black",
              }}
              onMouseEnter={(e) => {
                if (
                  withdrawAmount &&
                  parseFloat(withdrawAmount) >= 0.04 &&
                  parseFloat(withdrawAmount) <= currentSOLBalance &&
                  !isWithdrawing
                ) {
                  (e.target as HTMLElement).style.backgroundColor = "#1a6ce8";
                }
              }}
              onMouseLeave={(e) => {
                if (
                  withdrawAmount &&
                  parseFloat(withdrawAmount) >= 0.04 &&
                  parseFloat(withdrawAmount) <= currentSOLBalance &&
                  !isWithdrawing
                ) {
                  (e.target as HTMLElement).style.backgroundColor = "#1e7cfa";
                }
              }}
            >
              {isWithdrawing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>
                  Request Withdrawal{" "}
                  {withdrawAmount
                    ? `${parseFloat(withdrawAmount).toFixed(4)} SOL`
                    : ""}
                </span>
              )}
            </button>

            {/* Withdrawal History Card */}
            <div className="mt-4 mb-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                Recent Withdrawals
              </h3>

              {isLoadingWithdrawals ? (
                <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />
                    <span className="text-gray-400 text-sm">Loading...</span>
                  </div>
                </div>
              ) : withdrawalRequests.length > 0 ? (
                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                  {withdrawalRequests.slice(0, 3).map((request) => (
                    <div
                      key={request.id}
                      className="bg-gray-800 border border-gray-600 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-medium">
                            {parseFloat(request.amount.toString()).toFixed(4)}{" "}
                            SOL
                          </p>
                          <p className="text-gray-400 text-xs">
                            {new Date(request.created_at).toLocaleString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          {request.status === "pending" ? (
                            <span className="text-gray-400 text-xs font-medium">
                              pending...
                            </span>
                          ) : request.status === "completed" ? (
                            <span className="text-green-400 text-xs font-medium">
                              successful
                            </span>
                          ) : request.status === "approved" ? (
                            <span className="text-blue-400 text-xs font-medium">
                              approved
                            </span>
                          ) : (
                            <span className="text-red-400 text-xs font-medium">
                              rejected
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 text-center">
                  <p className="text-gray-400 text-sm">
                    No withdrawal requests yet
                  </p>
                </div>
              )}
            </div>

            <p className="text-gray-600 text-xs mb-2">
              Withdrawal approval can take up to {getWithdrawalApprovalTime()}
            </p>
            <p className="text-gray-500 text-xs">
              SOL will be sent to your wallet after approval
            </p>
          </div>
        </div>
      )}

      {/* Mobile-Optimized Swap Modal */}
      {showSwapModal && (
        <div className="fixed inset-0 bg-black flex items-center justify-center p-2 z-50">
          <div className="bg-black w-full max-w-sm mx-auto">
            {/* Close Button */}
            <div className="flex justify-end mb-3">
              <button
                onClick={() => setShowSwapModal(false)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                disabled={isSwapping}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Character Icon */}
            <div className="mb-4">
              <div className="w-12 h-12 mx-auto">
                <img
                  src="https://i.imgur.com/fWVz5td.png"
                  alt="Pump Pumpkin Icon"
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-xl font-normal mb-1 text-center">
              {swapMode === "buy" ? "Buy" : "Sell"}{" "}
              <span style={{ color: "#1e7cfa" }}>PPA</span>
            </h1>

            {/* Subtitle */}
            <p className="text-gray-400 text-sm mb-3 text-center">
              {swapMode === "buy" ? "Swap SOL For PPA" : "Swap PPA For SOL"}
            </p>

            {/* Balance Display */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-2 mb-3">
              <p className="text-gray-400 text-xs mb-1">Available</p>
              <p className="text-white text-sm">
                {swapMode === "buy"
                  ? `${userBalances.sol.toFixed(4)} SOL`
                  : `${formatTokenAmount(userBalances.ppa)} PPA`}
              </p>
            </div>

            {/* Error Message */}
            {swapError && (
              <div className="bg-red-900 border border-red-700 rounded-lg p-2 mb-3">
                <p className="text-red-300 text-xs">{swapError}</p>
              </div>
            )}

            {/* Pay Input with Max Button */}
            <div className="mb-2">
              <div className="relative">
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={`Enter ${
                    swapMode === "buy" ? "SOL" : "PPA"
                  } Amount`}
                  min="0"
                  step={swapMode === "buy" ? "0.001" : "0.01"}
                  disabled={isSwapping}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 pr-16 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-center disabled:opacity-50"
                />
                <button
                  onClick={() => {
                    handleMaxAmount();
                  }}
                  disabled={
                    isSwapping ||
                    (swapMode === "buy"
                      ? userBalances.sol <= 0.01
                      : userBalances.ppa <= 0)
                  }
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white text-xs px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Swap Arrow - Always visible and clickable */}
            <div className="flex justify-center mb-2">
              <button
                onClick={() => {
                  handleToggleSwapMode();
                }}
                disabled={isSwapping || isGettingQuote}
                className="bg-gray-800 hover:bg-gray-700 rounded-full p-1 border border-gray-600 hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGettingQuote ? (
                  <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                ) : (
                  <ArrowUpDown className="w-3 h-3 text-gray-400" />
                )}
              </button>
            </div>

            {/* Receive Display - For both buy and sell modes */}
            <div className="mb-3">
              <div className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-center">
                <span className="text-white text-sm">
                  {swapQuote
                    ? swapMode === "buy"
                      ? `${jupiterSwapService.formatTokenAmount(
                          swapQuote.outAmount,
                          "PPA"
                        )} PPA`
                      : `${jupiterSwapService.formatTokenAmount(
                          swapQuote.outAmount,
                          "SOL"
                        )} SOL`
                    : swapMode === "buy"
                    ? "0 PPA"
                    : "0 SOL"}
                </span>
              </div>
            </div>

            {/* Exchange Rate & Price Impact */}
            <div className="mb-4 text-center space-y-1">
              {swapQuote && swapQuote.priceImpactPct && (
                <p className="text-gray-400 text-xs">
                  Impact:{" "}
                  {parseFloat(swapQuote.priceImpactPct || "0").toFixed(2)}%
                </p>
              )}
              {exchangeRate && (
                <p className="text-white text-xs">{exchangeRate}</p>
              )}
            </div>

            {/* Swap Button */}
            <button
              onClick={handleSwap}
              disabled={
                !payAmount || !swapQuote || isSwapping || isGettingQuote
              }
              className="w-full text-black font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed mb-2 flex items-center justify-center space-x-2"
              style={{
                backgroundColor:
                  !payAmount || !swapQuote || isSwapping
                    ? "#374151"
                    : "#1e7cfa",
                color:
                  !payAmount || !swapQuote || isSwapping ? "#9ca3af" : "black",
              }}
            >
              {isSwapping ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Swapping...</span>
                </>
              ) : (
                <span>{swapMode === "buy" ? "Buy PPA" : "Sell PPA"}</span>
              )}
            </button>

            {/* Cancel Button */}
            <button
              onClick={() => setShowSwapModal(false)}
              disabled={isSwapping}
              className="w-full bg-transparent border border-gray-600 hover:border-gray-500 text-gray-400 hover:text-gray-300 font-medium py-2 px-4 rounded-lg text-sm transition-colors mb-3 disabled:opacity-50"
            >
              Cancel
            </button>

            {/* Powered by Jupiter */}
            <div className="flex items-center justify-center space-x-1">
              <span className="text-gray-500 text-xs">Powered by</span>
              <img
                src="https://portal.jup.ag/images/branding/JupiterIcon.svg"
                alt="Jupiter"
                className="w-3 h-3"
              />
              <span className="text-gray-400 text-xs font-medium">Jupiter</span>
            </div>
          </div>
        </div>
      )}

      {/* Mobile-Optimized Success Modal */}
      {showSuccessModal && swapSuccessData && (
        <div className="fixed inset-0 bg-black flex items-center justify-center p-2 z-50">
          <div className="bg-black w-full max-w-sm mx-auto text-center">
            {/* Success Icon */}
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
            </div>

            {/* Success Title */}
            <h1 className="text-2xl font-normal mb-3">
              Swap <span style={{ color: "#1e7cfa" }}>Successful!</span>
            </h1>

            {/* Transaction Details */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-xs">You Paid:</span>
                  <span className="text-white text-sm font-medium">
                    {swapSuccessData.inputAmount.toFixed(4)}{" "}
                    {swapSuccessData.inputToken}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-xs">You Received:</span>
                  <span className="text-green-400 text-sm font-medium">
                    {swapSuccessData.outputAmount.toFixed(4)}{" "}
                    {swapSuccessData.outputToken}
                  </span>
                </div>

                {/* Platform fees removed - no longer charged on swaps */}

                <div className="border-t border-gray-700 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-xs">
                      Transaction ID:
                    </span>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(swapSuccessData.txid)
                      }
                      className="text-blue-400 hover:text-blue-300 text-xs font-mono truncate max-w-24"
                      title="Click to copy"
                    >
                      {swapSuccessData.txid.slice(0, 6)}...
                      {swapSuccessData.txid.slice(-6)}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* View on Explorer Button */}
            <button
              onClick={() =>
                window.open(
                  `https://solscan.io/tx/${swapSuccessData.txid}`,
                  "_blank"
                )
              }
              className="w-full bg-transparent border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors mb-3"
            >
              View on Solscan
            </button>

            {/* Close Button */}
            <button
              onClick={handleCloseSuccessModal}
              className="w-full text-black font-medium py-2 px-4 rounded-lg text-sm transition-colors"
              style={{ backgroundColor: "#1e7cfa" }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "#1a6ce8";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "#1e7cfa";
              }}
            >
              Continue Trading
            </button>
          </div>
        </div>
      )}

      {/* Transaction Verification Loading Modal */}
      {isVerifyingTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-3 z-50">
          <div className="text-center max-w-xs w-full">
            {/* Loading Icon */}
            <div className="mb-6">
              <div className="relative w-20 h-20 mx-auto">
                <img
                  src="https://i.imgur.com/fWVz5td.png"
                  alt="Pump Pumpkin Icon"
                  className="w-full h-full object-cover rounded-lg"
                />
                <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-lg animate-spin"></div>
              </div>
            </div>

            {/* Loading Text */}
            <h1 className="text-2xl font-normal mb-3">
              Verifying Your{" "}
              <span style={{ color: "#1e7cfa" }}>Transaction</span>
            </h1>

            <p className="text-gray-400 text-lg mb-2">Please Wait...</p>
            <p className="text-gray-500 text-sm">
              We are confirming your transaction on the Solana blockchain
            </p>
            <p className="text-gray-500 text-sm mt-4">
              This usually takes a few seconds
            </p>

            {/* Animated dots */}
            <div className="flex justify-center space-x-1 mt-6">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <div
                className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
                style={{ animationDelay: "0.2s" }}
              ></div>
              <div
                className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
                style={{ animationDelay: "0.4s" }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Position Management Modal */}
      {showPositionModal && selectedPosition && (
        <PositionModal
          position={selectedPosition}
          onClose={handleClosePositionModal}
          onClosePosition={handleClosePosition}
          isClosingPosition={isClosingPosition}
          solPrice={solPrice}
        />
      )}

      {/* Closing Trade Loading Modal */}
      <TradeLoadingModal
        isOpen={showClosingModal}
        type="closing"
        tokenSymbol={closingTradeData?.tokenSymbol || ""}
        direction={closingTradeData?.direction}
        leverage={closingTradeData?.leverage}
        onClose={() => {
          setShowClosingModal(false);
          setClosingTradeData(null);
        }}
        canCancel={false} // Don't allow cancelling during anti-gaming delay
      />

      {/* Trade Results Modal */}
      <TradeResultsModal
        isOpen={showTradeResults}
        onClose={() => {
          setShowTradeResults(false);
          setTradeResultsData(null);

          // Reload positions to reflect changes
          if (activeTab === "positions") {
            loadTradingPositions();
          }
        }}
        tradeData={tradeResultsData}
      />

      {/* Share Gains Popup */}
      <ShareGainsPopup
        isOpen={showShareGainsPopup}
        onClose={() => {
          setShowShareGainsPopup(false);
          setTradeResultsData(null);
        }}
        onShare={async () => {
          if (tradeResultsData) {
            try {
              await shareTradeResults(tradeResultsData, walletAddress);
            } catch (error) {
              console.error("Error sharing trade results:", error);
            }
          }
        }}
        isProfit={tradeResultsData ? tradeResultsData.finalPnL > 0 : false}
        pnlAmount={tradeResultsData ? tradeResultsData.finalPnL : 0}
        tokenSymbol={tradeResultsData ? tradeResultsData.tokenSymbol : ""}
        leverage={tradeResultsData ? tradeResultsData.leverage : 1}
        direction={tradeResultsData ? tradeResultsData.direction : "Long"}
        collateralAmount={
          tradeResultsData ? tradeResultsData.collateralAmount : 0
        }
      />

      {/* Trading Modal */}
      {showTradingModal && selectedTokenData && (
        <TradingModal
          tokenData={selectedTokenData}
          onClose={() => {
            setShowTradingModal(false);
            setSelectedTokenData(null);
            // Reload positions when trading modal closes (in case user executed a trade)
            if (activeTab === "positions") {
              loadTradingPositions();
            }
          }}
          userSOLBalance={currentSOLBalance}
          walletAddress={walletAddress}
          onUpdateSOLBalance={(newBalance) => {
            setCurrentSOLBalance(newBalance);
            onUpdateSOLBalance(newBalance);
          }}
          onShowTerms={onShowTerms}
          onNavigateToPositions={() => {
            setShowTradingModal(false);
            setSelectedTokenData(null);
            setActiveTab("positions");
            // Reload positions to show the new trade immediately
            loadTradingPositions();
          }}
        />
      )}

      {/* Trade Details Modal */}
      {showTradeDetailsModal && selectedTradeId !== null && (
        <TradeDetailsModal
          positionId={selectedTradeId}
          onClose={() => {
            setShowTradeDetailsModal(false);
            setSelectedTradeId(null);
          }}
        />
      )}

      {/* Locking Modal */}
      <LockingModal
        isOpen={showLockingModal}
        onClose={() => setShowLockingModal(false)}
        userPPABalance={userBalances.ppa}
        ppaPrice={realPPAPriceInSOL}
        platformWalletAddress={depositWalletDisplay}
        onUpdateSOLBalance={(newBalance: number) => {
          setCurrentSOLBalance(newBalance);
          onUpdateSOLBalance(newBalance); // Update database through parent callback
        }}
        onLockPPA={async (amount: number, lockPeriod: number) => {
          // This callback is now handled internally by the LockingModal
          console.log(`Lock initiated: ${amount} PPA for ${lockPeriod} days`);
          // Refresh lifetime earnings and active locks after successful lock
          loadLifetimeEarnings();
          loadActivePPALocks();
        }}
      />

      {/* Unlock Modal */}
      <UnlockModal
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        expiredLock={expiredLock}
        solPrice={solPrice}
        onUnlockRequested={() => {
          // Refresh active locks after unlock request
          loadActivePPALocks();
        }}
      />

      {/* PNL Card Modal */}
      <PnlCardModal
        isOpen={showPnlCardPreview}
        onClose={closePnlCardPreview}
        pnlCardImage={pnlCardImage}
        pnlCardData={pnlCardData}
        isLoading={isPnlCardGenerating}
      />

      {/* Welcome Popup */}
      <WelcomePopup
        isOpen={showWelcomePopup}
        onClose={handleWelcomeClose}
        onOpenDeposit={() => setShowDepositModal(true)}
      />
    </div>
  );
}
