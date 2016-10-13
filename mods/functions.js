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

module.exports = {
    //Send message to the channel
    SendMessage: function(channel, message) {
        channel.sendMessage(message);
    },
    //Check if the specified user is allowed to use the command
    Allowed: function(role, user, guild) {
        var rolepos = module.exports.GetRole(guild.roles, role).position;
        var highestpos = module.exports.CheckPermission(user.memberOf(guild).roles);
        
        if(highestpos >= rolepos) return true;
        else return false;
    },
    //
    CheckPermission: function(user_roles) {
        var highest = -1;
        for(role in user_roles) {
            if(user_roles[role].position > highest)
                highest = user_roles[role].position;
        }
        return highest;
    },
    //Return the role object from its name
    GetRole: function(roleArr, roleName) {
        for(var role in roleArr) {
            if(roleArr[role].name == roleName)
                return roleArr[role];
        }
        return undefined;
    }
}