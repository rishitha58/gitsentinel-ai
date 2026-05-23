const { PRReview, REVIEW_STATUS } = require('../models/PRReview');
const Issue = require('../models/Issue');
const Repository = require('../models/Repository');
const analyticsService = require('../services/analyticsService');
const { getQueueStats, getRecentJobs } = require('../queues/reviewQueue');

const getStats = async (req, res) => {
  try {
    const [stats, queueStats] = await Promise.all([
      analyticsService.getDashboardStats(),
      getQueueStats(),
    ]);

    res.json({
      success: true,
      data: { ...stats, queue: queueStats },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await PRReview.findAndCountAll({
      include: [
        {
          model: Repository,
          as: 'repository',
          attributes: ['owner', 'name', 'fullName'],
        },
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
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getReviewById = async (req, res) => {
  try {
    const review = await PRReview.findByPk(req.params.id, {
      include: [
        { model: Issue, as: 'issues' },
        {
          model: Repository,
          as: 'repository',
          attributes: ['owner', 'name', 'fullName'],
        },
      ],
    });

    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    res.json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getQueueStatus = async (req, res) => {
  try {
    const [stats, recentJobs] = await Promise.all([
      getQueueStats(),
      getRecentJobs(10),
    ]);

    res.json({ success: true, data: { stats, recentJobs } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getAnalyticsByAuthor = async (req, res) => {
  try {
    const data = await analyticsService.getAnalyticsByAuthor();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getTrends = async (req, res) => {
  try {
    const data = await analyticsService.getTrends();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getStats,
  getReviews,
  getReviewById,
  getQueueStatus,
  getAnalyticsByAuthor,
  getTrends,
};