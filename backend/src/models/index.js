// backend/src/models/index.js
// SET UP ASSOCIATIONS BETWEEN MODELS

const Repository = require('./Repository');
const { PRReview } = require('./PRReview');
const Issue = require('./Issue');

// One Repository → Many PRReviews
Repository.hasMany(PRReview, {
  foreignKey: 'repositoryId',
  as: 'reviews',
  onDelete: 'CASCADE',
});
PRReview.belongsTo(Repository, {
  foreignKey: 'repositoryId',
  as: 'repository',
});

// One PRReview → Many Issues
PRReview.hasMany(Issue, {
  foreignKey: 'prReviewId',
  as: 'issues',
  onDelete: 'CASCADE',
});
Issue.belongsTo(PRReview, {
  foreignKey: 'prReviewId',
  as: 'prReview',
});

module.exports = { Repository, PRReview, Issue };