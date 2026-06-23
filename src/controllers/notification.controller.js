// ===== src/controllers/notification.controller.js =====
const webpush = require('web-push');
const admin = require('firebase-admin');

// In-memory subscription store (use DB in production)
const subscriptions = new Map();

exports.subscribe = async (req, res, next) => {
  try {
    const { subscription, fcmToken } = req.body;
    const userId = req.user._id.toString();

    if (subscription) subscriptions.set(userId, subscription);

    // Save FCM token to user
    if (fcmToken) {
      await req.user.constructor.findByIdAndUpdate(userId, { fcmToken });
    }

    res.json({ success: true, message: 'Abonné aux notifications' });
  } catch (err) { next(err); }
};

exports.getNotifications = async (req, res, next) => {
  try {
    // Return mock notifications (implement with a Notification model in production)
    const notifications = [
      {
        _id: '1',
        type: 'info',
        title: '🌿 Bienvenue sur BINOVA',
        body: 'Merci de rejoindre BINOVA. Ensemble, gardons Yaoundé propre !',
        isRead: false,
        createdAt: new Date().toISOString()
      }
    ];
    res.json({ success: true, data: notifications });
  } catch (err) { next(err); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Notifications marquées comme lues' });
  } catch (err) { next(err); }
};

exports.sendPush = async (req, res, next) => {
  try {
    const { title, body, type = 'info', userIds } = req.body;

    const payload = JSON.stringify({ title, body, type, timestamp: Date.now() });
    const sent = [];

    // Web push
    for (const [userId, sub] of subscriptions.entries()) {
      if (!userIds || userIds.includes(userId)) {
        try {
          await webpush.sendNotification(sub, payload);
          sent.push(userId);
        } catch (e) {
          if (e.statusCode === 410) subscriptions.delete(userId);
        }
      }
    }

    res.json({ success: true, message: `Notification envoyée à ${sent.length} utilisateur(s)` });
  } catch (err) { next(err); }
};

exports.getVapidPublicKey = (req, res) => {
  res.json({ success: true, publicKey: process.env.VAPID_PUBLIC_KEY });
};
