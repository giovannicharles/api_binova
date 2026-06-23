const mongoose = require('mongoose');

const binHistorySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  fillLevel: { type: Number, min: 0, max: 100 },
  openings: { type: Number, default: 0 },
  wasteType: {
    type: String,
    enum: ['mixed', 'organic', 'recyclable', 'hazardous', 'unknown'],
    default: 'mixed'
  },
  battery: { type: Number, min: 0, max: 100 },
  temperature: Number,
  humidity: Number
}, { _id: false });

const binSchema = new mongoose.Schema({
  binId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: { type: String, required: true, trim: true },
  zone: { type: String, required: true, trim: true },
  address: { type: String, trim: true },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  fillLevel: { type: Number, default: 0, min: 0, max: 100 },
  status: {
    type: String,
    enum: ['active', 'maintenance', 'offline', 'full'],
    default: 'active'
  },
  wasteType: {
    type: String,
    enum: ['mixed', 'organic', 'recyclable', 'hazardous', 'unknown'],
    default: 'mixed'
  },
  battery: { type: Number, default: 100, min: 0, max: 100 },
  temperature: { type: Number, default: null },
  humidity: { type: Number, default: null },
  openingsToday: { type: Number, default: 0 },
  openingsTotal: { type: Number, default: 0 },
  lastEmptied: { type: Date, default: null },
  lastDataReceived: { type: Date, default: null },
  alertThresholds: {
    attention: { type: Number, default: 80 },
    critical: { type: Number, default: 95 }
  },
  history: {
    type: [binHistorySchema],
    default: []
  },
  isSimulated: { type: Boolean, default: false },
  capacity: { type: Number, default: 240 }, // litres
  manufacturer: { type: String, default: 'BINOVA IoT v1' },
  firmwareVersion: { type: String, default: '1.0.0' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual: couleur status
binSchema.virtual('statusColor').get(function() {
  if (this.status === 'offline' || this.status === 'maintenance') return 'gray';
  if (this.fillLevel >= this.alertThresholds.critical) return 'red';
  if (this.fillLevel >= this.alertThresholds.attention) return 'orange';
  return 'green';
});

// Virtual: alerte active
binSchema.virtual('hasAlert').get(function() {
  return this.fillLevel >= this.alertThresholds.attention ||
         this.status === 'offline' ||
         this.battery < 20;
});

// Index géospatial
binSchema.index({ location: '2dsphere' });
binSchema.index({ zone: 1 });
binSchema.index({ status: 1 });
binSchema.index({ fillLevel: 1 });

module.exports = mongoose.model('Bin', binSchema);
