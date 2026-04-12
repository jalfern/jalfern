export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const proxyUrl = process.env.OLLAMA_PROXY_URL;
  const proxyToken = process.env.OLLAMA_PROXY_TOKEN;

  if (!proxyUrl || !proxyToken) {
    return res.status(500).json({ 
      error: 'Server configuration error', 
      message: 'OLLAMA_PROXY_URL and OLLAMA_PROXY_TOKEN environment variables must be set' 
    });
  }

  let body;
  try {
    body = req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  fetch(`${proxyUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-proxy-token': proxyToken,
    },
    body: JSON.stringify(body),
  })
    .then(response => {
      res.status(response.status);
      return response.text();
    })
    .then(data => {
      res.send(data);
    })
    .catch(error => {
      res.status(502).json({ error: 'Bad Gateway', message: error.message });
    });
}
