const loginRouter = require('express').Router();
const passport = require('passport');
const { body, validationResult } = require('express-validator');

loginRouter.post(
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
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.json({ errors: result.array() });
    }
    return next();
  },

  passport.authenticate('local'),

  (req, res) => {
    res.json(req.user.username);
  },
);

loginRouter.get('/', (req, res, next) => {
  if (req.session.hasOwnProperty('messages')) {
    console.log(req.session.messages[req.session.messages.length - 1]);
  }
  const form = '<h1>Login Page</h1><form method="POST" action="/api/v1.0/login">\
    Enter Username:<br><input type="text" name="username">\
    <br>Enter Password:<br><input type="password" name="password">\
    <br><br><input type="submit" value="Submit"></form>';

  res.send(form);
});

module.exports = loginRouter;
