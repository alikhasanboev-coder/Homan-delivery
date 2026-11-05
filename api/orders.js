import { db, norm, tg, tgHtml, role, lines, sheet } from './_lib.js';
import { MSG } from './config.js';

const clean = (b = {}) => {
  const items = (b.items || []).filter((i) => i.name && i.name.trim()).map((i) => ({
    name: i.name.trim().slice(0, 120), qty: Math.max(1, +i.qty || 1), from: i.from === 'Магазин' ? 'Магазин' : 'Склад',
  }));
  if (!b.name || norm(b.phone).length < 9 || !b.address || !items.length) return null;
  return { name: b.name.trim().slice(0, 80), phone: b.phone.trim().slice(0, 20), address: b.address.trim().slice(0, 200), items, comment: (b.comment || '').trim().slice(0, 300) };
};
const card = (o) => `${o.name}\n${o.phone}\n${o.address}\n\n${lines(o)}${o.comment ? '\n\n💬 ' + o.comment : ''}`;
const get = async (id) => { const r = await db('HGET', 'orders', id); return r ? JSON.parse(r) : null; };
const save = (o) => db('HSET', 'orders', o.id, JSON.stringify(o));
const couriers = async (txt) => { const c = (await db('SMEMBERS', 'couriers')) || []; await Promise.all(c.map((x) => tg(x, txt))); };
const closed = (o) => o.status === 'done' || o.status === 'cancelled';

export default async function handler(req, res) {
  const who = role(req);
  if (!who) return res.status(401).json({ error: 'Нет доступа' });
  const b = req.body || {};

  if (req.method === 'GET') {
    const flat = (await db('HGETALL', 'orders')) || [];
    const orders = [];
    for (let i = 1; i < flat.length; i += 2) orders.push(JSON.parse(flat[i]));
    orders.sort((a, b) => b.created - a.created);
    const chats = (await db('HKEYS', 'chats')) || [];
    orders.forEach((o) => (o.linked = chats.includes(norm(o.phone))));
    return res.json({ role: who, bot: process.env.BOT_USERNAME || '', orders });
  }

  if (who === 'shop' && req.method === 'POST') {
    const f = clean(b);
    if (!f) return res.status(400).json({ error: 'Заполните все поля' });
    const o = { id: Date.now().toString(36), created: Date.now(), status: 'new', ...f };
    await save(o);
    await couriers('🆕 Новый заказ\n\n' + card(o));
    await sheet(o);
    const chat = await db('HGET', 'chats', norm(o.phone));
    if (chat) await tgHtml(chat, MSG.accepted);
    return res.json({ ok: true, order: o });
  }

  if (who === 'shop' && req.method === 'PUT') {
    const f = clean(b);
    if (!f) return res.status(400).json({ error: 'Заполните все поля' });
    const o = await get(b.id);
    if (!o) return res.status(404).json({ error: 'Заказ не найден' });
    if (closed(o)) return res.status(409).json({ error: 'Заказ уже закрыт, изменить нельзя' });
    Object.assign(o, f, { edited: Date.now() });
    await save(o);
    await couriers('✏️ Заказ изменён\n\n' + card(o));
    await sheet(o);
    return res.json({ ok: true, order: o });
  }

  if (req.method === 'PATCH') {
    const o = await get(b.id);
    if (!o) return res.status(404).json({ error: 'Заказ не найден' });

    if (who === 'shop' && b.status === 'cancelled') {
      if (closed(o)) return res.status(409).json({ error: 'Заказ уже закрыт' });
      o.status = 'cancelled'; o.cancelledAt = Date.now();
      await save(o);
      await couriers(`❌ Заказ отменён\n\n${o.name}\n${o.address}`);
      await sheet(o);
      const chat = await db('HGET', 'chats', norm(o.phone));
      if (chat) await tgHtml(chat, MSG.cancelled);
      return res.json({ ok: true, order: o });
    }

    if (who === 'courier' && ['going', 'done'].includes(b.status)) {
      if (o.status === 'cancelled') return res.status(409).json({ error: 'Заказ отменён магазином' });
      if ((b.status === 'going' && o.status !== 'new') || (b.status === 'done' && o.status !== 'going'))
        return res.status(409).json({ error: 'Статус заказа уже изменён' });
      o.status = b.status; o[b.status + 'At'] = Date.now();
      await save(o);
      await sheet(o);
      const chat = await db('HGET', 'chats', norm(o.phone));
      if (chat) await tgHtml(chat, b.status === 'going' ? MSG.going : MSG.done);
      return res.json({ ok: true, order: o });
    }
  }

  res.status(403).json({ error: 'Действие недоступно' });
}
