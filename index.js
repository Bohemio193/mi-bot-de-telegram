const { Telegraf } = require('telegraf');
const express = require('express');

// Inicializar el bot con el token de Telegram
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Configurar comandos y manejadores de mensajes
bot.start((ctx) => ctx.reply('¡Hola! Bienvenido al bot mejorado 2.0.'));
bot.on('message', (ctx) => ctx.reply(ctx.message.text));

// Manejo de errores
bot.catch((err, ctx) => {
  console.error(`Ocurrió un error en el contexto ${ctx.updateType}`, err);
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
