// Netlify Function: bidrl-twiml
// Returns TwiML that Twilio will use to play a TTS message.

const { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } = process.env;
const axios = require('axios');

exports.handler = async (event) => {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    console.error('Missing ElevenLabs config');
    return { statusCode: 500, body: 'ElevenLabs not configured' };
  }

  const params = event.queryStringParameters || {};
  const text = params.text;

  if (!text) {
    return { statusCode: 400, body: 'Missing text parameter' };
  }

  try {
    // Generate audio on-the-fly for Twilio using ElevenLabs
    const ttsResponse = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      data: {
        text,
        model_id: 'eleven_multilingual_v2',
      },
      responseType: 'arraybuffer',
    });

    const audioBase64 = ttsResponse.data.toString('base64');

    // Twilio <Play> needs a URL, not raw audio. Since we don't have
    // persistent storage here, this simple version instead uses TwiML <Say>
    // as a fallback if streaming audio is too complex.

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say voice="Polly.Joanna">${text}</Say>\n</Response>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
      body: twiml,
    };
  } catch (err) {
    console.error('Error generating TTS in bidrl-twiml', err.response?.data || err.message || err);

    // Fallback: just use Twilio <Say> with the raw text
    const twimlFallback = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say voice="Polly.Joanna">${text}</Say>\n</Response>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
      body: twimlFallback,
    };
  }
};
