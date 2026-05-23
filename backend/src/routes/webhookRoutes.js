const express = require('express');
const router = express.Router();
const { validateWebhookSignature } = require('../middleware/webhookValidator');
const { handleWebhook } = require('../controllers/webhookController');

router.post('/', validateWebhookSignature, handleWebhook);

module.exports = router;