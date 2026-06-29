const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');
router.use(protect, adminOnly);
router.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(20);
    const total = await User.countDocuments();
    res.json({ success: true, count: users.length, total, users });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
router.get('/stats/overview', async (req, res) => {
  try {
    const total = await User.countDocuments();
    const donors = await User.countDocuments({ role: 'Donor' });
    const volunteers = await User.countDocuments({ role: 'Volunteer' });
    const feeders = await User.countDocuments({ role: 'Feeder' });
    const ngos = await User.countDocuments({ role: 'NGO' });
    res.json({ success: true, stats: { total, donors, volunteers, feeders, ngos } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
module.exports = router;
