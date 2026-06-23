const express = require('express');
const router = express.Router();
const bin = require('../controllers/bin.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, bin.getBins);
router.get('/my', protect, bin.getMyBins);
router.get('/zones', protect, bin.getZones);
router.get('/map/geojson', protect, bin.getBinsGeoJSON);
router.get('/:id', protect, bin.getBin);
router.get('/:id/history', protect, bin.getBinHistory);
router.post('/', protect, authorize('admin', 'super_admin', 'admin_municipal'), bin.createBin);
router.put('/:id', protect, authorize('admin', 'super_admin', 'admin_municipal'), bin.updateBin);
router.delete('/:id', protect, authorize('admin', 'super_admin'), bin.deleteBin);
router.patch('/:id/empty', protect, authorize('admin', 'super_admin', 'admin_municipal', 'collector'), bin.markBinEmptied);

module.exports = router;
