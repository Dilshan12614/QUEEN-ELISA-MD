// lib/msgparser.js - Clean and parse complex WhatsApp message payloads
const parseMessage = async (conn, mek) => {
    const msg = mek.messages[0];
    if (!msg || !msg.message) return null;

    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');
    const sender = isGroup ? (msg.key.participant || '') : jid;
    const fromMe = msg.key.fromMe;
    const pushname = msg.pushName || 'User';

    const messageType = Object.keys(msg.message)[0];
    
    // Extract text accurately from various message formats
    let body = "";
    if (messageType === 'conversation') {
        body = msg.message.conversation;
    } else if (messageType === 'extendedTextMessage') {
        body = msg.message.extendedTextMessage.text;
    } else if (messageType === 'imageMessage' || messageType === 'videoMessage') {
        body = msg.message[messageType].caption || "";
    } else if (messageType === 'interactiveResponseMessage') {
        const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
        body = params.id || "";
    } else if (messageType === 'buttonsResponseMessage') {
        body = msg.message.buttonsResponseMessage.selectedButtonId || "";
    }

    // Check for group admin privileges if inside a group chat
    let isGroupAdmin = false;
    let isBotAdmin = false;
    if (isGroup) {
        try {
            const metadata = await conn.groupMetadata(jid);
            const participants = metadata.participants || [];
            const admins = participants.filter(p => p.admin !== null).map(p => p.id);
            isGroupAdmin = admins.includes(sender);
            isBotAdmin = admins.includes(conn.user.id.split(':')[0] + '@s.whatsapp.net');
        } catch (e) {
            // Group metadata fetch failed (possibly bot was removed or network lag)
        }
    }

    return {
        msg,
        jid,
        isGroup,
        sender,
        fromMe,
        pushname,
        body,
        isGroupAdmin,
        isBotAdmin
    };
};

module.exports = { parseMessage };
