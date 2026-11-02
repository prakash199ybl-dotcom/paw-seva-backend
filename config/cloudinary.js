// ============================================================
//   PAW SEVA — config/cloudinary.js (v5.0)
//   Cloudinary settings. Lazy rakha hai taaki .env baad mein
//   load ho tab bhi sahi chale.
// ============================================================
const cloudinary = require('cloudinary').v2;

function isConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function getCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

module.exports = { isConfigured, getCloudinary };