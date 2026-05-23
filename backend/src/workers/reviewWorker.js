// backend/src/workers/reviewWorker.js

// WHY THE WORKER IS IN A SEPARATE FILE:
// In production, you can run multiple worker instances on different servers
// The queue in Redis acts as the shared task list
// Workers compete to pick up jobs - this is horizontal scaling

const { Worker } = require('bullmq');
const { workerConnection } = require('../config/redis');
const { PR_REVIEW_QUEUE_NAME } = require('../queues/reviewQueue');
const githubService = require('../services/githubService');
const aiService = require('../services/aiService');
const { PRReview, REVIEW_STATUS } = require('../models/PRReview');
const Issue = require('../models/Issue');
const Repository = require('../models/Repository');

// The processor function - called for EACH job in the queue
const processReviewJob = async (job) => {
  const prData = job.data;
  const startTime = Date.now();
  
  console.log(`\n🔄 Worker processing job ${job.id}`);
  console.log(`   PR #${prData.prNumber} in ${prData.repoOwner}/${prData.repoName}`);
  console.log(`   Author: ${prData.authorLogin}`);

  // Update job progress (visible in dashboard)
  await job.updateProgress(5);

  // ─── STEP 1: Update DB status to "processing" ─────────────────────────
  let prReview;
  try {
    prReview = await PRReview.findOne({
      where: { bullmqJobId: job.id }
    });
    
    if (prReview) {
      await prReview.update({
        status: REVIEW_STATUS.PROCESSING,
        processingStartedAt: new Date(),
      });
    }
  } catch (dbError) {
    console.error('DB update error (non-fatal):', dbError.message);
  }

  await job.updateProgress(10);

  // ─── STEP 2: Post "pending" status on GitHub ───────────────────────────
  try {
    await githubService.postPendingStatus(prData);
    console.log('   ✓ Posted pending status to GitHub');
  } catch (error) {
    console.error('   ✗ Failed to post pending status:', error.message);
    // Non-fatal - continue processing
  }

  await job.updateProgress(20);

  // ─── STEP 3: Fetch the PR diff from GitHub ─────────────────────────────
  let diff;
  try {
    diff = await githubService.getPullRequestDiff(prData);
    
    if (!diff || diff.length < 10) {
      console.log('   ⚠️ Empty diff - nothing to analyze');
      await markJobComplete(prReview, null, startTime);
      return { skipped: true, reason: 'Empty diff' };
    }
    
    console.log(`   ✓ Fetched diff (${diff.length} characters)`);
  } catch (error) {
    throw new Error(`Failed to fetch PR diff: ${error.message}`);
  }

  await job.updateProgress(35);

  // ─── STEP 4: Send to Python AI Service ────────────────────────────────
  let analysisResult;
  try {
    console.log('   🤖 Sending to AI service...');
    analysisResult = await aiService.analyzeDiff(diff, prData);
    console.log(`   ✓ AI analysis complete: ${analysisResult.issues?.length || 0} issues found`);
  } catch (error) {
    throw new Error(`AI service failed: ${error.message}`);
  }

  await job.updateProgress(65);

  // ─── STEP 5: Post review comments to GitHub ────────────────────────────
  try {
    await githubService.postReviewComments(prData, analysisResult);
    await githubService.postPRSummary(prData, analysisResult);
    console.log('   ✓ Posted review comments to GitHub');
  } catch (error) {
    console.error('   ✗ Failed to post GitHub comments:', error.message);
    // Non-fatal - still save to DB
  }

  await job.updateProgress(80);

  // ─── STEP 6: Save results to PostgreSQL ────────────────────────────────
  try {
    await saveAnalysisToDatabase(prData, analysisResult, job.id, startTime, prReview);
    console.log('   ✓ Saved analysis to PostgreSQL');
  } catch (error) {
    console.error('   ✗ Database save failed:', error.message);
    // Non-fatal - job still "succeeded" from queue perspective
  }

  await job.updateProgress(100);
  
  const totalTime = Date.now() - startTime;
  console.log(`✅ Job ${job.id} completed in ${totalTime}ms\n`);
  
  return {
    success: true,
    prNumber: prData.prNumber,
    issuesFound: analysisResult.issues?.length || 0,
    processingTimeMs: totalTime,
  };
};

