const express = require('express');
const router = express.Router();
const user = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth');

const adminRoles = ['admin', 'super_admin', 'admin_municipal'];

router.get('/leaderboard', protect, user.getLeaderboard);
router.patch('/profile', protect, user.updateProfile);
router.get('/', protect, authorize(...adminRoles), user.getUsers);
router.post('/', protect, authorize(...adminRoles), user.createUser);
router.get('/:id', protect, authorize(...adminRoles), user.getUser);
router.put('/:id', protect, authorize(...adminRoles), user.updateUser);
router.patch('/:id/suspend', protect, authorize(...adminRoles), user.suspendUser);
router.patch('/:id/activate', protect, authorize(...adminRoles), user.activateUser);
router.patch('/:id/reset-password', protect, authorize(...adminRoles), user.adminResetPassword);
router.delete('/:id', protect, authorize('admin', 'super_admin'), user.deleteUser);

module.exports = router;
