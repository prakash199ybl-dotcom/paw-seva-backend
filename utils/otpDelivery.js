// ============================================================
//   PAW SEVA — utils/otpDelivery.js (v5.2)
//   OTP kaise bheja jaye:
//     sms       -> MSG91 (India)          (MSG91_AUTH_KEY + MSG91_TEMPLATE_ID)
//     whatsapp  -> WhatsApp Cloud API     (WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_TEMPLATE_NAME)
//     screen    -> OTP screen par dikhao  (sirf testing, OTP_SHOW_ON_SCREEN=true)
//   Provider configured ho to OTP kabhi screen par nahi dikhta.
// ============================================================

const showOtpOnScreen = () =>
  process.env.OTP_SHOW_ON_SCREEN === 'true' || process.env.NODE_ENV !== 'production';

const smsConfigured = () =>
  Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID);

const whatsappConfigured = () =>
  Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_NAME);

const anyProviderConfigured = () => smsConfigured() || whatsappConfigured();

// Is request ke liye OTP kis raaste se jayega
function pickMode(channel) {
  if (channel === 'whatsapp') {
    if (whatsappConfigured()) return 'whatsapp';
  } else if (smsConfigured()) {
    return 'sms';
  }
  return showOtpOnScreen() ? 'screen' : 'none';
}

function fail(message, status = 502) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// ── MSG91: POST https://control.msg91.com/api/v5/otp ──────────
async function sendSmsMsg91(phone, otp) {
  const url = new URL('https://control.msg91.com/api/v5/otp');
  const q = url.searchParams;
  q.set('template_id', process.env.MSG91_TEMPLATE_ID);
  q.set('mobile', '91' + phone);          // country code ke saath
  q.set('otp', otp);                      // hamara apna OTP (verify hum khud karte hain)
  q.set('otp_length', '6');
  q.set('otp_expiry', '10');              // minutes
  q.set('authkey', process.env.MSG91_AUTH_KEY);

  let res, data = {};
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', authkey: process.env.MSG91_AUTH_KEY },
      body: '{}',
      signal: AbortSignal.timeout(10000),
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    console.error('MSG91 request failed:', e.message);
    throw fail('SMS bhejne mein dikkat aayi. Thodi der baad try karein.');
  }
  if (!res.ok || data.type === 'error') {
    // Authkey URL mein hai isliye URL log nahi karte, sirf jawab
    console.error('MSG91 error:', res.status, JSON.stringify(data));
    throw fail('SMS bhejne mein dikkat aayi. Thodi der baad try karein.');
  }
}

// ── WhatsApp Cloud API: authentication template ───────────────
// Authentication template mein code DO jagah jata hai: body + button
async function sendWhatsapp(phone, otp) {
  const version = process.env.WHATSAPP_API_VERSION || 'v23.0';
  const url = `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: '91' + phone,
    type: 'template',
    template: {
      name: process.env.WHATSAPP_TEMPLATE_NAME,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en_US' },
      components: [
        { type: 'body',   parameters: [{ type: 'text', text: otp }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otp }] },
      ],
    },
  };

  let res, data = {};
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.WHATSAPP_TOKEN },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    console.error('WhatsApp request failed:', e.message);
    throw fail('WhatsApp par OTP bhejne mein dikkat aayi. Thodi der baad try karein.');
  }
  if (!res.ok || data.error) {
    console.error('WhatsApp error:', res.status, JSON.stringify(data.error || data));
    throw fail('WhatsApp par OTP bhejne mein dikkat aayi. Thodi der baad try karein.');
  }
}

// ── Main: OTP bhejo ───────────────────────────────────────────
// Return: {} (real provider) ya { dev_otp } (screen mode). Fail par error (status ke saath)
async function deliverOtp(phone, otp, channel = 'sms') {
  const mode = pickMode(channel);
  if (mode === 'sms')      { await sendSmsMsg91(phone, otp);  return {}; }
  if (mode === 'whatsapp') { await sendWhatsapp(phone, otp);  return {}; }
  if (mode === 'screen')   { return { dev_otp: otp }; }
  throw fail(channel === 'whatsapp' ? 'WhatsApp OTP abhi available nahi hai.' : 'SMS service abhi configure nahi hai.', 503);
}

module.exports = { deliverOtp, pickMode, smsConfigured, whatsappConfigured, anyProviderConfigured, showOtpOnScreen };