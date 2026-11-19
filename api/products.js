import { Redis } from '@upstash/redis';

// Default product list — exactly what the live Ilvarin demo shows today.
// The admin page overwrites this in the database; until then these defaults
// are served so the shop never breaks.
export const DEFAULT_PRODUCTS = [
  { id: 'niacinamide', name: 'The Ordinary Niacinamide 10% + Zinc 1%', price: 1650, was: null },
  { id: 'cerave-foaming', name: 'CeraVe Foaming Facial Cleanser', price: 2450, was: 2800 },
  { id: 'cerave-cream', name: 'CeraVe Moisturising Cream', price: 2900, was: 3300 },
  { id: 'cosrx-snail', name: 'COSRX Advanced Snail 96 Mucin Power Essence', price: 2650, was: null },
  { id: 'cetaphil', name: 'Cetaphil Gentle Skin Cleanser', price: 1750, was: null },
  { id: 'cerave-hydrating', name: 'CeraVe Hydrating Facial Cleanser', price: null, was: null },
  { id: 'bioderma', name: 'Bioderma Sensibio H2O Micellar Water', price: 2450, was: null },
  { id: 'glycolic', name: 'The Ordinary Glycolic Acid 7% Toning Solution', price: null, was: null },
  { id: 'acne-wash', name: 'CeraVe Acne Foaming Cream Wash 4% Benzoyl Peroxide', price: null, was: null },
];

export const ALLOWED_IDS = new Set(DEFAULT_PRODUCTS.map((p) => p.id));

export function cleanProducts(input) {
  if (!Array.isArray(input)) return null;
  const byId = new Map(DEFAULT_PRODUCTS.map((p) => [p.id, p]));
  const out = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') return null;
    if (!byId.has(item.id)) return null;
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!name || name.length > 120) return null;
    const price = item.price === null || item.price === '' || item.price === undefined
      ? null
      : Number(item.price);
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 100000)) return null;
    const was = item.was === null || item.was === '' || item.was === undefined
      ? null
      : Number(item.was);
    if (was !== null && (!Number.isFinite(was) || was < 0 || was > 100000)) return null;
    out.push({ id: item.id, name, price, was });
  }
  // Every known product must be present, exactly once.
  if (out.length !== DEFAULT_PRODUCTS.length) return null;
  if (new Set(out.map((p) => p.id)).size !== out.length) return null;
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  try {
    const redis = Redis.fromEnv();
    const saved = await redis.get('ilvarin:products');
    const products = saved && Array.isArray(saved.products)
      ? saved.products
      : DEFAULT_PRODUCTS;
    return res.status(200).json({ products });
  } catch (e) {
    // Never break the shop: fall back to the built-in list.
    return res.status(200).json({ products: DEFAULT_PRODUCTS });
  }
}
