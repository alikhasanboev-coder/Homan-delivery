import { db, norm, tg } from './_lib.js';

export default async function handler(req, res) {
  if (req.headers['x-telegram-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET) return res.status(401).end();
  const m = req.body && req.body.message;
  if (!m) return res.json({ ok: true });
  const chat = m.chat.id;

  if (m.contact) {
    if (m.contact.user_id !== m.from.id) {
      await tg(chat, 'Пожалуйста, отправьте свой номер кнопкой ниже.');
      return res.json({ ok: true });
    }
    const phone = norm(m.contact.phone_number);
    const courierPhones = (process.env.COURIER_PHONES || '').split(',').map(norm).filter(Boolean);
    if (courierPhones.includes(phone)) {
      await db('SADD', 'couriers', String(chat));
      await tg(chat, '✅ Вы подключены как курьер. Новые заказы будут приходить сюда.', { reply_markup: { remove_keyboard: true } });
    } else {
      await db('HSET', 'chats', phone, String(chat));
      await tg(chat, '✅ Готово! Мы сообщим вам, когда курьер выедет и когда заказ будет доставлен.', { reply_markup: { remove_keyboard: true } });
    }
    return res.json({ ok: true });
  }

  await tg(chat, 'Добро пожаловать в Homan! Нажмите кнопку ниже, чтобы получать уведомления о вашем заказе.', {
    reply_markup: { keyboard: [[{ text: '📱 Отправить номер', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
  });
  res.json({ ok: true });
}
