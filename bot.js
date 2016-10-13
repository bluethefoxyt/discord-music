//IMPORT PACKAGES
var Discordie = require('discordie');
var jsonfile = require('jsonfile');

//USERBILITY
if(!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

//Load any external modss
var mods = {};
var functions = require('./mods/functions.js');
var external = [
    'music'
    ];
for(var item in external) {
    mods[external[item]] = require('./mods/{0}.js'.format(external[item]));
    console.log('Alert -> Loaded mods {0}'.format(external[item]));
}

//Set up the client and connection function
auth = {};
var client = new Discordie();
function connect() {
    client.connect({
        token: auth['token']
    });
}

//Load the auth dict
jsonfile.readFile('./config/auth.json', function(err, obj) {
    if(err) return console.log('ERROR -> Failed to load the auth config file. Check if the file is there and is valid JSON, {0}'.format(err));
    
    auth = obj;
    
    //Attempt to connect to the servers
    return connect();
});


//CONNECTED
client.Dispatcher.on('GATEWAY_READY', e => {
    console.log('Alert -> {0} is now online'.format(client.User.username));
    console.log('-----');
    
    //Join the voice channel
    var guild = client.Guilds.getBy('name', "The Filthy Spaceships");
    if(guild) {
        var musicChannel = guild.voiceChannels.filter(c => c.name == 'General')[0];
        if(musicChannel) return musicChannel.join(false, false);
    }
});

//DISCONNECTED
client.Dispatcher.on('DISCONNECTED', e => {
	const delay = 5000;
	const sdelay = Math.floor(delay/100)/10;

	if(e.error.message.indexOf('gateway') >= 0) console.log('Alert -> Disconnected from guild, resuming in ' + sdelay + ' seconds');
	else console.log('Error -> Failed to log in or get gateway, reconnecting in ' + sdelay + ' seconds');
    
	setTimeout(connect, delay);
});

//NEW MESSAGE
client.Dispatcher.on('MESSAGE_CREATE', e => {
    console.log('{0} ({1}) > {2}'.format(e.message.author.username, e.message.channel.name, e.message.content));
    var message = e.message.content,
        msgarray = e.message.content.split(' '),
        channel = e.message.channel,
        guild = e.message.guild,
        user = e.message.author;
        
    if(message.indexOf(client.User.mention) > -1) mods.music.command(e, client, message, msgarray, user, channel, guild, mods, functions);
});