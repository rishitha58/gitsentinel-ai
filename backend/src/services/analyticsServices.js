const { sequelize } = require('../config/database');
const { PRReview, REVIEW_STATUS } = require('../models/PRReview');
const Issue = require('../models/Issue');
const Repository = require('../models/Repository');

const getDashboardStats = async () => {
  const totalReviews = await PRReview.count();

  const last30Days = await PRReview.count({
    where: {
      createdAt: {
        [require('sequelize').Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  const avgRiskScoreResult = await PRReview.findOne({
    attributes: [[sequelize.fn('AVG', sequelize.col('risk_score')), 'avg']],
    where: { status: REVIEW_STATUS.COMPLETED },
    raw: true,
  });

  const issuesByType = await Issue.findAll({
    attributes: [
      'type',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    group: ['type'],
    raw: true,
  });

  return {
    totalReviews,
    last30Days,
    avgRiskScore: parseFloat(avgRiskScoreResult?.avg || 0).toFixed(1),
    issuesByType,
  };
};

const getAnalyticsByAuthor = async () => {
  const [results] = await sequelize.query(`
    SELECT 
      pr.author_login,
      COUNT(pr.id) as total_prs,
      ROUND(AVG(pr.risk_score), 2) as avg_risk_score,
      SUM(pr.security_issues_count) as total_security_issues,
      SUM(pr.performance_issues_count) as total_performance_issues,
      SUM(pr.quality_issues_count) as total_quality_issues
    FROM pr_reviews pr
    WHERE pr.status = 'completed'
      AND pr.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY pr.author_login
    ORDER BY avg_risk_score DESC
    LIMIT 20
  `);

  return results;
};

const getTrends = async () => {
  const [results] = await sequelize.query(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as pr_count,
      ROUND(AVG(risk_score), 2) as avg_risk_score,
      SUM(security_issues_count) as security_issues,
      SUM(performance_issues_count) as performance_issues,
      SUM(quality_issues_count) as quality_issues
    FROM pr_reviews
    WHERE status = 'completed'
      AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `);

  return results;
};

module.exports = {
  getDashboardStats,
  getAnalyticsByAuthor,
  getTrends,
};