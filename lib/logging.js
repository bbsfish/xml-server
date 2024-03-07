/**
 * Provides a service to output request logs such as POST to the database
 */
const sqlite = require('sqlite3');
const { logger } = require('./logger');

const file = process.env.LOG_OUTPUT_FILE || './backup.db';

let commit;
if (process.env.USE_LOGGING == 1) commit = setup();

function setup() {
    logger.info('Use logging in', file);
    const db = new sqlite.Database(file);
    const create = `CREATE TABLE IF NOT EXISTS data_pool (
      sn INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      type TEXT CHECK(type in ('POST', 'PUT', 'DELETE')),
      key TEXT,
      data TEXT)`;
    db.run(create, (err) => {
        if (err) logger.warn(err);
    });

    return function (type, key, data){
        if (['POST', 'PUT', 'DELETE'].includes(type)) {
            const insert = `INSERT INTO data_pool (type, key, data) VALUES (?, ?, ?)`;
            db.run(insert, [type, key, data], (err) => {
                if (err) logger.warn(err);
            });
        }
    };
}

module.exports.commit = commit;
