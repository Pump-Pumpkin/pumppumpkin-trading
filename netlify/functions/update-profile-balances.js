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

    const { walletAddress, solBalance, usdBalance, reason } = payload || {};

    if (!walletAddress || typeof walletAddress !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'walletAddress is required' }),
      };
    }

    if (solBalance === undefined && usdBalance === undefined) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Provide at least one of solBalance or usdBalance to update',
        }),
      };
    }

    loadLocalEnvIfNeeded();

    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase configuration for profile update');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (solBalance !== undefined) {
      const parsedSol = Number(solBalance);
      if (!Number.isFinite(parsedSol)) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'solBalance must be a valid number' }),
        };
      }
      updates.sol_balance = parsedSol;
    }

    if (usdBalance !== undefined) {
      const parsedUsd = Number(usdBalance);
      if (!Number.isFinite(parsedUsd)) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'usdBalance must be a valid number' }),
        };
      }
      updates.balance = parsedUsd;
    }

    const { data: profile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    if (fetchError) {
      console.error('Error verifying user profile before update:', fetchError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to verify profile existence' }),
      };
    }

    if (!profile) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User profile not found' }),
      };
    }

    const { data: updateResult, error: updateError } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('wallet_address', walletAddress)
      .select('wallet_address, balance, sol_balance')
      .maybeSingle();

    if (updateError) {
      console.error('Error updating profile balances:', updateError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to update profile balances' }),
      };
    }

    if (!updateResult) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Profile update returned no data' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        walletAddress,
        balance: updateResult.balance,
        solBalance: updateResult.sol_balance,
        reason: reason || null,
      }),
    };
  } catch (error) {
    console.error('Error in update-profile-balances:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message,
      }),
    };
  }
};


