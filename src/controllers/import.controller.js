const Bin = require('../models/Bin');
const User = require('../models/User');
const fs = require('fs');

// POST /api/import/bins
exports.importBins = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    }

    const content = fs.readFileSync(req.file.path, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const errors = [];
    let imported = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, idx) => row[h] = values[idx]);

      try {
        await Bin.create({
          binId: row.binId,
          name: row.name,
          zone: row.zone,
          address: row.address,
          location: {
            type: 'Point',
            coordinates: [parseFloat(row.longitude || 11.5), parseFloat(row.latitude || 3.8)]
          },
          fillLevel: parseInt(row.fillLevel) || 0,
          status: row.status || 'active',
          wasteType: row.wasteType || 'mixed',
          battery: parseInt(row.battery) || 100,
          capacity: parseInt(row.capacity) || 240
        });
        imported++;
      } catch (err) {
        errors.push({ row: row.binId, error: err.message });
      }
    }

    fs.unlinkSync(req.file.path);
    res.json({
      success: true,
      message: `${imported} bacs importés avec succès`,
      imported,
      errors: errors.length,
      errorDetails: errors
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/import/users
exports.importUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    }

    const content = fs.readFileSync(req.file.path, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const errors = [];
    let imported = 0;
    const bcrypt = require('bcryptjs');

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, idx) => row[h] = values[idx]);

      try {
        const passwordHash = await bcrypt.hash(row.password || 'password123', 12);
        await User.create({
          cni: row.cni,
          phone: row.phone,
          email: row.email,
          passwordHash,
          name: row.name,
          role: row.role || 'citizen',
          zone: row.zone,
          points: parseInt(row.points) || 0,
          level: row.level || 'Bronze'
        });
        imported++;
      } catch (err) {
        errors.push({ row: row.email, error: err.message });
      }
    }

    fs.unlinkSync(req.file.path);
    res.json({
      success: true,
      message: `${imported} utilisateurs importés avec succès`,
      imported,
      errors: errors.length,
      errorDetails: errors
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
