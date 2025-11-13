import { supabase, userProfileService } from "./supabaseClient";
import { fetchTokenDetailCached, fetchSOLPrice } from "./birdeyeApi";

// Add crypto for request hash generation
const crypto =
  typeof window !== "undefined" ? window.crypto : require("crypto");

export interface TradingPosition {
  id: number;
  wallet_address: string;
  token_address: string;
  token_symbol: string;
  direction: "Long" | "Short";
  order_type: "Market Order" | "Limit Order";
  entry_price: number;
  target_price?: number;
  amount: number;
  leverage: number;
  collateral_sol: number;
  position_value_usd: number;
  // Updated: Trading fee tracking
  trading_fee_usd?: number;
  trading_fee_sol?: number;
  trading_fee_percentage?: number;
  stop_loss?: number;
  take_profit?: number;
  status:
    | "pending"
    | "opening"
    | "open"
    | "closing"
    | "closed"
    | "liquidated"
    | "cancelled";
  current_pnl: number;
  liquidation_price: number;
  margin_call_triggered: boolean;
  margin_call_price?: number;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  close_price?: number;
  close_reason?: string;
  trade_results?: string;
  current_price?: number;
  margin_ratio?: number;
  token_image?: string | null;
}

export interface CreatePositionData {
  wallet_address: string;
  token_address: string;
  token_symbol: string;
  direction: "Long" | "Short";
  order_type: "Market Order" | "Limit Order";
  target_price?: number;
  fresh_market_price?: number;
  // NEW: Additional fields from frontend
  entry_price_with_slippage?: number;
  trading_fee_rate?: number;
  slippage_rate?: number;
  amount: number;
  leverage: number;
  stop_loss?: number;
  take_profit?: number;
}

export interface PositionUpdate {
  position_id: number;
  price: number;
  pnl: number;
  margin_ratio: number;
}

export interface MarginCallAlert {
  position: TradingPosition;
  current_price: number;
  required_collateral: number;
  shortfall: number;
}

// Request hash generation for deduplication
function generateRequestHash(
  data: CreatePositionData,
  timestamp: number
): string {
  const requestData = {
    wallet_address: data.wallet_address,
    token_address: data.token_address,
    direction: data.direction,
    order_type: data.order_type,
    amount: data.amount,
    leverage: data.leverage,
    // Round timestamp to 5-second window to allow minor timing differences
    time_window: Math.floor(timestamp / 5000) * 5000,
  };

  const jsonString = JSON.stringify(requestData);

  if (typeof window !== "undefined") {
    // Browser environment
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonString);
    return btoa(String.fromCharCode(...new Uint8Array(data))).slice(0, 32);
  } else {
    // Node environment
    return crypto
      .createHash("sha256")
      .update(jsonString)
      .digest("hex")
      .slice(0, 32);
  }
}

class PositionService {
  // Apply 0.3% entry slippage - always worse for user (platform's favor)
  private applyEntrySlippage(
    price: number,
    direction: "Long" | "Short",
    slippageRate: number = 0.003
  ): {
    slippedPrice: number;
    slippagePercent: number;
  } {
    let slippedPrice = price;

    // Entry slippage: always worse for user, better for platform
    if (direction === "Long") {
      // Long: User buys at higher price (worse for user)
      slippedPrice = price * (1 + slippageRate); // +0.3% higher entry price
    } else {
      // Short: User sells at lower price (worse for user)
      slippedPrice = price * (1 - slippageRate); // -0.3% lower entry price
    }

    const slippagePercent = ((slippedPrice - price) / price) * 100;

    return {
      slippedPrice,
      slippagePercent,
    };
  }

  // Calculate trading fee
  private calculateTradingFee(
    positionValueUSD: number,
    feeRate: number = 0.003,
    solPrice: number
  ): {
    feeUSD: number;
    feeSOL: number;
  } {
    const feeUSD = positionValueUSD * feeRate;
    const feeSOL = feeUSD / solPrice;

    return {
      feeUSD,
      feeSOL,
    };
  }

  // Position size limits based on leverage
  private getMaxPositionSize(leverage: number): number {
    if (leverage >= 50) return 100_000_000; // $100M for 50x-100x
    if (leverage >= 10) return 50_000_000; // $50M for 10x-49x
    if (leverage >= 2) return 10_000_000; // $10M for 2x-9x
    return 5_000_000; // $5M default fallback
  }

