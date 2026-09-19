const axios = require('axios'); 

/** 

* Fetch text or JSON data from a URL safely
* @param {string} url
*/
const getBuffer = async (url, options) => {
try {
options ? options : {}
const res = await axios({
method: "get",
url,
headers: {
'DNT': 1,
'Upgrade-Insecure-Requests': 1
},
...options,
responseType: 'arraybuffer'
});
return res.data;
} catch (e) {
console.log(`Error in getBuffer: ${e}`);
return null;
}
};

/** 

* Format bytes into human-readable size (KB, MB, GB)
* @param {number} bytes
*/
const formatBytes = (bytes, decimals = 2) => {
if (bytes === 0) return '0 Bytes';
const k = 1024;
const dm = decimals < 0 ? 0 : decimals;
const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
const i = Math.floor(Math.log(bytes) / Math.log(k));
return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

module.exports = {
getBuffer,
formatBytes
};
