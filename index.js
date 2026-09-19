const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, proto } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { commands } = require('./command');
const { parseMessage } = require('./lib/msgparser'); // Connect the message parser
const { getDB, saveDB } = require('./lib/database'); // Connect the database

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

    // 2. Plugins Auto-Loader System
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

    // 3. Monitor connection status
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

    // 4. WORKABLE WORK: ANTI-DELETE SYSTEM (Captures Deleted Messages)
    conn.ev.on('messages.update', async (updates) => {
        try {
            const db = getDB();
            if (!db.settings.antidelete) return; // Skip if disabled

            for (const update of updates) {
                if (update.update.message === null) {
                    const deletedMsgJid = update.key.remoteJid;
                    const deletedMsgSender = update.key.participant || deletedMsgJid;
                    
                    console.log(`[ANTI-DELETE] Detected inside: ${deletedMsgJid}`);
                    
                    await conn.sendMessage(deletedMsgJid, { 
                        text: `⚠️ *[QUEEN ELISA ANTI-DELETE]*\n\n@${deletedMsgSender.split('@')[0]} just deleted a message!`,
                        mentions: [deletedMsgSender]
                    }, { quoted: update });
                }
            }
        } catch (err) {
            console.log("Error in anti-delete engine:", err);
        }
    });

    // 5. Main Message Incoming Handler
    conn.ev.on('messages.upsert', async (mek) => {
        try {
            if (!mek.messages || mek.messages.length === 0) return;
            
            // Auto-Read Status Feature
            const rawMsg = mek.messages[0];
            const db = getDB();
            if (db.settings.autoviewstatus && rawMsg.key.remoteJid === 'status@broadcast') {
                await conn.readMessages([rawMsg.key]);
                console.log(`[STATUS WATCHER] Automatically viewed status from: ${rawMsg.pushName || 'User'}`);
                return;
            }

            // Parse incoming WhatsApp raw message payloads via lib/msgparser
            const parsed = await parseMessage(conn, mek);
            if (!parsed) return;

            const { msg, jid, isGroup, sender, fromMe, pushname, body, isGroupAdmin, isBotAdmin } = parsed;

            // Command identification structure
            const dbPrefix = db.settings.prefix || ".";
            const isCmd = body.startsWith(dbPrefix);
            
            // BUTTON ROUTER LOGIC: 
            // If it is a button response (doesn't have a prefix), we read it directly as the command name.
            const command = isCmd 
                ? body.slice(dbPrefix.length).trim().split(' ')[0].toLowerCase() 
                : body.trim().toLowerCase();
                
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(' ');

            const reply = async (text) => {
                await conn.sendMessage(jid, { text: text }, { quoted: msg });
            };

            // Locate and fire the command or matching button ID from registry
            const cmdData = commands.find((c) => c.pattern === command || (c.alias && c.alias.includes(command)));
            if (cmdData) {
                await cmdData.function(conn, mek, msg, { jid, body, isCmd, command, args, q, pushname, reply, isGroup, sender, fromMe, isGroupAdmin, isBotAdmin });
            }

        } catch (err) {
            console.log("Error handling standard loop message:", err);
        }
    });
}

startBot();
