const usersRouter = require('express').Router();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const {
  body, validationResult, query,
} = require('express-validator');
const multer = require('multer');
const sharp = require('sharp');
const { readFile, unlink } = require('node:fs/promises');
const fileTypeCjs = require('file-type-cjs');
const User = require('../models/user');
const List = require('../models/list');
const Watchlist = require('../models/watchlist');
const ProfilePhoto = require('../models/profilePhoto');
const Review = require('../models/review');
const Rate = require('../models/rate');
const Movie = require('../models/movie');
const { isAuth } = require('../utils/middleware');

const upload = multer({
  dest: 'temp/uploads/',
  limits: { fileSize: 1024 * 1024 * 1, files: 1 },
  fileFilter(req, file, cb) {
    const { originalname, mimetype } = file;
    const filetypes = /jpeg|jpg|png|gif/;
    if (filetypes.test(originalname) && filetypes.test(mimetype)) {
      req.fileValidationError = null;
      cb(null, true);
    } else {
      req.fileValidationError = 'Invalid file. Must be an image jpeg|jpg|png|gif';
      cb(new Error(req.fileValidationError));
    }
  },
}).single('photo');

// Create user
usersRouter.post(
  '/',
  body('username')
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in the username')
    .isLength({ min: 5 })
    .escape()
    .withMessage('Username must be specified with min 5 characters')
    .isAlphanumeric()
    .withMessage('Username has non-alphanumeric characters.'),
  body('password')
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in the password')
    .isLength({ min: 5 })
    .withMessage('Password must be specified with min 5 characters'),
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
      bcrypt.hash(
        request.body.password,
        Number(process.env.saltRounds),
        async (error, hashedPassword) => {
          if (error) {
            return next(error);
          }
          try {
            const user = new User({
              username: request.body.username,
              passwordHash: hashedPassword,
              date: new Date(),
              watchlist: new mongoose.Types.ObjectId(),
              photo: new mongoose.Types.ObjectId(),
              bio: '',
            });
            const photoUser = new ProfilePhoto({
              _id: user.photo,
            });
            await photoUser.save();
            const savedUser = await user.save();
            response.status(201).json(savedUser);
          } catch (err) {
            return next(err);
          }
        },
      );
    } catch (error) {
      return next(error);
    }
  },
);

// Get user
usersRouter.get('/:id', async (request, response, next) => {
  try {
    const user = await User.findById(request.params.id).populate({
      path: 'lists',
      select: {
        name: 1, description: 1, date: 1,
      },
      perDocumentLimit: 2,
      options: {
        sort: { date: -1, _id: -1 },
      },
    })
      .populate('photo', { image: 1 })
      .lean()
      .exec();
    if (user) {
      if (request.user?.id !== user.id) {
        user.watchlist = null;
      }
      user.photo = user.photo.hasOwnProperty('image') ? `data:${user.photo.image.contentType};base64,${user.photo.image.data.toString('base64')}` : null;
      const reviews = await Review.find({
        userId: user.id,
      }).sort({
        date: -1, _id: -1,
      }).populate('movieId', {
        name: 1, photo: 1, release_date: 1, idTMDB: 1, rateAverage: 1,
      }).limit(2)
        .exec();
      user.reviews = reviews;

      const rates = await Rate.find({
        userId: request.params.id,
      }).sort({ date: -1, value: -1, _id: -1 })
        .populate('movieId', {
          name: 1, photo: 1, release_date: 1, idTMDB: 1, rateAverage: 1, description: 1,
        })
        .limit(2)
        .exec();
      user.rates = rates;

      response.json(user);
    } else {
      response.status(404).end();
    }
  } catch (exception) {
    next(exception);
  }
});

