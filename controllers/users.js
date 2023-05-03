const usersRouter = require('express').Router();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('../models/user');

usersRouter.post('/', async (request, response, next) => {
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
            photo: '',
            bio: '',
          });
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
});

module.exports = usersRouter;
