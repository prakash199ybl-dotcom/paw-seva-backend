// ============================================================
//   PAW SEVA — routes/activities.js (v5.0)
//   CHANGES:
//   - POST aur DELETE ab login maangte hain (JWT)
//   - DELETE sirf owner ya admin
//   - likes kabhi negative nahi
//   - video (mediaType) support
// ============================================================
const express  = require('express');
const mongoose = require('mongoose');
const router   = express.Router();
const Activity = require('../models/Activity');
const { protect } = require('../middleware/auth');
const activeUser  = require('../middleware/activeUser');

const TYPES = ['feeding', 'rescue', 'medical', 'adoption', 'shelter'];

// ── GET: wall ki stories (public) ─────────────────────────────
router.get('/', async (req, res) => {
  try {
    const activities = await Activity.find({ isApproved: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, activities });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST: nayi wall post (login zaroori) ──────────────────────
router.post('/', protect, activeUser, async (req, res) => {
  try {
    const { name, type, caption, location, image, mediaType } = req.body;
    if (!name || !caption || !location) {
      return res.status(400).json({ success: false, message: 'Name, caption aur location zaroori hain.' });
    }
    // image sirf Cloudinary URL ya (purana) base64 image ho sakti hai
    if (image && !(String(image).startsWith('https://res.cloudinary.com/') || String(image).startsWith('data:image'))) {
      return res.status(400).json({ success: false, message: 'Invalid media.' });
    }
    const activity = await Activity.create({
      name:      String(name).trim().slice(0, 60),
      type:      TYPES.includes(type) ? type : 'feeding',
      caption:   String(caption).slice(0, 500),
      location:  String(location).slice(0, 80),
      image:     image || null,
      mediaType: image && mediaType === 'video' ? 'video' : 'image',
      userId:    String(req.dbUser._id),
    });
    res.status(201).json({ success: true, activity });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST like/unlike (public, device/user id se) ──────────────
router.post('/:id/like', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required.' });
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid id.' });
    }
    const activity = await Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ success: false, message: 'Not found.' });

    const uid = String(userId);
    const already = activity.likedBy.includes(uid);
    if (already) {
      activity.likes   = Math.max(0, (activity.likes || 0) - 1);
      activity.likedBy = activity.likedBy.filter(x => String(x) !== uid);
    } else {
      activity.likes = (activity.likes || 0) + 1;
      activity.likedBy.push(uid);
    }
    await activity.save();
    res.json({ success: true, likes: activity.likes, liked: !already });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE: sirf owner ya admin ───────────────────────────────
router.delete('/:id', protect, activeUser, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid id.' });
    }
    const activity = await Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ success: false, message: 'Story nahi mili.' });

    const isAdmin = req.dbUser.role === 'admin';
    const isOwner = activity.userId && String(activity.userId) === String(req.dbUser._id);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Aap sirf apni story delete kar sakte hain.' });
    }
    await activity.deleteOne();
    res.json({ success: true, message: 'Story deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;