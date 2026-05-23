// backend/src/models/PRReview.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// WHY ENUM FOR STATUS:
// A PR review can only be in one of these specific states
// Using an enum prevents typos and makes queries faster
const REVIEW_STATUS = {
  QUEUED: 'queued',       // Job added to BullMQ, not started
  PROCESSING: 'processing', // Worker picked it up
  COMPLETED: 'completed',   // AI analysis done, comments posted
  FAILED: 'failed',         // Something went wrong
  SKIPPED: 'skipped',      // PR was closed before we could analyze
};

const PRReview = sequelize.define('PRReview', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  
  // GitHub identifiers
  prNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  prTitle: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  prUrl: {
    type: DataTypes.STRING(500),
  },
  authorLogin: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  headSha: {
    type: DataTypes.STRING(40), // Git SHA is always 40 chars
    allowNull: false,
  },
  
  // BullMQ job tracking
  bullmqJobId: {
    type: DataTypes.STRING(100), // BullMQ job ID for tracking
  },
  status: {
    type: DataTypes.ENUM(...Object.values(REVIEW_STATUS)),
    defaultValue: REVIEW_STATUS.QUEUED,
    allowNull: false,
  },
  
  // AI Analysis results
  prSummary: {
    type: DataTypes.TEXT,
  },
  riskScore: {
    type: DataTypes.INTEGER, // 0-10
    validate: { min: 0, max: 10 },
  },
  filesAnalyzed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  securityIssuesCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  performanceIssuesCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  qualityIssuesCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  
  // Performance tracking
  queuedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  processingStartedAt: {
    type: DataTypes.DATE,
  },
  completedAt: {
    type: DataTypes.DATE,
  },
  processingTimeMs: {
    type: DataTypes.INTEGER, // How long the AI took in milliseconds
  },
  
  // Error tracking
  errorMessage: {
    type: DataTypes.TEXT,
  },
  retryCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  
  // Foreign key (set up in associations)
  repositoryId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  
}, {
  tableName: 'pr_reviews',
  indexes: [
    { fields: ['repository_id', 'created_at'] },
    { fields: ['author_login'] },
    { fields: ['status'] },
    { fields: ['bullmq_job_id'] },
    { fields: ['risk_score'] },
  ],
});

module.exports = { PRReview, REVIEW_STATUS };