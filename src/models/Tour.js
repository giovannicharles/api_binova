const mongoose = require('mongoose');

const tourSchema = new mongoose.Schema({
  tourId: {
    type: String,
    unique: true,
    default: () => 'TRN-' + Date.now().toString(36).toUpperCase()
  },
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['scheduled', 'emergency', 'manual'],
    default: 'scheduled'
  },
  status: {
    type: String,
    enum: ['planned', 'in_progress', 'completed', 'cancelled'],
    default: 'planned'
  },
  collector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bins: [{
    bin: { type: mongoose.Schema.Types.ObjectId, ref: 'Bin' },
    order: Number,
    status: {
      type: String,
      enum: ['pending', 'collected', 'skipped'],
      default: 'pending'
    },
    collectedAt: Date,
    note: String
  }],
  zone: { type: String },
  scheduledAt: { type: Date, required: true },
  startedAt: { type: Date },
  completedAt: { type: Date },
  estimatedDuration: { type: Number }, // minutes
  actualDuration: { type: Number },
  optimizedRoute: { type: Object }, // Google Maps directions response
  notes: { type: String, trim: true },
  notificationSent: { type: Boolean, default: false }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

tourSchema.virtual('progress').get(function() {
  if (!this.bins || this.bins.length === 0) return 0;
  const done = this.bins.filter(b => b.status === 'collected').length;
  return Math.round((done / this.bins.length) * 100);
});

tourSchema.index({ status: 1 });
tourSchema.index({ scheduledAt: -1 });
tourSchema.index({ collector: 1 });
tourSchema.index({ zone: 1 });

module.exports = mongoose.model('Tour', tourSchema);
