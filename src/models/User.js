const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  cni: {
    type: String,
    required: [true, 'La CNI est obligatoire'],
    unique: true,
    trim: true,
    uppercase: true
  },
  phone: {
    type: String,
    required: [true, 'Le téléphone est obligatoire'],
    unique: true,
    trim: true,
    match: [/^\+237[0-9]{9}$/, 'Format téléphone invalide (+237XXXXXXXXX)']
  },
  email: {
    type: String,
    required: [true, "L'email est obligatoire"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email invalide']
  },
  passwordHash: {
    type: String,
    required: [true, 'Le mot de passe est obligatoire'],
    select: false
  },
  name: {
    type: String,
    required: [true, 'Le nom est obligatoire'],
    trim: true,
    maxlength: [100, 'Nom trop long']
  },
  role: {
    type: String,
    enum: ['citizen', 'collector', 'admin_municipal', 'admin', 'super_admin'],
    default: 'citizen'
  },
  zone: {
    type: String,
    required: [true, 'La zone/quartier est obligatoire'],
    trim: true
  },
  avatarUrl: { type: String, default: null },
  isActive: { type: Boolean, default: true },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, select: false },
  twoFactorBackupCodes: { type: [String], select: false },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  refreshTokens: [{
    token: String,
    expiresAt: Date,
    deviceInfo: String
  }],
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
  // Gamification
  points: { type: Number, default: 0 },
  level: {
    type: String,
    enum: ['Bronze', 'Argent', 'Or', 'Platine'],
    default: 'Bronze'
  },
  badges: [{
    id: String,
    name: String,
    icon: String,
    earnedAt: Date
  }],
  stats: {
    reportsSubmitted: { type: Number, default: 0 },
    collectionsValidated: { type: Number, default: 0 },
    loginStreak: { type: Number, default: 0 },
    lastLoginDate: Date
  },
  // Notifications
  fcmToken: { type: String, default: null },
  webPushSubscription: { type: Object, default: null },
  notificationPreferences: {
    binAlerts: { type: Boolean, default: true },
    reportUpdates: { type: Boolean, default: true },
    collections: { type: Boolean, default: true },
    awareness: { type: Boolean, default: true }
  },
  // Opt-in classement
  rankingOptIn: { type: Boolean, default: false }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual: masque partiel CNI
userSchema.virtual('cniMasked').get(function() {
  if (!this.cni) return null;
  return this.cni.substring(0, 3) + '***' + this.cni.substring(this.cni.length - 3);
});

// Hash password avant save
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// Comparaison mot de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Mise à jour points et niveau
userSchema.methods.addPoints = async function(pts) {
  this.points += pts;
  if (this.points >= 5000) this.level = 'Platine';
  else if (this.points >= 2000) this.level = 'Or';
  else if (this.points >= 500) this.level = 'Argent';
  else this.level = 'Bronze';
  await this.save();
};

// Nettoyage refresh tokens expirés
userSchema.methods.cleanExpiredTokens = function() {
  const now = new Date();
  this.refreshTokens = this.refreshTokens.filter(t => t.expiresAt > now);
};

// Index
// userSchema.index({ cni: 1 });
// userSchema.index({ phone: 1 });
// userSchema.index({ email: 1 });
userSchema.index({ zone: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
