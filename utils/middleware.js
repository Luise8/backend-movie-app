require('dotenv').config();
const { RateLimiterMongo, RateLimiterMemory } = require('rate-limiter-flexible');
const mongoose = require('mongoose');
const { logger } = require('./logger');

const unknownEndpoint = (request, response) => {
  response.status(404).send({ error: 'unknown endpoint' });
};

const errorHandler = (error, request, response, next) => {
  logger.error(error.message);

  if (error.name === 'CastError') {
    return response.status(400).send({ error: 'malformatted id' });
  } if (error.name === 'ValidationError') {
    return response.status(400).json({ error: error.message });
  }

  return response.status(500).json({ error: 'Something wrong' });
};

const isAuth = (req, res, next) => {
  if (req.isAuthenticated?.()) {
    next();
  } else {
    res.status(401).json({ msg: 'You are not authorized to view this resource' });
  }
};

function rateLimiter() {
  return function limit(req, res, next) {
    let opts;
    let key;

    if (/(login|users)$/.test(req.path) && req.method === 'POST') {
      opts = {
        storeClient: mongoose.connection,
        points: 10,
        duration: 60 * 5,
        blockDuration: 60 * 60, // 1h
      };
      key = `${req.ip}createAuth`;
    } else if ((/users\/[a-z0-9]{24}$/.test(req.path) && (req.method === 'DELETE' || req.method === 'PUT'))
      || (/\/lists|watchlist/.test(req.path) && req.method !== 'GET')
    || (/reviews|rates/.test(req.path) && req.method !== 'GET')) {
      opts = {
        storeClient: mongoose.connection,
        points: 2,
        duration: 1,
        blockDuration: 60 * 5, // 5m
      };
      key = req.user?.id ? `${req.user?.id}transaction` : `${req.ip}transaction`;
    } else {
      opts = {
        storeClient: mongoose.connection,
        points: 60 * 3,
        duration: 60,
      };
      key = req.user?.id || req.ip;
    }

    const rateLimiterMongo = new RateLimiterMongo(opts);

    rateLimiterMongo.consume(key, 1)
      .then(() => {
        next();
      })
      .catch(() => {
        res.status(429).send('Too Many Requests');
      });
  };
}

module.exports = {
  unknownEndpoint,
  errorHandler,
  isAuth,
  rateLimiter,
};
