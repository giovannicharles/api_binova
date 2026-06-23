const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getActivities, getActivityStats } = require('../controllers/activity.controller');

router.get('/', protect, authorize('admin', 'super_admin'), getActivities);
router.get('/stats', protect, authorize('admin', 'super_admin'), getActivityStats);

module.exports = router;
