const config = require('../config');
var xmlDom = require('xmldom');
var net = require('net');

var MESSAGES = {'POWERON':'PWR01', 'POWEROFF':'PWR00', 'MUSICSERVER':'NSV000', 'PAUSE': 'NTCPAUSE'};

const ampControl = {

    /**
     * Sends a power-on message
     * @param callback {function} optional callback
     */
    poweron: function (callback) {
        sendMessage(MESSAGES.POWERON, callback);
    },

    poweroff: function () {
        sendMessage(MESSAGES.POWEROFF);
    },

    pause: function() {
        sendMessage(MESSAGES.PAUSE)
    },

    /**
     * Starts playing the artist, optional album
     * @param artist {String}
     * @param album {String}
     * @param callback {function} call after music is started, or error occurred
     */
    startMusic: function (artist, album, callback) {
        artist = artist.replace(/\s/, '.');
        if (album) {
            album = album.replace(/\s/, '.');
        }
        sendMessage(MESSAGES.POWERON, function () {
                sendMessage(MESSAGES.MUSICSERVER, function () {
                    //finding dnla server
                    findAndSelectItemInList(new RegExp(config.server_name, 'i'), function () {
                        let musicFound = findAndSelectItemInList(/music|musique/i, function () {
                            let artistSectionFound = findAndSelectItemInList(/artist|Artiste/i, function () {
                                let artistFound = findAndSelectItemInList(new RegExp(artist, 'i'), function () {
                                    let next = function () {
                                        sendMessage(selectNthItemInTheListRequest(0, amp.currentLevel), callback);
                                    };
                                    if (album) {
                                        findAndSelectItemInList(new RegExp(album, 'i'), next);
                                    } else {
                                        sendMessage(selectNthItemInTheListRequest(0, amp.currentLevel), next);
                                    }
                                });
                                if (!artistFound) {
                                    //error
                                    callback('given artist not found');
                                }
                            });
                            if (!artistSectionFound) {
                                //error
                                callback('artist section not found');
                            }
                        });
                        if (!musicFound) {
                            callback('music section not found');
                        }
                    });
                });
            }
        );
    },
};



var myNext, ampli;

/**
 *
 * @param stringToMatch {RegExp}
 * @param callback
 */
function findAndSelectItemInList(stringToMatch,callback){
    let itemFound = false;
    //select music
    for (let i = 0; i < amp.currentList.length; i++) {
        if(amp.currentList[i].match(stringToMatch)){
            //select music
            sendMessage(selectNthItemInTheListRequest(i, amp.currentLevel),callback);
            itemFound = true;
            break;
        }
    }
    return itemFound;
}


/**
 *
 * @param id {number}
 * @param level {number}
 * @returns {String}
 */
selectNthItemInTheListRequest = (id, level) => {
    var hexLevel = (level).toString(16).toUpperCase().padStart(2,'0');

    var hexID = (id).toString(16).toUpperCase().padStart(4,'0');

    return 'NLAI' + hexLevel + hexID + '----';
};

listItemsInLevel = (level, numberOfItems) => {
    var hexLevel = (level).toString(16).toUpperCase().padStart(2,'0');
    var numberOfItemsHex = (numberOfItems).toString(16).toUpperCase().padStart(4,'0');

    //NLAL00000400000F14
    return 'NLAL0000' + hexLevel + '0000' + numberOfItemsHex;
};


/**
 * Start the socket to the amp
 * @param name
 * @param host
 * @param port
 */
connectToAmpli = (name, host, port) => {
    ampli = net.connect({host: host, port: port});
    ampli.name = name;

    ampli.on('connect', function () {
        ampli.is_connected = true;
    }).on('close', function () {
        ampli.is_connected = false;
        ampli.destroy();
    }).on('error', function (err) {
        //console.log(err);
    }).on('data', function (data) {
        var messages = data.toString().replace(/[^\x20-\x7E\xC0-\xFF]/gi, '');

        messages = messages.replace(/ISCP.!1/, 'ISCP!1');
        messages = messages.split('ISCP!1');

        let i = 0, len = messages.length;
        for (; i < len; i++) {
            if (messages[i].length > 0) {
                processMessage(messages[i]);
            }
        }
    });
};

