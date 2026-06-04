const Report = require('../models/Report');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/reports';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `report-${Date.now()}-${Math.round(Math.random() * 1000)}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont autorisées'));
  }
});

exports.uploadMiddleware = upload.array('photos', 5);

// POST /api/reports
exports.createReport = async (req, res) => {
  try {
    const { title, description, category, priority, latitude, longitude, address, zone, binId } = req.body;

    if (!title || !description || !category || !latitude || !longitude || !zone) {
      return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
    }

    const photos = req.files ? req.files.map(f => `/uploads/reports/${f.filename}`) : [];

    const report = await Report.create({
      user: req.user._id,
      title,
      description,
      category,
      priority: priority || 'medium',
      location: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
      address,
      zone,
      photos,
      bin: binId || null,
      statusHistory: [{ status: 'pending', changedBy: req.user._id, note: 'Signalement créé' }]
    });

    // Points gamification
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { points: 50, 'stats.reportsSubmitted': 1 }
    });
    report.pointsAwarded = true;
    await report.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('report:new', { report: await report.populate('user', 'name zone') });
    }

    await report.populate('user', 'name zone');
    res.status(201).json({ success: true, data: report, message: '✅ Signalement soumis. +50 points !' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/reports
exports.getReports = async (req, res) => {
  try {
    const { zone, status, category, priority, page = 1, limit = 20, assignedTo } = req.query;
    const filter = {};

    // Citoyens voient seulement leurs signalements
    if (req.user.role === 'citizen') filter.user = req.user._id;
    else {
      if (zone) filter.zone = zone;
      if (status) filter.status = status;
      if (category) filter.category = category;
      if (priority) filter.priority = priority;
      if (assignedTo) filter.assignedTo = assignedTo;
    }

    const reports = await Report.find(filter)
      .populate('user', 'name zone phone')
      .populate('assignedTo', 'name phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Report.countDocuments(filter);

    res.json({
      success: true,
      data: reports,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/reports/:id
exports.getReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('user', 'name zone phone email')
      .populate('assignedTo', 'name phone')
      .populate('bin', 'name binId zone');
    if (!report) return res.status(404).json({ success: false, message: 'Signalement introuvable' });

    // Autorisation
    if (req.user.role === 'citizen' && !report.user._id.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/reports/:id/status
exports.updateReportStatus = async (req, res) => {
  try {
    const { status, note, assignedTo, partsNeeded, resolutionNote } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Signalement introuvable' });

    const prevStatus = report.status;
    report.status = status || report.status;
    if (note || status) {
      report.statusHistory.push({ status: report.status, changedBy: req.user._id, note: note || '' });
    }
    if (assignedTo) {
      report.assignedTo = assignedTo;
      report.assignedAt = new Date();
    }
    if (partsNeeded) report.partsNeeded = partsNeeded;
    if (resolutionNote) report.resolutionNote = resolutionNote;
    if (status === 'resolved') report.resolvedAt = new Date();

    await report.save();
    await report.populate('user assignedTo');

    const io = req.app.get('io');
    if (io) io.emit('report:status', { report, prevStatus });

    res.json({ success: true, data: report, message: 'Statut mis à jour' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/reports/:id
exports.deleteReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Signalement introuvable' });

    if (req.user.role === 'citizen' && !report.user.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    await report.deleteOne();
    res.json({ success: true, message: 'Signalement supprimé' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
