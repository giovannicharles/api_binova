const express = require('express');
const router = express.Router();
const report = require('../controllers/report.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, report.uploadMiddleware, report.createReport);
router.get('/', protect, report.getReports);
router.get('/my', protect, report.getMyReports);
router.get('/:id', protect, report.getReport);
router.put('/:id/status', protect, authorize('admin', 'super_admin', 'admin_municipal', 'collector'), report.updateReportStatus);
router.delete('/:id', protect, report.deleteReport);

module.exports = router;
