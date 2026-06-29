const Rescue = require('../models/Rescue');
const User = require('../models/User');

// ── @route  GET /api/rescues ──────────────────────────────────────────────────
// ── @access Private (all logged-in users)
const getRescues = async (req, res) => {
  try {
    const { status, severity, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status)   filter.status = status;
    if (severity) filter.severity = severity;

    const rescues = await Rescue.find(filter)
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Rescue.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: rescues.length,
      total,
      pages: Math.ceil(total / limit),
      rescues,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  GET /api/rescues/:id ──────────────────────────────────────────────
// ── @access Private
const getRescueById = async (req, res) => {
  try {
    const rescue = await Rescue.findById(req.params.id)
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email');

    if (!rescue) {
      return res.status(404).json({ success: false, message: 'Rescue not found.' });
    }
    res.status(200).json({ success: true, rescue });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  POST /api/rescues ─────────────────────────────────────────────────
// ── @access Private (any logged-in user can report)
const createRescue = async (req, res) => {
  try {
    const { description, location, animalType, severity } = req.body;

    const rescue = await Rescue.create({
      description,
      location,
      animalType,
      severity,
      reportedBy: req.user.id,
    });

    res.status(201).json({ success: true, rescue });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  PATCH /api/rescues/:id/accept ────────────────────────────────────
// ── @access Private (Volunteer / NGO)
const acceptRescue = async (req, res) => {
  try {
    const rescue = await Rescue.findById(req.params.id);

    if (!rescue) {
      return res.status(404).json({ success: false, message: 'Rescue not found.' });
    }
    if (rescue.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Rescue is no longer pending.' });
    }

    rescue.assignedTo = req.user.id;
    rescue.status = 'active';
    await rescue.save();

    // Increment volunteer's rescuesDone count
    await User.findByIdAndUpdate(req.user.id, { $inc: { rescuesDone: 1 } });

    res.status(200).json({ success: true, rescue });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  PATCH /api/rescues/:id ───────────────────────────────────────────
// ── @access Admin only
const updateRescue = async (req, res) => {
  try {
    const { status, adminNote } = req.body;

    const rescue = await Rescue.findByIdAndUpdate(
      req.params.id,
      {
        status,
        adminNote,
        ...(status === 'resolved' && { resolvedAt: new Date() }),
      },
      { new: true, runValidators: true }
    );

    if (!rescue) {
      return res.status(404).json({ success: false, message: 'Rescue not found.' });
    }
    res.status(200).json({ success: true, rescue });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  DELETE /api/rescues/:id ──────────────────────────────────────────
// ── @access Admin only
const deleteRescue = async (req, res) => {
  try {
    const rescue = await Rescue.findByIdAndDelete(req.params.id);
    if (!rescue) {
      return res.status(404).json({ success: false, message: 'Rescue not found.' });
    }
    res.status(200).json({ success: true, message: 'Rescue deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getRescues, getRescueById, createRescue, acceptRescue, updateRescue, deleteRescue };
