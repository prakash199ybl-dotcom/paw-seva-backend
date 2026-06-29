const mongoose = require('mongoose');

const rescueSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    animalType: {
      type: String,
      enum: ['Dog', 'Cat', 'Bird', 'Cow', 'Other'],
      default: 'Dog',
    },
    severity: {
      type: String,
      enum: ['low', 'moderate', 'critical'],
      default: 'moderate',
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'resolved', 'dismissed'],
      default: 'pending',
    },
    // Who reported this rescue
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Who accepted/is handling this rescue
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Admin notes
    adminNote: {
      type: String,
      default: '',
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Rescue', rescueSchema);
