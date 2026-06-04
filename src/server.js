require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const initSocket = require('./socket.js');
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const binRoutes = require('./routes/bin.routes');
const reportRoutes = require('./routes/report.routes');
const messageRoutes = require('./routes/message.routes');
const statsRoutes = require('./routes/stats.routes');
const iotRoutes = require('./routes/iot.routes');
const notificationRoutes = require('./routes/notification.routes');
const awarenessRoutes = require('./routes/awareness.routes');
const tourRoutes = require('./routes/tour.routes');

const app = express();
const server = http.createServer(app);

// Init Socket.io
const io = initSocket(server);
app.set('io', io);

// Connect DB
connectDB();

// Security Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(mongoSanitize());
app.use(hpp());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Trop de requêtes, réessayez dans 15 minutes.' }
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Trop de tentatives, réessayez dans 15 minutes.' }
});

// CORS
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:4200',
  process.env.ADMIN_URL || 'http://localhost:4300',
  'http://localhost:4200',
  'http://localhost:4300',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Body Parser
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Static files (uploads)
app.use('/uploads', express.static('uploads'));

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bins', binRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/awareness', awarenessRoutes);
app.use('/api/tours', tourRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'BINOVA API is running 🌿',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint non trouvé' });
});

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🌿 ===================================`);
  console.log(`   BINOVA API - SGAO-SARL`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Env:  ${process.env.NODE_ENV}`);
  console.log(`===================================\n`);
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});

module.exports = { app, server };
