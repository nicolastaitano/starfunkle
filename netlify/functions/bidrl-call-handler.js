// Netlify Function: bidrl-call-handler
// Receives webhook from OpenClaw BidRL monitor and initiates a Twilio call

const twilio = require('twilio');
const axios = require('axios');

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

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER || !NICOLAS_PHONE) {
    console.error('Missing Twilio config');
    return { statusCode: 500, body: 'Twilio not configured' };
  }

  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    console.error('Missing ElevenLabs config');
    return { statusCode: 500, body: 'ElevenLabs not configured' };
  }

  if (!BIDRL_TWIML_BASE_URL) {
    console.error('Missing BIDRL_TWIML_BASE_URL');
    return { statusCode: 500, body: 'Twiml base URL not configured' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    console.error('Invalid JSON payload', e);
    return { statusCode: 400, body: 'Invalid JSON' };
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
    // Call ElevenLabs TTS API to generate audio
    const ttsResponse = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      data: {
        text: messageText,
        model_id: 'eleven_multilingual_v2',
      },
      responseType: 'arraybuffer',
    });

    // For now, we assume BIDRL_TWIML_BASE_URL will handle TTS dynamically
    // and just pass the text + basic metadata via query params.
    // This keeps us from having to store audio in persistent storage.

    const twimlUrl = new URL('/.netlify/functions/bidrl-twiml', BIDRL_TWIML_BASE_URL);
    twimlUrl.searchParams.set('text', messageText);

    // Initiate Twilio call
    const call = await client.calls.create({
      to: NICOLAS_PHONE,
      from: TWILIO_FROM_NUMBER,
      url: twimlUrl.toString(),
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
