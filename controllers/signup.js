const signUpRouter = require('express').Router();

signUpRouter.get('/', async (request, response, next) => {
  try {
    const form = '<h1>Sign Up Page</h1><form method="POST" action="/api/v1.0/users">\
    Enter Username:<br><input type="text" name="username">\
    <br>Enter Password:<br><input type="password" name="password">\
    <br><br><input type="submit" value="Submit"></form>';
    response.send(form);
  } catch (error) {
    return next(error);
  }
});

module.exports = signUpRouter;
