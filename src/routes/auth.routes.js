const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/refresh', auth.refreshToken);
router.post('/refresh-token', auth.refreshToken);
router.post('/logout', protect, auth.logout);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password/:token', auth.resetPassword);
router.post('/enable-2fa', protect, authorize('admin', 'super_admin', 'collector', 'admin_municipal'), auth.enable2FA);
router.post('/verify-2fa', protect, auth.verify2FA);
router.post('/disable-2fa', protect, auth.disable2FA);
router.get('/me', protect, auth.getMe);
router.patch('/change-password', protect, auth.changePassword);

module.exports = router;
