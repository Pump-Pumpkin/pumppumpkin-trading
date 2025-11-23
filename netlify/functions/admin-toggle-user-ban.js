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

function isAuthorized(event) {
  const header =
    event.headers.authorization ||
    event.headers.Authorization ||
    event.headers['x-admin-auth'];

  if (!header) {
    return { ok: false, message: 'Missing Authorization header' };
  }

  let encoded = header;
  if (header.startsWith('Basic ')) {
    encoded = header.slice(6).trim();
  }

  let decoded;
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  } catch (error) {
    return { ok: false, message: 'Invalid Authorization header' };
  }

  const [username, password] = decoded.split(':');
  const expectedUsername =
    process.env.ADMIN_USERNAME || process.env.VITE_ADMIN_USERNAME || 'kingos69';
  const expectedPassword =
    process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || 'tnt007tnt007';

  if (username !== expectedUsername || password !== expectedPassword) {
    return { ok: false, message: 'Invalid admin credentials' };
  }

  return { ok: true };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const auth = isAuthorized(event);
  if (!auth.ok) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: auth.message }),
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

  const { walletAddress, isBanned } = payload || {};

  if (!walletAddress || typeof walletAddress !== 'string') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'walletAddress is required' }),
    };
  }

  if (typeof isBanned !== 'boolean') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'isBanned boolean is required' }),
    };
  }

  loadLocalEnvIfNeeded();

  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase configuration for admin toggle ban');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: profile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('wallet_address, is_banned')
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    if (fetchError) {
      console.error('Error verifying user before ban toggle:', fetchError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to verify user profile' }),
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
      .update({
        is_banned: isBanned,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', walletAddress)
      .select('wallet_address, is_banned, updated_at')
      .maybeSingle();

    if (updateError) {
      console.error('Error toggling user ban:', updateError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to update ban status' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        walletAddress: updateResult.wallet_address,
        isBanned: updateResult.is_banned,
        updatedAt: updateResult.updated_at,
      }),
    };
  } catch (error) {
    console.error('Unexpected error in admin-toggle-user-ban:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message,
      }),
    };
  }
};


