const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { loadLocalEnvIfNeeded } = require('../utils/depositWalletHelper');

const DEFAULT_MIN_DEPOSIT = 20;
const getMinDepositUsd = () => {
  const envValue =
    process.env.ATLOS_MIN_USD ||
    process.env.VITE_ATLOS_MIN_USD ||
    process.env.VITE_PUBLIC_ATLOS_MIN_USD;
  const parsed = Number(envValue);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_MIN_DEPOSIT;
};

const normalizeWallet = (value) =>
  typeof value === 'string' ? value.trim() : '';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON payload' }),
    };
  }

  const walletAddress = normalizeWallet(body.walletAddress);
  const requestedAmount = Number(body.amountUsd);
  const minDepositUsd = getMinDepositUsd();

  if (!walletAddress || walletAddress.length < 32) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'walletAddress is required' }),
    };
  }

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'amountUsd must be a positive number' }),
    };
  }

  loadLocalEnvIfNeeded();

  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const ATLOS_MERCHANT_ID =
    process.env.ATLOS_MERCHANT_ID || process.env.VITE_ATLOS_MERCHANT_ID;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ATLOS_MERCHANT_ID) {
    console.error('Missing Supabase or Atlos configuration');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('wallet_address, is_banned')
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    if (profileError) {
      console.error('Profile lookup failed:', profileError);
      throw new Error('Failed to validate profile');
    }

    if (!profile) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Profile not found. Please create a profile before depositing.',
        }),
      };
    }

    if (profile.is_banned) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: 'This wallet is currently banned from depositing.',
        }),
      };
    }

    const normalizedAmount = Math.max(
      minDepositUsd,
      Number(requestedAmount.toFixed(2))
    );

    const orderId = `PP-${Date.now()}-${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    const metadata = {
      userAgent: event.headers['user-agent'] || null,
      ip:
        event.headers['x-forwarded-for'] ||
        event.headers['client-ip'] ||
        event.headers['x-nf-client-connection-ip'] ||
        null,
    };

    const { error: insertError } = await supabase
      .from('atlos_deposit_orders')
      .insert({
        order_id: orderId,
        wallet_address: walletAddress,
        requested_usd: normalizedAmount,
        asset_symbol: 'USDC',
        status: 'pending',
        metadata,
      });

    if (insertError) {
      console.error('Failed to create Atlos order row:', insertError);
      throw new Error('Unable to create deposit order');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        orderId,
        orderAmount: normalizedAmount,
        merchantId: ATLOS_MERCHANT_ID,
        minDepositUsd,
        assetSymbol: 'USDC',
      }),
    };
  } catch (error) {
    console.error('create-atlos-payment error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
      }),
    };
  }
};

