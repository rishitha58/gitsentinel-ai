// backend/src/config/redis.js

const { Redis } = require('ioredis');
require('dotenv').config();

// WHY TWO REDIS CONNECTIONS:
// BullMQ requires SEPARATE connections for the Queue and the Worker
// If you use the same connection, BullMQ throws errors
// because Redis connections used for subscribing can't run other commands

const createRedisConnection = () => {
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    
    // These settings make Redis more resilient
    maxRetriesPerRequest: null, // Required by BullMQ
    retryStrategy: (times) => {
      // Exponential backoff: wait longer between each retry
      const delay = Math.min(times * 50, 2000);
      console.log(`Redis retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
    
    lazyConnect: true, // Don't connect until first command
  });
};

// Connection for the Queue (adding jobs)
const queueConnection = createRedisConnection();

// Connection for the Worker (processing jobs)  
const workerConnection = createRedisConnection();

// Connection for general app use (caching, etc.)
const defaultConnection = createRedisConnection();

// Test connection on startup
const connectRedis = async () => {
  try {
    await defaultConnection.connect();
    await defaultConnection.ping();
    console.log('✅ Redis connected successfully');
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.error('Make sure Redis is running: redis-server');
    process.exit(1);
  }
};

module.exports = {
  queueConnection,
  workerConnection,
  defaultConnection,
  connectRedis,
};