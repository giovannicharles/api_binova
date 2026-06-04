const express = require('express');
const router = express.Router();
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/awareness.controller');

router.get('/', optionalAuth, ctrl.getAll);
router.get('/:id', optionalAuth, ctrl.getOne);
router.post('/', protect, authorize('admin', 'super_admin', 'admin_municipal'), ctrl.create);
router.put('/:id', protect, authorize('admin', 'super_admin', 'admin_municipal'), ctrl.update);
router.delete('/:id', protect, authorize('admin', 'super_admin'), ctrl.remove);

module.exports = router;
