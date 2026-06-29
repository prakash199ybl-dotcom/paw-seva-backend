const FeedingLog = require('../models/FeedingLog');
const User = require('../models/User');

// ── @route  GET /api/feeding ──────────────────────────────────────────────────
// ── @access Admin: all logs | Feeder: own logs
const getFeedingLogs = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const filter = req.user.role === 'admin' ? {} : { feeder: req.user.id };

    const logs = await FeedingLog.find(filter)
      .populate('feeder', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await FeedingLog.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      pages: Math.ceil(total / limit),
      logs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  POST /api/feeding ─────────────────────────────────────────────────
// ── @access Private (Feeder role)
const createFeedingLog = async (req, res) => {
  try {
    const { location, animalCount, animalType, foodType, note } = req.body;

    if (!location || !animalCount) {
      return res.status(400).json({
        success: false,
        message: 'Location and animal count are required.',
      });
    }

    const log = await FeedingLog.create({
      feeder: req.user.id,
      location,
      animalCount,
      animalType,
      foodType,
      note,
    });

    // Increment feeder's feedingsDone count
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { feedingsDone: 1 },
    });

    const populated = await log.populate('feeder', 'name email');
    res.status(201).json({ success: true, log: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  GET /api/feeding/stats ───────────────────────────────────────────
// ── @access Admin
const getFeedingStats = async (req, res) => {
  try {
    // Total feedings and animals fed
    const overall = await FeedingLog.aggregate([
      {
        $group: {
          _id: null,
          totalFeedings: { $sum: 1 },
          totalAnimals: { $sum: '$animalCount' },
        },
      },
    ]);

    // Top feeders
    const topFeeders = await FeedingLog.aggregate([
      { $group: { _id: '$feeder', count: { $sum: 1 }, animals: { $sum: '$animalCount' } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'feederInfo',
        },
      },
      { $unwind: '$feederInfo' },
      {
        $project: {
          name: '$feederInfo.name',
          email: '$feederInfo.email',
          count: 1,
          animals: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      overall: overall[0] || { totalFeedings: 0, totalAnimals: 0 },
      topFeeders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  DELETE /api/feeding/:id ──────────────────────────────────────────
// ── @access Admin only
const deleteFeedingLog = async (req, res) => {
  try {
    const log = await FeedingLog.findByIdAndDelete(req.params.id);
    if (!log) {
      return res.status(404).json({ success: false, message: 'Log not found.' });
    }
    res.status(200).json({ success: true, message: 'Feeding log deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getFeedingLogs, createFeedingLog, getFeedingStats, deleteFeedingLog };
