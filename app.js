var express = require('express');

var logger = require('morgan');
var alexa = require("alexa-app");


var express_app = express();
var ampControl = require('./routes/ampli');

var indexRouter = require('./routes/index');
//var ampliRouter = require('./routes/ampli');
var alexaRouter = require('./routes/alexa');

var app = new alexa.app("remote");


express_app.use(logger('dev'));

//app.use('/', indexRouter);
//app.use('/ampli', ampliRouter);
//app.use('/alexa', alexaRouter);

app.intent("music",{
        "slots": {"number": "AMAZON.Artist"},
        "utterances": ["ok {-|artist}"],
    },
    function(req,res){
        var artist = req.slot('artist');
        var album = req.slot('album');
        ampControl.startMusic(artist,album,function(err){
            if(err){
                res.say("An error has occurred");
            } else {
                res.say("Je lance la musique")
            }
        })
    }
);

app.intent("poweron",
    function(req,res){
        ampControl.poweron();
        res.say("C'est parti !")
    }
);

app.intent("poweroff",
    function(req,res){
        ampControl.poweroff();
        res.say('Okay !')
    }
);

app.intent("pause",
    function(req,res){
        ampControl.poweroff();
        res.say('Okay !')
    }
);

app.express({
    expressApp: express_app ,
    checkCert: true,
    debug: false,
    endpoint: 'alexa'
});


// error handler
express_app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = express_app;
