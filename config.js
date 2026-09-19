const fs = require('fs');
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });

function convertToBool(text, fault = 'true') {
    return text === fault ? true : false;
}

module.exports = {
SESSION_ID: process.env.SESSION_ID || "LUXALGO=P5xkUZYL#kmvWI2vvod2HmcT_qDBzNHq2GD44jeHfakgGubLJPwU",
// ඔබේ MEGA Session ID එක මෙතනට දාන්න

// =================== [ BUTTON METHOD SETTINGS ] ===================
BUTTON_METHOD: process.env.BUTTON_METHOD || "true",
// බොට්ගේ මෙනු සහ මැසේජ් බටන් (Poll) ක්‍රමයට වැඩ කිරීමට මෙතන true කරන්න. සාමාන්‍ය මැසේජ් වලට false කරන්න.

POLL_BUTTON_TYPE: process.env.POLL_BUTTON_TYPE || "poll",
// බටන් වර්ගය (දැනට පාවිච්චි කරන්නේ ස්ථාවර 'poll' බටන් ක්‍රමයයි)
// ===================================================================

AUTO_STATUS_SEEN: convertToBool(process.env.AUTO_STATUS_SEEN || "true"),
AUTO_STATUS_REPLY: convertToBool(process.env.AUTO_STATUS_REPLY || "false"),
AUTO_STATUS_REACT: convertToBool(process.env.AUTO_STATUS_REACT || "true"),
AUTO_STATUS_MSG: process.env.AUTO_STATUS_MSG || "*SEEN YOUR STATUS BY QUEEN ELISA-MD 🤍*",
PREFIX: process.env.PREFIX || ".",
BOT_NAME: process.env.BOT_NAME || "QUEEN ELISA-MD",
STICKER_NAME: process.env.STICKER_NAME || "QUEEN-ELISA-MD",
CUSTOM_REACT: convertToBool(process.env.CUSTOM_REACT || "false"),
CUSTOM_REACT_EMOJIS: process.env.CUSTOM_REACT_EMOJIS || "💝,💖,💗,❤️‍🩹,❤️,🧡,💛,💚,💙,💜,🤎,🖤,🤍",
DELETE_LINKS: convertToBool(process.env.DELETE_LINKS || "false"),
OWNER_NUMBER: process.env.OWNER_NUMBER || "94773416478",
OWNER_NAME: process.env.OWNER_NAME || "DILSHAN ASHINSA",
DESCRIPTION: process.env.DESCRIPTION || "*© ᴘᴏᴡᴇʀᴇᴅ ʙʏ Qᴜᴇᴇɴ ᴇʟɪꜱᴀ ᴍᴅ*",
ALIVE_IMG: process.env.ALIVE_IMG || "https://telegra.ph",
LIVE_MSG: process.env.LIVE_MSG || "> HELLO I'AM *QUEEN-ELISA-MD*⚡",
READ_MESSAGE: convertToBool(process.env.READ_MESSAGE || "false"),
AUTO_REACT: convertToBool(process.env.AUTO_REACT || "false"),
ANTI_BAD: convertToBool(process.env.ANTI_BAD || "false"),
MODE: process.env.MODE || "public",
ANTI_LINK: convertToBool(process.env.ANTI_LINK || "false"),
AUTO_VOICE: convertToBool(process.env.AUTO_VOICE || "false"),
AUTO_STICKER: convertToBool(process.env.AUTO_STICKER || "false"),
AUTO_REPLY: convertToBool(process.env.AUTO_REPLY || "false"),
ALWAYS_ONLINE: convertToBool(process.env.ALWAYS_ONLINE || "false"),
PUBLIC_MODE: convertToBool(process.env.PUBLIC_MODE || "true"),
AUTO_TYPING: convertToBool(process.env.AUTO_TYPING || "false"),
READ_CMD: convertToBool(process.env.READ_CMD || "false"),
DEV: process.env.DEV || "94740534738",
ANTI_VV: convertToBool(process.env.ANTI_VV || "true"),
ANTI_DEL_PATH: process.env.ANTI_DEL_PATH || "log", 
AUTO_RECORDING: convertToBool(process.env.AUTO_RECORDING || "false"),

settings: {
    autoviewstatus: convertToBool(process.env.AUTO_STATUS_SEEN || "true"),
    prefix: process.env.PREFIX || ".",
    button_mode: convertToBool(process.env.BUTTON_METHOD || "true")
}
};
