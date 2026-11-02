// ============================================================
//   PAW SEVA — routes/stories.js (v5.0)
//   Banner stories: signature, queue (12h + fallback), create,
//   admin approve/pin/list, secure delete.
// ============================================================
const express  = require('express');
const mongoose = require('mongoose');
const router   = express.Router();

const Story    = require('../models/Story');
const Activity = require('../models/Activity');
const { protect }   = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');
const activeUser    = require('../middleware/activeUser');
const { isConfigured, getCloudinary } = require('../config/cloudinary');

// ── Settings (Render env se badal sakte ho) ───────────────────
const FRESH_HOURS     = Number(process.env.STORY_FRESH_HOURS) || 12; // kitne ghante "fresh"
const MIN_QUEUE       = Number(process.env.STORY_MIN_QUEUE)   || 10; // kam hone par purani se fill
const MAX_QUEUE       = 30;
const MAX_VIDEO_SEC   = 35;   // client 30 sec rokta hai, server thoda margin deta hai
const FOLDER          = 'pawseva/uploads';
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,mp4,mov,webm';

const NOT_CONFIGURED = { success: false, message: 'Media upload abhi configure nahi hai (Cloudinary).' };

// Client ko sirf zaroori fields bhejte hain
const publicStory = (s) => ({
  _id: s._id, userId: s.userId, userName: s.userName,
  mediaUrl: s.mediaUrl, mediaType: s.mediaType, duration: s.duration,
  caption: s.caption, location: s.location, pinned: !!s.pinned,
  status: s.status, createdAt: s.createdAt,
});

// ── 1) Upload signature (login zaroori) ───────────────────────
router.get('/upload-signature', protect, activeUser, (req, res) => {
  if (!isConfigured()) return res.status(503).json(NOT_CONFIGURED);
  const cloudinary = getCloudinary();
  const timestamp  = Math.round(Date.now() / 1000);
  // Yehi 3 params frontend bhi bhejega — dono jagah same hone chahiye
  const params = { timestamp, folder: FOLDER, allowed_formats: ALLOWED_FORMATS };
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);
  res.json({
    success: true,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey:    process.env.CLOUDINARY_API_KEY,
    timestamp, signature, folder: FOLDER, allowedFormats: ALLOWED_FORMATS,
  });
});

// ── 2) Public queue: pinned + fresh(12h) + purani se fill ─────
router.get('/', async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - FRESH_HOURS * 3600 * 1000);
    const base   = { status: 'approved' };

    const pinned = await Story.find({ ...base, pinned: true })
      .sort({ createdAt: -1 }).limit(5).lean();
    const fresh = await Story.find({ ...base, pinned: { $ne: true }, createdAt: { $gte: cutoff } })
      .sort({ createdAt: -1 }).limit(MAX_QUEUE).lean();

    let queue = [...pinned, ...fresh];

    // Nayi stories kam hain → purani (latest pehle) se queue bhar do
    if (queue.length < MIN_QUEUE) {
      const older = await Story.find({ ...base, pinned: { $ne: true }, createdAt: { $lt: cutoff } })
        .sort({ createdAt: -1 }).limit(MIN_QUEUE - queue.length).lean();
      queue = queue.concat(older);
    }

    res.set('Cache-Control', 'no-store');
    res.json({ success: true, freshHours: FRESH_HOURS, stories: queue.map(publicStory) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 3) Admin list: ?status=pending | approved ─────────────────
router.get('/manage', protect, adminOnly, async (req, res) => {
  try {
    const status = req.query.status === 'approved' ? 'approved' : 'pending';
    const stories = await Story.find({ status }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, stories: stories.map(publicStory) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 4) Nayi story (media pehle Cloudinary par upload ho chuka) ─
router.post('/', protect, activeUser, async (req, res) => {
  try {
    if (!isConfigured()) return res.status(503).json(NOT_CONFIGURED);
    const { mediaUrl, publicId, mediaType, duration, caption, location, userName } = req.body;

    if (!['image', 'video'].includes(mediaType)) {
      return res.status(400).json({ success: false, message: 'mediaType galat hai.' });
    }
    // URL hamare hi Cloudinary account ka hona chahiye (koi bahar ki link nahi)
    const prefix = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/${mediaType}/upload/`;
    if (typeof mediaUrl !== 'string' || !mediaUrl.startsWith(prefix)) {
      return res.status(400).json({ success: false, message: 'Invalid media URL.' });
    }
    if (typeof publicId !== 'string' || !publicId.startsWith(FOLDER + '/') || !mediaUrl.includes('/' + publicId)) {
      return res.status(400).json({ success: false, message: 'Invalid media id.' });
    }
    const dur = Number(duration) || 0;
    if (mediaType === 'video' && dur > MAX_VIDEO_SEC) {
      return res.status(400).json({ success: false, message: `Video ${MAX_VIDEO_SEC} sec se chhota hona chahiye.` });
    }

    const user = req.dbUser;
    const autoApprove = user.role === 'admin' || process.env.STORY_AUTO_APPROVE === 'true';

    const story = await Story.create({
      userId:   String(user._id),
      userName: String(userName || user.name || 'Anonymous').trim().slice(0, 60),
      mediaUrl, publicId, mediaType, duration: dur,
      caption:  String(caption || '').slice(0, 300),
      location: String(location || '').slice(0, 80),
      status:   autoApprove ? 'approved' : 'pending',
    });
    res.status(201).json({ success: true, story: publicStory(story) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 5) Admin: approve ─────────────────────────────────────────
router.patch('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id.' });
    const story = await Story.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
    if (!story) return res.status(404).json({ success: false, message: 'Story nahi mili.' });
    res.json({ success: true, story: publicStory(story) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 6) Admin: pin / unpin ─────────────────────────────────────
router.patch('/:id/pin', protect, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id.' });
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ success: false, message: 'Story nahi mili.' });
    story.pinned = !story.pinned;
    await story.save();
    res.json({ success: true, pinned: story.pinned });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 7) Delete: sirf owner ya admin ────────────────────────────
router.delete('/:id', protect, activeUser, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id.' });
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ success: false, message: 'Story nahi mili.' });

    const isAdmin = req.dbUser.role === 'admin';
    const isOwner = String(story.userId) === String(req.dbUser._id);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Aap sirf apni story delete kar sakte hain.' });
    }

    await story.deleteOne();

    // Cloudinary se file tabhi hatao jab wall ki koi post use na kar rahi ho
    try {
      const usedOnWall = await Activity.exists({ image: story.mediaUrl });
      if (!usedOnWall && isConfigured()) {
        await getCloudinary().uploader.destroy(story.publicId, { resource_type: story.mediaType, invalidate: true });
      }
    } catch (e) {
      console.error('Cloudinary cleanup error:', e.message); // delete fail nahi karna
    }
    res.json({ success: true, message: 'Story deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;