// Save everything to PostgreSQL
const saveAnalysisToDatabase = async (prData, analysisResult, jobId, startTime, existingReview) => {
  const processingTimeMs = Date.now() - startTime;
  
  // Upsert Repository record
  const [repo] = await Repository.findOrCreate({
    where: {
      owner: prData.repoOwner,
      name: prData.repoName,
    },
    defaults: {
      githubRepoId: prData.repoId || 0,
      owner: prData.repoOwner,
      name: prData.repoName,
      fullName: `${prData.repoOwner}/${prData.repoName}`,
      installationId: prData.installationId,
    },
  });

  // Update PRReview record
  if (existingReview) {
    await existingReview.update({
      status: REVIEW_STATUS.COMPLETED,
      prSummary: analysisResult.prSummary,
      riskScore: analysisResult.riskScore,
      filesAnalyzed: analysisResult.filesAnalyzed,
      securityIssuesCount: analysisResult.securityIssues || 0,
      performanceIssuesCount: analysisResult.performanceIssues || 0,
      qualityIssuesCount: analysisResult.qualityIssues || 0,
      completedAt: new Date(),
      processingTimeMs,
    });
    
    // Bulk insert all issues
    if (analysisResult.issues && analysisResult.issues.length > 0) {
      const issueRecords = analysisResult.issues.map(issue => ({
        type: issue.type,
        severity: issue.severity,
        file: issue.file,
        lineNumber: issue.line,
        description: issue.description,
        explanation: issue.explanation,
        suggestedFix: issue.suggestedFix,
        language: issue.language,
        prReviewId: existingReview.id,
      }));
      
      await Issue.bulkCreate(issueRecords);
    }
  }
  
  // Update repository aggregate stats
  await repo.increment('totalPRsAnalyzed');
};

const markJobComplete = async (prReview, analysisResult, startTime) => {
  if (!prReview) return;
  
  await prReview.update({
    status: REVIEW_STATUS.COMPLETED,
    completedAt: new Date(),
    processingTimeMs: Date.now() - startTime,
    ...(analysisResult && {
      prSummary: analysisResult.prSummary,
      riskScore: analysisResult.riskScore,
    }),
  });
};

// ─── CREATE THE WORKER ──────────────────────────────────────────────────────
const createWorker = () => {
  const worker = new Worker(
    PR_REVIEW_QUEUE_NAME,
    processReviewJob,  // The function to run for each job
    {
      connection: workerConnection,
      
      // CONCURRENCY: How many jobs to process simultaneously
      // Set to 3 means: 3 PRs being analyzed at the same time
      // Higher = faster throughput BUT more API costs and server load
      concurrency: 3,
      
      // Don't start new jobs if they fail - let the retry backoff work
      autorun: true,
    }
  );

  // ─── Worker Event Listeners ────────────────────────────────────────────
  
  worker.on('active', (job) => {
    console.log(`🔄 Job ${job.id} started processing`);
  });

  worker.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed:`, result);
  });

  worker.on('failed', async (job, error) => {
    console.error(`❌ Job ${job?.id} failed:`, error.message);
    
    // Update DB to show failure
    if (job) {
      try {
        const prReview = await PRReview.findOne({
          where: { bullmqJobId: job.id }
        });
        
        if (prReview) {
          // Check if this was the FINAL attempt (no more retries)
          const isLastAttempt = job.attemptsMade >= (job.opts.attempts || 1);
          
          if (isLastAttempt) {
            await prReview.update({
              status: REVIEW_STATUS.FAILED,
              errorMessage: error.message,
              retryCount: job.attemptsMade,
            });
            
            // Post failure notification to GitHub
            try {
              await githubService.updateCommitStatus(
                job.data,
                'error',
                'GitSentinel AI analysis failed'
              );
            } catch (e) {
              console.error('Could not post failure status to GitHub:', e.message);
            }
          } else {
            // Will retry - update retry count
            await prReview.update({
              retryCount: job.attemptsMade,
            });
          }
        }
      } catch (dbError) {
        console.error('Could not update DB on failure:', dbError.message);
      }
    }
  });

  worker.on('progress', (job, progress) => {
    console.log(`📊 Job ${job.id} progress: ${progress}%`);
  });

  worker.on('error', (error) => {
    console.error('Worker error:', error);
  });

  console.log('✅ BullMQ Worker started and listening for jobs');
  
  return worker;
};

module.exports = { createWorker };