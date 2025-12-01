const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { loadLocalEnvIfNeeded } = require('../utils/depositWalletHelper');

const SOLANA_MINT = 'So11111111111111111111111111111111111111112';
const DEFAULT_FALLBACK_SOL_PRICE = 150;

const getFallbackSolPrice = () => {
  const envValue =
    process.env.ATLOS_FALLBACK_SOL_PRICE || process.env.FALLBACK_SOL_PRICE;
  const parsed = Number(envValue);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_FALLBACK_SOL_PRICE;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const fetchSolPrice = async () => {
  const apiKey =
    process.env.BIRDEYE_API_KEY || process.env.VITE_BIRDEYE_API_KEY || '';

  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://public-api.birdeye.so/public/price?address=${SOLANA_MINT}`,
      {
        headers: {
          'X-API-KEY': apiKey,
          accept: 'application/json',
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(`Birdeye responded with ${response.status}`);
    }

    const payload = await response.json();
    const price = payload?.data?.price;
    const parsed = Number(price);
    return Number.isFinite(parsed) ? parsed : null;
  } catch (error) {
    console.warn('Failed to fetch SOL price from Birdeye:', error.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const verifySignature = (apiSecret, rawBody, incomingSignature) => {
  if (!incomingSignature) {
    return false;
  }

  const computed = crypto
    .createHmac('sha256', apiSecret)
    .update(rawBody || '')
    .digest('base64');

  return computed === incomingSignature;
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  loadLocalEnvIfNeeded();

  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const ATLOS_API_SECRET = process.env.ATLOS_API_SECRET;
  const ATLOS_MERCHANT_ID =
    process.env.ATLOS_MERCHANT_ID || process.env.VITE_ATLOS_MERCHANT_ID;

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !ATLOS_API_SECRET ||
    !ATLOS_MERCHANT_ID
  ) {
    console.error('Missing Atlos or Supabase configuration');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  const signatureHeader =
    event.headers['signature'] || event.headers['Signature'];
  if (!verifySignature(ATLOS_API_SECRET, event.body || '', signatureHeader)) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid signature' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON payload' }),
    };
  }

  const orderId = payload?.OrderId;
  if (!orderId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'OrderId is required' }),
    };
  }

  if (payload?.MerchantId && payload.MerchantId !== ATLOS_MERCHANT_ID) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Merchant ID does not match' }),
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: order, error: orderError } = await supabase
      .from('atlos_deposit_orders')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (orderError) {
      console.error('Failed to fetch deposit order:', orderError);
      throw new Error('Unable to load deposit order');
    }

    if (!order) {
      console.warn('No pending order found for', orderId);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Deposit order not found' }),
      };
    }

    const statusCode = Number(payload?.Status);
    if (statusCode !== 100) {
      const statusLabel =
        statusCode === 10
          ? 'awaiting_settlement'
          : statusCode === 59 || statusCode === 55
          ? 'failed'
          : order.status;

      await supabase
        .from('atlos_deposit_orders')
        .update({
          status: statusLabel,
          metadata: payload,
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Order status recorded',
        }),
      };
    }

    if (order.status === 'completed') {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Already processed' }),
      };
    }

    const paidUsd = toNumber(
      payload?.PaidAmount ?? payload?.Amount ?? order.requested_usd,
      order.requested_usd
    );
    if (paidUsd <= 0) {
      throw new Error('Paid amount missing from payload');
    }

    const solPrice = (await fetchSolPrice()) ?? getFallbackSolPrice();
    if (!solPrice || solPrice <= 0) {
      throw new Error('Unable to resolve SOL price for crediting');
    }

    const creditedSol = Number((paidUsd / solPrice).toFixed(8));
    if (!Number.isFinite(creditedSol) || creditedSol <= 0) {
      throw new Error('Calculated SOL credit is invalid');
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('sol_balance')
      .eq('wallet_address', order.wallet_address)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('Profile lookup failed:', profileError);
      throw new Error('User profile not found for crediting');
    }

    const newBalance = Number(profile.sol_balance || 0) + creditedSol;

    const updateProfile = await supabase
      .from('user_profiles')
      .update({
        sol_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', order.wallet_address);

    if (updateProfile.error) {
      throw new Error('Failed to update user balance');
    }

    const depositPayload = {
      wallet_address: order.wallet_address,
      amount: creditedSol,
      status: 'completed',
      asset_symbol: payload?.Asset || order.asset_symbol || 'USDC',
      fiat_amount_usd: paidUsd,
      order_id: order.order_id,
      payment_id: payload?.TransactionId || order.payment_id,
      txid: payload?.BlockchainHash || order.tx_hash,
      verification_source: 'atlos-postback',
      metadata: payload,
    };

    const insertDeposit = await supabase
      .from('deposit_transactions')
      .insert(depositPayload);

    if (insertDeposit.error) {
      console.error('Failed to insert deposit transaction:', insertDeposit.error);
    }

    const updatedOrder = {
      status: 'completed',
      transaction_id: payload?.TransactionId || order.transaction_id,
      payment_id: payload?.TransactionId || order.payment_id,
      tx_hash: payload?.BlockchainHash || order.tx_hash,
      paid_usd: paidUsd,
      paid_asset_amount: toNumber(payload?.Amount, order.requested_usd),
      paid_asset_symbol: payload?.Asset || order.asset_symbol || 'USDC',
      credited_sol: creditedSol,
      verification_source: 'atlos-postback',
      metadata: payload,
      updated_at: new Date().toISOString(),
    };

    const orderUpdate = await supabase
      .from('atlos_deposit_orders')
      .update(updatedOrder)
      .eq('order_id', orderId);

    if (orderUpdate.error) {
      console.error('Failed to update deposit order row:', orderUpdate.error);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        orderId,
        creditedSol,
        newBalance,
      }),
    };
  } catch (error) {
    console.error('atlos-postback error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
      }),
    };
  }
};


