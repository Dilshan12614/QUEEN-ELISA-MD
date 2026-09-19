// lib/database.js - Simple local JSON database management
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, '../database.json');

// Initialize database file if it doesn't exist
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({
        settings: {
            autoviewstatus: true,
            antidelete: true,
            prefix: "."
        },
        groups: {}
    }, null, 2));
}

const getDB = () => {
    try {
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } catch (e) {
        return {};
    }
};

const saveDB = (data) => {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
};

module.exports = {
    getDB,
    saveDB
};
