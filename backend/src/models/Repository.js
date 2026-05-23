// backend/src/models/Repository.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Repository = sequelize.define('Repository', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  githubRepoId: {
    type: DataTypes.BIGINT,
    unique: true,
    allowNull: false,
  },
  owner: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  fullName: {
    type: DataTypes.STRING(200), // "owner/name"
    allowNull: false,
  },
  installationId: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  totalPRsAnalyzed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  avgRiskScore: {
    type: DataTypes.DECIMAL(4, 2),
    defaultValue: 0,
  },
}, {
  tableName: 'repositories',
  indexes: [
    { fields: ['owner', 'name'] },
    { fields: ['github_repo_id'] },
  ],
});

module.exports = Repository;