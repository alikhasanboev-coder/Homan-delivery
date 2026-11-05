import { db, norm, tg, tgHtml, role, lines, sheet } from './_lib.js';
import { MSG } from './config.js';

export default async function handler(req, res) {
  const who = role(req);
  if (!who) return res.status(401).json({ error: 'PIN' });

  if (req.method === 'GET') {
    const flat = (await db('HGETALL', 'orders')) || [];
    const orders = [];
    for (let i = 1; i < flat.length; i += 2) orders.push(JSON.parse(flat[i]));
    orders.sort((a, b) => b.created - a.created);
    const chats = (await db('HKEYS', 'chats')) || [];
    orders.forEach((o) => (o.linked = chats.includes(norm(o.phone))));
    return res.json({ role: who, bot: process.env.BOT_USERNAME || '', orders });
  }

  if (req.method === 'POST' && who === 'shop') {
    const { name, phone, address, items, comment } = req.body || {};
    const clean = (items || []).filter((i) => i.name && i.name.trim()).map((i) => ({ name: i.name.trim().slice(0, 120), qty: Math.max(1, +i.qty || 1), from: i.from === 'Магазин' ? 'Магазин' : 'Склад' }));
    if (!name || norm(phone).length < 9 || !address || !clean.length) return res.status(400).json({ error: 'Заполните все поля' });
    const o = {
      id: Date.now().toString(36), created: Date.now(), status: 'new',
      name: name.trim().slice(0, 80), phone: phone.trim().slice(0, 20),
      address: address.trim().slice(0, 200), items: clean, comment: (comment || '').trim().slice(0, 300),
    };
    await db('HSET', 'orders', o.id, JSON.stringify(o));
    const couriers = (await db('SMEMBERS', 'couriers')) || [];
    const txt = `🆕 Новый заказ\n\n${o.name}\n${o.phone}\n${o.address}\n\n${lines(o)}${o.comment ? '\n\n💬 ' + o.comment : ''}`;
    await Promise.all(couriers.map((c) => tg(c, txt)));
    const chat = await db('HGET', 'chats', norm(o.phone));
    await sheet(o);
    if (chat) await tgHtml(chat, MSG.accepted);
    return res.json({ ok: true, order: o });
  }

  if (req.method === 'PATCH' && who === 'courier') {
    const { id, status } = req.body || {};
    if (!['going', 'done'].includes(status)) return res.status(400).json({ error: 'status' });
    const raw = await db('HGET', 'orders', id);
    if (!raw) return res.status(404).json({ error: 'not found' });
    const o = JSON.parse(raw);
    o.status = status;
    o[status + 'At'] = Date.now();
    await db('HSET', 'orders', id, JSON.stringify(o));
    const chat = await db('HGET', 'chats', norm(o.phone));
    await sheet(o);
    if (chat) await tgHtml(chat, status === 'going' ? MSG.going : MSG.done);
    return res.json({ ok: true, order: o });
  }

  res.status(405).json({ error: 'method' });
}
