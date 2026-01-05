const cors = require('cors');

/**
 * CORS Configuration
 * Allows requests from configured origins
 */
const getCorsOptions = () => {
  const allowedOrigins = [
    'https://facebook-tiktok-automation.vercel.app'
  ];

  // Add any additional origins from environment
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    envOrigins.split(',').forEach(origin => {
      const trimmed = origin.trim();
      if (trimmed && !allowedOrigins.includes(trimmed)) {
        allowedOrigins.push(trimmed);
      }
    });
  }

  // In development, allow localhost
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000');
    allowedOrigins.push('http://localhost:3001');
    allowedOrigins.push('http://127.0.0.1:3000');
    allowedOrigins.push('http://127.0.0.1:3001');
  }

  return {
    origin: function(origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-API-KEY', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
  };
};

module.exports = cors(getCorsOptions());
