const moviesRouter = require('express').Router();
const mongoose = require('mongoose');
const axios = require('axios');
const {
  body, validationResult, query,
} = require('express-validator');
const Movie = require('../models/movie');
const Review = require('../models/review');
const Rate = require('../models/rate');
const config = require('../utils/config');
const { takeMovieData } = require('../utils/TMDB-functions');
const { isAuth } = require('../utils/middleware');
const genresTMDB = require('../utils/movie-genres-TMDB');

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
      if ((pageSize * (page - 1)) > count) {
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
        prev_page: page === 0 || count === 0 ? '' : `/movies?page=${prevPage}&page_size=${pageSize}`,
        next_page: (pageSize * (page + 1)) < count ? `/movies?page=${page + 1}&page_size=${pageSize}` : '',
        results: movieList,
      };
      response.json(resultMovies);
    } catch (exception) {
      next(exception);
    }
  },
);

moviesRouter.get(
  '/rated',
  // Sanitization and validation
  query('page')
    .optional()
    .trim()
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in page')
    .custom((value) => /^\d+$/.test(value))
    .withMessage('page has non-numeric characters.')
    .custom((value) => (value > 0))
    .withMessage('Min value to page must be 1'),
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
      const pageSize = 20;
      const page = request.query.page ? parseInt(request.query.page, 10) : 1;

      // Get movie count and movies
      const count = await Movie.find({}).where('rateCount').gt(0).count();
      const movieList = await Movie.find({}).where('rateCount').gt(0).limit(pageSize)
        .skip(pageSize * (page - 1))
        .sort({ rateAverage: -1, date: -1, idTMDB: -1 })
        .exec();

      // Get number of prev page
      let prevPage;
      if ((pageSize * (page - 1)) > count) {
        if (Number.isInteger(count / pageSize)) {
          prevPage = (count / pageSize) - 1;
        } else {
          prevPage = parseInt(count / pageSize, 10);
        }
      } else {
        prevPage = page - 1;
      }

      const resultMovies = {
        total_results: count,
        page_size: pageSize,
        page,
        prev_page: page === 1 || count === 0 ? '' : `/movies?page=${prevPage}&page_size=${pageSize}`,
        next_page: (pageSize * (page + 1)) < count ? `/movies?page=${page + 1}&page_size=${pageSize}` : '',
        results: movieList,
        total_pages: Math.ceil(count / pageSize),
      };
      response.json(resultMovies);
    } catch (exception) {
      next(exception);
    }
  },
);

// Get popular movies from tmdb
moviesRouter.get(
  '/popular',
  // Sanitization and validation
  query('page')
    .optional()
    .trim()
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in page')
    .custom((value) => /^\d+$/.test(value))
    .withMessage('page has non-numeric characters.')
    .custom((value) => (value > 0))
    .withMessage('Min value to page must be 1'),
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
      // Get page value, pageSize and limiPage
      const page = Number(request.query.page) || 1;
      const pageSize = 20;
      const limitPage = 500;
      const pageToFind = page < limitPage ? page : limitPage;

      // Get movies count and movies
      const movieResults = await axios.get(config.URL_POPULAR_MOVIES(pageToFind));
      const movieList = page <= limitPage ? movieResults : [];

      const totalResults = movieResults.data?.total_results || 0;
      let count;
      if ((limitPage * 20) < totalResults) {
        count = limitPage * 20;
      } else {
        count = totalResults;
      }

      // Get number of prev page
      let prevPage;
      if ((pageSize * (page - 1)) > count) {
        prevPage = Math.ceil(count / pageSize);
      } else {
        prevPage = page - 1;
      }

      const resultMovies = {
        page_size: 20,
        prev_page: page === 1 || count === 0 ? '' : `movies/popular?page=${prevPage}`,
        next_page: (pageSize * page) < count ? `movies/popular?page=${page + 1}` : '',
        page,
        ...movieList.data,
        total_results: count,
        total_pages: Math.ceil(count / pageSize),
      };
      response.json(resultMovies);
    } catch (error) {
      next(error);
    }
  },
);

