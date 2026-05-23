// backend/src/models/Issue.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Each PR Review has MANY Issues
// Storing them in a separate table lets us:
// 1. Query "all security issues across all repos" efficiently
// 2. Track which issues were fixed in follow-up PRs
// 3. Build analytics like "most common issue type per developer"

const Issue = sequelize.define('Issue', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  
  type: {
    type: DataTypes.ENUM('Security', 'Performance', 'Bug', 'Quality'),
    allowNull: false,
  },
  severity: {
    type: DataTypes.ENUM('high', 'medium', 'low'),
    allowNull: false,
  },
  file: {
    type: DataTypes.STRING(500),
  },
  lineNumber: {
    type: DataTypes.INTEGER,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  explanation: {
    type: DataTypes.TEXT,
  },
  suggestedFix: {
    type: DataTypes.TEXT, // The code fix suggestion
  },
  language: {
    type: DataTypes.STRING(50),
  },
  
  // Was this issue auto-fixed by our bot?
  autoFixed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  
  // Foreign key
  prReviewId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  
}, {
  tableName: 'issues',
  indexes: [
    { fields: ['pr_review_id'] },
    { fields: ['type', 'severity'] },
    { fields: ['file'] },
  ],
});

module.exports = Issue;