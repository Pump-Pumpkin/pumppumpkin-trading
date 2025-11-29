const { createClient } = require('@supabase/supabase-js');
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const {
  determineWalletForEvent,
  loadLocalEnvIfNeeded,
} = require('../utils/depositWalletHelper');

// Serverless function to verify SOL deposits on-chain and credit user balance
exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { walletAddress, amount, txid, targetWallet } = JSON.parse(event.body);

    // Validate inputs
    if (!walletAddress || !amount || !txid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: walletAddress, amount, txid' }),
      };
    }

    if (amount < 0.04) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Minimum deposit is 0.04 SOL' }),
      };
    }

    // Environment variables (set in Netlify dashboard)
    loadLocalEnvIfNeeded();

    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    const SOLANA_RPC_URL =
      process.env.QUICKNODE_RPC ||
      process.env.SOLANA_RPC_URL ||
      process.env.VITE_SOLANA_RPC_URL ||
      'https://api.mainnet-beta.solana.com';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase env vars');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    // Initialize Supabase with service role key (server-side only)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if this txid was already processed (idempotency)
    const { data: existingDeposit } = await supabase
      .from('deposit_transactions')
      .select('id')
      .eq('txid', txid)
      .maybeSingle();

    if (existingDeposit) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Deposit already processed',
          alreadyProcessed: true,
        }),
      };
    }

    // Verify on-chain transaction
    console.log(`Verifying tx: ${txid} for ${walletAddress}`);
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    let tx;
    try {
      tx = await connection.getTransaction(txid, {
        maxSupportedTransactionVersion: 0,
      });
    } catch (err) {
      console.error('Error fetching transaction:', err);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Transaction not found or not confirmed' }),
      };
    }

    if (!tx || tx.meta?.err) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Transaction failed or not found' }),
      };
    }

    const detection = await determineWalletForEvent(event);
    const allowedWallets = Array.from(
      new Set(
        [
          ...(detection.walletList || []),
          detection.resolvedIsraelWallet,
          detection.resolvedGlobalWallet,
        ].filter(Boolean)
      )
    );

    if (targetWallet && !allowedWallets.includes(targetWallet)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid target wallet specified' }),
      };
    }

    let platformWalletToVerify = detection.walletAddress;

    if (targetWallet) {
      platformWalletToVerify = targetWallet;

      if (targetWallet !== detection.walletAddress) {
        console.warn(
          'Target wallet mismatch with geo detection (using client override)',
          JSON.stringify({
            detectedWallet: detection.walletAddress,
            providedWallet: targetWallet,
            countryCode: detection.countryCode,
          })
        );
      }
    } else if (!detection.countryCode && allowedWallets.length) {
      platformWalletToVerify = allowedWallets[0];
    }

    const platformPubkey = new PublicKey(platformWalletToVerify);
    const userPubkey = new PublicKey(walletAddress);

    // Check pre/post balances to confirm transfer
    const accountKeys = tx.transaction.message.getAccountKeys();
    const lookupKeys = accountKeys.lookupTableAccountKeys ?? [];
    const combinedKeys = accountKeys.staticAccountKeys.concat(lookupKeys);

    const platformIndex = combinedKeys.findIndex((key) =>
      key.equals(platformPubkey)
    );
    const userIndex = combinedKeys.findIndex((key) => key.equals(userPubkey));

    if (platformIndex === -1 || userIndex === -1) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Transaction does not involve the correct wallets' }),
      };
    }

    const preBalances = tx.meta.preBalances;
    const postBalances = tx.meta.postBalances;

    const platformReceived =
      (postBalances[platformIndex] - preBalances[platformIndex]) /
      LAMPORTS_PER_SOL;
    const userSent =
      (preBalances[userIndex] - postBalances[userIndex]) / LAMPORTS_PER_SOL;

    console.log(
      `Platform received: ${platformReceived} SOL, User sent: ${userSent} SOL`
    );

    let platformSatisfied = platformReceived >= amount * 0.99;
    let userSatisfied = userSent >= amount * 0.99;

    if (!platformSatisfied || !userSatisfied) {
      console.warn(
        "Primary balance check failed, running parsed instruction fallback..."
      );
      const parsedTx = await connection.getParsedTransaction(txid, {
        maxSupportedTransactionVersion: 0,
      });

      if (parsedTx?.transaction?.message?.instructions?.length) {
        const fallbackLamports = parsedTx.transaction.message.instructions
          .filter(
            (ix) =>
              ix.program === "system" &&
              ix.parsed?.type === "transfer" &&
              ix.parsed?.info?.destination === platformWalletToVerify
          )
          .reduce((sum, ix) => {
            const lamports = Number(ix.parsed?.info?.lamports ?? 0);
            return sum + (Number.isFinite(lamports) ? lamports : 0);
          }, 0);

        if (fallbackLamports > 0) {
          const fallbackSOL = fallbackLamports / LAMPORTS_PER_SOL;
          console.log(
            `Fallback parser detected ${fallbackSOL} SOL transferred to ${platformWalletToVerify}`
          );
          platformSatisfied = fallbackSOL >= amount * 0.99;
          userSatisfied = true;
        }
      }
    }

    if (!platformSatisfied || !userSatisfied) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Amount mismatch. Expected ~${amount} SOL (platform saw ${platformReceived.toFixed(
            4
          )} SOL, user ${userSent.toFixed(4)} SOL)`,
        }),
      };
    }

    // All checks passed - credit the user
    console.log(`✅ Verified deposit: ${amount} SOL from ${walletAddress}`);

    // Get current balance
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('sol_balance')
      .eq('wallet_address', walletAddress)
      .single();

    if (!profile) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'User profile not found' }),
      };
    }

    const newBalance = (profile.sol_balance || 0) + amount;

    // Update balance
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ sol_balance: newBalance })
      .eq('wallet_address', walletAddress);

    if (updateError) {
      console.error('Error updating balance:', updateError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to update balance' }),
      };
    }

    // Create deposit record
    const { error: depositError } = await supabase
      .from('deposit_transactions')
      .insert({
        wallet_address: walletAddress,
        amount: amount,
        status: 'completed',
        txid: txid,
        is_verified: true,
        platform_wallet: platformWalletToVerify,
      });

    if (depositError) {
      console.error('Error creating deposit record:', depositError);
      // Balance was updated, so don't fail - just log
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Deposit verified and credited',
        newBalance: newBalance,
        amount: amount,
        platformWallet: platformWalletToVerify,
        countryCode: detection.countryCode,
      }),
    };
  } catch (error) {
    console.error('Error in verify-deposit:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: error.message }),
    };
  }
};