// Get latest movies from tmdb
moviesRouter.get(
  '/latest',
  // Sanitization and validation
  query('page')
    .optional()
    .trim()
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in page')
    .custom((value) => /^\d+$/.test(value))
    .withMessage('page has non-numeric characters.')
    .custom((value) => (value > 0))
    .withMessage('Min value to page must be 1'),
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
      // Get page value, pageSize and limiPage
      const page = Number(request.query.page) || 1;
      const pageSize = 20;
      const limitPage = 500;
      const pageToFind = page < limitPage ? page : limitPage;

      // Get movies count and movies
      const movieResults = await axios.get(config.URL_LATEST_MOVIES(pageToFind));
      const movieList = page <= limitPage ? movieResults : [];

      const totalResults = movieResults.data?.total_results || 0;
      let count;
      if ((limitPage * 20) < totalResults) {
        count = limitPage * 20;
      } else {
        count = totalResults;
      }

      // Get number of prev page
      let prevPage;
      if ((pageSize * (page - 1)) > count) {
        prevPage = Math.ceil(count / pageSize);
      } else {
        prevPage = page - 1;
      }

      const resultMovies = {
        page_size: 20,
        prev_page: page === 1 || count === 0 ? '' : `movies/latest?page=${prevPage}`,
        next_page: (pageSize * page) < count ? `movies/latest?page=${page + 1}` : '',
        page,
        ...movieList.data,
        total_results: count,
        total_pages: Math.ceil(count / pageSize),
      };

      response.json(resultMovies);
    } catch (error) {
      next(error);
    }
  },
);

// Get trending movies from tmdb
moviesRouter.get(
  '/trending',
  // Sanitization and validation
  query('page')
    .optional()
    .trim()
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in page')
    .custom((value) => /^\d+$/.test(value))
    .withMessage('page has non-numeric characters.')
    .custom((value) => (value > 0))
    .withMessage('Min value to page must be 1'),
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
      // Get page value, pageSize and limiPage
      const page = Number(request.query.page) || 1;
      const pageSize = 20;
      const limitPage = 500;
      const pageToFind = page < limitPage ? page : limitPage;

      // Get movies count and movies
      const movieResults = await axios.get(config.URL_TRENDING_MOVIES(pageToFind));
      const movieList = page <= limitPage ? movieResults : [];

      const totalResults = movieResults.data?.total_results || 0;
      let count;
      if ((limitPage * 20) < totalResults) {
        count = limitPage * 20;
      } else {
        count = totalResults;
      }

      // Get number of prev page
      let prevPage;
      if ((pageSize * (page - 1)) > count) {
        prevPage = Math.ceil(count / pageSize);
      } else {
        prevPage = page - 1;
      }

      const resultMovies = {
        page_size: 20,
        prev_page: page === 1 || count === 0 ? '' : `movies/trending?page=${prevPage}`,
        next_page: (pageSize * page) < count ? `movies/trending?page=${page + 1}` : '',
        page,
        ...movieList.data,
        total_results: count,
        total_pages: Math.ceil(count / pageSize),
      };
      response.json(resultMovies);
    } catch (error) {
      next(error);
    }
  },
);

// Get movies by query from tmdb
moviesRouter.get(
  '/search',
  // Sanitization and validation
  query('page')
    .optional()
    .trim()
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in page')
    .custom((value) => /^\d+$/.test(value))
    .withMessage('page has non-numeric characters.')
    .custom((value) => (value > 0))
    .withMessage('Min value to page must be 1'),
  query('query')
    .customSanitizer((value) => {
      const decodeQuery = decodeURIComponent(value);
      return decodeQuery.trim().replace(/\s{2,}/g, ' ');
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
      // Get page value, pageSize, limiPage and query
      const page = Number(request.query.page) || 1;
      const pageSize = 20;
      const limitPage = 500;
      const query = request.query.query?.slice(0, 214) || '';

      if (!query) {
        const resultMovies = {
          page_size: 20,
          prev_page: '',
          next_page: '',
          page,
          results: [],
          total_results: 0,
          total_pages: 0,
          query,
        };
        return response.json(resultMovies);
      }

      const pageToFind = page < limitPage ? page : limitPage;

      // Get movies count and movies
      const movieResults = await axios.get(config.URL_SEARCH_MOVIES({ page: pageToFind, query }));
      const movieList = page <= limitPage ? movieResults : [];

      const totalResults = movieResults.data?.total_results || 0;
      let count;
      if ((limitPage * 20) < totalResults) {
        count = limitPage * 20;
      } else {
        count = totalResults;
      }

      // Get number of prev page
      let prevPage;
      if ((pageSize * (page - 1)) > count) {
        prevPage = Math.ceil(count / pageSize);
      } else {
        prevPage = page - 1;
      }

      const resultMovies = {
        page_size: 20,
        prev_page: page === 1 || count === 0 ? '' : `movies/search?query=${encodeURIComponent(query)}&page=${prevPage}`,
        next_page: (pageSize * page) < count ? `movies/search?query=${encodeURIComponent(query)}&page=${page + 1}` : '',
        page,
        ...movieList.data,
        total_results: count,
        total_pages: Math.ceil(count / pageSize),
        query,
      };
      response.json(resultMovies);
    } catch (error) {
      next(error);
    }
  },
);

