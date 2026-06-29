const mongoose = require('mongoose');

const feedingLogSchema = new mongoose.Schema(
  {
    feeder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    animalCount: {
      type: Number,
      required: [true, 'Animal count is required'],
      min: [1, 'Must feed at least 1 animal'],
    },
    animalType: {
      type: String,
      enum: ['Dogs', 'Cats', 'Mixed', 'Birds', 'Other'],
      default: 'Dogs',
    },
    foodType: {
      type: String,
      trim: true,
      default: 'Dry food',
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    // For streak tracking
    fedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('FeedingLog', feedingLogSchema);
