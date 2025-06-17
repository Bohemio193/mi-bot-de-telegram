const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start((ctx) => ctx.reply('¡Hola! Bienvenido al bot.'));
bot.on('message', (ctx) => ctx.reply(ctx.message.text));

bot.launch();

// Manejo de errores
bot.catch((err, ctx) => {
  console.error(`Ocurrió un error en el contexto ${ctx.updateType}`, err);
});

// Mantener la aplicación activa
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot de Telegram en funcionamiento');
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
