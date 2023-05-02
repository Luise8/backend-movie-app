const passport = require('passport');
const LocalStrategy = require('passport-local');
const bcrypt = require('bcrypt');
const User = require('../models/user');

const verifyCallback = (username, password, done) => {
  User.findOne({ username })
    .then((user) => {
      if (!user) { return done(null, false, { message: 'Incorrect username' }); }

      bcrypt.compare(password, user.passwordHash, (err, res) => {
        if (res) {
          // passwords match! log user in
          return done(null, user);
        }
        // passwords do not match!
        return done(null, false, { message: 'Incorrect password' });
      });
    })
    .catch((error) => {
      done(error);
    });
};

const strategy = new LocalStrategy(verifyCallback);

passport.use(strategy);

passport.serializeUser((user, done) => {
  process.nextTick(() => done(null, user._id));
});

passport.deserializeUser((userId, done) => {
  User.findById(userId)
    .then((user) => {
      done(null, user);
    })
    .catch((err) => done(err));
});

module.exports = passport;
