const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  name:        { type: String, required: true },
  type:        { type: String, enum: ['feeding','rescue','medical','adoption','shelter'], default: 'feeding' },
  caption:     { type: String, required: true },
  location:    { type: String, required: true },
  image:       { type: String, default: null }, // base64 ya URL
  likes:       { type: Number, default: 0 },
  likedBy:     [{ type: String }],
  isApproved:  { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);