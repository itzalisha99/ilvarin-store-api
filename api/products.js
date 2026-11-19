import { Redis } from '@upstash/redis';

// Default product list — exactly what the live Ilvarin demo shows today.
// The admin page overwrites this in the database; until then these defaults
// are served so the shop never breaks.
export const CATEGORIES = ['Serums', 'Cleansers', 'Moisturizers', 'Sunscreen', 'Toners', 'Masks', 'Eye Care', 'Hair Care'];

export const DEFAULT_PRODUCTS = [
  { id: 'niacinamide', name: 'The Ordinary Niacinamide 10% + Zinc 1%', price: 1650, was: null, cat: 'Serums', image: null },
  { id: 'cerave-foaming', name: 'CeraVe Foaming Facial Cleanser', price: 2450, was: 2800, cat: 'Cleansers', image: null },
  { id: 'cerave-cream', name: 'CeraVe Moisturising Cream', price: 2900, was: 3300, cat: 'Moisturizers', image: null },
  { id: 'cosrx-snail', name: 'COSRX Advanced Snail 96 Mucin Power Essence', price: 2650, was: null, cat: 'Serums', image: null },
  { id: 'cetaphil', name: 'Cetaphil Gentle Skin Cleanser', price: 1750, was: null, cat: 'Cleansers', image: null },
  { id: 'cerave-hydrating', name: 'CeraVe Hydrating Facial Cleanser', price: null, was: null, cat: 'Cleansers', image: null },
  { id: 'bioderma', name: 'Bioderma Sensibio H2O Micellar Water', price: 2450, was: null, cat: 'Cleansers', image: null },
  { id: 'glycolic', name: 'The Ordinary Glycolic Acid 7% Toning Solution', price: null, was: null, cat: 'Toners', image: null },
  { id: 'acne-wash', name: 'CeraVe Acne Foaming Cream Wash 4% Benzoyl Peroxide', price: null, was: null, cat: 'Cleansers', image: null },
];

export const ALLOWED_IDS = new Set(DEFAULT_PRODUCTS.map((p) => p.id));

const MAX_PRODUCTS = 50;
const MAX_IMAGE_CHARS = 350000; // ~260KB of image data

function cleanMoney(value) {
  if (value === null || value === '' || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100000) return undefined;
  return n;
}

export function cleanProducts(input) {
  if (!Array.isArray(input)) return null;
  if (input.length === 0 || input.length > MAX_PRODUCTS) return null;
  const seen = new Set();
  const out = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') return null;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) return null;
    if (seen.has(id)) return null;
    seen.add(id);
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!name || name.length > 120) return null;
    const price = cleanMoney(item.price);
    if (price === undefined) return null;
    const was = cleanMoney(item.was);
    if (was === undefined) return null;
    if (!CATEGORIES.includes(item.cat)) return null;
    let image = null;
    if (item.image !== null && item.image !== '' && item.image !== undefined) {
      if (typeof item.image !== 'string') return null;
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(item.image)) return null;
      if (item.image.length > MAX_IMAGE_CHARS) return null;
      image = item.image;
    }
    out.push({ id, name, price, was, cat: item.cat, image });
  }
  return out;
}

// Fill in cat/image for lists saved by the older version (which had no cat/image).
export function normalizeProducts(products) {
  if (!Array.isArray(products)) return DEFAULT_PRODUCTS;
  const byId = new Map(DEFAULT_PRODUCTS.map((p) => [p.id, p]));
  const out = [];
  for (const p of products) {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string') continue;
    const d = byId.get(p.id);
    out.push({
      id: p.id,
      name: typeof p.name === 'string' ? p.name : (d ? d.name : p.id),
      price: p.price === undefined ? (d ? d.price : null) : p.price,
      was: p.was === undefined ? (d ? d.was : null) : p.was,
      cat: CATEGORIES.includes(p.cat) ? p.cat : (d ? d.cat : 'Serums'),
      image: typeof p.image === 'string' ? p.image : null,
    });
  }
  return out.length ? out : DEFAULT_PRODUCTS;
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
      ? normalizeProducts(saved.products)
      : DEFAULT_PRODUCTS;
    return res.status(200).json({ products });
  } catch (e) {
    // Never break the shop: fall back to the built-in list.
    return res.status(200).json({ products: DEFAULT_PRODUCTS });
  }
}
