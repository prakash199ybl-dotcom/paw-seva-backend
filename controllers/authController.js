const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User   = require('../models/User');

// ── Helper: generate JWT ───────────────────────────────────────────────────
const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id, user.role);
  res.status(statusCode).json({
    success: true, token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, city: user.city },
  });
};

// ── Signup (email + optional phone) ────────────────────────────────────────
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

    const userData = { name, role: role || 'Donor', city, authProvider: 'local' };
    if (email) userData.email = email;
    if (password) userData.password = password;
    if (phone) userData.phone = phone;

    const user = await User.create(userData);
    sendTokenResponse(user, 201, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Login (email + password) ───────────────────────────────────────────────
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

// ── Send OTP ───────────────────────────────────────────────────────────────
const sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number required.' });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Upsert: update if phone exists, else we'll create on verify
    await User.findOneAndUpdate(
      { phone },
      { $set: { otp: otpHash, otpExpiry } },
      { upsert: false }
    );

    // TODO in production: Send SMS via Twilio/MSG91
    // const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    // await twilio.messages.create({ to: `+91${phone}`, from: process.env.TWILIO_FROM, body: `Your Paw Seva OTP: ${otp}` });

    console.log(`[DEV] OTP for ${phone}: ${otp}`);
    res.json({ success: true, message: 'OTP sent successfully.', dev_otp: process.env.NODE_ENV !== 'production' ? otp : undefined });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Login with OTP ─────────────────────────────────────────────────────────
const loginWithPhone = async (req, res) => {
  try {
    const { phone, otp, name, role } = req.body;
    if (!phone || !otp) return res.status(400).json({ success: false, message: 'Phone and OTP required.' });

    let user = await User.findOne({ phone }).select('+otp +otpExpiry');

    if (!user) {
      // New user via OTP — create account
      if (!name) return res.status(400).json({ success: false, message: 'Name required for first-time signup.' });
      const otpHash   = await bcrypt.hash(otp, 10);
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      user = await User.create({
        name, phone, otp: otpHash, otpExpiry,
        role: role || 'Donor', authProvider: 'otp',
        email: `otp_${phone}@pawseva.app`,
        password: `OTP_${Date.now()}`,
      });
    }

    // In production: verify OTP against stored hash
    // For dev: accept any 6-digit OTP (remove in production)
    const isValid = process.env.NODE_ENV !== 'production'
      ? /^\d{6}$/.test(otp)
      : await user.matchOTP(otp);

    if (!isValid) return res.status(401).json({ success: false, message: 'Invalid or expired OTP.' });

    // Clear OTP after use
    await User.findByIdAndUpdate(user._id, { $unset: { otp: 1, otpExpiry: 1 } });

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get current user ───────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update profile ─────────────────────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const { name, phone, city } = req.body;
    const user = await User.findByIdAndUpdate(req.user.id, { name, phone, city }, { new: true, runValidators: true });
    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { signup, login, sendOTP, loginWithPhone, getMe, updateProfile };
