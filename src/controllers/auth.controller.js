const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const emailService = require('../services/email.service');

// Helper: génère tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  });
  return { accessToken, refreshToken };
};

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  cniMasked: user.cniMasked,
  role: user.role,
  zone: user.zone,
  avatarUrl: user.avatarUrl,
  twoFactorEnabled: user.twoFactorEnabled,
  level: user.level,
  points: user.points,
  badges: user.badges,
  isActive: user.isActive
});

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { cni, phone, email, password, confirmPassword, name, zone } = req.body;

    if (!cni || !phone || !email || !password || !name || !zone) {
      return res.status(400).json({ success: false, message: 'Tous les champs obligatoires doivent être remplis' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    // Vérification unicité
    const existing = await User.findOne({ $or: [{ cni: cni.toUpperCase() }, { phone }, { email: email.toLowerCase() }] });
    if (existing) {
      let msg = 'Un compte existe déjà avec ';
      if (existing.cni === cni.toUpperCase()) msg += 'cette CNI';
      else if (existing.phone === phone) msg += 'ce numéro de téléphone';
      else msg += 'cet email';
      return res.status(409).json({ success: false, message: msg });
    }

    const user = await User.create({
      cni: cni.toUpperCase(),
      phone,
      email: email.toLowerCase(),
      passwordHash: password, // sera hashé par pre-save
      name,
      zone
    });

    // Email de bienvenue (non bloquant)
    emailService.sendWelcomeEmail(user).catch(console.error);

    // Connexion automatique
    const { accessToken, refreshToken } = generateTokens(user._id);
    const refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    user.refreshTokens.push({ token: refreshToken, expiresAt: refreshExpires });
    user.lastLogin = new Date();
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès. Bienvenue sur BINOVA ! 🌿',
      accessToken,
      refreshToken,
      user: sanitizeUser(user)
    });
  } catch (error) {
    next ? next(error) : res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { identifier, password, totpCode } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Identifiant et mot de passe requis' });
    }

    const isEmail = identifier.includes('@');
    const query = isEmail ? { email: identifier.toLowerCase() } : { phone: identifier };

    const user = await User.findOne(query).select('+passwordHash +twoFactorSecret +twoFactorBackupCodes');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Identifiants incorrects' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Compte suspendu. Contactez l\'administration.' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Identifiants incorrects' });
    }

    // 2FA check
    if (user.twoFactorEnabled) {
      if (!totpCode) {
        return res.status(200).json({
          success: false,
          requiresTwoFactor: true,
          message: 'Code TOTP requis',
          tempToken: jwt.sign({ id: user._id, step: '2fa' }, process.env.JWT_SECRET, { expiresIn: '5m' })
        });
      }
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: totpCode,
        window: 2
      });
      if (!verified) {
        // Vérifier backup codes
        const backupIndex = user.twoFactorBackupCodes.indexOf(totpCode);
        if (backupIndex === -1) {
          return res.status(401).json({ success: false, message: 'Code 2FA invalide' });
        }
        user.twoFactorBackupCodes.splice(backupIndex, 1);
      }
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.cleanExpiredTokens();
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      deviceInfo: req.headers['user-agent']?.substring(0, 100)
    });
    user.lastLogin = new Date();

    // Streak de connexion
    const today = new Date().toDateString();
    const lastLogin = user.stats?.lastLoginDate ? new Date(user.stats.lastLoginDate).toDateString() : null;
    if (lastLogin !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (lastLogin === yesterday) {
        user.stats.loginStreak = (user.stats.loginStreak || 0) + 1;
      } else {
        user.stats.loginStreak = 1;
      }
      user.stats.lastLoginDate = new Date();
      // +10 points/connexion quotidienne
      user.points += 10;
    }

    await user.save();

    res.json({
      success: true,
      message: `Bienvenue, ${user.name} !`,
      accessToken,
      refreshToken,
      user: sanitizeUser(user)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/refresh
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token manquant' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: 'Utilisateur introuvable' });

    const tokenDoc = user.refreshTokens.find(t => t.token === refreshToken && t.expiresAt > new Date());
    if (!tokenDoc) {
      return res.status(401).json({ success: false, message: 'Refresh token invalide ou expiré' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);
    user.refreshTokens.push({
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    await user.save();

    res.json({ success: true, accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Refresh token invalide' });
  }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken && req.user) {
      req.user.refreshTokens = req.user.refreshTokens.filter(t => t.token !== refreshToken);
      await req.user.save();
    }
    res.json({ success: true, message: 'Déconnexion réussie' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ success: false, message: 'Email ou téléphone requis' });

    const isEmail = identifier.includes('@');
    const query = isEmail ? { email: identifier.toLowerCase() } : { phone: identifier };
    const user = await User.findOne(query);

    // Toujours renvoyer succès pour éviter l'énumération
    if (!user) {
      return res.json({ success: true, message: 'Si ce compte existe, un email/SMS de réinitialisation a été envoyé.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.RESET_PASSWORD_URL}/${resetToken}`;
    await emailService.sendPasswordResetEmail(user, resetUrl).catch(console.error);

    res.json({ success: true, message: 'Si ce compte existe, un email de réinitialisation a été envoyé.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/reset-password/:token
exports.resetPassword = async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Token invalide ou expiré' });
    }

    const { password, confirmPassword } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 8 caractères' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas' });
    }

    user.passwordHash = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshTokens = []; // invalidate all sessions
    await user.save();

    res.json({ success: true, message: 'Mot de passe réinitialisé avec succès. Reconnectez-vous.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/enable-2fa
exports.enable2FA = async (req, res) => {
  try {
    const user = req.user;
    const secret = speakeasy.generateSecret({
      name: `BINOVA (${user.email})`,
      issuer: 'BINOVA - SGAO-SARL'
    });

    user.twoFactorSecret = secret.base32;
    await user.save({ validateBeforeSave: false });

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
    res.json({
      success: true,
      message: 'Scannez le QR code avec votre application d\'authentification',
      qrCode: qrCodeUrl,
      secret: secret.base32,
      manualEntry: secret.otpauth_url
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/verify-2fa (confirme activation)
exports.verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user._id).select('+twoFactorSecret');

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({ success: false, message: 'Code invalide' });
    }

    // Générer backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );
    user.twoFactorBackupCodes = backupCodes;
    user.twoFactorEnabled = true;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: 'Authentification à deux facteurs activée',
      backupCodes
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/disable-2fa
exports.disable2FA = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id).select('+passwordHash');
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
    }
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = [];
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, message: '2FA désactivé' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, user: sanitizeUser(req.user) });
};

// PATCH /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.user._id).select('+passwordHash');

    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) return res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect' });

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Les nouveaux mots de passe ne correspondent pas' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit avoir au moins 8 caractères' });
    }

    user.passwordHash = newPassword;
    user.refreshTokens = [];
    await user.save();

    res.json({ success: true, message: 'Mot de passe modifié. Reconnectez-vous.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
