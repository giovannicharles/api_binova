const nodemailer = require('nodemailer');

const getTransporter = () => {
  if (process.env.NODE_ENV === 'development') {
    // Utiliser Ethereal en dev
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: process.env.EMAIL_USER || 'test@ethereal.email', pass: process.env.EMAIL_PASS || 'test' }
    });
  }
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.sendgrid.net',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
};

const emailBase = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #F8FAFC; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(44,122,62,0.1); }
    .header { background: linear-gradient(135deg, #2C7A3E, #16A34A); padding: 32px 40px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 28px; letter-spacing: 2px; }
    .header p { color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px; }
    .body { padding: 40px; color: #1E293B; }
    .btn { display: inline-block; background: #2C7A3E; color: #fff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .footer { background: #F8FAFC; padding: 20px 40px; text-align: center; font-size: 12px; color: #475569; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌿 BINOVA</h1>
      <p>SGAO-SARL • Yaoundé, Cameroun</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      © 2026 BINOVA - SGAO-SARL | Une vie plus saine, pour un avenir durable<br>
      Yaoundé, Cameroun
    </div>
  </div>
</body>
</html>`;

exports.sendWelcomeEmail = async (user) => {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"BINOVA" <${process.env.EMAIL_FROM || 'noreply@binova.cm'}>`,
    to: user.email,
    subject: '🌿 Bienvenue sur BINOVA - Votre compte est créé !',
    html: emailBase(`
      <h2>Bonjour ${user.name} ! 👋</h2>
      <p>Votre compte BINOVA a été créé avec succès. Vous êtes maintenant prêt(e) à contribuer à une ville plus propre à Yaoundé.</p>
      <p><strong>Zone :</strong> ${user.zone}</p>
      <p>Avec BINOVA, vous pouvez :</p>
      <ul>
        <li>🗺️ Suivre le niveau des bacs près de chez vous</li>
        <li>📋 Signaler des problèmes</li>
        <li>💬 Contacter notre support</li>
        <li>🏆 Gagner des points et badges</li>
      </ul>
      <p><em>BINOVA • Une vie plus saine, pour un avenir durable</em></p>
    `)
  });
};

exports.sendPasswordResetEmail = async (user, resetUrl) => {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"BINOVA" <${process.env.EMAIL_FROM || 'noreply@binova.cm'}>`,
    to: user.email,
    subject: '🔐 Réinitialisation de votre mot de passe BINOVA',
    html: emailBase(`
      <h2>Réinitialisation de mot de passe</h2>
      <p>Bonjour ${user.name},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
      <center><a href="${resetUrl}" class="btn">Réinitialiser mon mot de passe</a></center>
      <p style="color:#475569; font-size:13px;">Ce lien est valable <strong>1 heure</strong>. Si vous n'avez pas effectué cette demande, ignorez cet email.</p>
      <p style="font-size:12px; word-break:break-all;">Lien direct : ${resetUrl}</p>
    `)
  });
};
