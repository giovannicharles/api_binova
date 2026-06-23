const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    unique: true,
    default: () => 'RPT-' + Date.now().toString(36).toUpperCase()
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Le titre est obligatoire'],
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: [true, 'La description est obligatoire'],
    trim: true,
    maxlength: 2000
  },
  category: {
    type: String,
    enum: ['overflow', 'damage', 'illegal_dump', 'maintenance', 'odor', 'pest', 'other'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in_progress', 'resolved', 'cancelled'],
    default: 'pending'
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: { type: [Number], required: true } // [lng, lat]
  },
  address: { type: String, trim: true },
  zone: { type: String, required: true },
  photos: [{ type: String }],
  bin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bin',
    required: [true, 'Le bac est obligatoire']
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  resolutionNote: { type: String, trim: true },
  partsNeeded: { type: String, trim: true }, // pièces à prévoir
  statusHistory: [{
    status: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
    timestamp: { type: Date, default: Date.now }
  }],
  // Points accordés à l'auteur
  pointsAwarded: { type: Boolean, default: false }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual: durée traitement (en heures)
reportSchema.virtual('processingTime').get(function() {
  if (!this.resolvedAt) return null;
  const diff = this.resolvedAt - this.createdAt;
  return Math.round(diff / (1000 * 60 * 60) * 10) / 10;
});

reportSchema.index({ location: '2dsphere' });
reportSchema.index({ zone: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ priority: 1 });
reportSchema.index({ user: 1 });
reportSchema.index({ assignedTo: 1 });
reportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
