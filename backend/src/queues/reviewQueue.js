// backend/src/queues/reviewQueue.js

const { Queue, QueueEvents } = require('bullmq');
const { queueConnection } = require('../config/redis');

// WHY BULLMQ OVER SIMPLE ASYNC CALLS:
// 
// Without Queue (BROKEN for scale):
//   Webhook arrives → await callAI() → 30 seconds later → post comment
//   If 100 PRs open at once, 100 simultaneous AI calls → server crashes
//   If server restarts during processing → job is LOST FOREVER
//
// With BullMQ Queue (CORRECT):
//   Webhook arrives → addJobToQueue() → instant 202 response
//   Workers pull jobs from Redis → process at their own pace
//   If server restarts → Redis still has the job → resumes automatically
//   Can control concurrency: only 5 AI calls at a time regardless of load

const PR_REVIEW_QUEUE_NAME = 'pr-review-queue';

// Create the queue
// The Queue object is used ONLY for adding jobs
// It does NOT process jobs - that's the Worker's job
const prReviewQueue = new Queue(PR_REVIEW_QUEUE_NAME, {
  connection: queueConnection,
  
  defaultJobOptions: {
    // Retry failed jobs automatically
    attempts: 3,
    backoff: {
      type: 'exponential',  // Wait 2s, then 4s, then 8s between retries
      delay: 2000,
    },
    
    // Remove completed jobs after 24 hours (keeps Redis clean)
    removeOnComplete: {
      age: 24 * 60 * 60, // seconds
      count: 1000,         // Keep max 1000 completed jobs
    },
    
    // Keep failed jobs for 7 days for debugging
    removeOnFail: {
      age: 7 * 24 * 60 * 60,
    },
  },
});

// QueueEvents lets us listen to what's happening in the queue
// Used by the dashboard to show live queue status
const prReviewQueueEvents = new QueueEvents(PR_REVIEW_QUEUE_NAME, {
  connection: queueConnection,
});

// Function to add a new PR review job to the queue
const addPRReviewJob = async (prData) => {
  const job = await prReviewQueue.add(
    'analyze-pr',  // Job name (for filtering/monitoring)
    prData,        // The actual data passed to the worker
    {
      // Priority: high severity repos get processed first
      // Lower number = higher priority in BullMQ
      priority: prData.isHighPriority ? 1 : 10,
      
      // Unique job ID prevents duplicate processing
      // If same PR webhook fires twice, second one is ignored
      jobId: `pr-${prData.repoOwner}-${prData.repoName}-${prData.prNumber}-${prData.headSha}`,
    }
  );
  
  console.log(`📬 Job ${job.id} added to queue for PR #${prData.prNumber}`);
  return job;
};

// Get queue statistics for the dashboard
const getQueueStats = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    prReviewQueue.getWaitingCount(),
    prReviewQueue.getActiveCount(),
    prReviewQueue.getCompletedCount(),
    prReviewQueue.getFailedCount(),
    prReviewQueue.getDelayedCount(),
  ]);
  
  return { waiting, active, completed, failed, delayed };
};

// Get recent jobs for the dashboard
const getRecentJobs = async (limit = 20) => {
  const [active, waiting, completed, failed] = await Promise.all([
    prReviewQueue.getActive(0, limit),
    prReviewQueue.getWaiting(0, limit),
    prReviewQueue.getCompleted(0, limit),
    prReviewQueue.getFailed(0, limit),
  ]);
  
  return { active, waiting, completed, failed };
};

module.exports = {
  prReviewQueue,
  prReviewQueueEvents,
  addPRReviewJob,
  getQueueStats,
  getRecentJobs,
  PR_REVIEW_QUEUE_NAME,
};