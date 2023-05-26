const moviesRouter = require('express').Router();
const mongoose = require('mongoose');
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

// Create a review
moviesRouter.post(
  '/:id/reviews',
  isAuth,
  // Sanitization and validation
  body('title')
    .trim()
    .customSanitizer((value) => value.replace(/\s{2,}/g, ' ')
      .replace(/-{2,}/g, '-')
      .replace(/'{2,}/g, '\'')
      .replace(/\.{2,}/g, '.')
      .replace(/,{2,}/g, ',')
      .replace(/\?{2,}/g, '?'))
    .isAlphanumeric('en-US', { ignore: ' -\'.,?' })
    .withMessage('Title has no valid characters.')
    .isLength({ min: 12, max: 175 })
    .withMessage('Title must be specified with min 12 characters and max 175 characters'),
  body('body')
    .trim()
    .customSanitizer((value) => value.replace(/\s{2,}/g, ' ')
      .replace(/-{2,}/g, '-')
      .replace(/'{2,}/g, '\'')
      .replace(/\.{2,}/g, '.')
      .replace(/,{2,}/g, ',')
      .replace(/\?{2,}/g, '?'))
    .isAlphanumeric('en-US', { ignore: ' -\'.,?' })
    .withMessage('Description has no valid characters.')
    .isLength({ min: 400, max: 10000 })
    .withMessage('Body must be specified with min 400 characters and max 10000 characters'),
  async (request, response, next) => {
    try {
      const result = validationResult(request);
      if (!result.isEmpty()) {
        return response.status(400).json({ errors: result.array() });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  },
  async (request, response, next) => {
    const session = await mongoose.connection.startSession();
    try {
      // Start transaction
      session.startTransaction();
      const { user } = request;

      const movie = await Movie.findOne({ idTMDB: request.params.id });
      if (movie) {
        const isCreated = await Review.findOne({ userId: request.user.id, movieId: movie.id });
        if (isCreated) {
          await session.abortTransaction();
          session.endSession();
          return response.status(409).json({ message: 'Already created' });
        }
        const reviewToSave = new Review({
          title: request.body.title,
          body: request.body.body,
          date: new Date(),
          movieId: movie.id,
          userId: user.id,
        });
        const savedReview = await reviewToSave.save();
        await session.commitTransaction();
        session.endSession();
        return response.status(201).json(savedReview);
      }

      // Get error of TMDB to modify it
      let responseTMDB;
      try {
        responseTMDB = await axios.get(config.URL_FIND_ONE_MOVIE(request.params.id));
      } catch (error) {
        // If the movie does not exist in TMDB
        await session.abortTransaction();
        session.endSession();
        return response.status(404).json({
          error: 'Invalid input. Movie no found',
        });
      }

      const newMovie = takeMovieData(responseTMDB.data);
      const movieToSave = new Movie({
        ...newMovie,
      });
      const savedMovie = await movieToSave.save({ session });
      const reviewToSave = new Review({
        title: request.body.title,
        body: request.body.body,
        date: new Date(),
        movieId: savedMovie.id,
        userId: user.id,
      });
      const savedReview = await reviewToSave.save({ session });

      // Confirm transaction
      await session.commitTransaction();
      session.endSession();

      return response.status(201).json(savedReview);
    } catch (exception) {
      await session.abortTransaction();
      session.endSession();
      next(exception);
    }
  },
);

// Edit review
moviesRouter.put(
  '/:id/reviews/:reviewId',
  isAuth,
  // Sanitization and validation
  body('title')
    .optional()
    .trim()
    .customSanitizer((value) => value.replace(/\s{2,}/g, ' ')
      .replace(/-{2,}/g, '-')
      .replace(/'{2,}/g, '\'')
      .replace(/\.{2,}/g, '.')
      .replace(/,{2,}/g, ',')
      .replace(/\?{2,}/g, '?'))
    .isAlphanumeric('en-US', { ignore: ' -\'.,?' })
    .withMessage('Title has no valid characters.')
    .isLength({ min: 12, max: 175 })
    .withMessage('Title must be specified with min 12 characters and max 175 characters'),
  body('body')
    .optional()
    .trim()
    .customSanitizer((value) => value.replace(/\s{2,}/g, ' ')
      .replace(/-{2,}/g, '-')
      .replace(/'{2,}/g, '\'')
      .replace(/\.{2,}/g, '.')
      .replace(/,{2,}/g, ',')
      .replace(/\?{2,}/g, '?'))
    .isAlphanumeric('en-US', { ignore: ' -\'.,?' })
    .withMessage('Description has no valid characters.')
    .isLength({ min: 400, max: 10000 })
    .withMessage('Body must be specified with min 400 characters and max 10000 characters'),
  async (request, response, next) => {
    try {
      const result = validationResult(request);
      if (!result.isEmpty()) {
        return response.status(400).json({ errors: result.array() });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  },
  async (request, response, next) => {
    try {
      const { user } = request;

      const movie = await Movie.findOne({ idTMDB: request.params.id });
      if (!movie) {
        return response.status(404).json({ error: 'Invalid input. Movie no found' });
      }

      const review = await Review
        .findOne({ movieId: movie.id, _id: request.params.reviewId });
      if (!review) {
        return response.status(404).json({ error: 'Invalid input. Review no found' });
      }

      if (user.id !== review.userId.toString()) return response.status(401).json();

      if (request.body.title) review.title = request.body.title;
      if (request.body.body) review.body = request.body.body;

      const savedReview = await review.save();
      return response.json(savedReview);
    } catch (error) {
      next(error);
    }
  },
);

// Delete review
moviesRouter.delete(
  '/:id/reviews/:reviewId',
  isAuth,
  async (request, response, next) => {
    try {
      const { user } = request;

      const movie = await Movie.findOne({ idTMDB: request.params.id });
      if (!movie) {
        return response.status(404).json({ error: 'Invalid input. Movie no found' });
      }

      const review = await Review
        .findOne({ movieId: movie.id, _id: request.params.reviewId });
      if (!review) {
        return response.status(404).json({ error: 'Invalid input. Review no found' });
      }

      if (user.id !== review.userId.toString()) return response.status(401).json();

      await review.deleteOne();
      return response.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

module.exports = moviesRouter;
