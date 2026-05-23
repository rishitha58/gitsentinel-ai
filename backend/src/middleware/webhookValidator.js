const crypto = require('crypto');

const validateWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-hub-signature-256'];

  if (!signature) {
    console.warn('⚠️ Webhook received without signature - rejecting');
    return res.status(401).json({ error: 'No signature provided' });
  }

  const rawBody = req.body;

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    console.warn('⚠️ Invalid webhook signature - rejecting');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Convert raw buffer to JSON now that signature is verified
  req.body = JSON.parse(rawBody.toString());

  console.log('✅ Webhook signature verified');
  next();
};

module.exports = { validateWebhookSignature };