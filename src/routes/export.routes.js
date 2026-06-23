const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { exportBins, exportUsers, exportReports, exportActivities } = require('../controllers/export.controller');

router.get('/bins', protect, authorize('admin', 'super_admin'), exportBins);
router.get('/users', protect, authorize('admin', 'super_admin'), exportUsers);
router.get('/reports', protect, authorize('admin', 'super_admin'), exportReports);
router.get('/activities', protect, authorize('admin', 'super_admin'), exportActivities);

module.exports = router;
