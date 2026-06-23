const express = require('express');
const router = express.Router();
const msg = require('../controllers/message.controller');
const { protect } = require('../middleware/auth');

router.get('/rooms', protect, msg.getRooms);
router.post('/rooms', protect, msg.createRoom);
router.get('/:roomId', protect, msg.getMessages);
router.post('/', protect, msg.uploadMiddleware, msg.sendMessage);

module.exports = router;
