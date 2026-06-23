const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { importBins, importUsers } = require('../controllers/import.controller');

router.post('/bins', protect, authorize('admin', 'super_admin'), upload.single('file'), importBins);
router.post('/users', protect, authorize('admin', 'super_admin'), upload.single('file'), importUsers);

module.exports = router;
