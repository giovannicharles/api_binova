const Tour = require('../models/Tour');
const Bin = require('../models/Bin');

// GET /api/tours
exports.getTours = async (req, res) => {
  try {
    const { status, zone, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (zone) filter.zone = zone;
    if (req.user.role === 'collector') filter.collector = req.user._id;

    const tours = await Tour.find(filter)
      .populate('collector', 'name phone')
      .populate('createdBy', 'name')
      .populate('bins.bin', 'name binId zone fillLevel location')
      .sort({ scheduledAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Tour.countDocuments(filter);
    res.json({ success: true, data: tours, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/tours
exports.createTour = async (req, res) => {
  try {
    const { name, type, collector, binIds, zone, scheduledAt, notes } = req.body;
    if (!name || !binIds?.length || !scheduledAt) {
      return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
    }

    const bins = binIds.map((id, idx) => ({ bin: id, order: idx + 1 }));
    const tour = await Tour.create({
      name,
      type: type || 'manual',
      collector,
      bins,
      zone,
      scheduledAt: new Date(scheduledAt),
      notes,
      createdBy: req.user._id
    });

    await tour.populate('bins.bin', 'name binId zone fillLevel');

    const io = req.app.get('io');
    if (io) io.emit('tour:new', { tour });

    res.status(201).json({ success: true, data: tour, message: 'Tournée créée' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/tours/:id
exports.updateTour = async (req, res) => {
  try {
    const allowed = ['name', 'status', 'collector', 'scheduledAt', 'notes', 'estimatedDuration'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (req.body.status === 'in_progress') updates.startedAt = new Date();
    if (req.body.status === 'completed') {
      updates.completedAt = new Date();
      // Marquer tous les bacs comme vidés
      const tour = await Tour.findById(req.params.id);
      if (tour) {
        const binIds = tour.bins.map(b => b.bin);
        await Bin.updateMany({ _id: { $in: binIds } }, { fillLevel: 0, lastEmptied: new Date() });
      }
    }

    const tour = await Tour.findByIdAndUpdate(req.params.id, updates, { new: true }).populate('bins.bin', 'name binId zone');
    if (!tour) return res.status(404).json({ success: false, message: 'Tournée introuvable' });

    const io = req.app.get('io');
    if (io) io.emit('tour:update', { tour });

    res.json({ success: true, data: tour, message: 'Tournée mise à jour' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/tours/:id/bins/:binId/collect
exports.markBinCollected = async (req, res) => {
  try {
    const tour = await Tour.findById(req.params.id);
    if (!tour) return res.status(404).json({ success: false, message: 'Tournée introuvable' });

    const binEntry = tour.bins.find(b => b.bin.toString() === req.params.binId);
    if (!binEntry) return res.status(404).json({ success: false, message: 'Bac non trouvé dans cette tournée' });

    binEntry.status = 'collected';
    binEntry.collectedAt = new Date();
    binEntry.note = req.body.note;
    await tour.save();

    await Bin.findByIdAndUpdate(req.params.binId, { fillLevel: 0, lastEmptied: new Date() });

    const io = req.app.get('io');
    if (io) io.emit('tour:bin-collected', { tourId: tour._id, binId: req.params.binId });

    res.json({ success: true, data: tour, message: 'Bac marqué comme collecté' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/tours/:id
exports.deleteTour = async (req, res) => {
  try {
    const tour = await Tour.findByIdAndDelete(req.params.id);
    if (!tour) return res.status(404).json({ success: false, message: 'Tournée introuvable' });
    res.json({ success: true, message: 'Tournée supprimée' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
