// ── Admin-only middleware ─────────────────────────────────────────────────────
// Use AFTER protect middleware: router.get('/route', protect, adminOnly, handler)

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. Admins only.',
  });
};

// ── Role-based access: pass allowed roles as array ────────────────────────────
// Usage: authorizeRoles('admin', 'NGO')
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not allowed to access this route.`,
      });
    }
    next();
  };
};

module.exports = { adminOnly, authorizeRoles };
