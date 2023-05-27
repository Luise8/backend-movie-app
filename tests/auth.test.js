const request = require('supertest');
const session = require('express-session');
const app = require('./app-helper');
const { dbDisconnect, initializeMongoServer } = require('./mongo-config-testing');
const { addInitialUsers, initialUsers } = require('./users-helper-db');
const authRouter = require('../controllers/auth');
const passport = require('../utils/passport');

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
});
const api = request.agent(app);

beforeEach(async () => {
  // To remove the session after every test
  await api
    .post('/api/v1.0/auth/logout').send();
});

describe('when there is initially some users saved in db', () => {
  beforeAll(async () => {
    await addInitialUsers(); // Add 13 users
  });

  describe('login', () => {
    it('succeeds with valid data', async () => {
      const res = await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        })
        .expect(200)
        .expect('Content-Type', /application\/json/);

      // The info of the currentSession
      expect(res.body).toEqual({ currentSession: { isAuth: true, userId: initialUsers[0]._id } });
    });

    it('fails with status 400 and errors prop with errors if data is invalid', async () => {
      const res = await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: 'Invalid password with withespaces', // The password is the same that username
        })
        .expect(400)
        .expect('Content-Type', /application\/json/);

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('fails with status 401 if username or password are wrong', async () => {
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: 'wrongPassword', // The password must be the same that username
        })
        .expect(401);
    });
  });

  describe('logout', () => {
    it('successful with return of current session user null and isAuth false', async () => {
      // login user
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        }).expect(200)
        .expect('Content-Type', /application\/json/);

      const res = await api
        .post('/api/v1.0/auth/logout')
        .send();

      // The info of the currentSession
      expect(res.body).toEqual({ currentSession: { isAuth: false, userId: null } });
    });
  });

  describe('status', () => {
    it('return logged in session when user is logged in', async () => {
      // login user
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        })
        .expect(200)
        .expect('Content-Type', /application\/json/);

      const res = await api
        .get('/api/v1.0/auth/status');

      expect(res.body).toEqual({ currentSession: { isAuth: true, userId: initialUsers[0]._id } });
    });

    it('return session not logged in when the user is not logged in', async () => {
      const res = await api
        .get('/api/v1.0/auth/status');

      expect(res.body).toEqual({ currentSession: { isAuth: false, userId: null } });
    });
  });
});

afterAll(async () => {
  await dbDisconnect();
  console.log('Disconected from MongoDB');
});
