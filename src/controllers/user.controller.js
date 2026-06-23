const User = require('../models/User');

// GET /api/users (admin)
exports.getUsers = async (req, res) => {
  try {
    const { role, zone, isActive, page = 1, limit = 20, search, sort } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (zone) filter.zone = zone;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { cni: { $regex: search, $options: 'i' } }
      ];
    }

    // Parse sort parameter (format: field or -field for descending)
    let sortObj = { createdAt: -1 };
    if (sort) {
      const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
      const sortDirection = sort.startsWith('-') ? -1 : 1;
      // Validate sort field to prevent injection
      const allowedSortFields = ['name', 'email', 'points', 'createdAt', 'zone', 'role'];
      if (allowedSortFields.includes(sortField)) {
        sortObj = { [sortField]: sortDirection };
      }
    }

    const users = await User.find(filter)
      .select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -refreshTokens -resetPasswordToken')
      .sort(sortObj)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: users,
      total,
      totalPages: Math.ceil(total / limit),
      page: Number(page),
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/users/:id
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -refreshTokens');
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/users (admin crée un utilisateur)
exports.createUser = async (req, res) => {
  try {
    const { cni, phone, email, password, name, zone, role } = req.body;
    const user = await User.create({ cni, phone, email, passwordHash: password, name, zone, role: role || 'citizen' });
    res.status(201).json({ success: true, data: user, message: 'Utilisateur créé' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/users/:id
exports.updateUser = async (req, res) => {
  try {
    const allowed = ['name', 'email', 'phone', 'zone', 'role', 'isActive', 'notificationPreferences', 'rankingOptIn'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .select('-passwordHash -twoFactorSecret');
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });

    res.json({ success: true, data: user, message: 'Utilisateur mis à jour' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/users/:id/suspend
exports.suspendUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false, refreshTokens: [] }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    res.json({ success: true, message: `Compte de ${user.name} suspendu` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/users/:id/activate
exports.activateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    res.json({ success: true, message: `Compte de ${user.name} réactivé` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/users/:id/reset-password (admin)
exports.adminResetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Mot de passe trop court (min. 8 caractères)' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    user.passwordHash = newPassword;
    user.refreshTokens = [];
    await user.save();
    res.json({ success: true, message: `Mot de passe de ${user.name} réinitialisé` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    res.json({ success: true, message: 'Utilisateur supprimé' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/users/profile (self-update)
exports.updateProfile = async (req, res) => {
  try {
    const allowed = ['name', 'zone', 'avatarUrl', 'notificationPreferences', 'rankingOptIn', 'fcmToken', 'webPushSubscription'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
      .select('-passwordHash -twoFactorSecret -twoFactorBackupCodes');
    res.json({ success: true, data: user, message: 'Profil mis à jour' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/users/leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const { zone } = req.query;
    const filter = { rankingOptIn: true, role: 'citizen' };
    if (zone) filter.zone = zone;

    const users = await User.find(filter)
      .select('name zone points level badges avatarUrl')
      .sort({ points: -1 })
      .limit(20);

    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
