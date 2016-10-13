var fs = require('fs');
var ytdl = require('ytdl-core');
var jsonfile = require('jsonfile');

var encoder;
var music = {};
var id = 0;
var playing = false;
var playID;
var progressTimer;
var playingMsgID;

module.exports = {
    command: function(e, client, message, msgarray, user, channel, guild, mods, functions) {
        switch(msgarray[1]) {
            /*
                When a user requests a song, check whether it is a valid video URL. If so, delete the message (to reduce clutter) and query the YouTube API (through ytdl-core) to grab the video title and length.
                
                Disregard any videos longer than 10 minutes.
                
                USAGE: @bot request youtube_url
            */
            case 'request':
                var url = message.substring(msgarray[0].length + 1 + msgarray[1].length + 1, message.length);
                if(url.match(/(http:|https:)?\/\/(www\.)?(youtube.com|youtu.be)\/(watch)?(playlist)?/)) {
                    e.message.delete().then(() => {
                        ytdl.getInfo(url, function(err, info) {
                            if(err) return console.log(err);
                            if(info['length_seconds'] > 600) return functions.SendMessage(channel, 'exclamation: Video too long, max 10 minutes');
                            
                            music[id] = {
                                'user': {
                                    'id': user.id,
                                    'username': user.username,
                                    'discriminator': user.discriminator
                                },
                                'url': url,
                                'id': info['video_id'],
                                'title': info['title'],
                                'length': info['length_seconds']
                            };
                            id++;
                            functions.SendMessage(channel, ':ok_hand: `{0} added to the queue`'.format(info['title']));
                            
                            if(!playing) {
                                playID = music[Object.keys(music)[0]];
                                module.exports.play(client.VoiceConnections.getForGuild(guild), functions, channel, guild, client);
                                playing = true;
                            }
                        });
                    });
                }
                break;
            
            /*
                Play the first song in the queue if the user has a role above 'Moderator' and if nothing is currently playing.
                
                USAGE: @bot play
            */
            case 'play':
                if(functions.Allowed('Moderator', user, guild)) {
                    if(!playing) {
                        e.message.delete().then(() => {
                            if(client.VoiceConnections.length == 0)     return functions.SendMessage(channel, ':exclamation: Not in a voice channel');
                            var info = client.VoiceConnections.getForGuild(guild);
                            
                            playID = music[Object.keys(music)[0]];
                            module.exports.play(info, functions, channel, guild, client);
                            playing = true;
                        });
                    }
                }
                break;
                
            /*
                Stop playing the current song if it's playing and the user has a role above 'Moderator'. Delete the message as well to reduce clutter.
                
                USAGE: @bot stop
            */
            case 'stop':
                if(playing && functions.Allowed('Moderator', user, guild)) {
                    e.message.delete().then(() => {
                        module.exports.stop();
                        functions.SendMessage(channel, ':ok_hand: Playback stopped');
                    });
                }
                break;
                
            /*
                Skip the current song and start playing the next one if a song is currenly playing and the user has a role above 'Moderator'. Delete the message to reduce clutter.
                
                USAGE: @bot skip
            */
            case 'skip':
                if(playing && functions.Allowed('Moderator', user, guild)) {
                    e.message.delete().then(() => {
                        module.exports.stop();
                        if(Object.keys(music).length > 0) {
                            module.exports.nextsong(functions, channel, guild, client);
                            playing = true;
                            functions.SendMessage(channel, ':ok_hand: Current song skipped');
                        }
                    });
                }
                break;
            
            /*
                Display information on the next song such as it's title and the user who requested it.
                
                USAGE: @bot next
            */
            case 'next':
                if(Object.keys(music).length > 1) {
                    e.message.delete().then(() => {
                        var next = music[Object.keys(music)[1]];
                        functions.SendMessage(channel, '**Up next** *{0}*\n**Requested by** {1}#{2}'.format(next['title'], next['user']['username'], playID['user']['discriminator']));
                    });
                }
                break;
        }
    },
    play: function(info, functions, channel, guild, client) {
        if(playID != undefined) {
            //Query ytdl to grab info again on the youtube video
            ytdl.getInfo(playID['url'], function(err, object) {
                //Sort through all the available formats to find the best one
                //If no best source is found, playback will not continue
                var formats = object.formats.filter(f => f.container === 'webm')
                .sort((a, b) => b.audioBitrate - a.audioBitrate);
                 
                var bestaudio = formats.find(f => f.audioBitrate > 0 && !f.bitrate) || formats.find(f => f.audioBitrate > 0);
                if(!bestaudio) return functions.SendMessage(channel, ':exclamation: No valid audio formats found');
                
                //If found, use it as the source for the Encoder
                encoder = info.voiceConnection.createExternalEncoder({
                    type: 'ffmpeg',
                    source: bestaudio.url
                });
                var stream = encoder.play();
                
                //Send a 'Now Playing' message to the channel.
                channel.sendMessage('**Now Playing** `{0}`\n**Requested by** {1}#{2}\n**URL** {3}\n**Progress** `0%`'.format(playID['title'], playID['user']['username'], playID['user']['discriminator'], playID['url'])).then(function(msg, err) {
                    if(err) return console.log(err);
                    playingMsgID = msg;
                    
                    //Keep updating the video's progress in the 'Now Playing' message every five seconds
                    var time = 0;
                    progressTimer = setInterval(function() {
                        time += 5;
                        msg.edit('**Now Playing** `{0}`\n**Requested by** {1}#{2}\n**URL** {3}\n**Progress** `{4}%`'.format(playID['title'], playID['user']['username'], playID['user']['discriminator'], playID['url'], Math.floor((time / playID['length']) * 100)));
                    }, 5000);
                });
                
                //Once the video ends, stop the progress timer above and move onto the next song
                encoder.once('end', () => {
                    clearInterval(progressTimer);
                    module.exports.nextsong(functions, channel, guild, client);
                });
                
                //Update the bot's game with the title of the video
                client.User.setGame(null);
                client.User.setGame({type: 1, name: playID['title']});
            });
        } else functions.SendMessage(channel, ':exclamation: Playlist empty');
    },
    stop: function() {
        encoder.stop();
        clearInterval(progressTimer);
        playing = false;
    },
    nextsong: function(functions, channel, guild, client) {
        delete music[Object.keys(music)[0]];
        
        if(Object.keys(music).length > 0) {
            var info = client.VoiceConnections.getForGuild(guild);
            playID = music[Object.keys(music)[0]];
            
            playingMsgID.delete().then(() => module.exports.play(info, functions, channel, guild, client));
        } else {
            functions.SendMessage(channel, ':exclamation: Playlist empty');
            module.exports.stop();
        }
    }
}