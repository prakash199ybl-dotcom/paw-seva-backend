// ============================================================
//   PAW SEVA — server.js 
//   All routes properly mounted
// ============================================================

const express   = require('express');
const cors      = require('cors');
const dotenv    = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/rescues',    require('./routes/rescues'));
app.use('/api/donations',  require('./routes/donations'));
app.use('/api/feeding',    require('./routes/feeding'));
app.use('/api/activities', require('./routes/activities'));

// ── Health check ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🐾 Paw Seva API is running! v4.0',
    endpoints: ['/api/auth', '/api/users', '/api/rescues', '/api/donations', '/api/feeding', '/api/activities']
  });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({ success: false, message: err.message || 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`\n🚀 Paw Seva backend running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  // Seed admin
  try {
    const User = require('./models/User');
    const exists = await User.findOne({ email: process.env.ADMIN_EMAIL || 'admin@pawseva.com' });
    if (!exists) {
      await User.create({
        name:     process.env.ADMIN_NAME     || 'Prakash',
        email:    process.env.ADMIN_EMAIL    || 'admin@pawseva.com',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        role:     'admin',
      });
      console.log('✅ Default admin created.');
    }
  } catch (err) { console.error('Admin seed error:', err.message); }
});


// //   PAW SEVA — Backend Server
// //   Entry point: loads env, connects DB, mounts all routes


// const express  = require('express');
// const cors     = require('cors');
// const dotenv   = require('dotenv');
// const connectDB = require('./config/db');

// // Existing routes:

// // app.use('/api/activities', activityRoutes);

// // Load environment variables from .env file
// dotenv.config();

// // Connect to MongoDB
// connectDB();

// // Seed default admin if not present
// const seedAdmin = async () => {
//   try {
//     const User = require('./models/User');
//     const exists = await User.findOne({ email: process.env.ADMIN_EMAIL });
//     if (!exists) {
//       await User.create({
//         name:     process.env.ADMIN_NAME     || 'Prakash',
//         email:    process.env.ADMIN_EMAIL    || 'admin@pawseva.com',
//         password: process.env.ADMIN_PASSWORD || 'admin123',
//         role:     'admin',
//       });
//       console.log('✅ Default admin account created.');
//     }
//   } catch (err) {
//     console.error('Admin seed error:', err.message);
//   }
// };

// const app = express();

// // ── Middleware ────────────────────────────────────────────────────────────────

// // CORS — allow your frontend origin
// app.use(cors({
//   origin: '*',
//   credentials: false,
// }));

// // app.use(cors({
// //   origin: [
// //     process.env.FRONTEND_URL || 'http://127.0.0.1:5500',
// //     'http://localhost:5500',
// //     'http://localhost:3000',
// //   ],
// //   credentials: true,
// // }));

// // Parse incoming JSON bodies
// app.use(express.json());

// // Parse URL-encoded bodies (for form submissions)
// app.use(express.urlencoded({ extended: true }));

// // ── Routes ────────────────────────────────────────────────────────────────────
// app.use('/api/auth',      require('./routes/auth'));
// app.use('/api/users',     require('./routes/users'));
// app.use('/api/rescues',   require('./routes/rescues'));
// app.use('/api/donations', require('./routes/donations'));
// app.use('/api/feeding',   require('./routes/feeding'));
// app.use('/api/activities', require('./routes/activities'));

// // ── Health check ──────────────────────────────────────────────────────────────
// app.get('/', (req, res) => {
//   res.json({
//     success: true,
//     message: '🐾 Paw Seva API is running!',
//     version: '1.0.0',
//     endpoints: {
//       auth:      '/api/auth',
//       users:     '/api/users      (admin only)',
//       rescues:   '/api/rescues',
//       donations: '/api/donations',
//       feeding:   '/api/feeding',
//     },
//   });
// });

// // ── 404 handler ───────────────────────────────────────────────────────────────
// app.use((req, res) => {
//   res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
// });

// // ── Global error handler ──────────────────────────────────────────────────────
// app.use((err, req, res, next) => {
//   console.error('Server Error:', err.stack);
//   res.status(500).json({ success: false, message: err.message || 'Internal server error.' });
// });

// // ── Start server ──────────────────────────────────────────────────────────────
// const PORT = process.env.PORT || 5000;

// app.listen(PORT, async () => {
//   console.log(`\n🚀 Paw Seva backend running on http://localhost:${PORT}`);
//   console.log(`📦 Environment : ${process.env.NODE_ENV || 'development'}`);
//   await seedAdmin();
// });
























