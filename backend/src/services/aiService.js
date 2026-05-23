const axios = require('axios');
require('dotenv').config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const analyzeDiff = async (diff, prData) => {
  console.log(`🤖 Sending diff to AI service...`);
  console.log(`   Size: ${diff.length} characters`);

  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/api/v1/analyze`,
      {
        diff: diff,
        prData: {
          prTitle: prData.prTitle,
          prNumber: prData.prNumber,
          repoOwner: prData.repoOwner,
          repoName: prData.repoName,
          authorLogin: prData.authorLogin,
          prUrl: prData.prUrl,
        },
      },
      {
        timeout: 120000, // 2 minutes - LLM calls are slow
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Received AI analysis response');
    return response.data;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ AI service not running! Start it first.');
    } else if (error.code === 'ECONNABORTED') {
      console.error('❌ AI service timed out');
    } else {
      console.error('❌ AI service error:', error.response?.data || error.message);
    }

    // Return safe fallback so the rest of the flow continues
    return {
      prSummary: 'AI analysis temporarily unavailable.',
      riskScore: 0,
      issues: [],
      securityIssues: 0,
      performanceIssues: 0,
      qualityIssues: 0,
      passedChecks: 0,
      filesAnalyzed: 0,
    };
  }
};

module.exports = { analyzeDiff };