  // Calculate liquidation price
  private calculateLiquidationPrice(
    entry_price: number,
    direction: "Long" | "Short",
    leverage: number
  ): number {
    // Liquidation occurs when losses reach 100% of collateral
    // For Long: price drops by (1/leverage) of entry price
    // For Short: price rises by (1/leverage) of entry price

    if (direction === "Long") {
      return entry_price * (1 - 1 / leverage);
    } else {
      return entry_price * (1 + 1 / leverage);
    }
  }

  // Calculate margin call price (at 80% of liquidation)
  private calculateMarginCallPrice(
    entry_price: number,
    liquidation_price: number,
    direction: "Long" | "Short"
  ): number {
    if (direction === "Long") {
      // Margin call at 80% of the way to liquidation
      return entry_price - (entry_price - liquidation_price) * 0.8;
    } else {
      return entry_price + (liquidation_price - entry_price) * 0.8;
    }
  }

  // Validate position size limits
  private validatePositionSize(
    position_value_usd: number,
    leverage: number
  ): boolean {
    const maxSize = this.getMaxPositionSize(leverage);
    return position_value_usd <= maxSize;
  }

  // REMOVED: Hidden trading fee calculation - no longer needed
  // All fees are now consolidated into a single 20% fee on total return when closing positions

  // Calculate P&L for a position
  async calculatePositionPnL(position: TradingPosition): Promise<{
    pnl: number;
    margin_ratio: number;
    current_price: number;
  }> {
    try {
      // Get current token price and SOL price from Birdeye
      const [tokenData, sol_price] = await Promise.all([
        fetchTokenDetailCached(position.token_address),
        fetchSOLPrice(),
      ]);

      if (!tokenData) {
        throw new Error(
          `Failed to fetch token data for ${position.token_address}`
        );
      }
      const current_price = tokenData.price;

      const entry_price = position.entry_price;
      const amount = position.amount;
      const leverage = position.leverage;

      // Calculate P&L in USD
      // amount = base token amount from user input
      // For leveraged trading, P&L should be calculated on the full leveraged exposure
      let pnl_usd = 0;

      console.log(`🧮 P&L DEBUG for position ${position.id}:`, {
        token: position.token_symbol,
        amount: amount,
        leverage: leverage,
        entry_price: entry_price,
        current_price: current_price,
        direction: position.direction,
      });

      if (position.direction === "Long") {
        // Long: Profit when price goes up
        pnl_usd = (current_price - entry_price) * amount * leverage;
      } else {
        // Short: Profit when price goes down
        pnl_usd = (entry_price - current_price) * amount * leverage;
      }

      console.log(`💰 P&L Result: $${pnl_usd.toFixed(2)} USD`);

      // Calculate margin ratio in SOL terms (FIXED)
      const max_loss_sol = position.collateral_sol; // Max loss is the collateral in SOL
      const pnl_sol = pnl_usd / sol_price; // Convert P&L from USD to SOL

      let margin_ratio = 0;
      if (pnl_sol < 0) {
        margin_ratio = Math.abs(pnl_sol) / max_loss_sol;
      }

      return {
        pnl: pnl_usd, // Return P&L in USD for display
        margin_ratio: Math.min(margin_ratio, 1), // Cap at 1
        current_price,
      };
    } catch (error) {
      console.error("Error calculating P&L:", error);
      throw error;
    }
  }

