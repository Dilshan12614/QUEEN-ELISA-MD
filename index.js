const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, proto } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { File } = require('megajs'); 
const config = require('./config');
const { commands } = require('./command');
const { parseMessage } = require('./lib/msgparser'); 
const { getDB } = require('./lib/database'); 

async function startBot() {
    // 1. Session and Credentials management (MEGA.nz # Sign & URL Fix)
    if (!fs.existsSync('./auth_info_baileys')) {
        fs.mkdirSync('./auth_info_baileys');
    }

    const credsPath = './auth_info_baileys/creds.json';
    
    if (!fs.existsSync(credsPath)) {
        if (!config.SESSION_ID) {
            return console.log('❌ Please add your session to SESSION_ID env or config file!!');
        }

        try {
            console.log("📥 Downloading session credentials from MEGA.nz...");
            
            // සෙෂන් අයිඩී එකේ මුලට LUXALGO= ආවොත් එය ඉවත් කරයි
            let sessdata = config.SESSION_ID.replace("LUXALGO=", "").trim();
            
            // MEGA ලින්ක් එක නිවැරදිව ගොඩනැගීම (ලින්ක් එකේ /file/ කොටස සහ # ලකුණ ස්ථාවරව තබා ගනී)
            let megaUrl = sessdata;
            if (!megaUrl.startsWith('https://mega.nz')) {
                // ඔබ දුන්නේ P5xkUZYL#kmv... වැනි කේතයක් පමණක් නම් එය සම්පූර්ණ MEGA ලින්ක් එකක් බවට පත් කරයි
                megaUrl = `https://mega.nzfile/${sessdata}`;
            }
            
            const file = File.fromURL(megaUrl);
            const data = await file.downloadBuffer();
            fs.writeFileSync(credsPath, data);
            console.log("✅ Session downloaded successfully from MEGA and configured! 🔒");
            
        } catch (err) {
            console.log("❌ MEGA.nz session download failed. Error:", err.message);
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
            
            const rawMsg = mek.messages[0];
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
                    body = pollUpdate.vote.selectedOptions[0].name;
                }
            }
            // =======================================================================

            if (!body) return;

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
                await cmdData.function(conn, mek, msg, { jid, body, isCmd, command, args, q, pushname, reply, isGroup, sender, fromMe, isGroupAdmin, isBotAdmin });
            }

        } catch (err) {
            console.log("Error handling standard loop message:", err);
        }
    });
}

startBot();
