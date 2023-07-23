const authRouter = require('express').Router();
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const { recatpchaCheck } = require('../utils/middleware');

authRouter.post(
  '/login',
  body('username')
    .custom((value) => !/\s/.test(value))
    .withMessage('No spaces are allowed in the username')
    .isLength({ min: 5, max: 20 })
    .escape()
    .withMessage('Username must be specified with min 5 and max 20 characters')
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
      next(error);
    }
  },
  recatpchaCheck,
  passport.authenticate('local'),

  (req, res, next) => {
    try {
      res.json({
        currentSession: {
          isAuth: req.isAuthenticated?.() || false,
          userId: req.user?._id || null,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Visiting this route logs the user out
authRouter.post('/logout', (req, res, next) => {
  try {
    if (!req.hasOwnProperty('logout')) {
      return res.status(200).json({
        currentSession: {
          isAuth: false,
          userId: null,
        },
      });
    }

    req.logout((error) => {
      if (error) { return next(error); }
      res.status(200).json({
        currentSession: {
          isAuth: req.isAuthenticated?.() || false,
          userId: req.user?._id || null,
        },
      });
    });
  } catch (error) {
    next(error);
  }
});

// Check status auth session
authRouter.get('/status', (req, res, next) => {
  try {
    res.json({
      currentSession: {
        isAuth: req.isAuthenticated?.() || false,
        userId: req.user?._id || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = authRouter;
