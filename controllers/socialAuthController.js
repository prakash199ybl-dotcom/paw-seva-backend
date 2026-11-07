// ============================================================
//   PAW SEVA — controllers/socialAuthController.js (v5.2)
//   Google Sign-In (ID token) + frontend ke liye public config.
//   Google client SECRET ki zaroorat nahi, sirf GOOGLE_CLIENT_ID.
// ============================================================
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { smsConfigured, whatsappConfigured } = require('../utils/otpDelivery');

const ROLES = ['Donor', 'Volunteer', 'Feeder', 'NGO'];
const googleClient = new OAuth2Client();

// ── Frontend ko batao kya-kya login available hai ─────────────
const publicConfig = (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    instagramUrl:   process.env.INSTAGRAM_URL || null,
    smsOtp:         smsConfigured(),
    whatsappOtp:    whatsappConfigured(),
  });
};

// ── POST /api/auth/google  { credential, role?, city? } ───────
const googleLogin = async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(503).json({ success: false, message: 'Google login abhi configure nahi hai.' });

    const credential = String((req.body && req.body.credential) || '');
    if (!credential) return res.status(400).json({ success: false, message: 'Google credential missing hai.' });

    // Google ka token verify: signature, audience (hamara client id), expiry, issuer
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Google token invalid ya expire ho gaya. Dubara try karein.' });
    }
    if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({ success: false, message: 'Google account ka email verified nahi hai.' });
    }
    const email = String(payload.email).toLowerCase();

    let user = await User.findOne({ googleId: payload.sub });

    if (!user) {
      // Is email se koi purana account hai? Email signup mein verify nahi hota, isliye
      // auto-link NAHI karte (koi doosre ka email daal kar account pehle bana sakta hai).
      const sameEmail = await User.findOne({ email });
      if (sameEmail) {
        return res.status(409).json({
          success: false,
          message: 'Is email se account pehle se hai. Usi tarah (mobile OTP se) login karein.',
        });
      }
      const role = ROLES.includes(req.body.role) ? req.body.role : 'Donor';
      user = await User.create({
        name: String(payload.name || email.split('@')[0]).slice(0, 60),
        email,
        googleId: payload.sub,
        authProvider: 'google',
        role,
        city: String((req.body && req.body.city) || '').trim().slice(0, 80),
      });
    }

    if (user.isActive === false) return res.status(403).json({ success: false, message: 'Aapka account disable hai.' });
    if (user.role === 'admin')   return res.status(403).json({ success: false, message: 'Admin account Google se login nahi hota.' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, city: user.city || '' },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { googleLogin, publicConfig };