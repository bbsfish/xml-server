require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Logger - 開発用ログ支援
const { logger } = require('./lib/logger');
// Logging - データのバックアップ用
const logging = require('./lib/logging');

// (XML <-> Object) Converter
const fxp = (function (){
    const { XMLParser, XMLBuilder } = require("fast-xml-parser");
    const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
    });
    const parser = new XMLParser();
    return { builder, parser };
})();


// Create Server
const http = require('http');
const server = http.createServer(async (req, res) => {
    // Response 用関数を res にアサインする
    const resHandler = {
        /**
         * 成功時
         * @param {Object} payload 返却するデータ
         */
        ok: (payload = null) => {
            payload = payload ?? { status: 'ok' };
            res.writeHead(200, {
                'Content-Type': 'applicatiion/json; charset=utf-8'
            });
            logger.debug('> ', payload);
            res.end(JSON.stringify(payload));
        },
        /**
         * 失敗時
         * @param {String} message 返却するエラーメッセージ
         */
        bad: (message) => {
            res.writeHead(400, {
                'Content-Type': 'text/plain; charset=utf-8'
            });
            res.end(JSON.stringify({ error: message }));
        }
    };
    Object.assign(res, { handler: resHandler });
    
    const method = req.method;
    logger.debug('<', method, req.url);
    let result;
    if (method == 'GET') result = await onGet(req, res);
    if (method == 'POST') result = await onPost(req, res);
    if (method == 'PUT') result = await onPut(req, res);
    if (method == 'DELETE') result = await onDelete(req, res);
});

/**
 * URL から Path および Params を探して、扱いやすいオブジェクトにする
 * @param {String} _url 対象となる URL eg: /id/foo?x=123
 * @returns {Object} { paths: [] | null, params: URLSerchParams | null }
 */
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

/**
 * ID から ファイルパスを生成する
 * @param {String} _id 対象となる ID
 * @returns {String} ファイルパス eg: ./data/idfoo.XML
 */
const srcPath = (_id) => {
    const EXT = process.env.FILEFORMAT || 'XML';
    const FOLDER = process.env.FOLDER || './data';
    const fileName = `${_id}.${EXT}`;
    return path.join(FOLDER, fileName);
}

async function onGet(req, res) {
    const query = checkUrl(req.url);
    try {
        if (query.paths === null) throw new Error('ID is not appoiinted');
        const src = srcPath(query.paths[0]);
        if (!fs.existsSync(src)) throw new Error('File is not exist');
        const text = fs.readFileSync(src);
        const content = fxp.parser.parse(text);
        res.handler.ok(content)
    } catch (error) {
        logger.info(error);
        res.handler.bad(error.message);
    }
}

async function onPost(req, res) {
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
                res.handler.ok();
            });
        });
    } catch (error) {
        logger.info(error);
        res.handler.bad(error.message);
    }
}

async function onPut(req, res) {
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
                res.handler.ok();
            });
        });
    } catch (error) {
        logger.info(error);
        res.handler.bad(error.message);
    }
}

async function onDelete(req, res) {
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
            res.handler.ok();
        });
    } catch (error) {
        logger.info(error);
        res.handler.bad(error.message);
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
