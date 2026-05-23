// backend/src/config/database.js

const { Sequelize } = require('sequelize');
require('dotenv').config();

// WHY POSTGRESQL INSTEAD OF MONGODB:
// Relational data like "which repo has which PRs, which PRs have which issues"
// is naturally relational - PostgreSQL handles JOINs efficiently
// You can ask: "Show me all high severity security issues from repos 
// owned by developers who have submitted more than 10 PRs" 
// in a single SQL query. MongoDB struggles with this.

const sequelize = new Sequelize(
  process.env.POSTGRES_DB,
  process.env.POSTGRES_USER, 
  process.env.POSTGRES_PASSWORD,
  {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    dialect: 'postgres',
    
    logging: process.env.NODE_ENV === 'development' 
      ? (sql) => console.log(`📊 SQL: ${sql}`)  // Show SQL in dev
      : false,                                    // Hide in production
    
    pool: {
      max: 10,      // Maximum connections in pool
      min: 2,       // Minimum connections always open
      acquire: 30000, // Max time to get a connection (ms)
      idle: 10000,   // Close connection if idle for 10 seconds
    },
    
    define: {
      timestamps: true,        // Auto-add createdAt, updatedAt
      underscored: true,       // Use snake_case column names
      freezeTableName: false,  // Auto-pluralize table names
    },
  }
);

const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connected successfully');
    
    // In development, sync models to DB
    // WARNING: Never use force:true in production - it DROPS tables
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true }); // Updates schema without losing data
      console.log('✅ Database models synchronized');
    }
    
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    console.error('Make sure PostgreSQL is running and credentials are correct');
    process.exit(1);
  }
};

module.exports = { sequelize, connectDatabase };