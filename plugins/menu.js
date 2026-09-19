// plugins/main.js - Main Commands (Menu & About)
const { cmd } = require('../command');
const config = require('../config');
const { proto } = require('@whiskeysockets/baileys');

// 1. MENU COMMAND WITH INTERACTIVE BUTTONS
cmd({
    pattern: "menu",
    alias: ["help", "panel"],
    category: "main",
    desc: "Show the main interactive menu"
}, async (conn, mek, msg, { jid, reply }) => {
    const buttonMessage = {
        viewOnceMessage: {
            message: {
                interactiveMessage: proto.Message.InteractiveMessage.create({
                    body: proto.Message.InteractiveMessage.Body.create({
                        text: `👋 *Hello! Welcome to ${config.BOT_NAME}.*\n\nPlease select an option from the buttons below:`
                    }),
                    footer: proto.Message.InteractiveMessage.Footer.create({
                        text: `🤖 ${config.BOT_NAME} Smart Bot`
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
    await conn.relayMessage(jid, buttonMessage, {});
});

// 2. ABOUT BOT BUTTON COMMAND
cmd({
    pattern: "about_bot_click",
    dontAddCommandList: true
}, async (conn, mek, msg, { jid }) => {
    await conn.sendMessage(jid, { text: `🤖 *${config.BOT_NAME} v1.0.0*\n\nBuilt entirely via GitHub with an advanced plugin system.` }, { quoted: msg });
});

// 3. DOWNLOAD MENU BUTTON COMMAND
cmd({
    pattern: "sub_download_click",
    dontAddCommandList: true
}, async (conn, mek, msg, { jid }) => {
    await conn.sendMessage(jid, { text: "📥 *Download Menu* \n\nFeatures are expanding! Send a link to download audio or video." }, { quoted: msg });
});
