const Bin = require('../models/Bin');

// GET /api/bins
exports.getBins = async (req, res) => {
  try {
    const { zone, status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (zone) filter.zone = zone;
    if (status) filter.status = status;

    const bins = await Bin.find(filter)
      .select('-history')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ zone: 1, name: 1 });

    const total = await Bin.countDocuments(filter);

    res.json({
      success: true,
      data: bins,
      total,
      totalPages: Math.ceil(total / limit),
      page: Number(page),
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/bins/my (citizen's bins)
exports.getMyBins = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const filter = { owner: req.user._id };

    const bins = await Bin.find(filter)
      .select('-history')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ name: 1 });

    const total = await Bin.countDocuments(filter);

    res.json({
      success: true,
      data: bins,
      total,
      totalPages: Math.ceil(total / limit),
      page: Number(page),
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/bins/map/geojson
exports.getBinsGeoJSON = async (req, res) => {
  try {
    const { zone } = req.query;
    const filter = zone ? { zone } : {};
    const bins = await Bin.find(filter).select('-history');

    const geojson = {
      type: 'FeatureCollection',
      features: bins.map(bin => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: bin.location.coordinates
        },
        properties: {
          id: bin._id,
          binId: bin.binId,
          name: bin.name,
          zone: bin.zone,
          fillLevel: bin.fillLevel,
          status: bin.status,
          statusColor: bin.statusColor,
          battery: bin.battery,
          wasteType: bin.wasteType,
          openingsToday: bin.openingsToday,
          lastDataReceived: bin.lastDataReceived,
          hasAlert: bin.hasAlert,
          address: bin.address
        }
      }))
    };

    res.json({ success: true, data: geojson });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/bins/:id
exports.getBin = async (req, res) => {
  try {
    const bin = await Bin.findById(req.params.id);
    if (!bin) return res.status(404).json({ success: false, message: 'Bac introuvable' });
    res.json({ success: true, data: bin });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/bins/:id/history
exports.getBinHistory = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const bin = await Bin.findById(req.params.id).select('binId name history');
    if (!bin) return res.status(404).json({ success: false, message: 'Bac introuvable' });

    const history = bin.history.filter(h => h.timestamp >= since);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/bins (admin)
exports.createBin = async (req, res) => {
  try {
    const { binId, name, zone, address, latitude, longitude, wasteType, alertThresholds, location } = req.body;
    const lat = latitude ?? location?.coordinates?.[1];
    const lng = longitude ?? location?.coordinates?.[0];
    const resolvedName = name || binId;

    if (!binId || !resolvedName || !zone || lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
    }

    const bin = await Bin.create({
      binId,
      name: resolvedName,
      zone,
      address,
      location: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
      wasteType: wasteType || 'mixed',
      alertThresholds: alertThresholds || { attention: 80, critical: 95 }
    });

    res.status(201).json({ success: true, data: bin, message: 'Bac créé avec succès' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/bins/:id (admin)
exports.updateBin = async (req, res) => {
  try {
    const allowed = ['name', 'zone', 'address', 'status', 'wasteType', 'alertThresholds', 'capacity'];
    const updates = {};
    allowed.forEach(field => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });

    const lat = req.body.latitude ?? req.body.location?.coordinates?.[1];
    const lng = req.body.longitude ?? req.body.location?.coordinates?.[0];
    if (lat !== undefined && lng !== undefined) {
      updates.location = { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] };
    }

    const bin = await Bin.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!bin) return res.status(404).json({ success: false, message: 'Bac introuvable' });

    res.json({ success: true, data: bin, message: 'Bac mis à jour' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/bins/:id (admin)
exports.deleteBin = async (req, res) => {
  try {
    const bin = await Bin.findByIdAndDelete(req.params.id);
    if (!bin) return res.status(404).json({ success: false, message: 'Bac introuvable' });
    res.json({ success: true, message: 'Bac supprimé' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/bins/:id/empty (marquer comme vidé)
exports.markBinEmptied = async (req, res) => {
  try {
    const bin = await Bin.findByIdAndUpdate(
      req.params.id,
      { fillLevel: 0, openingsToday: 0, lastEmptied: new Date(), status: 'active' },
      { new: true }
    );
    if (!bin) return res.status(404).json({ success: false, message: 'Bac introuvable' });

    const io = req.app.get('io');
    if (io) io.emit('bin:update', { bin, type: 'emptied' });

    res.json({ success: true, data: bin, message: 'Bac marqué comme vidé' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/bins/zones
exports.getZones = async (req, res) => {
  try {
    const zones = await Bin.distinct('zone');
    res.json({ success: true, data: zones.sort() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
