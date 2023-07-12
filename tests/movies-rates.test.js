const request = require('supertest');
const session = require('express-session');
const app = require('./app-helper');
const { dbDisconnect, initializeMongoServer } = require('./mongo-config-testing');

const {
  initialUsers,
  initialRates,
  initialMovies,
  addInitialUsers,
  addInitialRates,
  addInitialMovies,
} = require('./test-db-helper');
const Rate = require('../models/rate');
const moviesRouter = require('../controllers/movies');
const authRouter = require('../controllers/auth');
const passport = require('../utils/passport');
const middleware = require('../utils/middleware');

beforeAll(async () => {
  const sessionStore = await initializeMongoServer();
  app.use(session({
    secret: 'secretTest',
    resave: true,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    // Equals 1 day (1 day * 24 hr / 1 day * 60 min/ 1 hr * 60 sec/ 1 min * 1000 ms / 1 sec)
    },
    store: sessionStore,
  }));

  app.use(passport.initialize());
  app.use(passport.session());
  app.use('/api/v1.0/auth', authRouter);
  app.use('/api/v1.0/movies', moviesRouter);
  app.use(middleware.unknownEndpoint);
  app.use(middleware.errorHandler);
  await addInitialUsers();
});
const api = request.agent(app);

describe('when there is initially some movies and rates saved in DB', () => {
  // Get one rate for specific user
  describe('viewing a specific rate for specific user', () => {
    beforeAll(async () => {
      await addInitialMovies();
      await addInitialRates();
    });
    it('succeeds with a valid id and populate right data', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const movieSelected = initialMovies[0];
      const rateSelected = initialRates.find((rate) => rate.userId === initialUsers[0]._id);

      // Response rate selected
      const response = await api
        .get(`/api/v1.0/movies/${movieSelected.idTMDB}/rateUser`)
        .expect(200)
        .expect('Content-Type', /application\/json/);

      // movieId field is populate to release_date, name, photo, id, idTMDB,
      expect(response.body.rate).toMatchObject({
        movieId: {
          name: movieSelected.name,
          photo: movieSelected.photo,
          id: movieSelected._id,
          idTMDB: movieSelected.idTMDB,
          release_date: movieSelected.release_date,
        },
        userId: rateSelected.userId,
        value: rateSelected.value,
        id: rateSelected._id,
        date: rateSelected.date,
      });
    });

    it('return null if movie or rate does not exist', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      // Movie not found
      await api
        .get('/api/v1.0/movies/0/rateUser')
        .expect({ rate: null });

      // This movie does not have any rate to this user
      await api
        .get(`/api/v1.0/movies/${initialMovies[10].idTMDB}/rateUser`)
        .expect({ rate: null });
    });
  });

  // Create rates
  describe('create rates', () => {
    beforeEach(async () => {
      // To remove the session after every test
      await api
        .post('/api/v1.0/auth/logout').send();
      await addInitialMovies();
      await addInitialRates();
    });
    it('succeeds with valid data when the movie exist in DB and has not ratings', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const newRate = {
        value: 3,
      };

      // Get initial movie to give rate
      const initialMovie = await api.get(`/api/v1.0/movies/${initialMovies[10].idTMDB}`);

      const res = await api
        .post(`/api/v1.0/movies/${initialMovies[10].idTMDB}/rates`)
        .send({
          value: newRate.value,
        }).expect(201)
        .expect('Content-Type', /application\/json/);

      // The info of the new rate
      expect(res.body).toMatchObject({
        userId: `${initialUsers[0]._id}`,
        movieId: `${initialMovies[10]._id}`,
        date: expect.any(String),
        value: newRate.value,
      });

      // A new rate was added to the rates collection
      const newListRates = await Rate.find().count();
      expect(newListRates).toBe(initialRates.length + 1);

      const rateCreated = await Rate.findOne({
        userId: `${initialUsers[0]._id}`,
        movieId: `${initialMovies[10]._id}`,
        value: newRate.value,
      }).exec();

      expect(rateCreated).not.toBeNull();

      // The movie's rateAverage, rateValue, and rateCount fields were  updated
      const finalMovie = await api.get(`/api/v1.0/movies/${initialMovies[10].idTMDB}`);
      const expectedValue = initialMovie.body.rateValue + newRate.value;
      const expectedCount = initialMovie.body.rateCount + 1;
      const expectedAverage = Math.round(expectedValue / expectedCount);

      expect(finalMovie.body.rateValue).toBe(expectedValue);
      expect(finalMovie.body.rateCount).toBe(expectedCount);
      expect(finalMovie.body.rateAverage).toBe(expectedAverage);
    });
    it('succeeds with valid data when the movie exist in DB and has ratings', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[2].username,
          password: initialUsers[2].username, // The password is the same that username
        });

      const newRate = {
        value: 3,
      };

      // Get initial movie to give rate
      const initialMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);

      const res = await api
        .post(`/api/v1.0/movies/${initialMovies[0].idTMDB}/rates`)
        .send({
          value: newRate.value,
        }).expect(201)
        .expect('Content-Type', /application\/json/);

      // The info of the new rate
      expect(res.body).toMatchObject({
        userId: `${initialUsers[2]._id}`,
        movieId: `${initialMovies[0]._id}`,
        date: expect.any(String),
        value: newRate.value,
      });

      // A new rate was added to the rates collection
      const newListRates = await Rate.find().count();
      expect(newListRates).toBe(initialRates.length + 1);

      const rateCreated = await Rate.findOne({
        userId: `${initialUsers[2]._id}`,
        movieId: `${initialMovies[0]._id}`,
        value: newRate.value,
      }).exec();

      expect(rateCreated).not.toBeNull();

      // The movie's rateAverage, rateValue, and rateCount fields were  updated
      const finalMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);
      const expectedValue = initialMovie.body.rateValue + newRate.value;
      const expectedCount = initialMovie.body.rateCount + 1;
      const expectedAverage = Math.round(expectedValue / expectedCount);

      expect(finalMovie.body.rateValue).toBe(expectedValue);
      expect(finalMovie.body.rateCount).toBe(expectedCount);
      expect(finalMovie.body.rateAverage).toBe(expectedAverage);
    });
    it('fails with status code 404 if the movie does not exist', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      // Get initial movie to give rate
      const initialMovie = await api.get(`/api/v1.0/movies/${initialMovies[10].idTMDB}`);

      const newRate = {
        value: 3,
      };

      await api
        .post('/api/v1.0/movies/0/rates')
        .send({
          value: newRate.value,
        }).expect(404);

      // A new rate was not added to the rates collection
      const newListRates = await Rate.find().count();
      expect(newListRates).toBe(initialRates.length);

      // The movie's rateAverage, rateValue, and rateCount fields were not updated
      const finalMovie = await api.get(`/api/v1.0/movies/${initialMovies[10].idTMDB}`);
      const expectedValue = initialMovie.body.rateValue;
      const expectedCount = initialMovie.body.rateCount;
      const expectedAverage = initialMovie.body.rateAverage;

      expect(finalMovie.body.rateValue).toBe(expectedValue);
      expect(finalMovie.body.rateCount).toBe(expectedCount);
      expect(finalMovie.body.rateAverage).toBe(expectedAverage);
    });
    it('fails with status code 401 if the user is not logged in', async () => {
      // Get initial movie to give rate
      const initialMovie = await api.get(`/api/v1.0/movies/${initialMovies[10].idTMDB}`);

      const newRate = {
        value: 3,
      };

      await api
        .post(`/api/v1.0/movies/${initialMovies[10].idTMDB}/rates`)
        .send({
          value: newRate.value,
        }).expect(401);

      // A new rate was not added to the rates collection
      const newListRates = await Rate.find().count();
      expect(newListRates).toBe(initialRates.length);

      // The movie's rateAverage, rateValue, and rateCount fields were not updated
      const finalMovie = await api.get(`/api/v1.0/movies/${initialMovies[10].idTMDB}`);
      const expectedValue = initialMovie.body.rateValue;
      const expectedCount = initialMovie.body.rateCount;
      const expectedAverage = initialMovie.body.rateAverage;

      expect(finalMovie.body.rateValue).toBe(expectedValue);
      expect(finalMovie.body.rateCount).toBe(expectedCount);
      expect(finalMovie.body.rateAverage).toBe(expectedAverage);
    });
    it('fails with status code 400 if the inputs are invalids', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      // Get initial movie to give rate
      const initialMovie = await api.get(`/api/v1.0/movies/${initialMovies[10].idTMDB}`);

      const newRate = {
        value: 100,
      };

      const resUpdate = await api
        .post(`/api/v1.0/movies/${initialMovies[10].idTMDB}/rates`)
        .send({
          value: newRate.value,
        }).expect(400);

      expect(resUpdate.body.errors).toBeDefined();
      expect(resUpdate.body.errors.length).toBeGreaterThan(0);

      // A new rate was not added to the rates collection
      const newListRates = await Rate.find().count();
      expect(newListRates).toBe(initialRates.length);

      // The movie's rateAverage, rateValue, and rateCount fields were not updated
      const finalMovie = await api.get(`/api/v1.0/movies/${initialMovies[10].idTMDB}`);
      const expectedValue = initialMovie.body.rateValue;
      const expectedCount = initialMovie.body.rateCount;
      const expectedAverage = initialMovie.body.rateAverage;

      expect(finalMovie.body.rateValue).toBe(expectedValue);
      expect(finalMovie.body.rateCount).toBe(expectedCount);
      expect(finalMovie.body.rateAverage).toBe(expectedAverage);
    });
    it('fails with status code 409 if the user has already created a rate for a movie', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const newRate = {
        value: 3,
      };

      // Successful creation
      await api
        .post(`/api/v1.0/movies/${initialMovies[10].idTMDB}/rates`)
        .send({
          value: newRate.value,
        }).expect(201);

      // Failed creation
      await api
        .post(`/api/v1.0/movies/${initialMovies[10].idTMDB}/rates`)
        .send({
          value: newRate.value,
        }).expect(409);

      // A new rate was added to the rates collection only one time
      const newListRates = await Rate.find().count();
      expect(newListRates).toBe(initialRates.length + 1);
    });

    it('succeeds with the addition of new Movie in DB if it does not exist and if it has a valid ID of TMDB', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const newRate = {
        value: 3,
      };

      const newMovieIdTMDB = '675353';

      await api
        .post(`/api/v1.0/movies/${newMovieIdTMDB}/rates`)
        .send({
          value: newRate.value,
        }).expect(201)
        .expect('Content-Type', /application\/json/);

      const finalMovies = await api
        .get('/api/v1.0/movies/');

      // The movie was added to the movies collection
      expect(finalMovies.body.total).toBe(initialMovies.length + 1);

      // The movie's rateAverage, rateValue, andrateCount fields were set to the given rate
      const finalMovie = await api.get(`/api/v1.0/movies/${newMovieIdTMDB}`);
      const expectedValue = newRate.value;
      const expectedCount = 1;
      const expectedAverage = newRate.value;

      expect(finalMovie.body.rateValue).toBe(expectedValue);
      expect(finalMovie.body.rateCount).toBe(expectedCount);
      expect(finalMovie.body.rateAverage).toBe(expectedAverage);
    });
  });

  // Edit rates
  describe('edit rates', () => {
    beforeEach(async () => {
      // To remove the session after every test
      await api
        .post('/api/v1.0/auth/logout').send();
      await addInitialMovies();
      await addInitialRates();
    });
    it('succeeds with valid data', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      // Get initial movie to update rate
      const initialMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);

      const newRate = {
        value: 3,
      };

      const rateToChange = initialRates
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      const res = await api
        .put(`/api/v1.0/movies/${initialMovies[0].idTMDB}/rates/${rateToChange._id}`)
        .send({
          value: newRate.value,
        }).expect(200);

      // The info of the rate changed
      expect(res.body).toMatchObject({
        userId: `${initialUsers[0]._id}`,
        movieId: `${initialMovies[0]._id}`,
        date: expect.any(String),
        value: newRate.value,
      });

      // Check the data changed in the db
      const rateCreated = await Rate.findOne({
        userId: `${initialUsers[0]._id}`,
        movieId: `${initialMovies[0]._id}`,
      }).exec();

      expect(rateCreated.value).toBe(newRate.value);

      // The movie's rateAverage, rateValue, fields were updated. The rateCount field didn't change
      const finalMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);
      const expectedValue = (initialMovie.body.rateValue - rateToChange.value) + newRate.value;
      const expectedCount = initialMovie.body.rateCount;
      const expectedAverage = Math.round(expectedValue / expectedCount);
      expect(finalMovie.body.rateValue).toBe(expectedValue);
      expect(finalMovie.body.rateCount).toBe(expectedCount);
      expect(finalMovie.body.rateAverage).toBe(expectedAverage);
    });
    it('fails with status code 404 if the movie does not exist', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const newRate = {
        value: 3,
      };

      const rateToChange = initialRates
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      await api
        .put(`/api/v1.0/movies/0/rates/${rateToChange._id}`)
        .send({
          value: newRate.value,
        }).expect(404);

      // Check the data was not changed in the db
      const finalRate = await Rate.findOne({
        userId: `${initialUsers[0]._id}`,
        movieId: `${initialMovies[0]._id}`,
      }).exec();
      expect(finalRate.value).toBe(rateToChange.value);
    });
    it('fails with status code 404 if the rate does not exist', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      // Get initial movie to update rate
      const initialMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);

      const rateNonExistingId = new Rate({
        userId: `${initialUsers[0]._id}`,
        movieId: `${initialMovies[0]._id}`,
        date: new Date().toISOString(),
        value: 5,
      });
      await rateNonExistingId.save();
      await rateNonExistingId.deleteOne();
      await api
        .put(`/api/v1.0/movies/${initialMovies[0].idTMDB}/rates/${rateNonExistingId.id}`)
        .send({
          value: 5,
        }).expect(404);

      // The movie's rateAverage, rateValue and rateCount fields were not updated.
      const finalMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);
      const expectedValue = initialMovie.body.rateValue;
      const expectedCount = initialMovie.body.rateCount;
      const expectedAverage = initialMovie.body.rateAverage;
      expect(finalMovie.body.rateValue).toBe(expectedValue);
      expect(finalMovie.body.rateCount).toBe(expectedCount);
      expect(finalMovie.body.rateAverage).toBe(expectedAverage);
    });
    it('fails with status code 401 if the user is not the owner of the rate', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[1].username,
          password: initialUsers[1].username, // The password is the same that username
        });

      // Get initial movie to update rate
      const initialMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);

      const newRate = {
        value: 3,
      };

      const rateToChange = initialRates
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      await api
        .put(`/api/v1.0/movies/${initialMovies[0].idTMDB}/rates/${rateToChange._id}`)
        .send({
          value: newRate.value,
        }).expect(401);

      // Check the data was not changed in the db
      const finalRate = await Rate.findOne({
        userId: `${initialUsers[0]._id}`,
        movieId: `${initialMovies[0]._id}`,
      }).exec();
      expect(finalRate.value).toBe(rateToChange.value);

      // The movie's rateAverage, rateValue and rateCount fields were not updated.
      const finalMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);
      const expectedValue = initialMovie.body.rateValue;
      const expectedCount = initialMovie.body.rateCount;
      const expectedAverage = initialMovie.body.rateAverage;
      expect(finalMovie.body.rateValue).toBe(expectedValue);
      expect(finalMovie.body.rateCount).toBe(expectedCount);
      expect(finalMovie.body.rateAverage).toBe(expectedAverage);
    });
    it('fails with status code 401 if the user is not logged in', async () => {
      // Get initial movie to update rate
      const initialMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);

      const newRate = {
        value: 3,
      };

      const rateToChange = initialRates
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      await api
        .put(`/api/v1.0/movies/${initialMovies[0].idTMDB}/rates/${rateToChange._id}`)
        .send({
          value: newRate.value,
        }).expect(401);

      // Check the data was not changed in the db
      const finalRate = await Rate.findOne({
        userId: `${initialUsers[0]._id}`,
        movieId: `${initialMovies[0]._id}`,
      }).exec();
      expect(finalRate.value).toBe(rateToChange.value);

      // The movie's rateAverage, rateValue and rateCount fields were not updated.
      const finalMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);
      const expectedValue = initialMovie.body.rateValue;
      const expectedCount = initialMovie.body.rateCount;
      const expectedAverage = initialMovie.body.rateAverage;
      expect(finalMovie.body.rateValue).toBe(expectedValue);
      expect(finalMovie.body.rateCount).toBe(expectedCount);
      expect(finalMovie.body.rateAverage).toBe(expectedAverage);
    });
  });

  // Delete rates
  describe.only('delete rates', () => {
    beforeEach(async () => {
      // To remove the session after every test
      await api
        .post('/api/v1.0/auth/logout').send();
      await addInitialMovies();
      await addInitialRates();
    });
    it('succeeds with valid data', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      // Get initial rated movie
      const initialMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);

      const rateToDelete = initialRates
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      await api
        .delete(`/api/v1.0/movies/${initialMovies[0].idTMDB}/rates/${rateToDelete._id}`)
        .send().expect(204);

      // Check the data changed in db
      const finalRates = await Rate.find().exec();

      expect(finalRates.length).toBe(initialRates.length - 1);

      const finalRateIds = finalRates.map((item) => item._id.toString());
      expect(finalRateIds).not.toContain(rateToDelete._id);

      // The movie's rateAverage, rateValue, fields and rateCount were updated.
      const finalMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);
      const expectedValue = initialMovie.body.rateValue - rateToDelete.value;
      const expectedCount = initialMovie.body.rateCount - 1;
      const expectedAverage = Math.round(expectedValue / expectedCount);
      expect(finalMovie.body.rateValue).toBe(expectedValue);
      expect(finalMovie.body.rateCount).toBe(expectedCount);
      expect(finalMovie.body.rateAverage).toBe(expectedAverage);
    });

    it('fails with status code 404 if the movie does not exist', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const rateToDelete = initialRates
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      await api
        .delete(`/api/v1.0/movies/0/rates/${rateToDelete._id}`)
        .send().expect(404);

      // Check the data changed in db
      const finalRates = await Rate.find().exec();

      expect(finalRates.length).toBe(initialRates.length);

      const finalRateIds = finalRates.map((item) => item._id.toString());
      expect(finalRateIds).toContain(rateToDelete._id);
    });
    it('fails with status code 404 if the rate does not exist', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      // Get initial rated movie
      const initialMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);

      const rateNonExistingId = new Rate({
        userId: `${initialUsers[0]._id}`,
        movieId: `${initialMovies[0]._id}`,
        date: new Date().toISOString(),
        value: 5,
      });
      await rateNonExistingId.save();
      await rateNonExistingId.deleteOne();

      await api
        .delete(`/api/v1.0/movies/${initialMovies[0].idTMDB}/rates/${rateNonExistingId.id}`)
        .send().expect(404);

      // Check the data changed in db
      const finalRates = await Rate.find().exec();

      expect(finalRates.length).toBe(initialRates.length);

      // The movie's rateAverage, rateValue and rateCount fields were not updated.
      const finalMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);
      const expectedValue = initialMovie.body.rateValue;
      const expectedCount = initialMovie.body.rateCount;
      const expectedAverage = initialMovie.body.rateAverage;
      expect(finalMovie.body.rateValue).toBe(expectedValue);
      expect(finalMovie.body.rateCount).toBe(expectedCount);
      expect(finalMovie.body.rateAverage).toBe(expectedAverage);
    });

    it('fails with status code 401 if the user is not the owner of the rate', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[1].username,
          password: initialUsers[1].username, // The password is the same that username
        });

      // Get initial rated movie
      const initialMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);

      const rateToDelete = initialRates
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      await api
        .delete(`/api/v1.0/movies/${initialMovies[0].idTMDB}/rates/${rateToDelete._id}`)
        .send().expect(401);

      // Check the data changed in db
      const finalRates = await Rate.find().exec();

      expect(finalRates.length).toBe(initialRates.length);

      const finalRateIds = finalRates.map((item) => item._id.toString());
      expect(finalRateIds).toContain(rateToDelete._id);

      // The movie's rateAverage, rateValue and rateCount fields were not updated.
      const finalMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);
      const expectedValue = initialMovie.body.rateValue;
      const expectedCount = initialMovie.body.rateCount;
      const expectedAverage = initialMovie.body.rateAverage;
      expect(finalMovie.body.rateValue).toBe(expectedValue);
      expect(finalMovie.body.rateCount).toBe(expectedCount);
      expect(finalMovie.body.rateAverage).toBe(expectedAverage);
    });
    it('fails with status code 401 if the user is not logged in', async () => {
      // Get initial rated movie
      const initialMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);

      const rateToDelete = initialRates
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      await api
        .delete(`/api/v1.0/movies/${initialMovies[0]._id}/rates/${rateToDelete._id}`)
        .send().expect(401);

      // Check the data changed in db
      const finalRates = await Rate.find().exec();

      expect(finalRates.length).toBe(initialRates.length);

      const finalRateIds = finalRates.map((item) => item._id.toString());
      expect(finalRateIds).toContain(rateToDelete._id);

      // The movie's rateAverage, rateValue and rateCount fields were not updated.
      const finalMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`);
      const expectedValue = initialMovie.body.rateValue;
      const expectedCount = initialMovie.body.rateCount;
      const expectedAverage = initialMovie.body.rateAverage;
      expect(finalMovie.body.rateValue).toBe(expectedValue);
      expect(finalMovie.body.rateCount).toBe(expectedCount);
      expect(finalMovie.body.rateAverage).toBe(expectedAverage);
    });
  });
});

afterAll(async () => {
  await dbDisconnect();
  console.log('Disconected from MongoDB');
});