  // Create a new trading position using atomic database function
  async createPosition(data: CreatePositionData): Promise<TradingPosition> {
    try {
      console.log("🔒 SECURE POSITION CREATION STARTED (ATOMIC) 🔒");
      console.log("📥 RECEIVED DATA FROM FRONTEND:", data);

      // Generate request hash for deduplication
      const timestamp = Date.now();
      const requestHash = generateRequestHash(data, timestamp);
      console.log("🔑 Request hash generated:", requestHash);

      // STEP 1: Determine entry price
      console.log("📊 STEP 1: DETERMINING ENTRY PRICE");
      let entry_price = data.target_price || 0;

      if (data.order_type === "Market Order") {
        if (data.entry_price_with_slippage) {
          // Use the pre-calculated entry price from frontend (includes slippage)
          entry_price = data.entry_price_with_slippage;
          console.log(
            "💰 MARKET ORDER - USING PRE-CALCULATED ENTRY PRICE WITH SLIPPAGE:",
            entry_price
          );
        } else if (data.fresh_market_price) {
          // Apply slippage to fresh market price
          const slippageRate = data.slippage_rate || 0.003;
          const slippageResult = this.applyEntrySlippage(
            data.fresh_market_price,
            data.direction,
            slippageRate
          );
          entry_price = slippageResult.slippedPrice;
          console.log("💰 MARKET ORDER - APPLYING SLIPPAGE TO FRESH PRICE:", {
            fresh_price: data.fresh_market_price,
            slipped_price: entry_price,
            slippage: slippageResult.slippagePercent,
          });
        } else {
          // Fallback: fetch price and apply slippage
          const tokenData = await fetchTokenDetailCached(data.token_address);
          if (!tokenData) {
            throw new Error(
              `Failed to fetch token data for ${data.token_address}`
            );
          }
          const slippageRate = data.slippage_rate || 0.003;
          const slippageResult = this.applyEntrySlippage(
            tokenData.price,
            data.direction,
            slippageRate
          );
          entry_price = slippageResult.slippedPrice;
          console.log(
            "💰 MARKET ORDER - FALLBACK WITH SLIPPAGE APPLIED:",
            entry_price
          );
        }
      } else {
        console.log("🎯 LIMIT ORDER - ENTRY PRICE FROM USER:", entry_price);
      }

      // STEP 2: Get SOL price
      console.log("📊 STEP 2: FETCHING SOL PRICE");
      const sol_price = await fetchSOLPrice();
      console.log("💰 SOL PRICE:", sol_price);

      // STEP 3: Calculate position values with trading fee
      console.log("📊 STEP 3: CALCULATING POSITION VALUES WITH TRADING FEE");
      const position_value_usd = data.amount * entry_price;
      const leveraged_exposure = position_value_usd * data.leverage;

      // Calculate trading fee
      const tradingFeeRate = data.trading_fee_rate || 0.003; // Default 0.3%
      const tradingFee = this.calculateTradingFee(
        position_value_usd,
        tradingFeeRate,
        sol_price
      );

      console.log("💰 TRADING FEE CALCULATION:", {
        position_value_usd,
        fee_rate: tradingFeeRate,
        fee_usd: tradingFee.feeUSD,
        fee_sol: tradingFee.feeSOL,
      });

      // Validate position size
      if (!this.validatePositionSize(leveraged_exposure, data.leverage)) {
        throw new Error(
          `Position size ${leveraged_exposure.toFixed(0)} exceeds limit for ${
            data.leverage
          }x leverage`
        );
      }

      // Calculate collateral and total required SOL
      const collateral_usd = position_value_usd / data.leverage;
      const collateral_sol = collateral_usd / sol_price;
      const total_required_sol = collateral_sol + tradingFee.feeSOL; // Collateral + Trading Fee

      const liquidation_price = this.calculateLiquidationPrice(
        entry_price,
        data.direction,
        data.leverage
      );
      const margin_call_price = this.calculateMarginCallPrice(
        entry_price,
        liquidation_price,
        data.direction
      );

      console.log("🔒 CALLING ATOMIC DATABASE FUNCTION WITH FEES");
      console.log("📊 Parameters:", {
        wallet: data.wallet_address,
        token: data.token_symbol,
        direction: data.direction,
        collateral_sol: collateral_sol,
        trading_fee_sol: tradingFee.feeSOL,
        total_required_sol: total_required_sol,
        position_value_usd: position_value_usd,
        request_hash: requestHash,
      });

      // Call atomic database function with updated parameters
      const { data: result, error } = await supabase.rpc(
        "create_position_atomic_with_fees",
        {
          p_wallet_address: data.wallet_address,
          p_token_address: data.token_address,
          p_token_symbol: data.token_symbol,
          p_direction: data.direction,
          p_order_type: data.order_type,
          p_entry_price: entry_price,
          p_target_price: data.target_price || null,
          p_amount: data.amount,
          p_leverage: data.leverage,
          p_collateral_sol: collateral_sol,
          p_trading_fee_sol: tradingFee.feeSOL,
          p_trading_fee_usd: tradingFee.feeUSD,
          p_trading_fee_percentage: tradingFeeRate,
          p_total_required_sol: total_required_sol,
          p_position_value_usd: position_value_usd,
          p_stop_loss: data.stop_loss || null,
          p_take_profit: data.take_profit || null,
          p_liquidation_price: liquidation_price,
          p_margin_call_price: margin_call_price,
          p_request_hash: requestHash,
        }
      );

      if (error) {
        console.error("💥 ATOMIC FUNCTION ERROR:", error);

        // Handle specific error types
        if (error.message?.includes("Duplicate request detected")) {
          throw new Error(
            "Request already in progress. Please wait before retrying."
          );
        } else if (error.message?.includes("already have an active position")) {
          throw new Error(
            "You already have an active position for this token. Please close it first."
          );
        } else if (error.message?.includes("Insufficient SOL balance")) {
          throw new Error(error.message);
        } else {
          throw new Error(`Failed to create position: ${error.message}`);
        }
      }

      if (!result || !result.success) {
        throw new Error(
          "Position creation failed - invalid response from database"
        );
      }

      const positionId = result.position_id;
      console.log("✅ POSITION CREATED ATOMICALLY WITH FEES:", {
        position_id: positionId,
        previous_balance: result.previous_balance,
        new_balance: result.new_balance,
        collateral_deducted: result.collateral_deducted,
        trading_fee_deducted: result.trading_fee_deducted,
        total_deducted: result.total_deducted,
      });

      // Fetch the created position
      const { data: position, error: fetchError } = await supabase
        .from("trading_positions")
        .select("*")
        .eq("id", positionId)
        .single();

      if (fetchError || !position) {
        console.error("💥 ERROR FETCHING CREATED POSITION:", fetchError);
        throw new Error("Position created but failed to fetch details");
      }

      console.log("🎉 SECURE POSITION CREATION WITH FEES COMPLETED 🎉");
      return position;
    } catch (error) {
      console.error("💥 SECURE POSITION CREATION ERROR 💥");
      console.error("Error message:", (error as any)?.message);
      console.error("Error details:", error);
      throw error;
    }
  }

