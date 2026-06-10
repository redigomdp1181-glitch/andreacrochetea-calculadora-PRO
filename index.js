const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
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

const client = new Client({
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // A veces esto ayuda mucho en servidores
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    botStatus = 'esperando_qr';
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => { botStatus = 'conectado'; });
client.on('disconnected', () => { botStatus = 'desconectado'; });

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
