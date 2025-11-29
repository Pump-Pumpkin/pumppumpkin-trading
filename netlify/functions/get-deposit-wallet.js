const {
  determineWalletForEvent,
  loadLocalEnvIfNeeded,
} = require('../utils/depositWalletHelper');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    loadLocalEnvIfNeeded();
    const detection = await determineWalletForEvent(event);

    return {
      statusCode: 200,
      body: JSON.stringify({
        walletAddress: detection.walletAddress,
        countryCode: detection.countryCode,
        isIsrael: detection.isIsrael,
        detectionSource: detection.lookup?.source,
        detectionReason: detection.lookup?.reason,
        walletList: detection.walletList,
        israelWallet: detection.resolvedIsraelWallet,
        globalWallet: detection.resolvedGlobalWallet,
      }),
    };
  } catch (error) {
    console.error('Error determining deposit wallet:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to determine deposit wallet',
        details: error.message,
      }),
    };
  }
};

