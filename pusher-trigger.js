
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }
  
  // Простая проверка ключа
  const apiKey = req.headers['x-pusher-key'];
  if (!apiKey || apiKey !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const { channel, event, data } = req.body;
    
    // Отправляем через Pusher
    await pusher.trigger(channel, event, data);
    
    console.log(`✅ Pusher event sent: ${event} to ${channel}`);
    
    res.status(200).json({ 
      success: true,
      message: 'Event triggered',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Pusher trigger error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
