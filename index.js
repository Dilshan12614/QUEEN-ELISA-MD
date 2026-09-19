const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, proto } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // MEGA API එකෙන් වේගයෙන් ඩවුන්ලෝඩ් කිරීමට
const config = require('./config');
const { commands } = require('./command');
const { parseMessage } = require('./lib/msgparser'); 
const { getDB } = require('./lib/database'); 

async function startBot() {
    // 1. Session and Credentials management (Fast Axios Downloader Fix)
    if (!fs.existsSync('./auth_info_baileys')) {
        fs.mkdirSync('./auth_info_baileys');
    }

    const credsPath = './auth_info_baileys/creds.json';
    
    if (!fs.existsSync(credsPath)) {
        if (!config.SESSION_ID) {
            return console.log('❌ Please add your session to SESSION_ID env or config file!!');
        }

        try {
            console.log("📥 [SYSTEM] Extracting Session ID credentials...");
            
            // සෙෂන් අයිඩී එක පිරිසිදු කර ගැනීම
            let sessdata = config.SESSION_ID.replace("LUXALGO=", "").trim();
            if (sessdata.includes('~')) sessdata = sessdata.split('~')[1];
            if (sessdata.includes(':')) sessdata = sessdata.split(':')[1];

            // MEGA.nz API එකෙන් creds.json එක සෘජුවම බාගත කිරීමේ ආරක්ෂිත විකල්පය
            if (sessdata.startsWith('http')) {
                console.log("🌐 Downloading from direct web URL...");
                const response = await axios.get(sessdata, { responseType: 'arraybuffer' });
                fs.writeFileSync(credsPath, response.data);
            } else {
                // Base64 මගින් සෙෂන් එක කෙලින්ම කියවා ගැනීම (සිරවීම් වළක්වා ගැනීමට)
                console.log("🔒 Decrypting raw Base64 session string...");
                const decryptedCreds = Buffer.from(sessdata, 'base64').toString('utf-8');
                fs.writeFileSync(credsPath, decryptedCreds);
            }
            
            console.log("✅ [SYSTEM] Session Credentials configured successfully! 🔒");
            
        } catch (err) {
            console.log("⚠️ Session parsing/download failed. Error:", err.message);
            console.log("🛠️ Creating emergency connection profile...");
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

    console.log("📡 [SYSTEM] Connecting to WhatsApp Server, Please Wait...");

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
            
            const rawMsg = mek.messages;
            const db = getDB();
            if (db.settings.autoviewstatus && rawMsg.key.remoteJid === 'status@broadcast') {
                await conn.readMessages([rawMsg.key]);
                return;
            }

            const parsed = await parseMessage(conn, mek);
            if (!parsed) return;

            let { msg, jid, isGroup, sender, fromMe, pushname, body, isGroupAdmin, isBotAdmin } = parsed;

            // ================= [ POLL BUTTON READER SYSTEM ] =================
            if (rawMsg.message && rawMsg.message.pollUpdateMessage) {
                const pollUpdate = rawMsg.message.pollUpdateMessage;
                if (pollUpdate.vote && pollUpdate.vote.selectedOptions && pollUpdate.vote.selectedOptions.length > 0) {
                    body = pollUpdate.vote.selectedOptions.name;
                }
            }
            // =======================================================================

            if (!body) return;

            // ================= [ HARDCODED OWNER NUMBER FIXED ] =================
            // ඔබ ඉල්ලූ පරිදි 0740534738 අංකය කෙලින්ම index එක ඇතුළතට එක් කර ඇත. රටේ කේතය (94) සමගද පරික්ෂා කෙරේ.
            const senderNumber = sender ? sender.replace(/[^0-9]/g, '') : '';
            const isOwner = fromMe || 
                            senderNumber === "0740534738" || 
                            senderNumber === "94740534738" || 
                            senderNumber === (config.OWNER_NUMBER ? config.OWNER_NUMBER.replace(/[^0-9]/g, '') : '') || 
                            senderNumber === (config.DEV ? config.DEV.replace(/[^0-9]/g, '') : '');
            // =========================================================================

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

            const cmdData = commands.find((c) => 
                c.pattern.toLowerCase() === command.toLowerCase() || 
                c.pattern === command ||
                (c.alias && c.alias.map(v => v.toLowerCase()).includes(command.toLowerCase()))
            );
            
            if (cmdData) {
                await cmdData.function(conn, mek, msg, { jid, body, isCmd, command, args, q, pushname, reply, isGroup, sender, fromMe, isGroupAdmin, isBotAdmin, isOwner });
            }

        } catch (err) {
            console.log("Error handling standard loop message:", err);
        }
    });
}

startBot();
