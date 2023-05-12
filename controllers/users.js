const usersRouter = require('express').Router();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const User = require('../models/user');
const List = require('../models/list');
const Watchlist = require('../models/watchlist');
const ProfilePhoto = require('../models/profilePhoto');

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

usersRouter.get('/:id', async (request, response, next) => {
  try {
    const user = await User.findById(request.params.id).populate('lists', {
      name: 1,
    }).populate('photo', { image: 1 }).lean()
      .exec();
    if (user) {
      response.json({
        ...user,
        photo: user.photo.hasOwnProperty('image') ? `data:${user.photo.image.contentType};base64,${user.photo.image.data.toString('base64')}` : null,
      });
    } else {
      response.status(404).end();
    }
  } catch (exception) {
    next(exception);
  }
});


module.exports = usersRouter;
