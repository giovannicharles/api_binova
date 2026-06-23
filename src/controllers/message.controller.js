const { Message, ChatRoom } = require('../models/Message');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/chat';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `chat-${Date.now()}${path.extname(file.originalname)}`);
  }
});
exports.uploadMiddleware = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }).single('image');

// GET /api/messages/rooms
exports.getRooms = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'citizen') {
      query = { $or: [{ participants: req.user._id }, { type: 'support' }] };
    }
    const rooms = await ChatRoom.find(query).populate('participants', 'name avatarUrl role').sort({ updatedAt: -1 });
    res.json({ success: true, data: rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/messages/:roomId
exports.getMessages = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const messages = await Message.find({ room: req.params.roomId, isDeleted: false })
      .populate('sender', 'name avatarUrl role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({ success: true, data: messages.reverse() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/messages
exports.sendMessage = async (req, res) => {
  try {
    const { room, content, type } = req.body;
    const imageUrl = req.file ? `/uploads/chat/${req.file.filename}` : null;

    const message = await Message.create({
      room,
      sender: req.user._id,
      content: content || '',
      type: imageUrl ? 'image' : (type || 'text'),
      imageUrl
    });

    await ChatRoom.findOneAndUpdate(
      { roomId: room },
      {
        lastMessage: { content: content || '📷 Image', sender: req.user._id, timestamp: new Date() },
        $addToSet: { participants: req.user._id }
      },
      { upsert: true }
    );

    await message.populate('sender', 'name avatarUrl role');

    const io = req.app.get('io');
    if (io) io.to(room).emit('message:new', { message });

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/messages/rooms
exports.createRoom = async (req, res) => {
  try {
    const { name, type, zone } = req.body;
    const room = await ChatRoom.create({
      roomId: `room-${Date.now()}`,
      name,
      type: type || 'support',
      zone,
      participants: [req.user._id]
    });
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
