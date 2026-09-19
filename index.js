const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, proto } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { commands } = require('./command');

async function startBot() {
    // 1. Session and Credentials management
    if (!fs.existsSync('./auth_info_baileys')) {
        fs.mkdirSync('./auth_info_baileys');
    }

    const credsPath = './auth_info_baileys/creds.json';
    if (!fs.existsSync(credsPath)) {
        try {
            const base64Data = config.SESSION_ID.split('=');
            if (base64Data) {
                const decryptedCreds = Buffer.from(base64Data, 'base64').toString('utf-8');
                fs.writeFileSync(credsPath, decryptedCreds);
            }
        } catch (e) {
            fs.writeFileSync(credsPath, JSON.stringify({ "noiseKey": {}, "pairingKey": {}, "me": {}, "myAppStateKeyId": "" })); 
        }
    }

    // 2. PLUGINS AUTO-LOADER SYSTEM
    console.log("Loading plugins...");
    const pluginsPath = path.join(__dirname, 'plugins');
    if (fs.existsSync(pluginsPath)) {
        fs.readdirSync(pluginsPath).forEach(file => {
            if (file.endsWith('.js')) {
                require(`./plugins/${file}`);
                console.log(`Plugin Loaded: ${file} ✅`);
            }
        });
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const conn = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: [ "Ubuntu", "Chrome", "20.0.04" ]
    });

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log(`✅ ${config.BOT_NAME} Connected Successfully!`);
        }
    });

    conn.ev.on('messages.upsert', async (mek) => {
        try {
            if (!mek.messages || mek.messages.length === 0) return;
            const msg = mek.messages;
            if (!msg.message) return;

            const jid = msg.key.remoteJid;
            const messageType = Object.keys(msg.message);

            // Read regular messages or button interactions
            let body = "";
            if (messageType === 'conversation') {
                body = msg.message.conversation;
            } else if (messageType === 'extendedTextMessage') {
                body = msg.message.extendedTextMessage.text;
            } else if (messageType === 'interactiveResponseMessage') {
                const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
                body = params.id || "";
            }

            // Command parsing logic
            const prefix = ".";
            const isCmd = body.startsWith(prefix);
            const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : body.trim().toLowerCase();
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(' ');
            const pushname = msg.pushName || 'User';

            const reply = async (text) => {
                await conn.sendMessage(jid, { text: text }, { quoted: msg });
            };

            // Find and execute plugin command or button ID match
            const cmdData = commands.find((c) => c.pattern === command || (c.alias && c.alias.includes(command)));
            if (cmdData) {
                await cmdData.function(conn, mek, msg, { jid, body, isCmd, command, args, q, pushname, reply });
            }

        } catch (err) {
            console.log("Error inside message execution loop:", err);
        }
    });
}

startBot();
