const express = require('express');
const router = express.Router();
const stats = require('../controllers/stats.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/dashboard', protect, stats.getDashboard);
router.get('/opens-by-area', protect, stats.getOpensByArea);
router.get('/waste-types', protect, stats.getWasteTypes);
router.get('/fill-trend', protect, stats.getFillTrend);
router.get('/export/pdf', protect, authorize('admin', 'super_admin', 'admin_municipal'), stats.exportPDF);
router.get('/export/csv', protect, authorize('admin', 'super_admin', 'admin_municipal'), stats.exportCSV);

module.exports = router;
