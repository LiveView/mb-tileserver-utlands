var fs = require('fs');
var tm = require('./tm');
var Bridge = require('tilelive-bridge');
var tilelive = require('tilelive');

var cache = {};

module.exports = source;
tilelive.protocols['xml:'] = source;
tilelive.protocols['tmsource:'] = source;
tilelive.protocols['pgvectiles:'] = source;
tilelive.protocols['pgsource:'] = source;

function source(arg, callback) {
    if (arg) {
        var sourceType = arg.protocol;
        var id = tm._config.source + arg.host;
        if (cache[id]) return callback(null, cache[id]);
        switch (sourceType) {
            case 'pgvectiles:':
                return callback(null, tm.pgtiles);
            default :
                var xml = fs.readFileSync(id, 'utf-8');
                var opts = {};
                function parsed(err, p) {
                    if (err) return callback(err);
                    opts.id = id;
                    opts.xml = p;
                    source.refresh(opts, callback);
                }
                if (sourceType == 'pgsource:')
                    tm.updateResourceFilepath(xml, tm._config.geo_data, parsed);
                else
                    tm.updateXMLFilePath(xml, tm._config.geo_data, parsed);
                break;
        }
    }
}

// Load or refresh the relevant source using specified data + xml.
source.refresh = function(rawdata, callback) {
    var id = rawdata.id;
    var uri = tm.parse(rawdata.id);
    var opts = {};
    opts.xml = rawdata.xml;
    opts.base = uri.dirname;
    new Bridge(opts, loaded);
    function loaded(err, p) {
        if (err) return callback(err);
        cache[id] = cache[id] || p;
        cache[id].xml = rawdata.xml;
        callback(null, cache[id]);
    }
};

// Set or get tile serving errors.
source.error = function(id, err) {
    if (!cache[id]) return false;
    cache[id].errors = cache[id].errors || [];
    if (err && cache[id].errors.indexOf(err.message) === -1) {
        cache[id].errors.push(err.message);
    }
    return cache[id].errors;
};