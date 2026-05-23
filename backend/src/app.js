const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import configs
const { connectDatabase } = require('./config/database');
const { connectRedis } = require('./config/redis');

// Import models to register them (important for Sequelize)
require('./models/index');

// Import routes
const webhookRoutes = require('./routes/webhookRoutes');
const apiRoutes = require('./routes/apiRoutes');

// Import worker
const { createWorker } = require('./workers/reviewWorker');

const app = express();

// IMPORTANT: /webhook must use raw body parser
// This MUST come before express.json()
app.use('/webhook', express.raw({ type: 'application/json' }));

// All other routes use JSON
app.use(express.json());

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://yourdomain.com'
    : 'http://localhost:3000',
  credentials: true,
}));

app.use(helmet());

// Routes
app.use('/webhook', webhookRoutes);
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    service: 'GitSentinel Backend',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start everything in correct order
const startServer = async () => {
  try {
    console.log('🚀 Starting GitSentinel Backend...\n');

    // 1. Connect Redis (BullMQ needs this first)
    await connectRedis();

    // 2. Connect PostgreSQL
    await connectDatabase();

    // 3. Start the BullMQ Worker
    createWorker();

    // 4. Start HTTP server
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`\n✅ GitSentinel Backend running!`);
      console.log(`   Port: ${PORT}`);
      console.log(`   Webhook: http://localhost:${PORT}/webhook`);
      console.log(`   API: http://localhost:${PORT}/api`);
      console.log(`   Health: http://localhost:${PORT}/health\n`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\nShutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('\nShutting down gracefully...');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Startup failed:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;