  // Get user's positions
  async getUserPositions(wallet_address: string): Promise<TradingPosition[]> {
    try {
      console.log("🔍 DEBUG: Fetching positions for wallet:", wallet_address);

      // Prevent guest users from querying positions
      if (wallet_address === "guest") {
        console.log("⚠️ WARNING: Guest user cannot have trading positions");
        return [];
      }

      // Validate wallet address format (basic Solana address validation)
      if (
        !wallet_address ||
        wallet_address.length < 32 ||
        wallet_address.length > 44
      ) {
        console.error("❌ Invalid wallet address format:", wallet_address);
        return [];
      }

      const { data: positions, error } = await supabase
        .from("trading_positions")
        .select("*")
        .eq("wallet_address", wallet_address)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching positions:", error);
        throw error;
      }

      console.log(
        "✅ Successfully fetched",
        positions?.length || 0,
        "positions for wallet"
      );
      return positions || [];
    } catch (error) {
      console.error("💥 Error getting user positions:", error);
      throw error;
    }
  }

  // Get open positions (for P&L monitoring)
  async getOpenPositions(): Promise<TradingPosition[]> {
    try {
      const { data: positions, error } = await supabase
        .from("trading_positions")
        .select("*")
        .in("status", ["open"]); // Only include fully opened positions for liquidation monitoring

      if (error) {
        console.error("Error fetching open positions:", error);
        throw error;
      }

      return positions || [];
    } catch (error) {
      console.error("Error getting open positions:", error);
      throw error;
    }
  }

  // Update position P&L
  async updatePositionPnL(
    position_id: number,
    update: PositionUpdate
  ): Promise<void> {
    try {
      // Update position current_pnl
      const { error: positionError } = await supabase
        .from("trading_positions")
        .update({
          current_pnl: update.pnl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", position_id);

      if (positionError) {
        console.error("Error updating position P&L:", positionError);
        throw positionError;
      }

      // Insert position update record
      const { error: updateError } = await supabase
        .from("position_updates")
        .insert({
          position_id,
          price: update.price,
          pnl: update.pnl,
          margin_ratio: update.margin_ratio,
        });

      if (updateError) {
        console.error("Error inserting position update:", updateError);
        throw updateError;
      }
    } catch (error) {
      console.error("Error updating position P&L:", error);
      throw error;
    }
  }

  // Check for margin calls
  async checkMarginCalls(): Promise<MarginCallAlert[]> {
    try {
      const openPositions = await this.getOpenPositions();
      const marginCallAlerts: MarginCallAlert[] = [];
      const sol_price = await fetchSOLPrice(); // Get SOL price for conversions

      for (const position of openPositions) {
        const { pnl, margin_ratio, current_price } =
          await this.calculatePositionPnL(position);

        // Trigger margin call at 80% margin ratio
        if (margin_ratio >= 0.8 && !position.margin_call_triggered) {
          // Calculate how much collateral needed to get back to 50% margin ratio (in SOL terms)
          const safe_margin_ratio = 0.5;
          const current_loss_sol = Math.abs(pnl) / sol_price; // Convert USD loss to SOL using SOL price
          const safe_loss_sol = position.collateral_sol * safe_margin_ratio; // Safe loss in SOL
          const required_additional_collateral =
            current_loss_sol - safe_loss_sol; // Additional SOL needed

          marginCallAlerts.push({
            position,
            current_price,
            required_collateral: required_additional_collateral,
            shortfall: required_additional_collateral,
          });

          // Mark margin call as triggered
          await supabase
            .from("trading_positions")
            .update({ margin_call_triggered: true })
            .eq("id", position.id);

          console.log(`⚠️ Margin call triggered for position ${position.id}:`, {
            token: position.token_symbol,
            current_price,
            margin_ratio,
            required_collateral: required_additional_collateral,
          });
        }
      }

      return marginCallAlerts;
    } catch (error) {
      console.error("Error checking margin calls:", error);
      throw error;
    }
  }

  // Liquidate position
  async liquidatePosition(
    position_id: number,
    current_price: number
  ): Promise<void> {
    try {
      // STEP 1: Get the position details first
      const { data: position, error: fetchError } = await supabase
        .from("trading_positions")
        .select("*")
        .eq("id", position_id)
        .single();

      if (fetchError) {
        console.error("Error fetching position for liquidation:", fetchError);
        throw fetchError;
      }

      // STEP 2: Calculate final P&L for the liquidated position
      const finalPnL = await this.calculatePositionPnL(position);
      const sol_price = await fetchSOLPrice();

      // STEP 3: Calculate amount to return to user (in liquidation, user typically loses most/all collateral)
      // In liquidation, user loses the full collateral amount (this is the risk of leverage trading)
      // NOTE: No profit fees charged on liquidations since they're always losses
      const collateralToReturn = 0; // In liquidation, user gets nothing back

      console.log("🔥 Liquidating position with collateral loss:", {
        position_id,
        token: position.token_symbol,
        collateral_lost: `${position.collateral_sol.toFixed(4)} SOL`,
        final_pnl: `$${finalPnL.pnl.toFixed(2)}`,
        liquidation_price: current_price,
      });

      // STEP 4: Update position status to liquidated
      const { error } = await supabase
        .from("trading_positions")
        .update({
          status: "liquidated",
          closed_at: new Date().toISOString(),
          close_price: current_price,
          close_reason: "liquidation",
          current_pnl: finalPnL.pnl, // Store final P&L
        })
        .eq("id", position_id);

      if (error) {
        console.error("Error liquidating position:", error);
        throw error;
      }

      console.log(
        `🔥 Position ${position_id} liquidated at price ${current_price} - Collateral lost: ${position.collateral_sol.toFixed(
          4
        )} SOL`
      );
    } catch (error) {
      console.error("Error liquidating position:", error);
      throw error;
    }
  }

  // Check for liquidations
  async checkLiquidations(): Promise<{
    liquidatedCount: number;
    checkedCount: number;
  }> {
    try {
      const openPositions = await this.getOpenPositions();
      let liquidatedCount = 0;

      console.log(
        `🔍 Checking ${openPositions.length} open positions for liquidation...`
      );

      for (const position of openPositions) {
        try {
          const { margin_ratio, current_price } =
            await this.calculatePositionPnL(position);

          // Liquidate at 100% margin ratio
          if (margin_ratio >= 1.0) {
            await this.liquidatePosition(position.id, current_price);
            liquidatedCount++;

            console.log(`🔥 AUTOMATIC LIQUIDATION:`, {
              id: position.id,
              token: position.token_symbol,
              direction: position.direction,
              entry_price: position.entry_price,
              liquidation_price: current_price,
              margin_ratio: `${(margin_ratio * 100).toFixed(1)}%`,
              collateral_lost: `${position.collateral_sol.toFixed(4)} SOL`,
            });
          }
        } catch (error) {
          console.error(
            `Error checking position ${position.id} for liquidation:`,
            error
          );
          // Continue checking other positions
        }
      }

      if (liquidatedCount > 0) {
        console.log(
          `🚨 LIQUIDATION SUMMARY: ${liquidatedCount} positions liquidated out of ${openPositions.length} checked`
        );
      }

      return { liquidatedCount, checkedCount: openPositions.length };
    } catch (error) {
      console.error("Error checking liquidations:", error);
      throw error;
    }
  }

  // Close a position immediately
  async closePosition(
    position_id: number,
    close_reason: "manual" | "stop_loss" | "take_profit" | "liquidation",
    precomputedPrice?: number  // Allow Dashboard to pass fresh price to avoid double fetch
  ): Promise<void> {
    try {
      console.log(`🔒 CLOSING POSITION ${position_id} IMMEDIATELY 🔒`);
      console.log('🔍 Starting closePosition with precomputedPrice:', precomputedPrice);

      // STEP 1: First get position details, then parallel fetch price data
      const { data: position, error: fetchError } = await supabase
        .from("trading_positions")
        .select("*")
        .eq("id", position_id)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching position from database:', fetchError);
        throw fetchError;
      }
      
      if (!position) {
        console.error('❌ Position not found in database');
        throw new Error(`Position ${position_id} not found`);
      }
      
      console.log('✅ Position fetched successfully:', {
        id: position.id,
        status: position.status,
        token: position.token_symbol,
        direction: position.direction
      });

      // STEP 2: Parallel fetch token price and SOL price
      const [tokenData, sol_price] = await Promise.all([
        precomputedPrice ? null : fetchTokenDetailCached(position.token_address),
        fetchSOLPrice()
      ]);

      // STEP 3: Use precomputed price if available, otherwise fetch
      let close_price: number;
      if (precomputedPrice) {
        close_price = precomputedPrice;
        console.log(`💰 Using precomputed close price: $${close_price}`);
      } else {
        if (!tokenData) {
          throw new Error(
            `Failed to fetch current price for ${position.token_symbol}`
          );
        }
        close_price = tokenData.price;
        console.log(`💰 Current market price: $${close_price}`);
      }

      // STEP 4: Calculate final P&L
      const finalPnL = await this.calculatePositionPnLWithPrice(
        position,
        close_price
      );
      const pnlSOL = finalPnL.pnl / sol_price;

      // Calculate return amount: original collateral + P&L
      const totalReturnSOL = position.collateral_sol + pnlSOL;

      let actualReturnAmount: number;
      let platformFeeSOL = 0;

      if (close_reason === "liquidation" || position.status === "liquidated") {
        // No fee on liquidations (user already loses everything)
        actualReturnAmount = Math.max(0, totalReturnSOL);
        platformFeeSOL = 0;
      } else {
        // Take 20% fee on the TOTAL RETURN AMOUNT (as per Terms of Service)
        // This applies to both profits and losses
        if (totalReturnSOL > 0) {
          platformFeeSOL = totalReturnSOL * 0.2;
          actualReturnAmount = totalReturnSOL - platformFeeSOL;
        } else {
          // No return amount, no fee
          platformFeeSOL = 0;
          actualReturnAmount = 0;
        }
      }

      const pnlPercentage = (pnlSOL / position.collateral_sol) * 100;

      console.log(`💰 Position ${position_id} closing:`, {
        entry_price: position.entry_price,
        close_price: close_price,
        pnl_usd: finalPnL.pnl,
        pnl_sol: pnlSOL,
        original_collateral: position.collateral_sol,
        total_return_before_fees: totalReturnSOL,
        platform_fee_sol: platformFeeSOL,
        actual_return_sol: actualReturnAmount,
        pnl_percentage: pnlPercentage,
        close_reason: close_reason,
        is_liquidation:
          close_reason === "liquidation" || position.status === "liquidated",
        fee_charged_on_loss:
          pnlSOL < 0 &&
          close_reason !== "liquidation" &&
          position.status !== "liquidated",
      });

      // STEP 5: Always return remaining balance to user (even if small amount)
      const userProfile = await userProfileService.getProfile(
        position.wallet_address
      );
      if (userProfile && actualReturnAmount >= 0) {
        const newSOLBalance = userProfile.sol_balance + actualReturnAmount;
        const updateSuccess = await userProfileService.updateSOLBalance(
          position.wallet_address,
          newSOLBalance
        );

        if (updateSuccess) {
          console.log(
            `💰 Amount returned: ${userProfile.sol_balance.toFixed(
              6
            )} + ${actualReturnAmount.toFixed(6)} = ${newSOLBalance.toFixed(
              6
            )} SOL`
          );
        } else {
          console.error(
            `❌ CRITICAL: Failed to return ${actualReturnAmount.toFixed(
              6
            )} SOL to user ${position.wallet_address}`
          );
          throw new Error("Balance return failed - position closing aborted");
        }
      }

      // STEP 6: Create trade results for the frontend
      const tradeResults = {
        tokenSymbol: position.token_symbol,
        direction: position.direction as "Long" | "Short",
        leverage: position.leverage,
        entryPrice: position.entry_price,
        exitPrice: close_price,
        positionSize: position.amount,
        collateralAmount: position.collateral_sol,
        grossPnL: finalPnL.pnl,
        platformFee: platformFeeSOL * sol_price,
        finalPnL:
          actualReturnAmount * sol_price - position.collateral_sol * sol_price,
        pnlPercentage: pnlPercentage,
        totalReturn: actualReturnAmount,
      };

      // STEP 7: Update position status (working with current schema)
      const { error } = await supabase
        .from("trading_positions")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          close_price: close_price,
          current_pnl: finalPnL.pnl,
          close_reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", position_id);

      if (error) {
        console.error("❌ Error finalizing position close:", error);
        throw error;
      }

      console.log(`🎉 Position ${position_id} successfully closed and marked as 'closed' in database`);
      console.log("📊 Trade Results:", tradeResults);
      
      // Verify the position was actually closed
      const { data: verifyPosition } = await supabase
        .from("trading_positions")
        .select("status")
        .eq("id", position_id)
        .single();
      
      console.log(`🔍 Verification: Position ${position_id} status is now:`, verifyPosition?.status);
    } catch (error) {
      console.error("Error closing position:", error);
      throw error;
    }
  }

  // Calculate P&L with a specific price
  private async calculatePositionPnLWithPrice(
    position: any,
    price: number
  ): Promise<{ pnl: number; margin_ratio: number }> {
    const entry_price = position.entry_price;
    const amount = position.amount;
    const leverage = position.leverage;

    // Calculate P&L in USD - CORRECTED: Apply leverage for proper P&L calculation
    let pnl_usd = 0;
    if (position.direction === "Long") {
      pnl_usd = (price - entry_price) * amount * leverage;
    } else {
      pnl_usd = (entry_price - price) * amount * leverage;
    }

    // Get REAL-TIME SOL price instead of hardcoded value
    const sol_price = await fetchSOLPrice();

    // Calculate margin ratio using real SOL price
    const max_loss_sol = position.collateral_sol;
    const pnl_sol = pnl_usd / sol_price; // Use real-time SOL price
    let margin_ratio = 0;
    if (pnl_sol < 0) {
      margin_ratio = Math.abs(pnl_sol) / max_loss_sol;
    }

    console.log("📊 P&L Calculation:", {
      token: position.token_symbol,
      price_used: price,
      entry_price: entry_price,
      pnl_usd: pnl_usd,
      sol_price_real_time: sol_price,
      pnl_sol: pnl_sol,
      collateral_sol: max_loss_sol,
      margin_ratio: margin_ratio,
    });

    return {
      pnl: pnl_usd,
      margin_ratio: Math.min(margin_ratio, 1),
    };
  }
}

export const positionService = new PositionService();
