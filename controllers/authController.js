// ============================================================
//   PAW SEVA — authController.js (v4.0)
//   FIXES: city field saved in signup, OTP login working
// ============================================================

const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User   = require('../models/User');

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

// ── Signup ─────────────────────────────────────────────────────
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
    if (city)     userData.city     = city;  // FIX: city saved

    const user = await User.create(userData);
    sendTokenResponse(user, 201, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Login (email + password) ───────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required.' });
    const user = await User.findOne({ email }).select('+password');
    if (!user || !await user.matchPassword(password))
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Send OTP ───────────────────────────────────────────────────
const sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number required.' });

    const otp       = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash   = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await User.findOneAndUpdate(
      { phone },
      { $set: { otp: otpHash, otpExpiry } },
      { upsert: false }
    );

    // TODO production: send SMS via MSG91/Twilio
    console.log(`[DEV] OTP for +91${phone}: ${otp}`);

    res.json({
      success: true,
      message: 'OTP sent successfully.',
      ...(process.env.NODE_ENV !== 'production' && { dev_otp: otp })
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Login with OTP (phone) ─────────────────────────────────────
const loginWithPhone = async (req, res) => {
  try {
    const { phone, otp, name, role, city } = req.body;
    if (!phone || !otp) return res.status(400).json({ success: false, message: 'Phone and OTP required.' });

    let user = await User.findOne({ phone }).select('+otp +otpExpiry');

    if (!user) {
      // New user — create account
      if (!name) return res.status(400).json({ success: false, message: 'Name required for first signup.' });
      const otpHash   = await bcrypt.hash(otp, 10);
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      user = await User.create({
        name, phone,
        otp: otpHash, otpExpiry,
        role: role || 'Donor',
        city: city || '',
        authProvider: 'otp',
        email:    `user${phone}@pawseva.app`,
        password: `OTP_${Date.now()}`,
      });
    }

    // Dev mode: accept any 6-digit OTP
    const isValid = process.env.NODE_ENV !== 'production'
      ? /^\d{6}$/.test(otp)
      : await bcrypt.compare(otp, user.otp || '');

    if (!isValid) return res.status(401).json({ success: false, message: 'Invalid or expired OTP.' });

    // Clear OTP after use
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