// Edit user
usersRouter.put(
  '/:id',
  isAuth,
  async (request, response, next) => {
    try {
      // Checks
      const { user } = request;
      // First checks
      const userDb = await User.findById(request.params.id);
      if (!userDb) return response.status(404).json({ error: 'user no found' });
      if (userDb._id.toString() !== user._id.toString()) return response.status(401).end();

      upload(request, response, async (err) => {
        // Second check
        // Request invalidates for fewer fields than required
        const { username, password, bio } = request.body;
        if (!username
        || !password
          || !bio) {
          if (request.hasOwnProperty('file')) {
            await unlink(request.file.path);
            return response.status(400).json({ error: 'missing fields' });
          }
          return response.status(400).json({ error: 'missing fields' });
        }

        // Third check
        if (err instanceof multer.MulterError) {
          // A Multer error occurred when uploading.
          if (err.message === 'File too large') {
            return response.status(400).json({ error: err.message });
          }
          return response.status(400).json({ error: 'Invalid input' });
        } if (err) {
          if (request.fileValidationError) {
            return response.status(400).json({
              error: `${request.fileValidationError}. Make sure the file have the correct name extension and the Content-Type is correct`,
            });
          }
          return response.status(500).end();
        }
        next();
      });
    } catch (error) {
      next(error);
    }
  },
  // Sanitization and validation
  body('username')
    .trim()
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in the username')
    .isLength({ min: 5 })
    .escape()
    .withMessage('Username must be specified with min 5 characters')
    .isAlphanumeric()
    .withMessage('Username has non-alphanumeric characters.'),
  body('bio')
    .trim()
    .customSanitizer((value) => value.replace(/\s{2,}/g, ' ')
      .replace(/-{2,}/g, '-')
      .replace(/'{2,}/g, '\'')
      .replace(/\.{2,}/g, '.')
      .replace(/,{2,}/g, ',')
      .replace(/\?{2,}/g, '?'))
    .isAlphanumeric('en-US', { ignore: ' -\'.,?' })
    .withMessage('Bio has valid characters.'),
  body('password')
    .trim()
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in the password')
    .isLength({ min: 5 })
    .withMessage('Password must be specified with min 5 characters'),
  async (request, response, next) => {
    try {
      const result = validationResult(request);
      if (!result.isEmpty()) {
        if (request.hasOwnProperty('file')) {
          await unlink(request.file.path);
        }
        return response.status(400).json({ errors: result.array() });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  },
  // Last middleware
  async (request, response, next) => {
    const session = await mongoose.connection.startSession();
    try {
      session.startTransaction();

      const userToUpdate = request.body;
      // Encrypt password
      const hashedPassword = await bcrypt.hash(
        userToUpdate.password,
        Number(process.env.saltRounds),
      );
      const userUpdated = await User.findByIdAndUpdate(request.params.id, {
        username: userToUpdate.username,
        passwordHash: hashedPassword,
        bio: userToUpdate.bio,
      }, {
        new: true,
        runValidators: true,
        context: 'query',
        session,
      });

      // Update photo only if user was updated
      // Handle last check of file
      if (request.hasOwnProperty('file')) {
        try {
          // This is neccesary to can test with jest, es6 dynamic import throw errors
          let resultFileType;
          if (process.env.NODE_ENV === 'test') {
            const file = await readFile(request.file.path);
            resultFileType = await fileTypeCjs.fromBuffer(file);
          } else {
            console.log('maria');
            const { fileTypeFromFile } = await import('file-type');
            resultFileType = await fileTypeFromFile(request.file.path);
          }

          const filetypes = /jpeg|jpg|png|gif/;
          if (!filetypes.test(resultFileType.ext) || !filetypes.test(resultFileType.mime)) {
            await unlink(request.file.path);
            await session.abortTransaction();
            session.endSession();
            return response.status(400).json({ error: 'Invalid file. Must be an image jpeg|jpg|png|gif' });
          }

          // Catches the 'file-type' error which means that there is some error
          // related to the file type so it is invalid
        } catch (error) {
          await unlink(request.file.path);
          await session.abortTransaction();
          session.endSession();
          return response.status(400).json({ error: 'Invalid file. Must be an image jpeg|jpg|png|gif' });
        }

        // Get and rezise img
        const file = await readFile(request.file.path);
        const rezizedImg = await sharp(file)
          .toFormat('jpeg')
          .resize(100, 100, { withoutEnlargement: true })
          .toBuffer();

        // Remove from temp/uploads
        await unlink(request.file.path);
        // Save in db
        await ProfilePhoto
          .findByIdAndUpdate(request.user.photo.toString(), {
            image: { data: rezizedImg, contentType: request.file.mimetype },
          }, { session });
      }
      // Confirm transaction
      await session.commitTransaction();
      session.endSession();
      return response.json(userUpdated);
    } catch (error) {
      if (request.hasOwnProperty('file')) {
        await unlink(request.file.path);
      }
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  },
);

// Delete user
usersRouter.delete('/:id', isAuth, async (request, response, next) => {
  const session = await mongoose.connection.startSession();
  try {
    const { user } = request;
    const userDb = await User.findById(request.params.id);
    // No exist
    if (!userDb) return response.status(404).json({ error: 'user no found' });
    // No owner of account
    if (userDb._id.toString() !== user._id.toString()) return response.status(401).end();

    // Start session
    session.startTransaction();

    await Review.deleteMany({ userId: userDb._id }).session(session);
    await List.deleteMany({ userId: userDb._id }).session(session);
    const rates = await Rate.find({ userId: userDb._id }).session(session);
    if (rates.length > 0) {
      const moviesPromiseToChange = rates.map(async (rate) => {
        const movieToChange = await Movie.findById(rate.movieId).session(session);
        movieToChange.rateCount -= 1;
        movieToChange.rateValue -= rate.value;
        movieToChange.rateAverage = Math
          .round(movieToChange.rateValue / movieToChange.rateCount);
        return movieToChange.save();
      });
      await Promise.all(moviesPromiseToChange);
      await Rate.deleteMany({ userId: userDb._id }).session(session);
    }
    await Watchlist.findByIdAndDelete(userDb.watchlist).session(session);
    await ProfilePhoto.findByIdAndDelete(userDb.photo).session(session);
    await User.findByIdAndDelete(request.params.id).session(session);

    // Confirm transaction
    await session.commitTransaction();
    session.endSession();
    response.status(204).end();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// Get reviews
usersRouter.get(
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
      const user = await User.findById(request.params.id).populate('photo', { image: 1 })
        .lean().exec();
      if (user) {
        if (request.user?.id !== user.id) {
          user.watchlist = null;
        }
        user.photo = user.photo.hasOwnProperty('image') ? `data:${user.photo.image.contentType};base64,${user.photo.image.data.toString('base64')}` : null;

        // Get page and pageSize values
        const pageSize = Number(request.query.pageSize) || 10;
        const page = Number(request.query.page) || 0;

        // Get count of reviews
        const count = await Review.find({
          userId: request.params.id,
        }).count();

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

        const reviews = await Review.find({
          userId: request.params.id,
        }).sort({ date: -1, _id: -1 }).limit(pageSize)
          .skip(pageSize * page)
          .populate('movieId', {
            name: 1, photo: 1, release_date: 1, idTMDB: 1, rateAverage: 1,
          })
          .exec();

        response.json({
          user_details: user,
          total: count,
          page_size: pageSize,
          page,
          prev_page: page === 0 ? prevPage : `/movies?page=${prevPage}&page_size=${pageSize}`,
          next_page: (pageSize * (page + 1)) < count ? `/movies?page=${page + 1}&page_size=${pageSize}` : '',
          results: reviews,
        });
      } else {
        response.status(404).end();
      }
    } catch (exception) {
      next(exception);
    }
  },
);

// Get rates
usersRouter.get(
  '/:id/rates',
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
      const user = await User.findById(request.params.id).populate('photo', { image: 1 })
        .lean().exec();
      if (user) {
        if (request.user?.id !== user.id) {
          user.watchlist = null;
        }
        user.photo = user.photo.hasOwnProperty('image') ? `data:${user.photo.image.contentType};base64,${user.photo.image.data.toString('base64')}` : null;

        // Get page and pageSize values
        const pageSize = Number(request.query.pageSize) || 10;
        const page = Number(request.query.page) || 0;

        // Get count of rates
        const count = await Rate.find({
          userId: request.params.id,
        }).count();

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

        const rates = await Rate.find({
          userId: request.params.id,
        }).sort({ date: -1, value: -1, _id: -1 }).limit(pageSize)
          .skip(pageSize * page)
          .populate('movieId', {
            name: 1, photo: 1, release_date: 1, idTMDB: 1, rateAverage: 1, description: 1,
          })
          .exec();

        response.json({
          user_details: user,
          total: count,
          page_size: pageSize,
          page,
          prev_page: page === 0 ? prevPage : `/movies?page=${prevPage}&page_size=${pageSize}`,
          next_page: (pageSize * (page + 1)) < count ? `/movies?page=${page + 1}&page_size=${pageSize}` : '',
          results: rates,
        });
      } else {
        response.status(404).end();
      }
    } catch (exception) {
      next(exception);
    }
  },
);

// Get Lists
usersRouter.get(
  '/:id/lists',
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
      const user = await User.findById(request.params.id).populate('photo', { image: 1 })
        .lean().exec();
      if (user) {
        if (request.user?.id !== user.id) {
          user.watchlist = null;
        }
        user.photo = user.photo.hasOwnProperty('image') ? `data:${user.photo.image.contentType};base64,${user.photo.image.data.toString('base64')}` : null;

        // Get page and pageSize values
        const pageSize = Number(request.query.pageSize) || 10;
        const page = Number(request.query.page) || 0;

        // Get count of lists
        const count = await List.find({
          userId: request.params.id,
        }).count();

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

        const lists = await List.find({
          userId: request.params.id,
        }).sort({ date: -1, _id: -1 }).limit(pageSize)
          .skip(pageSize * page)
          .exec();

        response.json({
          user_details: user,
          total: count,
          page_size: pageSize,
          page,
          prev_page: page === 0 ? prevPage : `/movies?page=${prevPage}&page_size=${pageSize}`,
          next_page: (pageSize * (page + 1)) < count ? `/movies?page=${page + 1}&page_size=${pageSize}` : '',
          results: lists,
        });
      } else {
        response.status(404).end();
      }
    } catch (exception) {
      next(exception);
    }
  },
);

