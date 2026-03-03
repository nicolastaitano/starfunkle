// Netlify Function: bidrl-call-handler
// Receives webhook from OpenClaw BidRL monitor and initiates a Twilio call

const twilio = require('twilio');

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  NICOLAS_PHONE,
  ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID,
  BIDRL_TWIML_BASE_URL,
} = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Debug which Twilio vars are actually missing at runtime
  const missingTwilio = [];
  if (!TWILIO_ACCOUNT_SID) missingTwilio.push('TWILIO_ACCOUNT_SID');
  if (!TWILIO_AUTH_TOKEN) missingTwilio.push('TWILIO_AUTH_TOKEN');
  if (!TWILIO_FROM_NUMBER) missingTwilio.push('TWILIO_FROM_NUMBER');
  if (!NICOLAS_PHONE) missingTwilio.push('NICOLAS_PHONE');

  if (missingTwilio.length > 0) {
    console.error('Missing Twilio config vars:', missingTwilio);
    return {
      statusCode: 500,
      body: `Twilio not configured; missing: ${missingTwilio.join(', ')}`,
    };
  }

  // Debug which ElevenLabs vars are missing
  const missingEleven = [];
  if (!ELEVENLABS_API_KEY) missingEleven.push('ELEVENLABS_API_KEY');
  if (!ELEVENLABS_VOICE_ID) missingEleven.push('ELEVENLABS_VOICE_ID');

  if (missingEleven.length > 0) {
    console.error('Missing ElevenLabs config vars:', missingEleven);
    return {
      statusCode: 500,
      body: `ElevenLabs not configured; missing: ${missingEleven.join(', ')}`,
    };
  }

  if (!BIDRL_TWIML_BASE_URL) {
    console.error('Missing BIDRL_TWIML_BASE_URL');
    return { statusCode: 500, body: 'Twiml base URL not configured' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    console.error('Invalid JSON payload', { error: e.message, body: event.body });
    return { statusCode: 400, body: `Invalid JSON: ${e.message}; body=${event.body}` };
  }

  const { lotId, title, currentBid, timeRemainingSeconds, url } = payload;

  if (!lotId || !title || typeof currentBid === 'undefined' || typeof timeRemainingSeconds === 'undefined') {
    console.error('Missing required fields in payload', payload);
    return { statusCode: 400, body: 'Missing required fields' };
  }

  const roundedBid = Number(currentBid).toFixed(2);
  const seconds = Math.max(0, Math.round(timeRemainingSeconds));

  const messageText = `Nicolas, this is Starfunkle. You are about to lose a BidRL auction. ` +
    `Lot ${lotId}: ${title}. Current bid is ${roundedBid} dollars, and you have been outbid. ` +
    `${seconds} seconds remain. Check BidRL now if you want to raise your bid.`;

  try {
    // Construct TwiML URL safely without using URL() to avoid Invalid URL issues
    const base = BIDRL_TWIML_BASE_URL.replace(/\/$/, '');
    const twimlUrl = `${base}/.netlify/functions/bidrl-twiml?text=${encodeURIComponent(messageText)}`;

    // Initiate Twilio call
    const call = await client.calls.create({
      to: NICOLAS_PHONE,
      from: TWILIO_FROM_NUMBER,
      url: twimlUrl,
    });

    console.log('Call initiated', call.sid);

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', callSid: call.sid }),
    };
  } catch (err) {
    console.error('Error in bidrl-call-handler', err.response?.data || err.message || err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
