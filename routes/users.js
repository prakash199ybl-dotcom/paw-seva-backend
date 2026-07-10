// ============================================================
//   PAW SEVA — routes/users.js (v4.0)
//   FIXES: search by name/phone/city, toggle disable/enable
// ============================================================

const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { protect }   = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');

router.use(protect, adminOnly);

// GET all users with search
router.get('/', async (req, res) => {
  try {
    const { search, role, limit = 50 } = req.query;
    let filter = {};
    if (role && role !== 'all') filter.role = role;
    if (search && search.trim()) {
      const rx = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: rx }, { phone: rx }, { city: rx }, { email: rx }];
    }
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    const total = await User.countDocuments(filter);
    res.json({ success: true, count: users.length, total, users });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET stats
router.get('/stats/overview', async (req, res) => {
  try {
    const total      = await User.countDocuments();
    const donors     = await User.countDocuments({ role: 'Donor' });
    const volunteers = await User.countDocuments({ role: 'Volunteer' });
    const feeders    = await User.countDocuments({ role: 'Feeder' });
    const ngos       = await User.countDocuments({ role: 'NGO' });
    res.json({ success: true, stats: { total, donors, volunteers, feeders, ngos } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PATCH toggle disable/enable
router.patch('/:id/toggle', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot disable admin.' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, isActive: user.isActive, message: user.isActive ? 'User enabled.' : 'User disabled.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (user?.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot delete admin.' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
