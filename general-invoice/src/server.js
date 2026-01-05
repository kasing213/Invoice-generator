require('dotenv').config({ path: '.env.general' });

const express = require('express');
const connectDB = require('./config/db');
const corsMiddleware = require('./middleware/cors');
const { apiKeyAuth } = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (for deployment behind reverse proxy)
app.set('trust proxy', 1);

// Global middleware
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'general-invoice-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API info endpoint (no auth required)
app.get('/', (req, res) => {
  res.json({
    name: 'General Invoice API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      invoices: {
        create: 'POST /api/invoices',
        list: 'GET /api/invoices',
        get: 'GET /api/invoices/:id',
        update: 'PUT /api/invoices/:id',
        delete: 'DELETE /api/invoices/:id',
        updateStatus: 'PATCH /api/invoices/:id/status',
        pdf: 'GET /api/invoices/:id/pdf'
      },
      export: {
        excel: 'GET /api/export/excel',
        csv: 'GET /api/export/csv'
      }
    },
    documentation: 'Provide X-API-KEY header for authenticated endpoints'
  });
});

// API routes (auth required)
app.use('/api', apiKeyAuth, routes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`
========================================
  General Invoice API
========================================
  Environment: ${process.env.NODE_ENV || 'development'}
  Port: ${PORT}
  Health: http://localhost:${PORT}/health
========================================
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  try {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();
