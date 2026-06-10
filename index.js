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
    nombreNegocio: "Tu Negocio",
    productos: "Describe aquí lo que vendes",
    metodoPago: "Tu link de pago",
    reglas: "Sé amable, usa emojis y busca cerrar la venta."
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
        args: ['--no-sandbox', '--disable-setuid-sandbox']
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
