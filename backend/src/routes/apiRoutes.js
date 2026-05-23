// backend/src/routes/apiRoutes.js

const express = require('express');
const router = express.Router();
const { PRReview } = require('../models/PRReview');
const Issue = require('../models/Issue');
const Repository = require('../models/Repository');
const { getQueueStats, getRecentJobs } = require('../queues/reviewQueue');
const { sequelize } = require('../config/database');

// ─── Dashboard Stats ──────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  try {
    const [totalReviews, queueStats] = await Promise.all([
      PRReview.count(),
      getQueueStats(),
    ]);
    
    const avgRiskScore = await PRReview.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('risk_score')), 'avg']],
      where: { status: 'completed' },
      raw: true,
    });
    
    const issuesByType = await Issue.findAll({
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['type'],
      raw: true,
    });

    res.json({
      success: true,
      data: {
        totalReviews,
        avgRiskScore: parseFloat(avgRiskScore?.avg || 0).toFixed(1),
        queue: queueStats,
        issuesByType,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Queue Status (Real-time for Dashboard) ────────────────────────────────

router.get('/queue/status', async (req, res) => {
  try {
    const [stats, recentJobs] = await Promise.all([
      getQueueStats(),
      getRecentJobs(10),
    ]);
    
    res.json({ success: true, data: { stats, recentJobs } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── PR Reviews ───────────────────────────────────────────────────────────

router.get('/reviews', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const { count, rows } = await PRReview.findAndCountAll({
      include: [
        { model: Repository, as: 'repository', attributes: ['owner', 'name'] }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reviews/:id', async (req, res) => {
  try {
    const review = await PRReview.findByPk(req.params.id, {
      include: [
        { model: Issue, as: 'issues' },
        { model: Repository, as: 'repository' },
      ]
    });
    
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }
    
    res.json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Analytics ────────────────────────────────────────────────────────────

router.get('/analytics/by-author', async (req, res) => {
  try {
    // Raw SQL for complex aggregation - Sequelize ORM sometimes makes this messy
    const [results] = await sequelize.query(`
      SELECT 
        pr.author_login,
        COUNT(pr.id) as total_prs,
        AVG(pr.risk_score) as avg_risk_score,
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
    
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/analytics/trends', async (req, res) => {
  try {
    // Issue trends over last 30 days - grouped by day
    const [results] = await sequelize.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as pr_count,
        AVG(risk_score) as avg_risk_score,
        SUM(security_issues_count) as security_issues,
        SUM(performance_issues_count) as performance_issues
      FROM pr_reviews
      WHERE status = 'completed'
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;