const Bin = require('../models/Bin');

let simulatorInterval = null;
let simulatorConfig = { speed: 1, scenario: 'normal', active: false };

// POST /api/iot/data
exports.receiveIoTData = async (req, res) => {
  try {
    const { binId, fillLevel, openings, wasteType, battery, temperature, humidity } = req.body;

    if (!binId) return res.status(400).json({ success: false, message: 'binId requis' });

    let bin = await Bin.findOne({ binId: binId.toUpperCase() });
    if (!bin) {
      return res.status(404).json({ success: false, message: `Bac ${binId} introuvable` });
    }

    const prevLevel = bin.fillLevel;
    bin.fillLevel = Math.min(100, Math.max(0, fillLevel ?? bin.fillLevel));
    bin.openingsToday = openings !== undefined ? bin.openingsToday + openings : bin.openingsToday;
    bin.openingsTotal += openings || 0;
    bin.wasteType = wasteType || bin.wasteType;
    bin.battery = battery !== undefined ? battery : bin.battery;
    bin.temperature = temperature ?? bin.temperature;
    bin.humidity = humidity ?? bin.humidity;
    bin.lastDataReceived = new Date();

    // Historique (limité à 2000 entrées)
    bin.history.push({
      timestamp: new Date(),
      fillLevel: bin.fillLevel,
      openings: openings || 0,
      wasteType: bin.wasteType,
      battery: bin.battery,
      temperature: bin.temperature,
      humidity: bin.humidity
    });
    if (bin.history.length > 2000) bin.history = bin.history.slice(-2000);

    // Mise à jour status
    if (bin.fillLevel >= 100) bin.status = 'full';
    else if (bin.status === 'full') bin.status = 'active';
    if (bin.battery < 5) bin.status = 'offline';

    await bin.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('bin:update', { bin, prevLevel });

      // Alertes
      if (bin.fillLevel >= bin.alertThresholds.critical && prevLevel < bin.alertThresholds.critical) {
        io.emit('bin:alert', {
          bin,
          type: 'critical',
          message: `🚨 Bac ${bin.name} (${bin.zone}) critique : ${bin.fillLevel}%`
        });
      } else if (bin.fillLevel >= bin.alertThresholds.attention && prevLevel < bin.alertThresholds.attention) {
        io.emit('bin:alert', {
          bin,
          type: 'attention',
          message: `⚠️ Bac ${bin.name} (${bin.zone}) : ${bin.fillLevel}%`
        });
      }
    }

    res.json({ success: true, data: bin, message: 'Données IoT reçues' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/iot/simulate/start
exports.startSimulator = async (req, res) => {
  try {
    if (simulatorInterval) clearInterval(simulatorInterval);

    const { speed = 1, scenario = 'normal' } = req.body;
    simulatorConfig = { speed, scenario, active: true };

    const intervalMs = Math.max(5000, 30000 / speed);
    const io = req.app.get('io');

    const runSimulation = async () => {
      const bins = await Bin.find({ isSimulated: true });
      if (!bins.length) return;

      for (const bin of bins) {
        const prevLevel = bin.fillLevel;
        let increment = 0;

        switch (scenario) {
          case 'peak': increment = Math.random() * 8 + 2; break;
          case 'slow': increment = Math.random() * 2; break;
          case 'failure':
            if (Math.random() < 0.05) {
              bin.status = 'offline';
              bin.battery = Math.max(0, bin.battery - 5);
              await bin.save();
              if (io) io.emit('bin:alert', { bin, type: 'failure', message: `❌ Panne détectée: ${bin.name}` });
              continue;
            }
            increment = Math.random() * 5;
            break;
          default: increment = Math.random() * 4 + 0.5;
        }

        bin.fillLevel = Math.min(100, bin.fillLevel + increment);
        bin.openingsToday += Math.random() < 0.3 ? Math.floor(Math.random() * 3) + 1 : 0;
        bin.openingsTotal += bin.openingsToday;
        bin.battery = Math.max(0, bin.battery - (Math.random() * 0.2));
        bin.temperature = 25 + Math.random() * 10;
        bin.humidity = 40 + Math.random() * 40;
        bin.lastDataReceived = new Date();

        bin.history.push({
          timestamp: new Date(),
          fillLevel: bin.fillLevel,
          openings: bin.openingsToday,
          wasteType: bin.wasteType,
          battery: bin.battery
        });
        if (bin.history.length > 2000) bin.history = bin.history.slice(-2000);

        if (bin.fillLevel >= 100) bin.status = 'full';
        await bin.save();

        if (io) {
          io.emit('bin:update', { bin, prevLevel });
          if (bin.fillLevel >= bin.alertThresholds.critical && prevLevel < bin.alertThresholds.critical) {
            io.emit('bin:alert', { bin, type: 'critical', message: `🚨 ${bin.name} critique: ${Math.round(bin.fillLevel)}%` });
          }
        }
      }
    };

    simulatorInterval = setInterval(runSimulation, intervalMs);
    runSimulation(); // Premier cycle immédiat

    res.json({
      success: true,
      message: `Simulateur IoT démarré (scenario: ${scenario}, vitesse: x${speed}, intervalle: ${intervalMs / 1000}s)`,
      config: simulatorConfig
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/iot/simulate/stop
exports.stopSimulator = async (req, res) => {
  if (simulatorInterval) {
    clearInterval(simulatorInterval);
    simulatorInterval = null;
  }
  simulatorConfig.active = false;
  res.json({ success: true, message: 'Simulateur IoT arrêté' });
};

// GET /api/iot/simulate/status
exports.getSimulatorStatus = async (req, res) => {
  res.json({ success: true, data: simulatorConfig });
};

// POST /api/iot/simulate/seed — crée des bacs simulés
exports.seedSimulatedBins = async (req, res) => {
  try {
    const zones = ['Bastos', 'Nlongkak', 'Melen', 'Essos', 'Mvog-Ada', 'Biyem-Assi', 'Mendong', 'Mimboman'];
    const binData = [];

    // Coordonnées Yaoundé centre + variations
    const baseCoords = { lat: 3.8667, lng: 11.5167 };
    let counter = 1;

    for (const zone of zones) {
      const binsPerZone = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < binsPerZone; i++) {
        binData.push({
          binId: `BIN-${zone.toUpperCase().replace(/[^A-Z]/g, '')}-${String(counter).padStart(3, '0')}`,
          name: `Bac ${zone} #${i + 1}`,
          zone,
          address: `Rue ${Math.floor(Math.random() * 100) + 1}, ${zone}`,
          location: {
            type: 'Point',
            coordinates: [
              baseCoords.lng + (Math.random() - 0.5) * 0.1,
              baseCoords.lat + (Math.random() - 0.5) * 0.1
            ]
          },
          fillLevel: Math.floor(Math.random() * 90),
          battery: Math.floor(Math.random() * 40) + 60,
          wasteType: ['mixed', 'organic', 'recyclable'][Math.floor(Math.random() * 3)],
          isSimulated: true,
          status: ['active', 'active', 'active', 'maintenance'][Math.floor(Math.random() * 4)]
        });
        counter++;
      }
    }

    await Bin.deleteMany({ isSimulated: true });
    const bins = await Bin.insertMany(binData);

    res.json({ success: true, message: `${bins.length} bacs simulés créés`, count: bins.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
