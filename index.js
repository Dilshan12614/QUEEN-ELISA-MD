const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, proto } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const config = require('./config'); // config.js ෆයිල් එක සම්බන්ද කිරීම 

async function startBot() {
// auth_info_baileys ෆෝල්ඩර් එක නැත්නම් එකක් සාදයි
if (!fs.existsSync('./auth_info_baileys')) {
fs.mkdirSync('./auth_info_baileys');
} 

// config.js එකේ තියෙන Session ID එක පාවිච්චි කර creds.json ෆයිල් එක සකස් කිරීම
const credsPath = './auth_info_baileys/creds.json';
if (!fs.existsSync(credsPath)) {
try {
// සෙෂන් එකේ මැද තියෙන '=' ලකුණෙන් වෙන් කර base64 කොටස decode කිරීම
const base64Data = config.SESSION_ID.split('=')[1];
if (base64Data) {
const decryptedCreds = Buffer.from(base64Data, 'base64').toString('utf-8');
fs.writeFileSync(credsPath, decryptedCreds);
}
} catch (e) {
console.log("Session decryption failed, creating basic session file.");
fs.writeFileSync(credsPath, JSON.stringify({ "noiseKey": {}, "pairingKey": {}, "me": {}, "myAppStateKeyId": "" }));
}
}

const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

const conn = makeWASocket({
logger: pino({ level: 'silent' }),
printQRInTerminal: false,
auth: state,
browser: [ "Ubuntu", "Chrome", "20.0.04" ]
});

conn.ev.on('creds.update', saveCreds);

// WhatsApp සම්බන්දතාවය පරීක්ෂා කිරීම
conn.ev.on('connection.update', (update) => {
const { connection, lastDisconnect } = update;
if (connection === 'close') {
const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
console.log('සම්බන්ධතාවය બිඳ වැටුණා. නැවත උත්සාහ කරයි...', shouldReconnect);
if (shouldReconnect) startBot();
} else if (connection === 'open') {
console.log('✅ QUEEN ELISA-MD සාර්ථකව සම්බන්ධ වුණා!');
}
});

// මැසේජ් කියවන කොටස (Message Handler)
conn.ev.on('messages.upsert', async (mek) => {
try {
if (!mek.messages || mek.messages.length === 0) return;
const msg = mek.messages[0]; // පළමු මැසේජ් එක ලබා ගැනීම
if (!msg.message) return;
    const jid = msg.key.remoteJid;
    const messageType = Object.keys(msg.message)[0];

    // යූසර් එවන අකුරු හෝ බටන් Click කියවා ගැනීම
    let body = "";
    if (messageType === 'conversation') {
        body = msg.message.conversation;
    } else if (messageType === 'extendedTextMessage') {
        body = msg.message.extendedTextMessage.text;
    } else if (messageType === 'interactiveResponseMessage') {
        const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
        body = params.id || "";
    }

    // Command: .menu හෝ menu ලෙස මැසේජ් කල විට INTERACTIVE BUTTON MESSAGE එකක් යැවීම
    if (body === '.menu' || body === 'menu') {
        
        const buttonMessage = {
            viewOnceMessage: {
                message: {
                    interactiveMessage: proto.Message.InteractiveMessage.create({
                        body: proto.Message.InteractiveMessage.Body.create({
                            text: `👋 *Hello! Welcome to ${config.BOT_NAME}.*\n\nඔබට අවශ්‍ය වැඩකෑල්ල පහත බොත්තම් වලින් තෝරන්න:`
                        }),
                        footer: proto.Message.InteractiveMessage.Footer.create({
                            text: "🤖 QUEEN ELISA-MD Smart Bot"
                        }),
                        header: proto.Message.InteractiveMessage.Header.create({
                            title: `✨ ${config.BOT_NAME} MENU ✨`,
                            hasMediaAttachment: false
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                            buttons: [
                                {
                                    "name": "quick_reply",
                                    "buttonParamsJson": "{\"display_text\":\"📥 Download Menu\",\"id\":\"sub_download_click\"}"
                                },
                                {
                                    "name": "quick_reply",
                                    "buttonParamsJson": "{\"display_text\":\"ℹ️ About Bot\",\"id\":\"about_bot_click\"}"
                                }
                            ],
                        })
                    })
                }
            }
        };

        // WhatsApp වෙත බටන් මැසේජ් එක යැවීම
        await conn.relayMessage(jid, buttonMessage, {});
    }

    // --- බටන්ස් වලට රිප්ලයි දෙන කොටස ---
    if (body === 'sub_download_click') {
        await conn.sendMessage(jid, { text: "🎬 *Subtitle / Media Downloader* \n\nදැනට මෙම වැඩකෑල්ල සක්‍රීය වෙමින් පවතී..." }, { quoted: msg });
    }

    if (body === 'about_bot_click') {
        await conn.sendMessage(jid, { text: `🤖 *${config.BOT_NAME} v1.0.0*\n\nටර්මිනල් රහිතව GitHub මඟින් නිපදවන ලදි.` }, { quoted: msg });
    }

} catch (err) {
    console.log("Error:", err);
}

});

} 

startBot();