// Get movies by genre from tmdb
moviesRouter.get(
  '/genre',
  // Sanitization and validation
  query('page')
    .optional()
    .trim()
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in page')
    .custom((value) => /^\d+$/.test(value))
    .withMessage('page has non-numeric characters.')
    .custom((value) => (value > 0))
    .withMessage('Min value to page must be 1'),
  query('genres')
    .exists()
    .isLength({ min: 2 })
    .withMessage('Genres must be defined')
    .custom((value) => {
      const items = value.split(',');
      const checkNumeric = items.every((item) => /^\d+$/.test(item));
      if (!checkNumeric) return false;
      const max = genresTMDB.reduce((prev, current) => ((prev.id > current.id)
        ? prev : current)).id.toString().length;
      return items.every((item) => item.toString().length >= 2 && item.toString().length <= max);
    })
    .withMessage('Genres must be a comma-separated string of valid types of movie genres'),
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
      // Get page value, pageSize, limiPage and genres
      const page = Number(request.query.page) || 1;
      const pageSize = 20;
      const limitPage = 500;
      const { genres } = request.query;
      const pageToFind = page < limitPage ? page : limitPage;

      // Get movies count and movies
      const movieResults = await axios
        .get(config.URL_FIND_MOVIES_BY_GENRE({ page: pageToFind, genres }));
      const movieList = page <= limitPage ? movieResults : [];

      const totalResults = movieList.data?.total_results || 0;
      let count;
      if ((limitPage * 20) < totalResults) {
        count = limitPage * 20;
      } else {
        count = totalResults;
      }

      // Get number of prev page
      let prevPage;
      if ((pageSize * (page - 1)) > count) {
        prevPage = Math.ceil(count / pageSize);
      } else {
        prevPage = page - 1;
      }

      const resultMovies = {
        page_size: 20,
        prev_page: page === 1 || count === 0 ? '' : `movies/genre?genres=${genres}&page=${prevPage}`,
        next_page: (pageSize * page) < count ? `movies/genre?genres=${genres}&page=${page + 1}` : '',
        page,
        ...movieList.data,
        total_results: count,
        total_pages: Math.ceil(count / pageSize),
      };
      response.json(resultMovies);
    } catch (error) {
      next(error);
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

// Get movie details
moviesRouter.get('/:id/detail', async (request, response, next) => {
  try {
    // To get TMDB error
    let movieTMDB;
    try {
      movieTMDB = await axios.get(config.URL_FIND_MOVIE_DETAILS(request.params.id));
    } catch (error) {
      return response.status(404).json({ error: 'Movie not found' });
    }

    const movie = await Movie.findOne({ idTMDB: request.params.id }).lean().exec();
    if (movie) {
      movie.id = movie._id;
      delete movie._id;
      delete movie.__v;
      const reviews = await Review.find({ movieId: movie.id }).count().exec();
      movie.reviews = reviews;
    }
    return response.json({
      ...movieTMDB.data,
      movieDB: movie,
    });
  } catch (error) {
    next(error);
  }
});

// Get movie from TMDB - this route is usefull to check if a movie exist
moviesRouter.get('/:id/tmdb', async (request, response) => {
  try {
    const movieTMDB = await axios.get(config.URL_FIND_ONE_MOVIE(request.params.id));
    return response.json(movieTMDB.data);
  } catch (error) {
    return response.status(404).json({ error: 'Movie not found in TMDB' });
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
          .sort({ date: -1, userId: -1 }).populate('userId', {username: 1}).skip(pageSize * page)
          .exec();

        // Get number of prev page
        let prevPage;
        if ((pageSize * (page - 1)) > count) {
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
            prev_page: page === 0 || count === 0 ? '' : `/movies/${request.params.id}/reviews?page=${prevPage}&page_size=${pageSize}`,
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
            prev_page: page === 0 || count === 0 ? '' : `/movies/${request.params.id}/reviews?page=${prevPage}&page_size=${pageSize}`,
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

// Get review for specific movie and user
moviesRouter.get('/:id/reviewUser', isAuth, async (request, response, next) => {
  try {
    const movie = await Movie.findOne({ idTMDB: request.params.id }).exec();
    if (!movie) return response.json({ review: null });

    const review = await Review.findOne({ movieId: movie.id, userId: request.user.id }).populate('movieId', {
      name: 1, release_date: 1, photo: 1, idTMDB: 1,
    });
    if (review) {
      return response.json({ review });
    }
    return response.json({ review: null });
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

// Get rate for specific movie and user
moviesRouter.get('/:id/rateUser', isAuth, async (request, response, next) => {
  try {
    const movie = await Movie.findOne({ idTMDB: request.params.id }).exec();
    if (!movie) return response.json({ rate: null });

    const rate = await Rate.findOne({ movieId: movie.id, userId: request.user.id }).populate('movieId', {
      name: 1, release_date: 1, photo: 1, idTMDB: 1,
    });
    if (rate) {
      return response.json({ rate });
    }
    return response.json({ rate: null });
  } catch (exception) {
    next(exception);
  }
});

// Create a rate
moviesRouter.post(
  '/:id/rates',
  isAuth,
  // Sanitization and validation
  body('value')
    .trim()
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in value')
    .isLength({ min: 1, max: 2 })
    .withMessage('Min length 1, max length 2')
    .custom((value) => /^([1-9]|10)$/.test(value))
    .withMessage('value only can has numeric characters from 1 to 10'),
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
        const isCreated = await Rate.findOne({ userId: user.id, movieId: movie.id });
        if (isCreated) {
          await session.abortTransaction();
          session.endSession();
          return response.status(409).json({ message: 'Already created' });
        }
        const rateToSave = new Rate({
          value: request.body.value,
          date: new Date(),
          movieId: movie.id,
          userId: user.id,
        });

        const savedRate = await rateToSave.save();
        await session.commitTransaction();
        session.endSession();
        return response.status(201).json(savedRate);
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
      const rateToSave = new Rate({
        value: request.body.value,
        date: new Date(),
        movieId: savedMovie.id,
        userId: user.id,
      });
      const savedRate = await rateToSave.save({ session });

      // Confirm transaction
      await session.commitTransaction();
      session.endSession();

      return response.status(201).json(savedRate);
    } catch (exception) {
      await session.abortTransaction();
      session.endSession();
      next(exception);
    }
  },
);

// Edit rate
moviesRouter.put(
  '/:id/rates/:rateId',
  isAuth,
  // Sanitization and validation
  body('value')
    .trim()
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in value')
    .isLength({ min: 1, max: 2 })
    .withMessage('Min length 1, max length 2')
    .custom((value) => /^([1-9]|10)$/.test(value))
    .withMessage('value only can has numeric characters from 1 to 10'),
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

      const rate = await Rate
        .findOne({ movieId: movie.id, _id: request.params.rateId });
      if (!rate) {
        return response.status(404).json({ error: 'Invalid input. Rate no found' });
      }

      if (user.id !== rate.userId.toString()) return response.status(401).json();

      rate.value = request.body.value;
      const savedReview = await rate.save();
      return response.json(savedReview);
    } catch (error) {
      next(error);
    }
  },
);

// Delete rate
moviesRouter.delete(
  '/:id/rates/:rateId',
  isAuth,
  async (request, response, next) => {
    try {
      const { user } = request;

      const movie = await Movie.findOne({ idTMDB: request.params.id });
      if (!movie) {
        return response.status(404).json({ error: 'Invalid input. Movie no found' });
      }

      const rate = await Rate
        .findOne({ movieId: movie.id, _id: request.params.rateId });
      if (!rate) {
        return response.status(404).json({ error: 'Invalid input. Rate no found' });
      }

      if (user.id !== rate.userId.toString()) return response.status(401).json();

      await rate.deleteOne();
      return response.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

module.exports = moviesRouter;
