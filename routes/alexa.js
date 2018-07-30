var express = require('express');
var router = express.Router();


router.use(express.json);

router.use('/alexa', function(req,res,next){

    //get the artist from the request body
    let data = req.data;
    if(data.request.type === 'IntentRequest'){
        if(data.request.intent.name === 'Music'){
            //put some music !
            let artist = data.request.intent.slots.artist.value;
            //figure out a way to call the right stuff...

        } else if(data.request.intent.name === 'poweron'){
            //turn on the amp
        } else if(data.request.intent.name === 'poweroff'){
            //turn off the amp
        } else if(data.request.intent.name === 'pause'){
            //pause the music
        }



    }
});
