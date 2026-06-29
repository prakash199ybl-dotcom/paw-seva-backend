const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  email:         { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  password:      { type: String, minlength: 6, select: false },
  phone:         { type: String, unique: true, sparse: true, trim: true },
  role:          { type: String, enum: ['Donor','Volunteer','Feeder','NGO','admin'], default: 'Donor' },
  city:          { type: String, default: '' },
  isActive:      { type: Boolean, default: true },
  totalDonated:  { type: Number, default: 0 },
  rescuesDone:   { type: Number, default: 0 },
  feedingsDone:  { type: Number, default: 0 },
  otp:           { type: String, select: false },
  otpExpiry:     { type: Date, select: false },
  googleId:      { type: String, sparse: true },
  instagramId:   { type: String, sparse: true },
  authProvider:  { type: String, enum: ['local','otp','google','instagram','whatsapp'], default: 'local' },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function(entered) {
  return await bcrypt.compare(entered, this.password);
};

userSchema.methods.matchOTP = async function(entered) {
  if (!this.otp) return false;
  if (this.otpExpiry && new Date() > this.otpExpiry) return false;
  return await bcrypt.compare(entered, this.otp);
};

module.exports = mongoose.model('User', userSchema);
