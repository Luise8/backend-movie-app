# movie-app-backend
Backend of the movie-app project.

### Getting started

```
git clone git@github.com:Luise8/movie-app-backend.git
cd movie-app-backend
npm install
npm run dev
```
### Requeriments
- This App requires the use of the following frontend repository:
[https://github.com/Luise8/movie-app-frontend](https://github.com/Luise8/movie-app-frontend)
- You must create a TMDB account.
- Make sure to replace the env.example with an .env file with the corresponding variables.
- It is necessary to register in google recaptcha. If you don't want to use these services you should remove the recatpchaCheck declaration in the src/utils/middleware.js path as well as its use in the login (src/controllers/auth.js) and create user (src/controllers/user.js) routes.

### Description

API, that serves the data in JSON format.

It has functionalities: movies, user, authentication, sessions, reviews, rates, lists, watchlists.

Server handled by express.

Databases managed by mongoose.

Session and authentication are handled by express-session, passportJs, and connect-mongo.

Tests performed with jest, supertest, mongodb-memory-server-core.

Movie data retrieved from TMDB.
