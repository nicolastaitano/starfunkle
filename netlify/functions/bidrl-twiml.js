// Netlify Function: bidrl-twiml
// Returns TwiML that Twilio will use to speak the provided text.

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const text = params.text;

  if (!text) {
    return { statusCode: 400, body: 'Missing text parameter' };
  }

  // For now, keep it simple: let Twilio handle TTS via <Say>.
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say voice="Polly.Joanna">${text}</Say>\n</Response>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml',
    },
    body: twiml,
  };
};
