(function() {
    'use strict';
    
    var DIR_SERVER  = __dirname     + '/',
        DIR_LIB     = DIR_SERVER    + '../',
        DIR         = DIR_SERVER    + '../../',
        
        HOME_WIN    = process.env.HOMEPATH,
        HOME_UNIX   = process.env.HOME,
        
        HOME        = (HOME_UNIX || HOME_WIN) + '/',
        
        fs          = require('fs'),
        crypto      = require('crypto'),
        
        Util        = require(DIR_LIB       + 'util'),
        CloudFunc   = require(DIR_LIB       + 'cloudfunc'),
        check       = require('checkup'),
        
        tryRequire  = require('tryrequire'),
        
        pipe        = require('pipe-io'),
        ponse       = require('ponse'),
        json        = require('jonny'),
        
        apiURL      = CloudFunc.apiURL,
        
        ConfigPath  = DIR   + 'json/config.json',
        ConfigHome  = HOME  + '.cloudcmd.json',
        
        config      =
            tryRequire(ConfigHome) ||
            tryRequire(ConfigPath, {log: true}) || {};
    
    module.exports          = set;
    module.exports.save     = save;
    module.exports.socket   = socket;
    
    function set(key, value) {
        var result;
        
        if (key)
            if (value === undefined)
                result      = config[key];
            else
                config[key] = value;
        else
            result          = middle;
        
        return result;
    }
    
    function save(callback) {
        var data = json.stringify(config);
        
        check(arguments, ['callback']);
        
        if (data)
            fs.writeFile(ConfigHome, data, callback);
        else
            callback(Error('Config is empty!'));
    }
    
    function socket(sock) {
        check(arguments, ['socket']);
        
        sock.of('/config')
            .on('connection', function(socket) {
                socket.on('message', function(json) {
                    var data,
                        is = Util.type.object(json);
                    
                    if (!is) {
                        socket.emit('err', 'Error: Wrong data type!');
                    } else {
                        cryptoPass(json);
                        
                        data = traverse(json);
                        
                        save(function(error) {
                            if (error) {
                                socket.emit('err', error.message);
                            } else {
                                socket.broadcast.send(json);
                                socket.send(json);
                                socket.emit('log', data);
                            }
                        });
                    }
                });
            });
    }
    
    function middle(req, res, next) {
        if (req.url !== apiURL + '/config') {
            next();
        } else {
            switch(req.method) {
            case 'GET':
                get(req, res, next);
                break;
            
            case 'PATCH':
                patch(req, res, next);
                break;
            
            default:
                next();
            }
        }
    }
    
    function get(req, res) {
        var data = json.stringify(config);
        
        ponse.send(data, {
            name    : 'config.json',
            request : req,
            response: res,
            cache   : false
        });
    }
    
    function patch(req, res, callback) {
        var options = {
            name    : 'config.json',
            request : req,
            response: res,
            cache   : false
        };
        
        pipe.getBody(req, function(error, body) {
            var data    = '',
                json    = json.parse(body) || {};
            
            if (error)
                callback(error);
            else
                cryptoPass(json);
            
            data = traverse(json);
            
            save(function(error) {
                if (error)
                    ponse.sendError(error, options);
                else
                    ponse.send(data, options);
            });
        });
    }
    
    function traverse(json) {
        var data;
        
        Object.keys(json).forEach(function(name) {
            data = CloudFunc.formatMsg('config', name);
            set(name, json[name]);
        });
        
        return data;
    }
    
    function cryptoPass(json) {
        if (json && json.password)
            json.password = crypt(json.password);
    }
    
    function crypt(password) {
        var result,
            sha = crypto.createHash('sha512WithRSAEncryption');
        
        sha.update(password);
        result = sha.digest('hex');
        
        return result;
    }
    
})();
