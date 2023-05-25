const request = require('supertest');
const session = require('express-session');
const app = require('./app-helper');
const { dbDisconnect, initializeMongoServer } = require('./mongo-config-testing');

const {
  initialUsers,
  initialLists,
  initialRates,
  initialWatchlists,
  initialMovies,
  initialReviews,
  addInitialUsers,
  addInitialLists,
  addInitialWatchlists,
  addInitialRates,
  addInitialProfilePhotos,
  addInitialMovies,
  addInitialReviews,
  nonExistingId,
} = require('./test-db-helper');
const Review = require('../models/review');
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

describe('when there is initially some movies and reviews saved in db', () => {
  // Get reviews
  describe('getting some reviews', () => {
    beforeAll(async () => {
      await addInitialMovies(); // Add 16 movies
      await addInitialReviews(); // Add 13 reviews
    });

    it('reviews are returned as json', async () => {
      await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews`).expect(200).expect('Content-Type', /application\/json/);
    });

    it('the amount of all reviews of one movie is returned in the total property', async () => {
      const response = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews`);

      // Reviews added to this movie.
      const amountReviews = initialReviews
        .filter((review) => review.movieId === initialMovies[0]._id).length;
      expect(response.body.total).toBe(amountReviews);
    });

    it('by default, a maximum of 10 movies are returned in the results property', async () => {
      const response = await api.get(`/api/v1.0/movies/${initialMovies[2].idTMDB}/reviews`);

      expect(response.body.results).toHaveLength(10);
    });

    it('return the number of reviews and data according to the result and query parameters page and pageSize', async () => {
      const page = 2;
      const pageSize = 3;

      const initialResponse = await api.get(`/api/v1.0/movies/${initialMovies[2].idTMDB}/reviews?page=${1}&pageSize=${pageSize}`);

      const secondResponse = await api.get(`/api/v1.0/movies/${initialMovies[2].idTMDB}/reviews?page=${page}&pageSize=${pageSize}`);

      // To check each review item is only in one response
      //  according to query parameters page and pageSize
      initialResponse.body.results.forEach((reviewFirstResponse) => {
        expect(secondResponse.body.results).not.toContainEqual(reviewFirstResponse);
      });

      expect(secondResponse.body.results).toHaveLength(pageSize);
      expect(secondResponse.body.page).toBe(page);
      expect(secondResponse.body.prev_page).toContain(`page=${page - 1}`);
      expect(secondResponse.body.next_page).toContain(`page=${page + 1}`);
      expect(secondResponse.body.movie_details).toEqual({
        name: initialMovies[2].name,
        idTMDB: initialMovies[2].idTMDB,
        release_date: initialMovies[2].release_date,
        photo: initialMovies[2].photo,
        rateAverage: initialMovies[2].rateAverage,
      });
    });

    it('fails with statuscode 400 if query parameters are invalid', async () => {
      const page = 'one';
      const pageSize = 5;
      await api.get(`/api/v1.0/movies/${initialMovies[2].idTMDB}/reviews?page=${page}&pageSize=${pageSize}`).expect(400);
    });

    it('the unique identifier property of the review is named id', async () => {
      const response = await api.get(`/api/v1.0/movies/${initialMovies[2].idTMDB}/reviews`);

      expect(response.body.results[0].id).toBeDefined();
      expect(response.body.results[0]._id).not.toBeDefined();
    });
  });

  // Get one review
  describe('viewing a specific review', () => {
    beforeAll(async () => {
      await addInitialMovies(); // Add 16 movies
      await addInitialReviews(); // Add 13 reviews
    });
    it('succeeds with a valid id and populate right data', async () => {
      const movieSelected = initialMovies[0];

      const reviewsResponseMovieSelected = await api.get(`/api/v1.0/movies/${movieSelected.idTMDB}/reviews`);

      // Response review selected
      const response = await api
        .get(`/api/v1.0/movies/${movieSelected.idTMDB}/reviews/${reviewsResponseMovieSelected.body.results[0].id}`)
        .expect(200)
        .expect('Content-Type', /application\/json/);

      // movieId field is populate to release_date, name, photo, id, idTMDB,
      const {
        movieId, ...formatedMovieSelected
      } = reviewsResponseMovieSelected.body.results[0];

      expect(response.body).toMatchObject({
        movieId: {
          name: movieSelected.name,
          photo: movieSelected.photo,
          id: movieSelected._id,
          idTMDB: movieSelected.idTMDB,
          release_date: movieSelected.release_date,
        },
        ...formatedMovieSelected,
      });
    });

    it('fails with statuscode 404 if review does not exist', async () => {
      const validNonexistingId = await nonExistingId('review');
      console.log(validNonexistingId);
      await api
        .get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${validNonexistingId}`)
        .expect(404);
    });
  });

  // Create reviews
  describe('create reviews', () => {
    beforeEach(async () => {
      // To remove the session after every test
      await api
        .post('/api/v1.0/auth/logout').send();
      await addInitialMovies();
      await addInitialReviews();
    });
    it('succeeds with valid data', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const newReview = {
        title: `Title of the review created by ${initialUsers[0].username}`,
        body: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenati',
      };
      const res = await api
        .post(`/api/v1.0/movies/${initialMovies[10].idTMDB}/reviews`)
        .send({
          title: newReview.title,
          body: newReview.body,
        }).expect(201)
        .expect('Content-Type', /application\/json/);

      // The info of the new review
      expect(res.body).toMatchObject({
        userId: `${initialUsers[0]._id}`,
        movieId: `${initialMovies[10]._id}`,
        date: expect.any(String),
        title: newReview.title,
        body: newReview.body,
      });

      // A new review was added to the reviews collection
      const newListReview = await Review.find().count();
      expect(newListReview).toBe(initialReviews.length + 1);

      const reviewsMovie = await api.get(`/api/v1.0/movies/${initialMovies[10].idTMDB}/reviews`);

      expect(reviewsMovie.body.results).toContainEqual(expect.objectContaining({
        title: newReview.title,
        body: newReview.body,
      }));
    });
    it('fails with status code 404 if the movie does not exist', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const newReview = {
        title: `Title of the review created by ${initialUsers[0].username}`,
        body: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenati',
      };

      const res = await api
        .post('/api/v1.0/movies/0/reviews')
        .send({
          title: newReview.title,
          body: newReview.body,
        }).expect(404);

      // A new review was not added to the reviews collection
      const newListReview = await Review.find().count();
      expect(newListReview).toBe(initialReviews.length);
    });
    it('fails with status code 401 if the user is not logged in', async () => {
      const newReview = {
        title: `Title of the review created by ${initialUsers[0].username}`,
        body: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenati',
      };
      const res = await api
        .post(`/api/v1.0/movies/${initialMovies[10].idTMDB}/reviews`)
        .send({
          title: newReview.title,
          body: newReview.body,
        }).expect(401);

      // A new review was not added to the reviews collection
      const newListReview = await Review.find().count();
      expect(newListReview).toBe(initialReviews.length);
    });
    it('fails with status code 400 if the inputs are invalids', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const newReview = {
        title: 'Short title',
        body: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenati',
      };

      const resUpdate = await api
        .post(`/api/v1.0/movies/${initialMovies[10].idTMDB}/reviews`)
        .send({
          title: newReview.title,
          body: newReview.body,
        }).expect(400);

      expect(resUpdate.body.errors).toBeDefined();
      expect(resUpdate.body.errors.length).toBeGreaterThan(0);

      // A new review was not added to the reviews collection
      const newListReview = await Review.find().count();
      expect(newListReview).toBe(initialReviews.length);
    });
    it('fails with status code 409 if the user has already created a review for a movie', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const newReview = {
        title: `Title of the review created by ${initialUsers[0].username}`,
        body: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenati',
      };
      // Successful creation
      await api
        .post(`/api/v1.0/movies/${initialMovies[10].idTMDB}/reviews`)
        .send({
          title: newReview.title,
          body: newReview.body,
        }).expect(201)
        .expect('Content-Type', /application\/json/);

      // Failed creation
      await api
        .post(`/api/v1.0/movies/${initialMovies[10].idTMDB}/reviews`)
        .send({
          title: newReview.title,
          body: newReview.body,
        }).expect(409);

      // A new review was added only one time to the reviews collection
      const newListReview = await Review.find().count();
      expect(newListReview).toBe(initialReviews.length + 1);
    });

    it('succeeds with the addition of new Movie in DB if it does not exist and if it has a valid ID of TMDB', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const newReview = {
        title: `Title of the review created by ${initialUsers[0].username}`,
        body: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenati',
      };

      const newMovieIdTMDB = '675353';

      await api
        .post(`/api/v1.0/movies/${newMovieIdTMDB}/reviews`)
        .send({
          title: newReview.title,
          body: newReview.body,
        }).expect(201)
        .expect('Content-Type', /application\/json/);

      const finalMovies = await api
        .get('/api/v1.0/movies/');

      // The movie was added to the movies collection
      expect(finalMovies.body.total).toBe(initialMovies.length + 1);
    });
  });

  // Edit reviews
  describe('edit review', () => {
    beforeAll(async () => {
      await addInitialMovies();
    });
    beforeEach(async () => {
      // To remove the session after every test
      await api
        .post('/api/v1.0/auth/logout').send();
      await addInitialReviews();
    });
    it('succeeds with valid data', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const newReview = {
        title: `Title of the review changed by ${initialUsers[0].username}`,
        body: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenatifelis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenati',
      };

      const reviewToChange = initialReviews
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      const res = await api
        .put(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${reviewToChange._id}`)
        .send({
          title: newReview.title,
          body: newReview.body,
        }).expect(200);

      // The info of the review changed
      expect(res.body).toMatchObject({
        userId: `${initialUsers[0]._id}`,
        movieId: `${initialMovies[0]._id}`,
        date: expect.any(String),
        title: newReview.title,
        body: newReview.body,
      });

      // Check the data changed in the db
      const reviewMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${reviewToChange._id}`);

      expect(reviewMovie.body).toMatchObject({
        title: newReview.title,
        body: newReview.body,
      });
    });
    it('fails with status code 404 if the movie does not exist', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const newReview = {
        title: `Title of the review changed by ${initialUsers[0].username}`,
        body: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenatifelis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenati',
      };

      const reviewToChange = initialReviews
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      const initialReviewMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${reviewToChange._id}`);

      await api
        .put(`/api/v1.0/movies/0/reviews/${reviewToChange._id}`)
        .send({
          title: newReview.title,
          body: newReview.body,
        }).expect(404);

      // Check the data was not changed in the db
      const reviewMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${reviewToChange._id}`);

      expect(reviewMovie.body).toEqual(initialReviewMovie.body);
    });
    it('fails with status code 404 if the review does not exist', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const newReview = {
        title: `Title of the review changed by ${initialUsers[0].username}`,
        body: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenatifelis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenati',
      };

      const validNonexistingId = await nonExistingId('review');
      await api
        .put(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${validNonexistingId}`)
        .send({
          title: newReview.title,
          body: newReview.body,
        }).expect(404);
    });
    it('fails with status code 401 if the user is not the owner of the review', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[1].username,
          password: initialUsers[1].username, // The password is the same that username
        });

      const newReview = {
        title: `Title of the review changed by ${initialUsers[1].username}`,
        body: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenatifelis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenati',
      };

      // Review made by one user different, userNumber0
      const reviewToChange = initialReviews
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      const initialReviewMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${reviewToChange._id}`);

      await api
        .put(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${reviewToChange._id}`)
        .send({
          title: newReview.title,
          body: newReview.body,
        }).expect(401);

      // Check the data was not changed in the db
      const reviewMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${reviewToChange._id}`);

      expect(reviewMovie.body).toEqual(initialReviewMovie.body);
    });
    it('fails with status code 401 if the user is not logged in', async () => {
      const newReview = {
        title: `Title of the review changed by ${initialUsers[0].username}`,
        body: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenatifelis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenati',
      };

      const reviewToChange = initialReviews
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      const initialReviewMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${reviewToChange._id}`);

      await api
        .put(`/api/v1.0/movies/0/reviews/${reviewToChange._id}`)
        .send({
          title: newReview.title,
          body: newReview.body,
        }).expect(401);

      // Check the data was not changed in the db
      const reviewMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${reviewToChange._id}`);

      expect(reviewMovie.body).toEqual(initialReviewMovie.body);
    });
  });

  // Delete reviews
  describe('delete review', () => {
    beforeAll(async () => {
      await addInitialMovies();
    });
    beforeEach(async () => {
      // To remove the session after every test
      await api
        .post('/api/v1.0/auth/logout').send();
      await addInitialReviews();
    });
    it('succeeds with valid data', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      // The inital data in the db of this movie
      const initialReviewsMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews`);

      const reviewToDelete = initialReviews
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      await api
        .delete(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${reviewToDelete._id}`)
        .send().expect(204);

      // Check the data changed in db
      const finalReviewsMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews`);

      expect(finalReviewsMovie.body.total).toBe(initialReviewsMovie.body.total - 1);
      expect(finalReviewsMovie.body.results).not.toContainEqual(expect.objectContaining({
        title: reviewToDelete.title,
        body: reviewToDelete.body,
      }));
    });

    it('fails with status code 404 if the movie does not exist', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const reviewToDelete = initialReviews
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      await api
        .delete(`/api/v1.0/movies/0/reviews/${reviewToDelete._id}`)
        .send().expect(404);

      // Check the review was not deleted of the db
      await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${reviewToDelete._id}`).expect(200);
    });
    it('fails with status code 404 if the review does not exist', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[0].username,
          password: initialUsers[0].username, // The password is the same that username
        });

      const initialReviewsMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews`);

      const validNonexistingId = await nonExistingId('review');
      await api
        .delete(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${validNonexistingId}`)
        .send().expect(404);

      const finalReviewsMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews`);

      // The reviews of the movie are the same
      expect(initialReviewsMovie.body.total).toBe(finalReviewsMovie.body.total);
    });

    it('fails with status code 401 if the user is not the owner of the review', async () => {
      // Login
      await api
        .post('/api/v1.0/auth/login')
        .send({
          username: initialUsers[1].username,
          password: initialUsers[1].username, // The password is the same that username
        });

      // Review made by one user different, userNumber0
      const reviewToDelete = initialReviews
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      const initialReviewsMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews`);

      await api
        .delete(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${reviewToDelete._id}`)
        .send().expect(401);

      // Check the review was not deleted of the db
      await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${reviewToDelete._id}`).expect(200);

      const finalReviewsMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews`);
      // The reviews of the movie are the same
      expect(initialReviewsMovie.body.total).toEqual(finalReviewsMovie.body.total);
    });
    it('fails with status code 401 if the user is not logged in', async () => {
      const reviewToDelete = initialReviews
        .find((item) => item.userId === initialUsers[0]._id
          && initialMovies[0]._id === item.movieId);

      const initialReviewsMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews`);

      await api
        .delete(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${reviewToDelete._id}`)
        .send().expect(401);

      // Check the review was not deleted of the db
      await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews/${reviewToDelete._id}`).expect(200);

      const finalReviewsMovie = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews`);
      // The reviews of the movie are the same
      expect(initialReviewsMovie.body.total).toEqual(finalReviewsMovie.body.total);
    });
  });
});

describe('when there are movies but there are not reviews in db', () => {
  beforeAll(async () => {
    await Review.deleteMany({});
    await addInitialMovies(); // Add 16 movies
  });
  it('return the number of reviews and data according to the result', async () => {
    const response = await api.get(`/api/v1.0/movies/${initialMovies[2].idTMDB}/reviews`).expect(200).expect('Content-Type', /application\/json/);
    expect(response.body.results).toHaveLength(0);
  });
});

afterAll(async () => {
  await dbDisconnect();
  console.log('Disconected from MongoDB');
});
