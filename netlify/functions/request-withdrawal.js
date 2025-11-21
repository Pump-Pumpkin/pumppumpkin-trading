const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

let didLoadLocalEnv = false;

function loadLocalEnvIfNeeded() {
  if (didLoadLocalEnv) {
    return;
  }

  const requiredKeys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = requiredKeys.filter((key) => !process.env[key]);

  if (missing.length === 0) {
    didLoadLocalEnv = true;
    return;
  }

  try {
    const envPath = path.resolve(__dirname, '..', '..', 'netlify-env-vars.txt');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [key, ...rest] = trimmed.split('=');
        const value = rest.join('=');
        if (key && value !== undefined && !process.env[key]) {
          process.env[key] = value;
        }
      });
    }
  } catch (error) {
    console.warn('Unable to load local Netlify env vars:', error);
  } finally {
    didLoadLocalEnv = true;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON payload' }),
      };
    }

    const { walletAddress, amount } = payload || {};

    if (!walletAddress || typeof walletAddress !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'walletAddress is required' }),
      };
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Withdrawal amount must be a positive number' }),
      };
    }

    if (parsedAmount < 0.04) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Minimum withdrawal is 0.04 SOL' }),
      };
    }

    loadLocalEnvIfNeeded();

    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase configuration for withdrawals');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('wallet_address, sol_balance')
      .eq('wallet_address', walletAddress)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found for withdrawal:', walletAddress, profileError);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'User profile not found' }),
      };
    }

    const { data: pendingRequests, error: pendingError } = await supabase
      .from('withdrawal_requests')
      .select('id')
      .eq('wallet_address', walletAddress)
      .eq('status', 'pending')
      .limit(1);

    if (pendingError) {
      console.error('Error checking pending withdrawals:', pendingError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to validate pending withdrawals' }),
      };
    }

    if (pendingRequests && pendingRequests.length > 0) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          error: 'You already have a pending withdrawal request. Please wait for it to be processed.',
        }),
      };
    }

    const { data: latestDeposit, error: depositError } = await supabase
      .from('deposit_transactions')
      .select('created_at')
      .eq('wallet_address', walletAddress)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (depositError) {
      console.error('Error fetching latest deposit:', depositError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to validate deposit history' }),
      };
    }

    const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
    if (latestDeposit?.created_at) {
      const depositTime = new Date(latestDeposit.created_at).getTime();
      if (!Number.isNaN(depositTime)) {
        const elapsed = Date.now() - depositTime;
        if (elapsed < THREE_MONTHS_MS) {
          const daysLeft = Math.ceil(
            (THREE_MONTHS_MS - elapsed) / (24 * 60 * 60 * 1000)
          );
          return {
            statusCode: 403,
            body: JSON.stringify({
              error: `Withdrawals are locked for approximately ${daysLeft} more day(s) after your most recent deposit.`,
            }),
          };
        }
      }
    }

    const { data: activePositions, error: positionsError } = await supabase
      .from('trading_positions')
      .select('collateral_sol')
      .eq('wallet_address', walletAddress)
      .in('status', ['pending', 'opening', 'open', 'closing']);

    if (positionsError) {
      console.error('Error fetching active positions:', positionsError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to validate trading positions' }),
      };
    }

    const lockedCollateral =
      (activePositions || []).reduce(
        (total, position) => total + Number(position.collateral_sol || 0),
        0
      );

    const currentBalance = Number(profile.sol_balance || 0);
    const availableBalance = currentBalance - lockedCollateral;

    if (availableBalance < parsedAmount) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Insufficient available balance. You have ${availableBalance.toFixed(
            4
          )} SOL available for withdrawal.`,
        }),
      };
    }

    const newBalance = currentBalance - parsedAmount;

    const { data: withdrawalRequest, error: insertError } = await supabase
      .from('withdrawal_requests')
      .insert({
        wallet_address: walletAddress,
        amount: parsedAmount,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating withdrawal request:', insertError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to create withdrawal request' }),
      };
    }

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        sol_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', walletAddress);

    if (updateError) {
      console.error('Error updating SOL balance after withdrawal:', updateError);
      await supabase
        .from('withdrawal_requests')
        .delete()
        .eq('id', withdrawalRequest.id);

      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to update balance after withdrawal' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Withdrawal request submitted for ${parsedAmount.toFixed(4)} SOL.`,
        newBalance,
        request: withdrawalRequest,
        availableBalanceBefore: availableBalance,
        lockedCollateral,
      }),
    };
  } catch (error) {
    console.error('Error in request-withdrawal:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message,
      }),
    };
  }
};