// Get one list
usersRouter.get(
  '/:id/lists/:listId',
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
  query('light')
    .optional()
    .trim()
    .isBoolean()
    .withMessage('Must be true or false, or a number 1 to true and 0 to false'),
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
      const user = await User.findById(request.params.id).populate('photo', { image: 1 })
        .lean().exec();

      // Get count
      const list = await List.findById(request.params.listId)
        .exec();
      const count = list.movies.length;
      if (user && list) {
        if (request.user?.id !== user.id) {
          user.watchlist = null;
        }
        user.photo = user.photo.hasOwnProperty('image') ? `data:${user.photo.image.contentType};base64,${user.photo.image.data.toString('base64')}` : null;

        // Get page and pageSize values
        const pageSize = Number(request.query.pageSize) || 10;
        const page = Number(request.query.page) || 0;

        // Get ligth value
        const light = request.query.light || false;

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

        const listTotalIds = list.movies;
        let moviesArray;
        if (light === 'true' || light === '1') {
          moviesArray = await List.findById(request.params.listId)
            .select('movies')
            .populate({
              path: 'movies',
              select: {
                name: 1, idTMDB: 1, photo: 1, rateAverage: 1, release_date: 1,
              },
            })
            .exec();
          response.json({
            user_details: user,
            total: count,
            description: list.description,
            listTotalIds,
            name: list.name,
            date: list.date,
            results: moviesArray.movies,
            id: list.id,
          });
        } else {
          moviesArray = await List.findById(request.params.listId)
            .select('movies')
            .where('movies').slice([page * pageSize, pageSize])
            .populate({
              path: 'movies',
            })
            .exec();
          response.json({
            user_details: user,
            total: count,
            page_size: pageSize,
            page,
            prev_page: page === 0 ? prevPage : `/movies?page=${prevPage}&page_size=${pageSize}`,
            next_page: (pageSize * (page + 1)) < count ? `/movies?page=${page + 1}&page_size=${pageSize}` : '',
            description: list.description,
            listTotalIds,
            id: list.id,
            name: list.name,
            date: list.date,
            results: moviesArray.movies,
          });
        }
      } else {
        response.status(404).end();
      }
    } catch (exception) {
      next(exception);
    }
  },
);

