const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, proto } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { commands } = require('./command');
const { parseMessage } = require('./lib/msgparser'); 
const { getDB } = require('./lib/database'); 

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const conn = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // QR අක්‍රීයයි
        auth: state,
        browser: [ "Ubuntu", "Chrome", "20.0.04" ] // බ්‍රවුසර් එකක් ලෙස පෙන්වීම
    });

    // --- PAIRING CODE GENERATOR ---
    // බොට් තවම ලොග් වෙලා නැත්නම්, පහත නම්බර් එකට ඔටෝ කෝඩ් එකක් රික්වෙස්ට් කරයි
    if (!conn.authState.creds.registered) {
        // 💡 කරුණාකර '94771234567' වෙනුවට ඔයාගේ බොට් දාන WhatsApp නම්බර් එක ඇතුලත් කරන්න (+ ලකුණ නැතිව)
        const myBotNumber = "94740534738"; 
        
        setTimeout(async () => {
            let code = await conn.requestPairingCode(myBotNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\n\n🔑 QUEEN ELISA LOGIN PAIRING CODE: ${code}\n\n`);
        }, 5000);
    }

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log(`✅ ${config.BOT_NAME} Connected Successfully!`);
        }
    });

    conn.ev.on('messages.upsert', async (mek) => {
        try {
            if (!mek.messages || mek.messages.length === 0) return;
            const parsed = await parseMessage(conn, mek);
            if (!parsed) return;

            const { msg, jid, body } = parsed;
            const db = getDB();
            const dbPrefix = db.settings.prefix || ".";
            const isCmd = body.startsWith(dbPrefix);
            
            const command = isCmd ? body.slice(dbPrefix.length).trim().split(' ')[0].toLowerCase() : body.trim().toLowerCase();
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(' ');
            const pushname = msg.pushName || 'User';
            const reply = async (text) => { await conn.sendMessage(jid, { text: text }, { quoted: msg }); };

            const cmdData = commands.find((c) => c.pattern === command || (c.alias && c.alias.includes(command)));
            if (cmdData) {
                await cmdData.function(conn, mek, msg, { jid, body, isCmd, command, args, q, pushname, reply });
            }
        } catch (err) {
            console.log(err);
        }
    });
}

startBot();
