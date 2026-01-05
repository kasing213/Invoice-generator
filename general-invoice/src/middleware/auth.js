/**
 * API Key Authentication Middleware
 * Validates X-API-KEY header against configured API keys
 */
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required. Provide X-API-KEY header or apiKey query parameter.'
    });
  }

  // Get valid API keys from environment
  const validKeys = (process.env.API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);

  if (validKeys.length === 0) {
    console.warn('Warning: No API_KEYS configured in environment');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error: No API keys configured'
    });
  }

  if (!validKeys.includes(apiKey)) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }

  next();
};

module.exports = { apiKeyAuth };
