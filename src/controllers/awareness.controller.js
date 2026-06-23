// ===== src/controllers/awareness.controller.js =====
const Awareness = require('../models/Awareness');

exports.getAll = async (req, res, next) => {
  try {
    const { type, zone, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (zone) filter.zones = { $in: [zone, 'all'] };

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Awareness.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(Number(limit)),
      Awareness.countDocuments(filter)
    ]);

    res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const article = await Awareness.findById(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Article non trouvé' });
    res.json({ success: true, data: article });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const article = await Awareness.create({ ...req.body, publishedAt: new Date() });
    res.status(201).json({ success: true, data: article });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const article = await Awareness.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!article) return res.status(404).json({ success: false, message: 'Article non trouvé' });
    res.json({ success: true, data: article });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await Awareness.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Article supprimé' });
  } catch (err) { next(err); }
};
