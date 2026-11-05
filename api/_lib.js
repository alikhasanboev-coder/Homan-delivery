const U = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const T = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export const db = async (...cmd) => {
  const r = await fetch(U, { method: 'POST', headers: { Authorization: 'Bearer ' + T }, body: JSON.stringify(cmd) });
  return (await r.json()).result;
};
export const norm = (p) => String(p || '').replace(/\D/g, '').slice(-9);
export const tg = (chat_id, text, extra = {}) =>
  fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id, text, ...extra }),
  }).catch(() => {});
export const role = (req) => {
  const r = req.headers['x-role'];
  return r === 'shop' || r === 'courier' ? r : null;
};
export const lines = (o) => o.items.map((i) => `• ${i.name} × ${i.qty}`).join('\n');
