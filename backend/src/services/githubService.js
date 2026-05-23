const { App } = require('@octokit/app');
const fs = require('fs');
require('dotenv').config();

let githubApp;

const getGithubApp = () => {
  if (!githubApp) {
    githubApp = new App({
      appId: process.env.GITHUB_APP_ID,
      privateKey: fs.readFileSync(
        process.env.GITHUB_APP_PRIVATE_KEY_PATH,
        'utf8'
      ),
      webhooks: {
        secret: process.env.GITHUB_WEBHOOK_SECRET,
      },
    });
  }

  return githubApp;
};

const getOctokitForInstallation = async (installationId) => {
  const app = getGithubApp();

  // THIS matches YOUR installed package versions
  return await app.getInstallationOctokit(installationId);
};

// =========================================
// POST PENDING STATUS
// =========================================

const postPendingStatus = async (prData) => {
  try {
    const octokit =
      await getOctokitForInstallation(
        prData.installationId
      );

    await octokit.request(
      'POST /repos/{owner}/{repo}/statuses/{sha}',
      {
        owner: prData.repoOwner,
        repo: prData.repoName,
        sha: prData.headSha,
        state: 'pending',
        description:
          'GitSentinel AI is analyzing your code...',
        context: 'GitSentinel AI Review',
      }
    );

    console.log(
      '✅ Posted pending status to GitHub'
    );
  } catch (error) {
    console.error(
      'Error posting pending status:',
      error.message
    );
  }
};

// =========================================
// FETCH PR DIFF
// =========================================

const getPullRequestDiff = async (prData) => {
  try {
    const octokit =
      await getOctokitForInstallation(
        prData.installationId
      );

    const response = await octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      {
        owner: prData.repoOwner,
        repo: prData.repoName,
        pull_number: prData.prNumber,
        mediaType: {
          format: 'diff',
        },
      }
    );

    console.log(
      '✅ Fetched PR diff successfully'
    );

    return response.data;
  } catch (error) {
    console.error(
      'Error fetching PR diff:',
      error.message
    );

    return null;
  }
};

// =========================================
// FETCH PR FILES
// =========================================

const getPullRequestFiles = async (prData) => {
  try {
    const octokit =
      await getOctokitForInstallation(
        prData.installationId
      );

    const response = await octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
      {
        owner: prData.repoOwner,
        repo: prData.repoName,
        pull_number: prData.prNumber,
      }
    );

    console.log(
      `📁 Retrieved ${response.data.length} changed files`
    );

    return response.data;
  } catch (error) {
    console.error(
      'Error fetching PR files:',
      error.message
    );

    return [];
  }
};

// =========================================
// UPDATE COMMIT STATUS
// =========================================

const updateCommitStatus = async (
  prData,
  state,
  description
) => {
  try {
    const octokit =
      await getOctokitForInstallation(
        prData.installationId
      );

    await octokit.request(
      'POST /repos/{owner}/{repo}/statuses/{sha}',
      {
        owner: prData.repoOwner,
        repo: prData.repoName,
        sha: prData.headSha,
        state,
        description,
        context: 'GitSentinel AI Review',
      }
    );

    console.log(
      `✅ Commit status updated: ${state}`
    );
  } catch (error) {
    console.error(
      'Error updating commit status:',
      error.message
    );
  }
};

// =========================================
// POST PR SUMMARY
// =========================================

const postPRSummary = async (
  prData,
  analysisResult
) => {
  try {
    const octokit =
      await getOctokitForInstallation(
        prData.installationId
      );

    const summary = `
## 🤖 GitSentinel AI Review

${analysisResult.prSummary || 'Analysis complete'}

Risk Score: ${
      analysisResult.riskScore || 0
    }/10
`;

    await octokit.request(
      'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
      {
        owner: prData.repoOwner,
        repo: prData.repoName,
        issue_number: prData.prNumber,
        body: summary,
      }
    );

    console.log('📝 Posted PR summary');
  } catch (error) {
    console.error(
      'Error posting PR summary:',
      error.message
    );
  }
};

// =========================================
// REVIEW COMMENTS
// =========================================

const postReviewComments = async (
  prData,
  analysisResult
) => {
  try {
    const octokit =
      await getOctokitForInstallation(
        prData.installationId
      );

    const reviewBody = `
## 🤖 GitSentinel AI Review

Found ${
      analysisResult.issues?.length || 0
    } issue(s).
`;

    await octokit.request(
      'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
      {
        owner: prData.repoOwner,
        repo: prData.repoName,
        pull_number: prData.prNumber,
        body: reviewBody,
        event: 'COMMENT',
      }
    );

    console.log(
      '💬 Posted review comments'
    );
  } catch (error) {
    console.error(
      'Error posting review comments:',
      error.message
    );
  }
};

module.exports = {
  getOctokitForInstallation,
  postPendingStatus,
  getPullRequestDiff,
  getPullRequestFiles,
  postReviewComments,
  postPRSummary,
  updateCommitStatus,
};