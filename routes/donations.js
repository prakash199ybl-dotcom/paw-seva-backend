const express = require('express');
const router = express.Router();
const { getDonations, createDonation, getDonationStats } = require('../controllers/donationController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');
router.use(protect);
router.route('/').get(getDonations).post(createDonation);
router.get('/stats', adminOnly, getDonationStats);
module.exports = router;
