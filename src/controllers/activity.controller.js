const Activity = require('../models/Activity');

// GET /api/activities
exports.getActivities = async (req, res) => {
  try {
    const { action, entityType, userId, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (userId) filter.user = userId;

    const activities = await Activity.find(filter)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Activity.countDocuments(filter);

    res.json({
      success: true,
      data: activities,
      total,
      totalPages: Math.ceil(total / limit),
      page: Number(page)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/activities/stats
exports.getActivityStats = async (req, res) => {
  try {
    const stats = await Activity.aggregate([
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          latest: { $max: '$createdAt' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const total = await Activity.countDocuments();
    const today = await Activity.countDocuments({
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });

    res.json({
      success: true,
      data: {
        total,
        today,
        byAction: stats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
