// Google Sheets uchun skript. Kodni Extensions → Apps Script ichiga qo'ying.
const HEAD = ['ID', 'Дата', 'Клиент', 'Телефон', 'Адрес', 'Товары', 'Комментарий', 'Статус', 'Выехал', 'Доставлен'];
const ST = { new: 'Новый', going: 'В пути', done: 'Доставлен' };

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.secret !== PropertiesService.getScriptProperties().getProperty('SECRET')) {
    return ContentService.createTextOutput('forbidden');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const o = d.order;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName('Заказы');
    if (!sh) {
      sh = ss.insertSheet('Заказы');
      sh.appendRow(HEAD);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, HEAD.length).setFontWeight('bold');
      sh.getRange('A:A').setNumberFormat('@');
      sh.getRange('D:D').setNumberFormat('@');
      sh.setColumnWidths(1, HEAD.length, 130);
      sh.setColumnWidth(5, 260);
      sh.setColumnWidth(6, 300);
    }
    const f = (t) => (t ? Utilities.formatDate(new Date(t), 'Asia/Tashkent', 'dd.MM.yyyy HH:mm') : '');
    const items = o.items.map((i) => i.name + ' × ' + i.qty + ' (' + (i.from || 'Склад') + ')').join('\n');
    const row = [o.id, f(o.created), o.name, o.phone, o.address, items, o.comment || '', ST[o.status] || o.status, f(o.goingAt), f(o.doneAt)];
    const last = sh.getLastRow();
    const ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().flat() : [];
    const i = ids.indexOf(o.id);
    const r = i >= 0 ? i + 2 : last + 1;
    sh.getRange(r, 1, 1, HEAD.length).setValues([row]).setWrap(true).setVerticalAlignment('top');
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}
