const Database = require('better-sqlite3');
const db = new Database('data/news_automation.db', { readonly: true });
const rows = db.all('SELECT * FROM settings');
console.log('Settings rows:', rows.length);
for (const row of rows) {
  console.log('_id:', row._id, '| value:', row.value ? row.value.substring(0, 50) + '...' : 'null');
}
db.close();