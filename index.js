require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { logger } = require('./lib/logger');
const logging = require('./lib/logging');

const fxp = (function (){
    const { XMLParser, XMLBuilder } = require("fast-xml-parser");
    const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
    });
    const parser = new XMLParser();
    return { builder, parser };
})();

const http = require('http');
const server = http.createServer(async (req, res) => {
    const method = req.method;
    logger.debug('<', method, req.url);
    let result;
    if (method == 'GET') result = await onGet(req, res, ok, bad);
    if (method == 'POST') result = await onPost(req, res, ok, bad);
    if (method == 'PUT') result = await onPut(req, res, ok, bad);
    if (method == 'DELETE') result = await onDelete(req, res, ok, bad);

    function bad(req, res, message) {
        res.writeHead(400, {
            'Content-Type': 'text/plain; charset=utf-8'
        });
        res.end(message);
    }

    function ok(req, res, jsontext) {
        res.writeHead(200, {
            'Content-Type': 'applicatiion/json; charset=utf-8'
        });
        logger.debug('> RESPONSE', jsontext);
        res.end(jsontext);
    }
});

const checkUrl = (_url) => {
    // '/foo/var?x=123' -> ['foo', 'var'] | null
    const paths = (function (url){
        const match = url.match(/^.*(?=\?.*)|^.*$/); // get paths
        if (match) return match[0].slice(1).split('/');
        return null;
    })(_url);
    // '/foo/var?x=123' -> URLSerchParams | null
    const params = (function (url){
        const match = url.match(/(?<=\?).+/); // get paths
        if (match) return new URLSearchParams(match[0]);
        return null;
    })(_url);

    return { paths, params };
}

const srcPath = (_id, fnPrefix = null) => {
    const EXT = process.env.FILEFORMAT || 'XML';
    const FOLDER = process.env.FOLDER || './data';
    const fileName = (fnPrefix)
        ? `${fnPrefix}.${_id}.${EXT}`
        : `${_id}.${EXT}`;
    return path.join(FOLDER, fileName);
}

async function onGet(req, res, ok, bad) {
    const query = checkUrl(req.url);
    try {
        if (query.paths === null) throw new Error('ID is not appoiinted');
        const src = srcPath(query.paths[0]);
        if (!fs.existsSync(src)) throw new Error('File is not exist');
        const text = fs.readFileSync(src);
        const content = fxp.parser.parse(text);
        ok(req, res, JSON.stringify(content))
    } catch (error) {
        logger.info(error);
        bad(req, res, error.message);
    }
}

async function onPost(req, res, ok, bad) {
    const query = checkUrl(req.url);
    try {
        if (query.paths === null) throw new Error('ID is not appointed');
        const src = srcPath(query.paths[0]);
        if (fs.existsSync(src)) throw new Error('File is already exist');
        let body = '';
        req.on('data', (chunk) => { body = chunk }).on('end', () => {
            const content = JSON.parse(body);
            const text = fxp.builder.build(content);
            if (logging.commit) logging.commit('POST', query.paths[0], text);
            fs.writeFile(src, text, (err) => {
                if (err) {
                    logger.warn(err);
                    throw err;
                }
                ok(req, res, '');
            });
        });
    } catch (error) {
        logger.info(error);
        bad(req, res, error.message);
    }
}

async function onPut(req, res, ok, bad) {
    const query = checkUrl(req.url);
    try {
        if (query.paths === null) throw new Error('ID is not appointed');
        const src = srcPath(query.paths[0]);
        if (!fs.existsSync(src)) throw new Error('File is not exist');
        let body = '';
        req.on('data', (chunk) => { body = chunk }).on('end', () => {
            const content = JSON.parse(body);
            const text = fxp.builder.build(content);
            if (logging.commit) logging.commit('PUT', query.paths[0], text);
            fs.writeFile(src, text, (err) => {
                if (err) {
                    logger.warn(err);
                    throw err;
                }
                ok(req, res, '');
            });
        });
    } catch (error) {
        logger.info(error);
        bad(req, res, error.message);
    }
}

async function onDelete(req, res, ok, bad) {
    const query = checkUrl(req.url);
    try {
        if (query.paths === null) throw new Error('ID is not appointed');
        const src = srcPath(query.paths[0]);
        if (!fs.existsSync(src)) throw new Error('File is not exist');
        if (logging.commit) logging.commit('DELETE', query.paths[0], '');
        fs.unlink(src, (err) => {
            if (err) {
                logger.warn(err);
                throw err;
            }
            ok(req, res, '');
        });
    } catch (error) {
        logger.info(error);
        bad(req, res, error.message);
    }
}

server.on('error', (e) => {
    logger.error('Server Error', e);
});
server.on('clientError', (e) => {
    logger.error('Client Error', e);
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    logger.info('Server listening on port', port);
});
