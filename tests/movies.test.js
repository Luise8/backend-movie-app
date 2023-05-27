const request = require('supertest');
const app = require('./app-helper');
const { dbDisconnect, initializeMongoServer } = require('./mongo-config-testing');

const {
  initialMovies,
  addInitialMovies,
  nonExistingId,
} = require('./test-db-helper');
const Movie = require('../models/movie');
const moviesRouter = require('../controllers/movies');

app.use('/api/v1.0/movies', moviesRouter);
const api = request(app);

beforeAll(async () => {
  await initializeMongoServer();
});

describe('when there is initially some movies saved in db', () => {
  beforeAll(async () => {
    await addInitialMovies(); // Add 16 movies
  });

  it('movies are returned as json', async () => {
    await api.get('/api/v1.0/movies').expect(200).expect('Content-Type', /application\/json/);
  });

  it('the amount of all movies is returned in the total property', async () => {
    const response = await api.get('/api/v1.0/movies');
    expect(response.body.total).toBe(initialMovies.length);
  });

  it('by default, a maximum of 10 movies are returned in the results property', async () => {
    const response = await api.get('/api/v1.0/movies');
    expect(response.body.results).toHaveLength(10);
  });

  it('return the number of movies and data according to the result and query parameters page and pageSize', async () => {
    const page = 2;
    const pageSize = 5;
    const initialResponse = await api.get(`/api/v1.0/movies?page=${1}&pageSize=${pageSize}`);
    const secondResponse = await api.get(`/api/v1.0/movies?page=${page}&pageSize=${pageSize}`);

    // To check each movie item is only in one response
    //  according to query parameters page and pageSize
    initialResponse.body.results.forEach((movieFirstResponse) => {
      expect(secondResponse.body.results).not.toContainEqual(movieFirstResponse);
    });

    expect(secondResponse.body.results).toHaveLength(pageSize);
    expect(secondResponse.body.page).toBe(page);
    expect(secondResponse.body.prev_page).toContain(`page=${page - 1}`);
    expect(secondResponse.body.next_page).toContain(`page=${page + 1}`);
  });

  it('fails with statuscode 400 if query parameters are invalid', async () => {
    const page = 'one';
    const pageSize = 5;
    await api.get(`/api/v1.0/movies?page=${page}&pageSize=${pageSize}`).expect(400);
  });

  describe('checking the sort', () => {
    let newMovie;
    beforeAll(async () => {
      newMovie = new Movie({
        name: 'Movie that must be first by rateAverage 1 over 0 of the rest of movies in initialMovies',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Inventore, iste quis facilis beatae eius mollitia libero assumenda cupiditate illo. Nulla, adipisci omnis corrupti non magnam consequatur beatae ipsum asperiores officiis',
        idTMDB: await nonExistingId('movie'),
        date: initialMovies[0].date,
        rateAverage: 1,
      });
      await newMovie.save();
    });

    it('movies are sorted by rateAverage first, then date and then idTMDB', async () => {
      const response = await api.get('/api/v1.0/movies');
      expect(response.body.results[0].name).toContain(newMovie.name);
    });
    afterAll(async () => {
      newMovie.deleteOne({});
    });
  });

  it('the unique identifier property of the movies is named id', async () => {
    const response = await api.get('/api/v1.0/movies');

    expect(response.body.results[0].id).toBeDefined();
    expect(response.body.results[0]._id).not.toBeDefined();
  });

  describe('viewing a specific movie', () => {
    it('succeeds with a valid id', async () => {
      const response = await api
        .get(`/api/v1.0/movies/${initialMovies[0].idTMDB}`)
        .expect(200)
        .expect('Content-Type', /application\/json/);

      const {
        _id, ...formatedMovieSelected
      } = initialMovies[0];

      expect(response.body).toMatchObject({
        id: _id,
        ...formatedMovieSelected,
      });
    });

    it('fails with statuscode 404 if movie does not exist', async () => {
      const validNonexistingIdTMDB = await nonExistingId('movie');
      console.log(validNonexistingIdTMDB);
      await api
        .get(`/api/v1.0/movies/${validNonexistingIdTMDB}`)
        .expect(404);
    });
  });
});

describe('when there are not movies in db', () => {
  beforeAll(async () => {
    await Movie.deleteMany({});
  });
  it('return the number of movies and data according to the result', async () => {
    const response = await api.get('/api/v1.0/movies').expect(200).expect('Content-Type', /application\/json/);
    expect(response.body.results).toHaveLength(0);
  });
});

afterAll(async () => {
  await dbDisconnect();
  console.log('Disconected from MongoDB');
});
