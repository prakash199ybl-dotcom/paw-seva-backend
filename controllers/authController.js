// ============================================================
//   PAW SEVA — controllers/authController.js (v5.1)
//   FIX: Login OTP ab backend se verify hota hai (real token milta hai).
//   Pehle frontend OTP khud banata tha, backend ko pata hi nahi tha,
//   isliye login-phone 401 deta tha aur demo (fake) session ban jata tha.
//
//   Env (Render):
//     OTP_SHOW_ON_SCREEN=true  -> OTP screen par dikhega (SMS lagne tak testing)
//     SMS lagne ke baad isko hata do / false kar do.
// ============================================================
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User   = require('../models/User');

// ── Token helpers ──────────────────────────────────────────────
const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id, user.role);
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id:    user._id,
      name:  user.name,
      email: user.email,
      role:  user.role,
      phone: user.phone,
      city:  user.city || '',
    },
  });
};

// ── OTP settings ───────────────────────────────────────────────
const OTP_TTL_MS    = 10 * 60 * 1000;  // OTP 10 minute valid
const MAX_ATTEMPTS  = 5;               // 5 galat try ke baad OTP khatam
const RESEND_GAP_MS = 30 * 1000;       // 30 sec se pehle dubara OTP nahi
const wrongTries = new Map();          // phone -> galat try count (server restart par reset)
const lastSent   = new Map();          // phone -> last OTP bhejne ka time

const showOtpOnScreen = () =>
  process.env.OTP_SHOW_ON_SCREEN === 'true' || process.env.NODE_ENV !== 'production';

// SMS bhejne ki jagah. Real SMS (MSG91/Twilio) yahin lagega.
async function deliverOtp(phone, otp) {
  // TODO: real SMS provider yahan call karo.
  if (showOtpOnScreen()) return { dev_otp: otp };
  const e = new Error('SMS service abhi configure nahi hai.');
  e.status = 503;
  throw e;
}

// ── Signup (email + optional phone) ────────────────────────────
const signup = async (req, res) => {
  try {
    const { name, email, password, role, phone, city } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required.' });
    if (role === 'admin') return res.status(400).json({ success: false, message: 'Cannot sign up as admin.' });

    if (email) {
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ success: false, message: 'Email already registered.' });
    }
    if (phone) {
      const exists = await User.findOne({ phone });
      if (exists) return res.status(400).json({ success: false, message: 'Mobile number already registered.' });
    }

    const userData = { name, role: role || 'Donor', authProvider: 'local' };
    if (email)    userData.email    = email;
    if (password) userData.password = password;
    if (phone)    userData.phone    = phone;
    if (city)     userData.city     = city;

    const user = await User.create(userData);
    sendTokenResponse(user, 201, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Login (email + password) — admin ke liye ───────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required.' });
    const user = await User.findOne({ email }).select('+password');
    if (!user || !await user.matchPassword(password))
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    if (user.isActive === false) return res.status(403).json({ success: false, message: 'Aapka account disable hai.' });
    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Send OTP (sirf registered number ko) ───────────────────────
const sendOTP = async (req, res) => {
  try {
    const phone = String((req.body && req.body.phone) || '').trim();
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number daalein.' });
    }

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ success: false, message: 'Is number se account nahi mila. Pehle Sign Up karein.' });
    if (user.isActive === false) return res.status(403).json({ success: false, message: 'Aapka account disable hai.' });
    if (user.role === 'admin')   return res.status(403).json({ success: false, message: 'Admin account email aur password se login hota hai.' });

    if (Date.now() - (lastSent.get(phone) || 0) < RESEND_GAP_MS) {
      return res.status(429).json({ success: false, message: 'Thodi der baad dubara OTP mangwayein.' });
    }

    const otp   = String(crypto.randomInt(100000, 1000000));
    const extra = await deliverOtp(phone, otp);           // fail hua to kuch save nahi hota

    await User.updateOne({ phone }, {
      $set: { otp: await bcrypt.hash(otp, 10), otpExpiry: new Date(Date.now() + OTP_TTL_MS) },
    });
    lastSent.set(phone, Date.now());
    wrongTries.delete(phone);

    res.json({ success: true, message: 'OTP bhej diya gaya.', ...extra });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.status ? err.message : 'OTP bhejne mein error aaya.' });
  }
};

// ── Login with OTP ─────────────────────────────────────────────
const loginWithPhone = async (req, res) => {
  try {
    const phone = String((req.body && req.body.phone) || '').trim();
    const otp   = String((req.body && req.body.otp)   || '').trim();
    if (!/^\d{10}$/.test(phone) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Phone aur 6-digit OTP zaroori hai.' });
    }

    const user = await User.findOne({ phone }).select('+otp +otpExpiry');
    if (!user) return res.status(404).json({ success: false, message: 'Is number se account nahi mila. Pehle Sign Up karein.' });
    if (user.isActive === false) return res.status(403).json({ success: false, message: 'Aapka account disable hai.' });
    if (user.role === 'admin')   return res.status(403).json({ success: false, message: 'Admin account email aur password se login hota hai.' });

    const notExpired = user.otp && user.otpExpiry && new Date(user.otpExpiry) > new Date();
    const valid = notExpired && await bcrypt.compare(otp, user.otp);

    if (!valid) {
      const n = (wrongTries.get(phone) || 0) + 1;
      wrongTries.set(phone, n);
      if (n >= MAX_ATTEMPTS) {
        wrongTries.delete(phone);
        await User.findByIdAndUpdate(user._id, { $unset: { otp: 1, otpExpiry: 1 } });
        return res.status(429).json({ success: false, message: 'Bahut zyada galat try. Naya OTP mangwayein.' });
      }
      return res.status(401).json({ success: false, message: notExpired ? 'OTP galat hai.' : 'OTP expire ho gaya. Naya OTP mangwayein.' });
    }

    // OTP sirf ek baar chalta hai
    wrongTries.delete(phone);
    await User.findByIdAndUpdate(user._id, { $unset: { otp: 1, otpExpiry: 1 } });
    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get me ─────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update profile ─────────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const { name, phone, city } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, city },
      { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { signup, login, sendOTP, loginWithPhone, getMe, updateProfile };