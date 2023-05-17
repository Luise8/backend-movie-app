const request = require('supertest');
const app = require('./app-helper');
const { dbDisconnect, initializeMongoServer } = require('./mongo-config-testing');

const {
  initialMovies,
  initialReviews,
  addInitialMovies,
  addInitialReviews,
  nonExistingId,
} = require('./test-db-helper');
const Review = require('../models/review');
const moviesRouter = require('../controllers/movies');

app.use('/api/v1.0/movies', moviesRouter);
const api = request(app);

beforeAll(async () => {
  await initializeMongoServer();
});

describe('when there is initially some movies and reviews saved in db', () => {
  beforeAll(async () => {
    await addInitialMovies(); // Add 16 movies
    await addInitialReviews(); // Add 13 reviews
  });

  it('reviews are returned as json', async () => {
    await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews`).expect(200).expect('Content-Type', /application\/json/);
  });

  it('the amount of all reviews of one movie is returned in the total property', async () => {
    const response = await api.get(`/api/v1.0/movies/${initialMovies[0].idTMDB}/reviews`);

    // Reviews added to this movie. See movies-initial.js
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

  describe('viewing a specific review', () => {
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
});

describe('when there are movies but there are not reviews in db', () => {
  beforeAll(async () => {
    await Review.deleteMany({});
    await addInitialMovies(); // Add 16 movies
  });
  it('return the number of reviews and data according to the result', async () => {
    const response = await api.get(`/api/v1.0/movies/${initialMovies[2].idTMDB}/reviews`).expect(200).expect('Content-Type', /application\/json/);
    console.log(response.body);
    expect(response.body.results).toHaveLength(0);
  });
});

afterAll(async () => {
  await dbDisconnect();
  console.log('Disconected from MongoDB');
});
