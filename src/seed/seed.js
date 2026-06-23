const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Bin = require('../models/Bin');

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Bin.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create admins (password will be hashed by pre-save hook)
    const monkam = await User.create({
      cni: '1234567890123',
      phone: '+237612345678',
      email: 'monkam@binova.cm',
      passwordHash: 'admin123',
      name: 'Monkam',
      role: 'admin',
      zone: 'Bastos',
      points: 0,
      level: 'Bronze'
    });

    const giovanni = await User.create({
      cni: '9876543210987',
      phone: '+237698765432',
      email: 'giovanni@binova.cm',
      passwordHash: 'admin123',
      name: 'Giovanni',
      role: 'admin',
      zone: 'Mvan',
      points: 0,
      level: 'Bronze'
    });

    console.log('👤 Created admins: monkam, giovanni');

    // Create clients with their bins (password will be hashed by pre-save hook)

    // Client 1: Dupont in Bastos
    const dupont = await User.create({
      cni: '1111111111111',
      phone: '+237611111111',
      email: 'dupont@example.com',
      passwordHash: 'client123',
      name: 'Jean Dupont',
      role: 'citizen',
      zone: 'Bastos',
      points: 150,
      level: 'Bronze',
      stats: {
        reportsSubmitted: 3,
        collectionsValidated: 0,
        loginStreak: 5
      }
    });

    // Create bins for Dupont
    await Bin.create([
      {
        binId: 'BAC-001',
        name: 'Bac Dupont - Maison',
        zone: 'Bastos',
        address: 'Rue Bastos 123',
        owner: dupont._id,
        location: {
          type: 'Point',
          coordinates: [11.5021, 3.8788]
        },
        fillLevel: 45,
        status: 'active',
        wasteType: 'mixed',
        battery: 95
      },
      {
        binId: 'BAC-002',
        name: 'Bac Dupont - Bureau',
        zone: 'Bastos',
        address: 'Bureau Bastos',
        owner: dupont._id,
        location: {
          type: 'Point',
          coordinates: [11.5031, 3.8798]
        },
        fillLevel: 72,
        status: 'active',
        wasteType: 'recyclable',
        battery: 88
      }
    ]);

    // Client 2: Mbarga in Mvan
    const mbarga = await User.create({
      cni: '2222222222222',
      phone: '+237622222222',
      email: 'mbarga@example.com',
      passwordHash: 'client123',
      name: 'Paul Mbarga',
      role: 'citizen',
      zone: 'Mvan',
      points: 520,
      level: 'Argent',
      stats: {
        reportsSubmitted: 12,
        collectionsValidated: 2,
        loginStreak: 15
      },
      badges: [
        { id: 'first_report', name: 'Premier signalement', icon: 'ri-flag-line', earnedAt: new Date() },
        { id: 'eco_citizen', name: 'Éco-citoyen', icon: 'ri-leaf-line', earnedAt: new Date() }
      ]
    });

    // Create bins for Mbarga
    await Bin.create([
      {
        binId: 'BAC-003',
        name: 'Bac Mbarga - Principal',
        zone: 'Mvan',
        address: 'Quartier Mvan',
        owner: mbarga._id,
        location: {
          type: 'Point',
          coordinates: [11.4921, 3.8688]
        },
        fillLevel: 88,
        status: 'active',
        wasteType: 'organic',
        battery: 75
      },
      {
        binId: 'BAC-004',
        name: 'Bac Mbarga - Secondaire',
        zone: 'Mvan',
        address: 'Mvan Extension',
        owner: mbarga._id,
        location: {
          type: 'Point',
          coordinates: [11.4931, 3.8698]
        },
        fillLevel: 34,
        status: 'active',
        wasteType: 'mixed',
        battery: 92
      },
      {
        binId: 'BAC-005',
        name: 'Bac Mbarga - Commerce',
        zone: 'Mvan',
        address: 'Marché Mvan',
        owner: mbarga._id,
        location: {
          type: 'Point',
          coordinates: [11.4941, 3.8708]
        },
        fillLevel: 97,
        status: 'full',
        wasteType: 'mixed',
        battery: 60
      }
    ]);

    // Client 3: Nkodo in Nkoldongo
    const nkodo = await User.create({
      cni: '3333333333333',
      phone: '+237633333333',
      email: 'nkodo@example.com',
      passwordHash: 'client123',
      name: 'Marie Nkodo',
      role: 'citizen',
      zone: 'Nkoldongo',
      points: 2450,
      level: 'Or',
      stats: {
        reportsSubmitted: 45,
        collectionsValidated: 8,
        loginStreak: 30
      },
      badges: [
        { id: 'first_report', name: 'Premier signalement', icon: 'ri-flag-line', earnedAt: new Date() },
        { id: 'eco_citizen', name: 'Éco-citoyen', icon: 'ri-leaf-line', earnedAt: new Date() },
        { id: 'recycler', name: 'Recycleur', icon: 'ri-recycle-line', earnedAt: new Date() }
      ]
    });

    // Create bins for Nkodo
    await Bin.create([
      {
        binId: 'BAC-006',
        name: 'Bac Nkodo - Domicile',
        zone: 'Nkoldongo',
        address: 'Nkoldongo 1',
        owner: nkodo._id,
        location: {
          type: 'Point',
          coordinates: [11.5121, 3.8888]
        },
        fillLevel: 56,
        status: 'active',
        wasteType: 'recyclable',
        battery: 85
      },
      {
        binId: 'BAC-007',
        name: 'Bac Nkodo - École',
        zone: 'Nkoldongo',
        address: 'École Nkoldongo',
        owner: nkodo._id,
        location: {
          type: 'Point',
          coordinates: [11.5131, 3.8898]
        },
        fillLevel: 23,
        status: 'active',
        wasteType: 'mixed',
        battery: 98
      }
    ]);

    // Create some public bins (no owner)
    await Bin.create([
      {
        binId: 'BAC-PUB-001',
        name: 'Bac Public - Centre Ville',
        zone: 'Messa',
        address: 'Centre Ville',
        location: {
          type: 'Point',
          coordinates: [11.5221, 3.8588]
        },
        fillLevel: 67,
        status: 'active',
        wasteType: 'mixed',
        battery: 80
      },
      {
        binId: 'BAC-PUB-002',
        name: 'Bac Public - Ekoumdoum',
        zone: 'Ekoumdoum',
        address: 'Ekoumdoum',
        location: {
          type: 'Point',
          coordinates: [11.5321, 3.8488]
        },
        fillLevel: 91,
        status: 'active',
        wasteType: 'mixed',
        battery: 45
      },
      {
        binId: 'BAC-PUB-003',
        name: 'Bac Public - Kondengui',
        zone: 'Kondengui',
        address: 'Kondengui',
        location: {
          type: 'Point',
          coordinates: [11.5421, 3.8388]
        },
        fillLevel: 42,
        status: 'active',
        wasteType: 'recyclable',
        battery: 90
      }
    ]);

    console.log('📦 Created bins for clients and public bins');
    console.log('👥 Created 3 clients with their bins');
    console.log('✅ Database seeded successfully!');

    console.log('\n📋 Login credentials:');
    console.log('Admins:');
    console.log('  - monkam@binova.cm / admin123');
    console.log('  - giovanni@binova.cm / admin123');
    console.log('Clients:');
    console.log('  - dupont@example.com / client123');
    console.log('  - mbarga@example.com / client123');
    console.log('  - nkodo@example.com / client123');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedDatabase();
