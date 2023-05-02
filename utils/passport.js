const passport = require('passport');
const LocalStrategy = require('passport-local');

const User = require('../models/user');

const verifyCallback = (username, password, done) => {
  User.findOne({ username })
    .then((user) => {
      if (!user) { return done(null, false, { message: 'Incorrect username' }); }

      const isValid = user.passwordHash === password;

      if (!isValid) {
        return done(null, false, { message: 'Incorrect password' });
      }
      return done(null, user);
    })
    .catch((err) => {
      done(err);
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
