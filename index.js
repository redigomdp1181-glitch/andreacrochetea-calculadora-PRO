const { Client, LocalAuth } = require('whatsapp-web.js');
const { OpenAI } = require('openai');
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let emprendedorConfig = {
    nombreNegocio: "Andrea Crochetea",
    productos: "Calculadora de Precios PRO",
    metodoPago: "https://andreacrochetea.com/productos/calculadora-pro/",
    reglas: `Sos HolaAmiga, la asistente virtual experta de Andrea Crochetea. Tu misión es ayudar a emprendedoras y vender la 'Calculadora de Precios PRO'.
Tu personalidad: Sos súper argentina, cálida, profesional y cercana. Usás emojis (🚀, 📈, ✨, 🌎, 😊) y tratás a las clientas de vos. Sos breve, directa y eficiente.
Información clave para tus respuestas:
• ¿Qué es?: Es una Web App, no se descarga de Play Store/Apple Store. Se puede usar online o instalar como app en celu/tablet/compu.
• ¿Para quién es?: Es multirrubro. Sirve para todo lo que se pueda medir, pesar o contar.
• Funcionamiento: 1) Cargás materiales, 2) creás proyecto, 3) cargás datos, 4) compartís PDF/imagen. Incluye cronómetro de tiempo, gastos ocultos (luz, gas, desgaste de moldes).
• Inversión: Es un pago único (sin suscripciones), tenés acceso ilimitado y a todas las actualizaciones futuras.
• Compra: Podés ver todos los detalles y realizar tu compra segura aquí: https://andreacrochetea.com/productos/calculadora-pro/
• Moneda: Funciona en moneda local.
• Soporte: Soy tu única vía de ayuda. Si tienen dudas, deciles que me escriban directamente a mí en este chat, soy tu asistente personal.
Regla de oro: Si te preguntan si sirve para su emprendimiento o cómo funciona, explicáselo con seguridad. Tu tono siempre debe ser motivador: les hacés entender que la app les ahorra tiempo y les evita perder plata.`
};

const chatHistories = {};
let botStatus = 'desconectado';

// Configuramos el cliente UNA SOLA VEZ
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '.wwebjs_auth'
    }),
   puppeteer: {
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // ESTO ES CLAVE: evita que el bot se cuelgue por memoria
        '--no-zygote'
    ],
    timeout: 60000 // Le damos 60 segundos para arrancar
}
});

// Evento para el QR (usando el link que es más fácil de escanear)
client.on('qr', (qr) => {
    botStatus = 'esperando_qr';
    console.log('QR RECIBIDO, escanealo desde aquí: https://api.qrserver.com/v1/create-qr-code/?data=' + encodeURIComponent(qr));
});

client.on('ready', () => { botStatus = 'conectado'; });
client.on('disconnected', () => { botStatus = 'desconectado'; });

// Lógica de mensajes con OpenAI
client.on('message', async (msg) => {
    if (msg.from.includes('@g.us') || msg.fromMe) return;
    const userId = msg.from;
    const systemPrompt = `Eres un vendedor experto para "${emprendedorConfig.nombreNegocio}". 
    Info: ${emprendedorConfig.productos}. Pago: ${emprendedorConfig.metodoPago}. 
    Reglas: ${emprendedorConfig.reglas}`;

    if (!chatHistories[userId]) {
        chatHistories[userId] = [{ role: "system", content: systemPrompt }];
    } else {
        chatHistories[userId][0] = { role: "system", content: systemPrompt };
    }

    chatHistories[userId].push({ role: "user", content: msg.body });
    
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: chatHistories[userId]
        });
        const iaResponse = completion.choices[0].message.content;
        chatHistories[userId].push({ role: "assistant", content: iaResponse });
        await client.sendMessage(msg.from, iaResponse);
    } catch (e) { console.error(e); }
});

client.initialize();

app.get('/', (req, res) => { res.render('dashboard', { config: emprendedorConfig, botStatus }); });
app.post('/update-config', (req, res) => {
    emprendedorConfig = req.body;
    res.redirect('/');
});

app.listen(port, () => { console.log(`Dashboard en http://localhost:${port}`); });
