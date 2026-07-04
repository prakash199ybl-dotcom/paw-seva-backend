const express    = require('express');
const router     = express.Router();
const Activity   = require('../models/Activity');

// ── GET all activities ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const activities = await Activity.find({ isApproved: true })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ success: true, activities });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST new activity ──────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, type, caption, location, image } = req.body;
    if (!name || !caption || !location) {
      return res.status(400).json({ success: false, message: 'Name, caption aur location required hai.' });
    }
    const activity = await Activity.create({ name, type, caption, location, image });
    res.status(201).json({ success: true, activity });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST like/unlike ───────────────────────────────────────
router.post('/:id/like', async (req, res) => {
  try {
    const { userId } = req.body;
    const activity = await Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found.' });

    const alreadyLiked = activity.likedBy.includes(userId);
    if (alreadyLiked) {
      activity.likes    -= 1;
      activity.likedBy   = activity.likedBy.filter(id => id !== userId);
    } else {
      activity.likes    += 1;
      activity.likedBy.push(userId);
    }
    await activity.save();
    res.json({ success: true, likes: activity.likes, liked: !alreadyLiked });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE activity (admin) ────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await Activity.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Activity deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;