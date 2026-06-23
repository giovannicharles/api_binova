const Bin = require('../models/Bin');
const Report = require('../models/Report');
const User = require('../models/User');
const Tour = require('../models/Tour');
const PDFDocument = require('pdfkit');

// GET /api/stats/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalBins, activeBins, fullBins, offlineBins,
      totalReports, pendingReports, resolvedToday,
      totalUsers, newUsersWeek,
      toursToday
    ] = await Promise.all([
      Bin.countDocuments(),
      Bin.countDocuments({ status: 'active' }),
      Bin.countDocuments({ status: 'full' }),
      Bin.countDocuments({ status: 'offline' }),
      Report.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments({ status: 'resolved', resolvedAt: { $gte: today } }),
      User.countDocuments({ role: 'citizen' }),
      User.countDocuments({ role: 'citizen', createdAt: { $gte: weekAgo } }),
      Tour.countDocuments({ scheduledAt: { $gte: today }, status: { $ne: 'cancelled' } })
    ]);

    const avgFillLevel = await Bin.aggregate([
      { $group: { _id: null, avg: { $avg: '$fillLevel' } } }
    ]);

    const fillByZone = await Bin.aggregate([
      { $group: { _id: '$zone', avgFill: { $avg: '$fillLevel' }, count: { $sum: 1 } } },
      { $sort: { avgFill: -1 } }
    ]);

    const reportsByDay = await Report.aggregate([
      { $match: { createdAt: { $gte: weekAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        bins: { total: totalBins, active: activeBins, full: fullBins, offline: offlineBins, avgFillLevel: Math.round(avgFillLevel[0]?.avg || 0) },
        reports: { total: totalReports, pending: pendingReports, resolvedToday },
        users: { total: totalUsers, newThisWeek: newUsersWeek },
        tours: { today: toursToday },
        fillByZone,
        reportsByDay,
        timestamp: now
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/stats/opens-by-area
exports.getOpensByArea = async (req, res) => {
  try {
    const data = await Bin.aggregate([
      {
        $group: {
          _id: '$zone',
          totalOpenings: { $sum: '$openingsTotal' },
          todayOpenings: { $sum: '$openingsToday' },
          binCount: { $sum: 1 },
          avgFill: { $avg: '$fillLevel' }
        }
      },
      { $sort: { totalOpenings: -1 } }
    ]);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/stats/waste-types
exports.getWasteTypes = async (req, res) => {
  try {
    const data = await Bin.aggregate([
      { $group: { _id: '$wasteType', count: { $sum: 1 }, avgFill: { $avg: '$fillLevel' } } },
      { $sort: { count: -1 } }
    ]);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/stats/fill-trend
exports.getFillTrend = async (req, res) => {
  try {
    const { days = 7, binId } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const filter = { lastDataReceived: { $gte: since } };
    if (binId) filter._id = binId;

    const bins = await Bin.find(filter).select('binId name zone history');
    const trend = {};

    bins.forEach(bin => {
      bin.history.filter(h => h.timestamp >= since).forEach(h => {
        const day = h.timestamp.toISOString().split('T')[0];
        if (!trend[day]) trend[day] = { date: day, totalFill: 0, count: 0 };
        trend[day].totalFill += h.fillLevel;
        trend[day].count++;
      });
    });

    const result = Object.values(trend).map(d => ({
      date: d.date,
      avgFill: Math.round(d.totalFill / d.count)
    })).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/stats/export/pdf
exports.exportPDF = async (req, res) => {
  try {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="binova-rapport-${new Date().toISOString().split('T')[0]}.pdf"`);
    doc.pipe(res);

    // Header
    doc.rect(0, 0, 612, 80).fill('#2C7A3E');
    doc.fillColor('#FFFFFF').fontSize(24).font('Helvetica-Bold').text('BINOVA', 50, 20);
    doc.fontSize(12).font('Helvetica').text('Rapport de gestion des déchets - SGAO-SARL', 50, 50);
    doc.fillColor('#1E293B');

    doc.moveDown(3);
    doc.fontSize(10).text(`Date : ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'right' });

    // Stats
    const [totalBins, totalReports, totalUsers] = await Promise.all([
      Bin.countDocuments(),
      Report.countDocuments(),
      User.countDocuments({ role: 'citizen' })
    ]);
    const avgFill = await Bin.aggregate([{ $group: { _id: null, avg: { $avg: '$fillLevel' } } }]);
    const fillByZone = await Bin.aggregate([
      { $group: { _id: '$zone', avgFill: { $avg: '$fillLevel' }, count: { $sum: 1 } } },
      { $sort: { avgFill: -1 } }
    ]);

    doc.moveDown(2);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#2C7A3E').text('Résumé Exécutif');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').fillColor('#1E293B');
    doc.text(`Total des bacs connectés : ${totalBins}`);
    doc.text(`Niveau de remplissage moyen : ${Math.round(avgFill[0]?.avg || 0)}%`);
    doc.text(`Total signalements : ${totalReports}`);
    doc.text(`Citoyens enregistrés : ${totalUsers}`);

    doc.moveDown(2);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#2C7A3E').text('Analyse par Zone');
    doc.moveDown(0.5);
    fillByZone.forEach(z => {
      const bar = Math.round(z.avgFill / 2);
      doc.fontSize(10).font('Helvetica').fillColor('#1E293B');
      doc.text(`${z._id} : ${Math.round(z.avgFill)}% (${z.count} bac${z.count > 1 ? 's' : ''})`);
    });

    doc.moveDown(3);
    doc.fontSize(8).fillColor('#475569').text('BINOVA • Une vie plus saine, pour un avenir durable • SGAO-SARL, Yaoundé, Cameroun 2026', { align: 'center' });

    doc.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/stats/export/csv
exports.exportCSV = async (req, res) => {
  try {
    const bins = await Bin.find().select('-history -__v').lean();
    const headers = ['binId', 'name', 'zone', 'fillLevel', 'status', 'battery', 'wasteType', 'openingsToday', 'openingsTotal', 'lastDataReceived'];
    const rows = bins.map(b => headers.map(h => b[h] ?? '').join(','));
    const csv = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="binova-bacs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
