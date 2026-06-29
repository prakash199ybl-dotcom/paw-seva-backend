const express = require('express');
const router  = express.Router();
const { signup, login, sendOTP, loginWithPhone, getMe, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/signup',       signup);
router.post('/login',        login);
router.post('/send-otp',     sendOTP);
router.post('/login-phone',  loginWithPhone);
router.get('/me',            protect, getMe);
router.put('/update',        protect, updateProfile);

module.exports = router;
