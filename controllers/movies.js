const moviesRouter = require('express').Router();
const Movie = require('../models/movie');
const Review = require('../models/review');
const { logger } = require('../utils/logger');

moviesRouter.get('/', async (request, response, next) => {
  try {
    const movieList = await Movie.find({}).limit(10).sort({ date: -1 }).exec();
    logger.debug('%O', movieList);
    response.json(movieList);
  } catch (exception) {
    next(exception);
  }
});

moviesRouter.get('/:id', async (request, response, next) => {
  try {
    const movie = await Movie.findOne({ idTMDB: request.params.id });
    if (movie) {
      response.json(movie);
    } else {
      response.status(404).end();
    }
  } catch (exception) {
    next(exception);
  }
});

moviesRouter.get('/:id/reviews', async (request, response, next) => {
  try {
    const movie = await Movie.findOne({ idTMDB: request.params.id }).lean();
    if (movie) {
      const reviews = await Review.find({ movieId: movie.id });
      logger.debug('🚀 ~ file: movies.js:34 ~ moviesRouter.get ~ reviews:%O', reviews);
      if (reviews.length === 0) {
        response.json({
          ...movie,
          reviews: [],
        });
      } else {
        response.json({
          ...movie,
          reviews,
        });
      }
    } else {
      response.status(404).end();
    }
  } catch (exception) {
    next(exception);
  }
});

moviesRouter.get('/:id/reviews/:idReview', async (request, response, next) => {
  try {
    const review = await Review.findById(request.params.idReview);
    if (review) {
      response.json(review);
    } else {
      response.status(404).end();
    }
  } catch (exception) {
    next(exception);
  }
});


module.exports = moviesRouter;
