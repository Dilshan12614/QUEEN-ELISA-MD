const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, proto } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const config = require('./config');

// Pairing Code එක Terminal/Logs හරහා ලබා ගැනීමට (ටර්මිනල් නැති නිසා Logs වලින් බලාගත හැක)
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    // 1. WhatsApp Login Session එක සුරැකීමට ෆෝල්ඩර් එකක් සෑදීම
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const conn = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // QR Code එක පෙන්වීම අක්‍රීයයි (Pairing Code පාවිච්චි කරන නිසා)
        auth: state,
        browser: [ "Ubuntu", "Chrome", "20.0.04" ] // Pairing code වැඩ කිරීමට බ්‍රවුසර් එකක් ලෙස පෙන්වීම
    });

    // --- PAIRING CODE ක්‍රියාවලිය ---
    // බොට් තවමත් WhatsApp ගිණුමට සම්බන්ධ වී නැත්නම් ලොග්ස් වලට නම්බර් එක ඉල්ලයි (Koyeb/Render Logs වල දමන්න පුළුවන්)
    if (!conn.authState.creds.registered) {
        // 💡 සටහන: ඔයාගේ බොට් දාන Phone Number එක රටේ කෝඩ් එක සමඟ (+9477xxxxxxx) මෙතන දෙන්නත් පුළුවන්, 
        // නැත්නම් Koyeb Environment Variables වල PHONE_NUMBER ලෙස දෙන්නත් පුළුවන්.
        const phoneNumber = process.env.PHONE_NUMBER || "94771234567"; // <-- මෙතන ඔයාගේ බොට් දාන නම්බර් එක දාන්න (+ ලකුණ නැතුව)
        
        setTimeout(async () => {
            let code = await conn.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\n\n🔑 QUEEN ELISA-MD LOGIN PAIRING CODE: ${code}\n\n`);
        }, 3000);
    }

    conn.ev.on('creds.update', saveCreds);

    // 2. WhatsApp සම්බන්දතාවය පරීක්ෂා කිරීම
    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('සම්බන්ධතාවය බිඳ වැටුණා. නැවත උත්සාහ කරයි...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ QUEEN ELISA-MD CONNECTED✅');
        }
    });

    // 3. මැසේජ් කියවන කොටස (Message Handler)
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
                                    text: `👋 *Hello! Welcome to QUEEN ELISA-MD.*\n\nඔබට අවශ්‍ය වැඩකෑල්ල පහත බොත්තම් වලින් තෝරන්න:`
                                }),
                                footer: proto.Message.InteractiveMessage.Footer.create({
                                    text: "🤖 QUEEN ELISA-MD Smart Bot"
                                }),
                                header: proto.Message.InteractiveMessage.Header.create({
                                    title: "✨ QUEEN ELISA-MD MENU ✨",
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
                await conn.sendMessage(jid, { text: "🤖 *QUEEN ELISA-MD v1.0.0*\n\nටර්මිනල් රහිතව GitHub මඟින් නිපදවන ලදි." }, { quoted: msg });
            }

        } catch (err) {
            console.log("Error:", err);
        }
    });
}

startBot();
