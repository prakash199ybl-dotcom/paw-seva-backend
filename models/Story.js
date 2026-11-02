// ============================================================
//   PAW SEVA — models/Story.js (v5.0)
//   Banner stories (photo ya video). Media Cloudinary par,
//   yahan sirf URL aur details.
// ============================================================
const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  userId:    { type: String, required: true },
  userName:  { type: String, required: true, trim: true },
  mediaUrl:  { type: String, required: true },
  mediaType: { type: String, enum: ['image', 'video'], required: true },
  publicId:  { type: String, required: true },   // Cloudinary delete ke liye
  duration:  { type: Number, default: 0 },       // video seconds
  caption:   { type: String, default: '', maxlength: 300 },
  location:  { type: String, default: '' },
  status:    { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  pinned:    { type: Boolean, default: false },  // admin pin = hamesha queue mein
}, { timestamps: true });

storySchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Story', storySchema);