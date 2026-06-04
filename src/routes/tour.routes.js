const express = require('express');
const router = express.Router();
const tour = require('../controllers/tour.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, tour.getTours);
router.post('/', protect, authorize('admin', 'super_admin', 'admin_municipal'), tour.createTour);
router.put('/:id', protect, authorize('admin', 'super_admin', 'admin_municipal', 'collector'), tour.updateTour);
router.patch('/:id/bins/:binId/collect', protect, authorize('collector', 'admin', 'super_admin'), tour.markBinCollected);
router.delete('/:id', protect, authorize('admin', 'super_admin'), tour.deleteTour);

module.exports = router;
