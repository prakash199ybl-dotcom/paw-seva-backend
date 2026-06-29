const Donation = require('../models/Donation');
const User = require('../models/User');

// ── @route  GET /api/donations ────────────────────────────────────────────────
// ── @access Admin: all donations | Donor: own donations
const getDonations = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { donor: req.user.id };
    const { page = 1, limit = 10 } = req.query;

    const donations = await Donation.find(filter)
      .populate('donor', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Donation.countDocuments(filter);

    // Sum of confirmed donations (admin sees total, donor sees their own)
    const totalAmount = await Donation.aggregate([
      { $match: { ...filter, status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    res.status(200).json({
      success: true,
      count: donations.length,
      total,
      pages: Math.ceil(total / limit),
      totalAmount: totalAmount[0]?.total || 0,
      donations,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  POST /api/donations ───────────────────────────────────────────────
// ── @access Private (Donor role)
const createDonation = async (req, res) => {
  try {
    const { amount, campaign, message } = req.body;

    if (!amount || !campaign) {
      return res.status(400).json({
        success: false,
        message: 'Amount and campaign are required.',
      });
    }

    const donation = await Donation.create({
      donor: req.user.id,
      amount,
      campaign,
      message,
    });

    // Update donor's total donated amount
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { totalDonated: amount },
    });

    const populated = await donation.populate('donor', 'name email');
    res.status(201).json({ success: true, donation: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  GET /api/donations/stats ─────────────────────────────────────────
// ── @access Admin
const getDonationStats = async (req, res) => {
  try {
    const stats = await Donation.aggregate([
      { $match: { status: 'confirmed' } },
      {
        $group: {
          _id: '$campaign',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const grandTotal = stats.reduce((sum, s) => sum + s.total, 0);

    res.status(200).json({ success: true, grandTotal, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getDonations, createDonation, getDonationStats };
