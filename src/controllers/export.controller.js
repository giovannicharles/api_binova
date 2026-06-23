const Bin = require('../models/Bin');
const User = require('../models/User');
const Report = require('../models/Report');
const Activity = require('../models/Activity');

// GET /api/export/bins
exports.exportBins = async (req, res) => {
  try {
    const bins = await Bin.find().lean();
    const csv = [
      ['binId', 'name', 'zone', 'address', 'fillLevel', 'status', 'wasteType', 'battery', 'capacity'].join(','),
      ...bins.map(b => [
        b.binId, b.name, b.zone, b.address || '', b.fillLevel, b.status, b.wasteType, b.battery, b.capacity
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bins-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/export/users
exports.exportUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'citizen' }).lean();
    const csv = [
      ['name', 'email', 'phone', 'zone', 'points', 'level', 'reportsSubmitted', 'loginStreak'].join(','),
      ...users.map(u => [
        u.name, u.email, u.phone, u.zone, u.points, u.level, u.stats?.reportsSubmitted || 0, u.stats?.loginStreak || 0
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=users-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/export/reports
exports.exportReports = async (req, res) => {
  try {
    const reports = await Report.find().populate('user', 'name').lean();
    const csv = [
      ['reportId', 'title', 'category', 'priority', 'status', 'zone', 'user', 'createdAt'].join(','),
      ...reports.map(r => [
        r.reportId, r.title, r.category, r.priority, r.status, r.zone, r.user?.name || 'N/A', r.createdAt
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=reports-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/export/activities
exports.exportActivities = async (req, res) => {
  try {
    const activities = await Activity.find().populate('user', 'name').lean();
    const csv = [
      ['action', 'entityType', 'user', 'details', 'createdAt'].join(','),
      ...activities.map(a => [
        a.action, a.entityType || '', a.user?.name || 'System', JSON.stringify(a.details), a.createdAt
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=activities-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
