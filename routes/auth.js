const express = require('express');
const router  = express.Router();
const { signup, login, sendOTP, loginWithPhone, getMe, updateProfile } = require('../controllers/authController');
const { googleLogin, publicConfig } = require('../controllers/socialAuthController');
const { protect } = require('../middleware/auth');

router.post('/signup',        signup);
router.post('/login',         login);
router.post('/send-otp',      sendOTP);
router.post('/login-phone',   loginWithPhone);
router.post('/google',        googleLogin);       // v5.2
router.get('/public-config',  publicConfig);      // v5.2
router.get('/me',             protect, getMe);
router.put('/update',         protect, updateProfile);

module.exports = router;