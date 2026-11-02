// ============================================================
//   PAW SEVA — middleware/activeUser.js (v5.0)
//   protect ke BAAD lagta hai. DB se user nikalta hai,
//   disabled user ko rokta hai, req.dbUser set karta hai.
// ============================================================
const User = require('../models/User');

module.exports = async function activeUser(req, res, next) {
  try {
    const id = req.user && (req.user.id || req.user._id);
    const user = id ? await User.findById(id) : null;
    if (!user) {
      return res.status(401).json({ success: false, message: 'User nahi mila. Dobara login karein.' });
    }
    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: 'Aapka account disable hai.' });
    }
    req.dbUser = user;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};