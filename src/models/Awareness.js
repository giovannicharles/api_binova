const mongoose = require('mongoose');

const awarenessSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 300 },
  summary: { type: String, trim: true, maxlength: 500 },
  content: { type: String, required: true },
  type: {
    type: String,
    enum: ['article', 'video', 'alert', 'tip'],
    default: 'article'
  },
  category: {
    type: String,
    enum: ['recycling', 'health', 'environment', 'community', 'news'],
    default: 'environment'
  },
  imageUrl: String,
  videoUrl: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isPublished: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  targetZones: [String], // zones ciblées (vide = toutes)
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  tags: [String],
  publishedAt: Date,
  isHealthAlert: { type: Boolean, default: false },
  alertLevel: {
    type: String,
    enum: ['info', 'warning', 'danger'],
    default: 'info'
  }
}, {
  timestamps: true
});

awarenessSchema.index({ isPublished: 1, publishedAt: -1 });
awarenessSchema.index({ type: 1 });
awarenessSchema.index({ category: 1 });
awarenessSchema.index({ isHealthAlert: 1 });

module.exports = mongoose.model('Awareness', awarenessSchema);
