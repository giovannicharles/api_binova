const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error('❌ Error:', err);

  // Mongoose: ID invalide
  if (err.name === 'CastError') {
    error.message = 'Ressource introuvable';
    return res.status(404).json({ success: false, message: error.message });
  }

  // Mongoose: champ unique dupliqué
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const fieldNames = { cni: 'CNI', phone: 'Téléphone', email: 'Email' };
    error.message = `${fieldNames[field] || field} déjà utilisé(e)`;
    return res.status(400).json({ success: false, message: error.message });
  }

  // Mongoose: validation
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ success: false, message: messages[0], errors: messages });
  }

  // JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Token invalide' });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Erreur serveur interne',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
