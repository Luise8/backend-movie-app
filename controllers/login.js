const loginRouter = require('express').Router();
const passport = require('passport');

loginRouter.post('/', passport.authenticate('local', { successRedirect: '/api/v1.0/login/login-success', failureRedirect: '/api/v1.0/login/login-failure', failureMessage: true }));

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

loginRouter.get('/login-success', (req, res, next) => {
  res.send('You successfully logged in.');
});

loginRouter.get('/login-failure', (req, res, next) => {
  console.log(req.message);
  res.send('You entered the wrong password.');
});

module.exports = loginRouter;
