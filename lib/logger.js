/**
 * Provides a console logging system for development
 */

const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = process.env.LOGGER_LEVEL || 'all';

module.exports = { logger };
