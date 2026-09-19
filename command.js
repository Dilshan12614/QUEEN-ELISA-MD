// command.js - Command and Button handler registry
const commands = [];

function cmd(info, func) {
    const data = {
        pattern: info.pattern,
        alias: info.alias || [],
        desc: info.desc || '',
        category: info.category || 'misc',
        dontAddCommandList: info.dontAddCommandList || false,
        function: func
    };
    commands.push(data);
    return data;
}

module.exports = {
    cmd,
    commands
};
