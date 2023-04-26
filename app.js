const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const config = require('./utils/config');
const { logger } = require('./utils/logger');
const middleware = require('./utils/middleware');

const app = express();

mongoose.set('strictQuery', false);

mongoose.connect(config.MONGODB_URI)
  .then(() => {
    logger.info('connected to MongoDB');
  })
  .catch((error) => {
    logger.info('error connecting to MongoDB:', error.message);
  });

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev', { stream: logger.stream }));
app.use(middleware.unknownEndpoint);
app.use(middleware.errorHandler);

module.exports = app;
