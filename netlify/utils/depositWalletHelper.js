const fs = require('fs');
const path = require('path');

const DEFAULT_ISRAEL_WALLET = 'CTDZ5teoWajqVcAsWQyEmmvHQzaDiV1jrnvwRmcL1iWv';
const DEFAULT_GLOBAL_WALLET = 'BKknmxoHFWiBXY1DsYn2Df1LRWQGcvCckcLEsnGhRcwg';

let didLoadLocalEnv = false;

function loadLocalEnvIfNeeded() {
  if (didLoadLocalEnv) {
    return;
  }

  const candidatePaths = [
    path.resolve(__dirname, '..', 'netlify-env-vars.txt'),
    path.resolve(__dirname, '..', '..', 'netlify-env-vars.txt'),
    path.resolve(process.cwd(), 'netlify-env-vars.txt'),
  ];

  try {
    for (const envPath of candidatePaths) {
      if (!fs.existsSync(envPath)) {
        continue;
      }

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

      break;
    }
  } catch (error) {
    console.warn('Unable to load local Netlify env vars:', error);
  } finally {
    didLoadLocalEnv = true;
  }
}

function getConfiguredWallets() {
  loadLocalEnvIfNeeded();
  const israelWallet =
    process.env.PLATFORM_WALLET ||
    process.env.VITE_PLATFORM_WALLET ||
    DEFAULT_ISRAEL_WALLET;
  const configuredInternational =
    process.env.GLOBAL_PLATFORM_WALLET ||
    process.env.VITE_GLOBAL_PLATFORM_WALLET ||
    DEFAULT_GLOBAL_WALLET;
  const internationalWallet = configuredInternational || israelWallet;
  const walletList = Array.from(
    new Set([israelWallet, internationalWallet].filter(Boolean))
  );

  return {
    israelWallet,
    internationalWallet,
    walletList,
  };
}

function extractClientIp(event) {
  const headers = (event && event.headers) || {};
  const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
  const nfClientIp =
    headers['x-nf-client-connection-ip'] ||
    headers['X-Nf-Client-Connection-Ip'];
  const clientIp = headers['client-ip'] || headers['Client-Ip'];
  const requestContextIp =
    event?.requestContext?.identity?.sourceIp ||
    event?.requestContext?.http?.sourceIp;

  const ipCandidate =
    (forwarded && forwarded.split(',')[0].trim()) ||
    nfClientIp ||
    clientIp ||
    requestContextIp ||
    null;

  return ipCandidate;
}

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  const firstOctet = parseInt(ip.split('.')[0], 10);
  if (firstOctet === 172) {
    const secondOctet = parseInt(ip.split('.')[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  return false;
}

async function lookupCountryByIp(ip) {
  if (!ip || isPrivateIp(ip)) {
    return {
      countryCode: 'IL',
      source: 'fallback',
      reason: 'private-or-missing-ip',
      isFallback: true,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Geo lookup failed with status ${response.status}`);
    }

    const data = await response.json();
    const code = data?.country_code ? String(data.country_code).toUpperCase() : null;

    return {
      countryCode: code,
      source: 'ipapi',
      reason: 'lookup-success',
      raw: data,
    };
  } catch (error) {
    return {
      countryCode: null,
      source: 'ipapi',
      reason: 'lookup-error',
      error: error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function determineWalletForEvent(event) {
  const { israelWallet, internationalWallet, walletList } = getConfiguredWallets();
  const ip = extractClientIp(event);
  const lookup = await lookupCountryByIp(ip);
  const countryCode = lookup.countryCode || null;
  const isIsrael = countryCode === 'IL';
  const walletAddress = isIsrael ? israelWallet : internationalWallet;

  return {
    walletAddress,
    isIsrael,
    countryCode,
    lookup,
    walletList,
    resolvedIsraelWallet: israelWallet,
    resolvedGlobalWallet: internationalWallet,
  };
}

module.exports = {
  DEFAULT_ISRAEL_WALLET,
  DEFAULT_GLOBAL_WALLET,
  loadLocalEnvIfNeeded,
  getConfiguredWallets,
  extractClientIp,
  lookupCountryByIp,
  determineWalletForEvent,
};

