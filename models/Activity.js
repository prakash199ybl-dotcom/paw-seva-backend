// ============================================================
//   PAW SEVA — models/Activity.js (v5.0)
//   CHANGE: userId (owner delete ke liye) + mediaType (video support)
// ============================================================
const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  name:       { type: String, required: true },
  type:       { type: String, enum: ['feeding','rescue','medical','adoption','shelter'], default: 'feeding' },
  caption:    { type: String, required: true },
  location:   { type: String, required: true },
  image:      { type: String, default: null },        // Cloudinary URL ya purana base64
  mediaType:  { type: String, enum: ['image','video'], default: 'image' },  // CHANGE v5
  userId:     { type: String, default: null },        // CHANGE v5: kisne daali
  likes:      { type: Number, default: 0 },
  likedBy:    [{ type: String }],
  isApproved: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);