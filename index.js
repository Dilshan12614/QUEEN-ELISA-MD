const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, proto } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { commands } = require('./command');
const { parseMessage } = require('./lib/msgparser'); 
const { getDB } = require('./lib/database'); 

async function startBot() {
    // 1. Session and Credentials management
    if (!fs.existsSync('./auth_info_baileys')) {
        fs.mkdirSync('./auth_info_baileys');
    }

    const credsPath = './auth_info_baileys/creds.json';
    if (!fs.existsSync(credsPath)) {
        try {
            const base64Data = config.SESSION_ID.split('=');
            if (base64Data && base64Data[1]) {
                const decryptedCreds = Buffer.from(base64Data[1], 'base64').toString('utf-8');
                fs.writeFileSync(credsPath, decryptedCreds);
            }
        } catch (e) {
            console.log("Session decryption failed, creating basic session file.");
            fs.writeFileSync(credsPath, JSON.stringify({ "noiseKey": {}, "pairingKey": {}, "me": {}, "myAppStateKeyId": "" })); 
        }
    }

    // 2. Plugins Auto-Loader System with Total Count Logger
    console.log("=========================================");
    console.log("⚙️  STARTING QUEEN ELISA-MD PLUGINS ENGINE...");
    console.log("=========================================");
    
    const pluginsPath = path.join(__dirname, 'plugins');
    let pluginCount = 0;
    
    if (fs.existsSync(pluginsPath)) {
        fs.readdirSync(pluginsPath).forEach(file => {
            if (file.endsWith('.js')) {
                require(`./plugins/${file}`);
                console.log(`🔹 Plugin Loaded: ${file} ✅`);
                pluginCount++;
            }
        });
    }
    console.log("-----------------------------------------");
    console.log(`🎉 SUCCESS: ${pluginCount} PLUGINS INSTALLED SUCCESSFULLY!`);
    console.log("=========================================");

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const conn = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: [ "Ubuntu", "Chrome", "20.0.04" ]
    });

    conn.ev.on('creds.update', saveCreds);

    // 3. Monitor connection status with beautiful logs
    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Connection closed. Reconnecting to WhatsApp...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log("=========================================");
            console.log(`✅ SUCCESS: CONNECTED TO WHATSAPP SERVER!`);
            console.log(`🤖 BOT NAME : ${config.BOT_NAME}`);
            console.log(`📡 STATUS   : ONLINE & READY TO WORK`);
            console.log("=========================================");
        }
    });

    // 4. Main Message Incoming Handler
    conn.ev.on('messages.upsert', async (mek) => {
        try {
            if (!mek.messages || mek.messages.length === 0) return;
            
            // Auto-Read Status Feature
            const rawMsg = mek.messages[0];
            const db = getDB();
            if (db.settings.autoviewstatus && rawMsg.key.remoteJid === 'status@broadcast') {
                await conn.readMessages([rawMsg.key]);
                return;
            }

            // Parse incoming WhatsApp raw message payloads via lib/msgparser
            const parsed = await parseMessage(conn, mek);
            if (!parsed) return;

            const { msg, jid, isGroup, sender, fromMe, pushname, body, isGroupAdmin, isBotAdmin } = parsed;
            if (!body) return;

            // Command identification structure
            const dbPrefix = db.settings.prefix || ".";
            const isCmd = body.startsWith(dbPrefix);
            
            let command = "";
            if (isCmd) {
                const splitText = body.slice(dbPrefix.length).trim().split(' ');
                command = splitText[0].toLowerCase();
            } else {
                command = body.trim(); 
            }
                
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(' ');

            const reply = async (text) => {
                await conn.sendMessage(jid, { text: text }, { quoted: msg });
            };

            // Locate and fire the command or matching button ID from registry
            const cmdData = commands.find((c) => 
                c.pattern.toLowerCase() === command.toLowerCase() || 
                c.pattern === command ||
                (c.alias && c.alias.map(v => v.toLowerCase()).includes(command.toLowerCase()))
            );
            
            if (cmdData) {
                await cmdData.function(conn, mek, msg, { jid, body, isCmd, command, args, q, pushname, reply, isGroup, sender, fromMe, isGroupAdmin, isBotAdmin });
            }

        } catch (err) {
            console.log("Error handling standard loop message:", err);
        }
    });
}

startBot();
