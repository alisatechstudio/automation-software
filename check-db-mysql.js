const mysql = require('mysql2/promise');
async function main() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'alisatec_automation',
    password: 'SAROmyw4',
    database: 'alisatec_automation'
  });
  
  const [rows] = await connection.execute('SELECT * FROM settings WHERE _id LIKE "%TTS%" OR _id LIKE "%GEMINI%"');
  console.log('TTS/Gemini settings:', rows);
  
  const [allSettings] = await connection.execute('SELECT * FROM settings LIMIT 20');
  console.log('All settings (first 20):', allSettings);
  
  connection.end();
}
main().catch(console.error);