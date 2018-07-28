var express = require('express');
var router = express.Router();
var net = require('net');
var xmldom = require('xmldom');
var ampli;

var LEVELS = Object.freeze({"musicServer":0, "server":1, "music":2, "artists":3, });

/* GET users listing. */
router.get('/on', function(req, res, next) {
    sendMessage('PWR01');
    res.send('AMPLI WAS ASKED TO POWER ON');
});

router.get('/off', function(req, res, next) {
    sendMessage('PWR00');
    res.send('AMPLI WAS ASKED TO POWER OFF');

});

router.get('/musicserver', function(req, res, next) {
    sendMessage('NSV000');
    res.send('AMPLI WAS ASKED TO GO TO THE MUSIC SERVERS');
});

router.get('/fibaneserver', function(req, res, next) {
    sendMessage('NLAI010000----');
    res.send('AMPLI WAS ASKED TO GO TO THE FIBANE SERVERS');
});

router.get('/fibaneservermusique', function(req, res, next) {
    sendMessage('NLAI020001----');
    res.send('AMPLI WAS ASKED TO GO TO THE FIBANE SERVERS');
});

router.get('/list', function(req, res, next) {
    var result = '';
    if(amp !== undefined && amp.currentList !== undefined){
        var i = 0;
        for(i = 0 ; i < amp.currentList.length; i++){
            result += i + ' - ' + amp.currentList[i] + '\n';
        }
    }
    res.send(result);
});

router.get('/select/:id',function (req, res, next) {
    var id = req.params.id;
    var level = amp.currentLevel;
    if(id >= amp.currentList.size){
        res.status(500).send('ID is too big and doesn\'t exist in the list');
    } else {
        var message=  selectNthItemInTheListRequest(id, level);
        sendMessage(message);
        res.send('MESSAGE ' + message + ' HAS BEEN SENT FOR LEVEL ' + level)
    }
});

router.get('/custom/:message',function (req, res, next) {
    var message = req.params.message;
    sendMessage(message);
    res.send('MESSAGE ' + message + ' HAS BEEN SENT');
});


/**
 *
 * @param id {String}
 * @param level {String}
 * @returns {String}
 */
selectNthItemInTheListRequest = (id, level) => {
    var hexID = id.toString(16).toUpperCase().padStart(4,'0');

    var hexLevel = level.toString(16).toUpperCase().padStart(2,'0');

    return 'NLAI' + hexLevel + hexID + '----';
};

listItemsInLevel = (level, numberOfItems) => {
    var hexLevel = level.toString(16).toUpperCase().padStart(2,'0');
    var numberOfItemsHex = numberOfItems.toString(16).toUpperCase().padStart(4,'0');

    //NLAL00000400000F14
    return 'NLAL0000' + hexLevel + '0000' + numberOfItemsHex;
};

/*

NLAI010000----
NLAI020001----          (second item in list) 1NLAI030002 - 3rd item in list  1NLAI0400E4---- xth item in the list
NLAI030002----
NLAI0400E4----
NLAI050001----
NLAI060008----
   Izzzzll----:

"Izzzzllxxxx----"	select the listed item (from Network Control Only)
zzzz -> sequence number (0000-FFFF)
ll -> number of layer (00-FF)
xxxx -> index number (0000-FFFF : 1st to 65536th Item [4 HEX digits] )
---- -> not used
 */


/*
   NLAL0003 04 00  00 0014  sequence number 0003
   NLAL0004 04 00  14 0014
   NLAL0000 04 00  00 0214
      Lzzzz ll{xx}{xx}yyyy:
        name: lzzzzll-xx-xx-yyyy
        description: 'specifiy to get the listed data (from Network Control Only)
          zzzz -> sequence number (0000-FFFF)
          ll -> number of layer (00-FF)
          xxxx -> index of start item (0000-FFFF : 1st to 65536th Item [4 HEX digits]
          )
          yyyy -> number of items (0000-FFFF : 1 to 65536 Items [4 HEX digits] )'
        models: set1

 */


module.exports = router;

connectToAmpli = (name, host, port) => {
    ampli = net.connect({host: host, port: port});
    ampli.name = name;

    ampli.on('connect', function () {
        ampli.is_connected = true;
    }).on('close', function () {
        ampli.is_connected = false;
        ampli.destroy();
    }).on('error', function (err) {
        ampli.is_connected = false;
    }).on('data', function (data) {
        var messages = data.toString().replace(/[^\x20-\x7E\xC0-\xFF]/gi, '');

        messages = messages.replace(/ISCP.!1/, 'ISCP!1');
        messages = messages.split('ISCP!1');

        for (var i = 0, len = messages.length; i < len; i++) {
            if (messages[i].length > 0) {
                processMessage(messages[i]);
            }
        }
    });
};

sendMessage = message => {
    console.log('sending message ' + message);
    if(ampli === undefined || !ampli.is_connected){
        console.log("ampli is not connected");
        connectToAmpli('pioneer', '192.168.1.88', 60128);
    }
    ampli.write(iscp_packet(message),(e) => console.log(e));
};

/**
 *
 * @param message {String}
 */
processMessage = message => {
    console.log(message);
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
        var values = message.split('-');
        amp.currentList.push(values[1]);
    } else if (message.startsWith('NLAX') || message.includes('><item')) {
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
            parser = new xmldom.DOMParser();
            xmlDoc = parser.parseFromString(amp.xmlContent,'text/xml');
            let stuff = xmlDoc.getElementsByTagName('item');
            amp.currentList = [];
            for(let i=0;i<stuff.length;i++){
                amp.currentList.push(stuff[i].getAttribute('title'));
            }
            amp.xmlContent='';
        }
    } else if (message.startsWith('NLT')) {
        /*      NLT0002 0000 0005 02 10 04 00 00 FibaneServer
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
        number = parseInt(message.substring(11, 15),16) -1;
        if(amp.currentList.length <= number){
            layer = parseInt(message.substring(15,17),16);
            sendMessage(listItemsInLevel(layer,number));
        }
    }
};


var amp = {
    currentList: [],
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
