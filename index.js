const { Telegraf } = require('telegraf');
const express = require('express');
const cron = require('node-cron');
const low = require('lowdb');
const FileSync = require('lowdb/node/adapters/FileSync');

// Inicializar el bot con el token de Telegram
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Configurar la base de datos local
const adapter = new FileSync('db.json');
const db = low(adapter);

// Inicializar la base de datos
db.defaults({ messages: [] }).write();

// Función para programar un mensaje
function scheduleMessage(chatId, time, message) {
  cron.schedule(time, () => {
    bot.telegram.sendMessage(chatId, message);
    // Eliminar el mensaje programado de la base de datos
    db.get('messages').remove({ chatId, time, message }).write();
  }, {
    scheduled: true,
    timezone: "America/New_York" // Ajusta la zona horaria según tu ubicación
  });
}

// Comando /programar
bot.command('programar', (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 3) {
    return ctx.reply('Uso: /programar <hora> <mensaje>');
  }

  const time = args[1];
  const message = args.slice(2).join(' ');

  // Programar el mensaje
  scheduleMessage(ctx.chat.id, time, message);

  // Guardar el mensaje en la base de datos
  db.get('messages').push({ chatId: ctx.chat.id, time, message }).write();

  ctx.reply(`Mensaje programado para ${time}: ${message}`);
});

// Comando /mensajes
bot.command('mensajes', (ctx) => {
  const messages = db.get('messages').filter({ chatId: ctx.chat.id }).value();
  if (messages.length === 0) {
    return ctx.reply('No hay mensajes programados.');
  }

  const messageList = messages.map(msg => `Hora: ${msg.time}, Mensaje: ${msg.message}`).join('\n');
  ctx.reply(`Mensajes programados:\n${messageList}`);
});

// Comando /ayuda
bot.command('ayuda', (ctx) => {
  const helpMessage = `
*Soy Smart Messenger Bot, tu asistente para automatizar mensajes.*

🔹 Programa mensajes para enviar automáticamente
🔹 Controla tus automatizaciones 
🔹 Estadísticas de uso en tiempo real
🔹 Funciona 24/7

Usa los botones de abajo o estos comandos:
/programar <hora> <mensaje> - Programar mensaje
/mensajes - Ver mensajes programados
/ayuda - Ver todos los comandos
`;
  ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

// Configurar comandos y manejadores de mensajes
bot.start((ctx) => ctx.reply('¡Hola! Bienvenido/a al bot mejorado.'));
bot.on('message', (ctx) => ctx.reply(ctx.message.text));

// Manejo de errores
bot.catch((err, ctx) => {
  console.error(`Ocurrió un error en el contexto ${ctx.updateType}`, err);
  ctx.reply('Lo siento, ocurrió un error. Intenta de nuevo más tarde.');
});

// Iniciar el bot en modo polling
bot.launch();

// Mantener la aplicación activa
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot de Telegram en funcionamiento');
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
