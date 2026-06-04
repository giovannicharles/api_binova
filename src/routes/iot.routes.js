const express = require('express');
const router = express.Router();
const iot = require('../controllers/iot.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/data', iot.receiveIoTData); // endpoint IoT (peut utiliser API key externe)
router.post('/simulate/start', protect, authorize('admin', 'super_admin'), iot.startSimulator);
router.post('/simulate/stop', protect, authorize('admin', 'super_admin'), iot.stopSimulator);
router.get('/simulate/status', protect, iot.getSimulatorStatus);
router.post('/simulate/seed', protect, authorize('admin', 'super_admin'), iot.seedSimulatedBins);

module.exports = router;
