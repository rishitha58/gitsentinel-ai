// backend/src/controllers/webhookController.js

const { addPRReviewJob } = require('../queues/reviewQueue');
const { PRReview, REVIEW_STATUS } = require('../models/PRReview');
const Repository = require('../models/Repository');

const handleWebhook = async (req, res) => {
  const eventType = req.headers['x-github-event'];
  const payload = req.body;

  // RESPOND IMMEDIATELY - GitHub requires response within 10 seconds
  // BullMQ queue accepts the job instantly so we can respond right away
  res.status(202).json({
    message: 'Webhook received and queued for processing',
    timestamp: new Date().toISOString(),
  });

  console.log(`\n📨 Webhook received: ${eventType}`);

  try {
    if (eventType === 'pull_request') {
      await handlePullRequestWebhook(payload);
    }
    // Handle other events as needed
  } catch (error) {
    console.error('❌ Webhook handling error:', error.message);
  }
};

const handlePullRequestWebhook = async (payload) => {
  const action = payload.action;
  
  // Only process these specific actions
  if (!['opened', 'synchronize', 'reopened'].includes(action)) {
    console.log(`Ignoring PR action: ${action}`);
    return;
  }

  const prData = {
    // PR Info
    prNumber: payload.pull_request.number,
    prTitle: payload.pull_request.title,
    prBody: payload.pull_request.body || '',
    prUrl: payload.pull_request.html_url,
    authorLogin: payload.pull_request.user.login,
    headSha: payload.pull_request.head.sha,
    baseBranch: payload.pull_request.base.ref,
    headBranch: payload.pull_request.head.ref,
    
    // Repo Info
    repoOwner: payload.repository.owner.login,
    repoName: payload.repository.name,
    repoId: payload.repository.id,
    repoFullName: payload.repository.full_name,
    
    // GitHub App Installation
    installationId: payload.installation.id,
    
    // Action context
    action: action,
    isHighPriority: false, // Could check if author is a team lead etc.
  };

  console.log(`📋 Processing PR #${prData.prNumber}: "${prData.prTitle}"`);
  console.log(`   Repo: ${prData.repoOwner}/${prData.repoName}`);
  console.log(`   Author: ${prData.authorLogin}`);

  try {
    // Ensure repository exists in our DB
    const [repo] = await Repository.findOrCreate({
      where: {
        owner: prData.repoOwner,
        name: prData.repoName,
      },
      defaults: {
        githubRepoId: prData.repoId,
        owner: prData.repoOwner,
        name: prData.repoName,
        fullName: prData.repoFullName,
        installationId: prData.installationId,
      },
    });

    // Create a PRReview record immediately (status: queued)
    // This lets the dashboard show the PR is pending even before processing
    const prReview = await PRReview.create({
      prNumber: prData.prNumber,
      prTitle: prData.prTitle,
      prUrl: prData.prUrl,
      authorLogin: prData.authorLogin,
      headSha: prData.headSha,
      status: REVIEW_STATUS.QUEUED,
      queuedAt: new Date(),
      repositoryId: repo.id,
    });

    // Add job to BullMQ queue
    const job = await addPRReviewJob(prData);

    // Update the DB record with the BullMQ job ID
    await prReview.update({ bullmqJobId: job.id });

    console.log(`✅ PR #${prData.prNumber} queued as job ${job.id}`);
    
  } catch (error) {
    console.error('❌ Failed to queue PR review:', error.message);
  }
};

module.exports = { handleWebhook };