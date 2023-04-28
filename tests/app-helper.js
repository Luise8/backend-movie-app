const express = require('express');
const morgan = require('morgan');
const { logger } = require('../utils/logger');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev', { stream: logger.stream }));

module.exports = app;