// Create list
usersRouter.post(
  '/:id/lists',
  isAuth,
  async (request, response, next) => {
    try {
      // Checks
      const { user } = request;
      // Check owner
      // First checks
      const userDb = await User.findById(request.params.id);
      if (!userDb) return response.status(404).json({ error: 'user no found' });
      if (user.id !== request.params.id) return response.status(401).end();
      next();
    } catch (error) {
      next(error);
    }
  },
  // Sanitization and validation
  body('name')
    .trim()
    .customSanitizer((value) => value.replace(/\s{2,}/g, ' ')
      .replace(/-{2,}/g, '-')
      .replace(/'{2,}/g, '\'')
      .replace(/\.{2,}/g, '.')
      .replace(/,{2,}/g, ',')
      .replace(/\?{2,}/g, '?'))
    .isAlphanumeric('en-US', { ignore: ' -\'.,?' })
    .withMessage('Name has no valid characters.')
    .isLength({ min: 12 })
    .withMessage('Name must be specified with min 12 characters'),
  body('description')
    .optional()
    .trim()
    .customSanitizer((value) => value.replace(/\s{2,}/g, ' ')
      .replace(/-{2,}/g, '-')
      .replace(/'{2,}/g, '\'')
      .replace(/\.{2,}/g, '.')
      .replace(/,{2,}/g, ',')
      .replace(/\?{2,}/g, '?'))
    .isAlphanumeric('en-US', { ignore: ' -\'.,?' })
    .withMessage('Description has no valid characters.'),
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
      session.startTransaction();

      const { name } = request.body;
      const { description } = request.body;
      const list = new List({
        name, description, movies: [], userId: request.user.id, date: new Date(),
      });
      await list.save({ session });
      const userToUpdate = await User.findById(request.params.id).session(session);
      userToUpdate.lists.push(list);
      await userToUpdate.save();
      // Confirm transaction
      await session.commitTransaction();
      session.endSession();
      return response.status(201).json(list);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  },
);

module.exports = usersRouter;
