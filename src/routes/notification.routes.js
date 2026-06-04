const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/notification.controller');

router.get('/vapid-public-key', ctrl.getVapidPublicKey);
router.post('/subscribe', protect, ctrl.subscribe);
router.get('/', protect, ctrl.getNotifications);
router.post('/mark-all-read', protect, ctrl.markAllRead);
router.post('/send', protect, ctrl.sendPush);

module.exports = router;
