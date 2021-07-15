var express    = require('express');
var app        = express();
var https      = require('https');
var fs         = require('fs');
var config     = JSON.parse(fs.readFileSync('./config.json'));

// configuring certificates
var options = {
    key : fs.readFileSync(config.key),
    cert: fs.readFileSync(config.cert),
    ca: [fs.readFileSync(config.ca)]
};
var server = https.createServer(options,app).listen(config.port);

var io = require('socket.io')(server);

app.use(express.static('conference'));
require('./signaling/socket_signal.js').init(app, io,config,() => {

});
console.log('SERVER LISTENING AT '+config.port);