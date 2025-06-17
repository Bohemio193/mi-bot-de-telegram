import { Telegraf } from 'telegraf';
import express from 'express';
import cron from 'node-cron';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Configurar __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inicializar el bot con el token de Telegram
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Configurar la base de datos local
const file = join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter);

// Inicializar la base de datos
await db.read();
db.data ||= { messages: [] };
await db.write();

// Map para almacenar trabajos cron activos
const activeJobs = new Map();

// Función para programar un mensaje
function scheduleMessage(chatId, time, message, messageId) {
  const job = cron.schedule(time, async () => {
    try {
      await bot.telegram.sendMessage(chatId, message);
      
      // Eliminar el mensaje programado de la base de datos
      await db.read();
      const messages = db.data.messages || [];
      db.data.messages = messages.filter(msg => msg.id !== messageId);
      await db.write();
      
      // Remover del map de trabajos activos
      activeJobs.delete(messageId);
      
      console.log(`Mensaje enviado y eliminado: ${messageId}`);
    } catch (error) {
      console.error('Error enviando mensaje programado:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });
  
  // Guardar el trabajo en el map
  activeJobs.set(messageId, job);
  
  return job;
}

// Función para cargar mensajes programados al iniciar
async function loadScheduledMessages() {
  await db.read();
  const messages = db.data.messages || [];
  
  messages.forEach(msg => {
    scheduleMessage(msg.chatId, msg.time, msg.message, msg.id);
  });
  
  console.log(`Cargados ${messages.length} mensajes programados`);
}

// Comando /programar
bot.command('programar', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
      return ctx.reply('❌ Uso: /programar <hora> <mensaje>\n\nEjemplo: /programar "0 9 * * *" "Buenos días!"');
    }

    const time = args[1];
    const message = args.slice(2).join(' ');
    const messageId = Date.now().toString();

    // Validar formato cron básico
    if (!cron.validate(time)) {
      return ctx.reply('❌ Formato de hora inválido. Usa formato cron.\n\nEjemplos:\n- "0 9 * * *" (9:00 AM diario)\n- "30 14 * * 1-5" (2:30 PM lunes a viernes)');
    }

    // Programar el mensaje
    scheduleMessage(ctx.chat.id, time, message, messageId);

    // Guardar el mensaje en la base de datos
    await db.read();
    db.data.messages = db.data.messages || [];
    db.data.messages.push({ 
      id: messageId,
      chatId: ctx.chat.id, 
      time, 
      message,
      createdAt: new Date().toISOString()
    });
    await db.write();

    ctx.reply(`✅ Mensaje programado correctamente!\n\n🕐 Horario: ${time}\n📝 Mensaje: ${message}\n🆔 ID: ${messageId}`);
  } catch (error) {
    console.error('Error en comando programar:', error);
    ctx.reply('❌ Error al programar el mensaje. Intenta de nuevo.');
  }
});

// Comando /mensajes
bot.command('mensajes', async (ctx) => {
  try {
    await db.read();
    const messages = (db.data.messages || []).filter(msg => msg.chatId === ctx.chat.id);
    
    if (messages.length === 0) {
      return ctx.reply('📭 No hay mensajes programados.');
    }

    let messageList = '📋 *Mensajes programados:*\n\n';
    messages.forEach((msg, index) => {
      messageList += `${index + 1}. 🕐 ${msg.time}\n📝 ${msg.message}\n🆔 ${msg.id}\n\n`;
    });

    ctx.reply(messageList, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error en comando mensajes:', error);
    ctx.reply('❌ Error al obtener los mensajes.');
  }
});

// Comando /cancelar
bot.command('cancelar', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply('❌ Uso: /cancelar <ID>\n\nUsa /mensajes para ver los IDs disponibles.');
    }

    const messageId = args[1];
    
    // Cancelar el trabajo cron
    if (activeJobs.has(messageId)) {
      activeJobs.get(messageId).stop();
      activeJobs.delete(messageId);
    }

    // Eliminar de la base de datos
    await db.read();
    const originalLength = (db.data.messages || []).length;
    db.data.messages = (db.data.messages || []).filter(msg => msg.id !== messageId);
    await db.write();

    if (db.data.messages.length < originalLength) {
      ctx.reply(`✅ Mensaje cancelado correctamente (ID: ${messageId})`);
    } else {
      ctx.reply(`❌ No se encontró mensaje con ID: ${messageId}`);
    }
  } catch (error) {
    console.error('Error en comando cancelar:', error);
    ctx.reply('❌ Error al cancelar el mensaje.');
  }
});

