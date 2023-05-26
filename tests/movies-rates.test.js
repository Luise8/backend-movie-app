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

describe('when there is initially some movies and rates saved in db', () => {
  // Create rates
  describe('create rates', () => {
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

      const newRate = {
        value: 3,
      };
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

      await api
        .post('/api/v1.0/movies/0/rates')
        .send({
          value: newRate.value,
        }).expect(404);

      // A new rate was not added to the rates collection
      const newListRates = await Rate.find().count();
      expect(newListRates).toBe(initialRates.length);
    });
    it('fails with status code 401 if the user is not logged in', async () => {
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
    });
    it('fails with status code 400 if the inputs are invalids', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

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
    });
  });

  // Edit rates
  describe('edit rates', () => {
    beforeAll(async () => {
      await addInitialMovies();
    });
    beforeEach(async () => {
      // To remove the session after every test
      await api
        .post('/api/v1.0/auth/logout').send();
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
    });
    it('fails with status code 401 if the user is not the owner of the rate', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[1].username,
          password: initialUsers[1].username, // The password is the same that username
        });

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
    });
    it('fails with status code 401 if the user is not logged in', async () => {
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
    });
  });

  // Delete rates
  describe('delete rates', () => {
    beforeAll(async () => {
      await addInitialMovies();
    });
    beforeEach(async () => {
      // To remove the session after every test
      await api
        .post('/api/v1.0/auth/logout').send();
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
    });

    it('fails with status code 401 if the user is not the owner of the rate', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[1].username,
          password: initialUsers[1].username, // The password is the same that username
        });

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
    });
    it('fails with status code 401 if the user is not logged in', async () => {
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
    });
  });
});

afterAll(async () => {
  await dbDisconnect();
  console.log('Disconected from MongoDB');
});