function sendMessage(message, callback) {
    //console.log('sending message ' + message);
    if(ampli === undefined || !ampli.is_connected){
        //console.log("ampli is not connected");
        connectToAmpli('pioneer', '192.168.1.88', config.port);
    }
    if(typeof callback === 'function'){
        myNext = callback;
    }
    ampli.write(iscp_packet(message));
}

function executeCallback(){
    if(typeof myNext === 'function'){
        let myCallback = myNext;
        myNext = undefined;
        myCallback();
    }
}

/**
 *
 * @param message {String}
 */
processMessage = message => {
    //console.log(message);
    let number, layer, level;
    if (message.startsWith('NLSU')) {
        /*
                NLSU0-Browse Folders
                NLSU1-Music
                NLSU2-Pictures
                NLSU3-Video
        */
        if (message.substring(4, 5) === '0') {
            amp.currentList = [];
            //new list begins
        }
        amp.currentList.push(message.substring(message.indexOf('-') +1 ));
        if(amp.currentList.length === amp.expectedListSize){
            executeCallback();
        }
    } else if (message.startsWith('NLAX') || message.includes('><item')) {
        if(message.includes('response status="fail"')){
            //sometimes fails because the selection is too big for the server or whatever. Need to split calls
            //here we don't have the failed request...

        }
        //XML message - multiple messages coming
        let xmlValue = message;
        if(message.startsWith('NLAX')){
            xmlValue = message.substring(12);
            amp.xmlContent = ''; //new xml
        }
        amp.xmlContent += xmlValue;

        if(message.endsWith('</response>')){
            amp.xmlContent = amp.xmlContent.replace(/\n/g,'');
            amp.xmlContent = amp.xmlContent.replace(/\r/g,'');
            //last message, process the xml
            parser = new xmlDom.DOMParser();
            xmlDoc = parser.parseFromString(amp.xmlContent,'text/xml');
            let stuff = xmlDoc.getElementsByTagName('item');
            amp.currentList = [];
            for(let i=0;i<stuff.length;i++){
                amp.currentList.push(stuff[i].getAttribute('title'));
            }
            amp.xmlContent='';
            executeCallback();
        }
    } else if (message.startsWith('NLT00')) {
        /*      NLT 00 0 2 0000 0044 06 10 04 00 00- All Albums -
                NLT 00 0 2 0000 0005 02 10 04 00 00 FibaneServer
                NLT 00 0 2 0000 029B 04 10 04 00 00
                NLT 00 0 2 0000 029B 04 10 04 00 00
                  '{xx}u y cccc iiii ll rr aa bb ss
                  '{xx}u y cccc iiii ll sr aa bb ss
                xx : Service Type 00 : Music Server
                u : UI Type 0 : List
                y : Layer Info 2 : under 2nd Layer
                cccc : Current Cursor Position (HEX 4 letters)
                iiii : Number of List Items (HEX 4 letters)
                ll : Number of Layer
                */
        level = parseInt(message.substring(6,7));
        amp.currentLevel = level;
        number = parseInt(message.substring(11, 15),16);
        amp.expectedListSize = number;
        if(number > 4){
            layer = parseInt(message.substring(15,17),16);
            sendMessage(listItemsInLevel(layer,number));
        }
    } else if(message.startsWith('NLTF3')){
        // NLTF3 = list items F3 : NET
        number = parseInt(message.substring(11, 15),16);
        amp.expectedListSize = number; //don't know why I don't have to do -1 here... Protocol is sketchy
    }/* else if(message.startsWith('PWR01')){
        //ampli just started, call callback if needed
        executeCallback();
    }*/
};

//NTCRETURN


var amp = {
    currentList: [],
    expectedListSize: 0,
    currentLevel: 0,
    xmlContent : '',
};

function iscp_packet(data) {
    var iscp_msg, header;

    // Add ISCP header if not already present
    if (data.charAt(0) !== '!') { data = '!1' + data; }
    // ISCP message
    iscp_msg = new Buffer(data + '\x0D\x0a');

    // eISCP header
    header = new Buffer([
        73, 83, 67, 80, // magic
        0, 0, 0, 16,    // header size
        0, 0, 0, 0,     // data size
        1,              // version
        0, 0, 0         // reserved
    ]);
    // write data size to eISCP header
    header.writeUInt32BE(iscp_msg.length, 8);

    return Buffer.concat([header, iscp_msg]);
}

module.exports = ampControl;

