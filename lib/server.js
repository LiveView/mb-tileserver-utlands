var _ = require('underscore');
var source = require('./source');
var style = require('./style');
var stats = require('./stats');
var pgtiles = require('pgtiles');
var tm = require('./tm');
var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var app = express();
var carto = require('carto');
var version = require('./../package.json').version.replace(/^\s+|\s+$/g, '');
var mapnik = require('mapnik');
var maps = require('../maps');
var connection = require('./connection');

carto.tree.Reference.setVersion(mapnik.versions.mapnik);

app.use(bodyParser.json());
app.use(app.router);
app.get('/maps/:map/:z(\\d+)/:x(\\d+)/:y(\\d+).png', style.loadStyle, cors(), tile);
app.get('/', function(req,res) {
    res.sendfile('index.html');
});


function tile(req, res, next) {
    var z = req.params.z | 0;
    var x = req.params.x | 0;
    var y = req.params.y | 0;
    var m = req.params.map;
    var scale = (req.params.scale) ? req.params.scale[1] | 0 : undefined;
    // limits scale to 4x (1024 x 1024 tiles or 288dpi) for now
    scale = scale > 4 ? 4 : scale;

    var id = req.source ? req.source.data.id : req.style.data.id;
    var source = req.style;
    var cacheback = function(err, data, headers) {
        if (err) return err;
        tm.pgtiles.putTile(m,z,x,y,data,done);
    }

    var done = function(err, data, headers) {
        if (err && err.message === 'Tilesource not loaded') {
            return res.redirect(req.path);
        } else if (err && err.message === 'Tile does not exist'){
            return source.getTile(m, z,x,y, cacheback);
        }
        else if (err) {
            // Set errors cookie for this style.
            style.error(id, err);
            res.cookie('errors', _(style.error(id)).join('|'));
            return next(err);
        }

        // Set drawtime/srcbytes cookies.
        stats.set(source, 'drawtime', z, data._drawtime);
        stats.set(source, 'srcbytes', z, data._srcbytes);
        res.cookie('drawtime', stats.cookie(source, 'drawtime'));
        res.cookie('srcbytes', stats.cookie(source, 'srcbytes'));

        // Clear out tile errors.
        res.cookie('errors', '');

        headers['cache-control'] = 'max-age=3600';
        res.set(headers);
        return res.send(data);
    };
    done.scale = scale;
    if (req.params.format !== 'png') done.format = req.params.format;
    if (maps[m].cache){
        tm.pgtiles.getTile(m,z,x,y, done);
    }
    else{
        source.getTile(m,z,x,y, done);
    }
}

function stage(){
    new pgtiles({
        connection: connection,
        query: { batch: 1 }
    }, function(err, pgtiles) {
        if (err) return err;
        tm.pgtiles = pgtiles;
        console.log('tiledb: ' + pgtiles._db.database + " connected");
    });
}
stage();
module.exports = app;

