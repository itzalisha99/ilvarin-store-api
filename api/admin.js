import { Redis } from '@upstash/redis';
import { cleanProducts } from './products.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'bad json' });
    }
  }
  body = body || {};

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return res.status(500).json({ error: 'admin password not set' });
  if (body.password !== adminPassword) {
    return res.status(401).json({ error: 'wrong password' });
  }

  // Password-only check (used by the login screen).
  if (body.action === 'check') return res.status(200).json({ ok: true });

  const products = cleanProducts(body.products);
  if (!products) return res.status(400).json({ error: 'bad product list' });

  try {
    const redis = Redis.fromEnv();
    await redis.set('ilvarin:products', { products });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'could not save' });
  }
}
