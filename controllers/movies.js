const moviesRouter = require('express').Router();
const axios = require('axios');
const {
  body, validationResult, query,
} = require('express-validator');
const Movie = require('../models/movie');
const Review = require('../models/review');
const User = require('../models/user');
const Rate = require('../models/rate');
const { logger } = require('../utils/logger');
const config = require('../utils/config');
const { takeMovieData } = require('../utils/TMDB-functions');
const { isAuth } = require('../utils/middleware');

moviesRouter.get(
  '/',
  // Sanitization and validation
  query('page')
    .optional()
    .trim()
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in page')
    .custom((value) => /^\d+$/.test(value))
    .withMessage('page has non-numeric characters.'),
  query('pageSize')
    .optional()
    .trim()
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in pageSize')
    .custom((value) => /^\d+$/.test(value))
    .withMessage('pageSize has non-numeric characters.')
    .customSanitizer((value) => {
      if (Number(value) > 30) {
        return 30;
      } if (Number(value) === 0) {
        return 10;
      }
      return value;
    }),
  (req, res, next) => {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        return res.status(400).json({ errors: result.array() });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  },
  async (request, response, next) => {
    try {
      // Get page and pageSize values
      const pageSize = request.query.pageSize
      && parseInt(request.query.pageSize, 10) <= 30 ? parseInt(request.query.pageSize, 10) : 10;
      const page = request.query.page ? parseInt(request.query.page, 10) : 0;

      // Get movie count and movies
      const count = await Movie.find({}).count();
      const movieList = await Movie.find({}).limit(pageSize)
        .skip(pageSize * page).sort({ rateAverage: -1, date: -1, idTMDB: -1 })
        .exec();

      // Get number of prev page
      let prevPage;
      if (page === 0) {
        prevPage = '';
      } else if ((pageSize * (page - 1)) > count) {
        if (Number.isInteger(count / pageSize)) {
          prevPage = (count / pageSize) - 1;
        } else {
          prevPage = parseInt(count / pageSize, 10);
        }
      } else {
        prevPage = page - 1;
      }

      const resultMovies = {
        total: count,
        page_size: pageSize,
        page,
        prev_page: page === 0 ? prevPage : `/movies?page=${prevPage}&page_size=${pageSize}`,
        next_page: (pageSize * (page + 1)) < count ? `/movies?page=${page + 1}&page_size=${pageSize}` : '',
        results: movieList,
      };
      logger.debug('%O', movieList);
      response.json(resultMovies);
    } catch (exception) {
      next(exception);
    }
  },
);

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

moviesRouter.get(
  '/:id/reviews',
  // Sanitization and validation
  query('page')
    .optional()
    .trim()
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in page')
    .custom((value) => /^\d+$/.test(value))
    .withMessage('page has non-numeric characters.'),
  query('pageSize')
    .optional()
    .trim()
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in pageSize')
    .custom((value) => /^\d+$/.test(value))
    .withMessage('pageSize has non-numeric characters.')
    .customSanitizer((value) => {
      if (Number(value) > 30) {
        return 30;
      } if (Number(value) === 0) {
        return 10;
      }
      return value;
    }),
  (req, res, next) => {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        return res.status(400).json({ errors: result.array() });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  },

  async (request, response, next) => {
    try {
      // Get page and pageSize values
      const pageSize = request.query.pageSize
      && parseInt(request.query.pageSize, 10) <= 30 ? parseInt(request.query.pageSize, 10) : 10;
      const page = request.query.page ? parseInt(request.query.page, 10) : 0;

      // Get movie
      const movie = await Movie.findOne({ idTMDB: request.params.id }).lean();

      // If exist
      if (movie) {
      // Get count of reviews of movie and get reviews
        const count = await Review.find({ movieId: movie._id }).count();
        const reviews = await Review.find({ movieId: movie._id }).limit(pageSize)
          .sort({ date: -1, userId: -1 }).skip(pageSize * page)
          .exec();
        logger.debug('🚀 ~ file: movies.js:95 ~ moviesRouter.get ~ reviews:%O', reviews);

        // Get number of prev page
        let prevPage;
        if (page === 0) {
          prevPage = '';
        } else if ((pageSize * (page - 1)) > count) {
          if (Number.isInteger(count / pageSize)) {
            prevPage = (count / pageSize) - 1;
          } else {
            prevPage = parseInt(count / pageSize, 10);
          }
        } else {
          prevPage = page - 1;
        }

        // If there are not reviews with the current page and pageSize
        if (reviews.length === 0) {
          response.json({
            movie_details: {
              idTMDB: movie.idTMDB,
              name: movie.name,
              release_date: movie.release_date,
              photo: movie.photo,
              rateAverage: movie.rateAverage,
            },
            total: count,
            page_size: pageSize,
            page,
            prev_page: page === 0 ? prevPage : `/movies/${request.params.id}/reviews?page=${prevPage}&page_size=${pageSize}`,
            next_page: (pageSize * (page + 1)) < count ? `/movies/${request.params.id}/reviews?page=${page + 1}&page_size=${pageSize}` : '',
            results: [],
          });

        // If there are reviews with the current page and pageSize
        } else {
          response.json({
            movie_details: {
              idTMDB: movie.idTMDB,
              name: movie.name,
              release_date: movie.release_date,
              photo: movie.photo,
              rateAverage: movie.rateAverage,
            },
            total: count,
            page_size: pageSize,
            page,
            prev_page: page === 0 ? prevPage : `/movies/${request.params.id}/reviews?page=${prevPage}&page_size=${pageSize}`,
            next_page: (pageSize * (page + 1)) < count ? `/movies/${request.params.id}/reviews?page=${page + 1}&page_size=${pageSize}` : '',
            results: reviews,
          });
        }

      // If movie does not exist
      } else {
        response.status(404).end();
      }
    } catch (exception) {
      next(exception);
    }
  },
);

moviesRouter.get('/:id/reviews/:idReview', async (request, response, next) => {
  try {
    const review = await Review.findById(request.params.idReview).populate('movieId', {
      name: 1, release_date: 1, photo: 1, idTMDB: 1,
    });
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
