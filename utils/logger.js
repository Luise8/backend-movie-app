const { createLogger, format, transports } = require('winston');
const path = require('path');

const {
  combine, timestamp, printf, json, colorize, label, splat,
} = format;

const myFormatConsoleLog = printf(({
  level, message, label, timestamp,
}) => `${timestamp} ${level} [${label}]: ${message}`);

const logger = createLogger({
  transports: [
    new transports.Console({
      level: 'debug',
      format: combine(
        colorize(),
        label({ label: path.basename(require.main.filename) }),
        timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        splat(),
        myFormatConsoleLog,
      ),
    }),
  ],
});

// - Write all logs with importance level of `error` or less to `error.log`
// - Write all logs with importance level of `info` or less to `combined.log`
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: combine(
        label({ label: require.main.filename }),
        timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        splat(),
        json(),
      ),
    }),
  );
  logger.add(new transports.File({
    filename: 'logs/combined.log',
    level: 'info',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    format: combine(
      label({ label: require.main.filename }),
      timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
      }),
      splat(),
      json(),
    ),
  }));
}

// create a stream object with a 'write' function that will be used by `morgan`
logger.stream = {
  write(message, encoding) {
    // use the 'info' log level so the output will be picked up by both
    // transports (file combined.log and console)
    logger.info(message);
  },
};

module.exports = {
  logger,
};
