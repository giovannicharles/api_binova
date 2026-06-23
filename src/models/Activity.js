const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'report_created',
      'report_updated',
      'report_resolved',
      'bin_created',
      'bin_updated',
      'bin_emptied',
      'tour_created',
      'tour_completed',
      'user_created',
      'user_updated',
      'export_generated',
      'import_processed',
      'settings_updated',
      'alert_triggered',
      'message_sent'
    ]
  },
  entityType: {
    type: String,
    enum: ['Report', 'Bin', 'User', 'Tour', 'Message', 'System'],
    required: false
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: { type: String },
  userAgent: { type: String },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });
activitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