// Comando /ayuda
bot.command('ayuda', (ctx) => {
  const helpMessage = `
🤖 *Smart Messenger Bot*
_Tu asistente para automatizar mensajes_

🔹 Programa mensajes para enviar automáticamente
🔹 Controla tus automatizaciones 
🔹 Estadísticas de uso en tiempo real
🔹 Funciona 24/7

📋 *Comandos disponibles:*

/programar <hora> <mensaje> - Programar mensaje
/mensajes - Ver mensajes programados  
/cancelar <ID> - Cancelar mensaje programado
/ayuda - Ver esta ayuda
/estado - Estado del bot

📅 *Formato de hora (Cron):*
- "0 9 * * *" → 9:00 AM diario
- "30 14 * * 1-5" → 2:30 PM lunes a viernes  
- "0 */2 * * *" → Cada 2 horas
- "15 10 * * 0" → 10:15 AM domingos

¿Necesitas ayuda? ¡Pregúntame!
`;
  ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

// Comando /estado
bot.command('estado', async (ctx) => {
  try {
    await db.read();
    const totalMessages = (db.data.messages || []).length;
    const userMessages = (db.data.messages || []).filter(msg => msg.chatId === ctx.chat.id).length;
    const activeJobsCount = activeJobs.size;

    const statusMessage = `
📊 *Estado del Bot*

✅ Bot: Activo
📱 Trabajos programados: ${activeJobsCount}
📝 Tus mensajes: ${userMessages}
🌐 Total mensajes: ${totalMessages}
🕐 Última consulta: ${new Date().toLocaleString('es-ES')}

_Todo funcionando correctamente_ ✨
`;

    ctx.reply(statusMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error en comando estado:', error);
    ctx.reply('❌ Error al obtener el estado.');
  }
});

// Configurar comandos
bot.start((ctx) => {
  const welcomeMessage = `
¡Hola ${ctx.from.first_name}! 👋

Bienvenido al *Smart Messenger Bot*

🚀 Ya puedes empezar a programar mensajes automáticos.

Usa /ayuda para ver todos los comandos disponibles.
`;
  ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
});

// Manejar mensajes de texto
bot.on('text', (ctx) => {
  if (!ctx.message.text.startsWith('/')) {
    ctx.reply(`Recibí: "${ctx.message.text}"\n\nUsa /ayuda para ver los comandos disponibles.`);
  }
});

// Manejo de errores
bot.catch((err, ctx) => {
  console.error(`Error en contexto ${ctx.updateType}:`, err);
  if (ctx.reply) {
    ctx.reply('❌ Lo siento, ocurrió un error. Intenta de nuevo más tarde.');
  }
});

// Iniciar el bot
console.log('🤖 Iniciando Smart Messenger Bot...');
bot.launch().then(() => {
  console.log('✅ Bot iniciado correctamente');
  loadScheduledMessages();
});

// Mantener la aplicación activa con Express
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    status: 'Smart Messenger Bot activo',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeJobs: activeJobs.size
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

app.get('/stats', async (req, res) => {
  try {
    await db.read();
    res.json({
      totalMessages: (db.data.messages || []).length,
      activeJobs: activeJobs.size,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor web activo en puerto ${PORT}`);
  console.log(`📊 Endpoints disponibles: /, /health, /stats`);
});

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('🛑 Deteniendo bot...');
  bot.stop('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('🛑 Deteniendo bot...');
  bot.stop('SIGTERM');
  process.exit(0);
});

export default bot;
