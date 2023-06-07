const request = require('supertest');
const app = require('./app-helper');
require('dotenv').config();
const moviesRouter = require('../controllers/movies');
const middleware = require('../utils/middleware');

beforeAll(async () => {
  app.use('/api/v1.0/movies', moviesRouter);
  app.use(middleware.unknownEndpoint);
  app.use(middleware.errorHandler);
});
const api = request(app);

describe('get popular movies', () => {
  const limitPage = 500;
  const pageSize = 20;
  const baseUrl = '/api/v1.0/movies/popular';
  const urlToCheck = 'movies/popular';
  it('return right data with valid queries', async () => {
    const page = 1;
    const response = await api.get(`${baseUrl}?page=${page}`).expect(200).expect('Content-Type', /application\/json/);
    const pageSecond = limitPage < response.body.total_pages
      ? limitPage : response.body.total_pages;
    const secondResponse = await api.get(`${baseUrl}?page=${pageSecond}`).expect(200);

    expect(response.body.results).toBeDefined();
    expect(response.body.page).toBeDefined();
    expect(response.body.page_size).toBeDefined();
    expect(response.body.prev_page).toBeDefined();
    expect(response.body.next_page).toBeDefined();
    expect(response.body.total_pages).toBeDefined();
    expect(response.body.total_results).toBeDefined();

    expect(Array.isArray(response.body.results)).toBeTruthy();
    expect(response.body.total_results)
      .toBeLessThanOrEqual(response.body.total_pages * response.body.page_size);
    expect(response.body.total_results)
      .toBeGreaterThan((response.body.total_pages * response.body.page_size) - 20);

    expect(response.body.page_size).toBe(pageSize);
    expect(response.body.total_pages <= limitPage).toBeTruthy();

    // Right prev or next page - bottom limit
    expect(response.body.prev_page).toContain('');
    expect(response.body.next_page).toContain(`${urlToCheck}?page=${page + 1}`);

    // Right prev or next page - top limit
    expect(secondResponse.body.prev_page).toContain(`${urlToCheck}?page=${pageSecond - 1}`);
    expect(secondResponse.body.next_page).toContain('');
  });

  it('set default page to 1', async () => {
    const response = await api.get(`${baseUrl}`).expect(200);
    expect(response.body.page).toBe(1);
  });

  it('fails with status code 400 and array of errors if page is not valid', async () => {
    const page = 'one';
    const response = await api.get(`${baseUrl}?page=${page}`).expect(400);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors.length).toBeGreaterThan(0);
  });
});

describe('get latest movies', () => {
  const limitPage = 500;
  const pageSize = 20;
  const baseUrl = '/api/v1.0/movies/latest';
  const urlToCheck = 'movies/latest';

  it('return right data with valid queries', async () => {
    const page = 1;

    const response = await api.get(`${baseUrl}?page=${page}`).expect(200).expect('Content-Type', /application\/json/);
    const pageSecond = limitPage < response.body.total_pages
      ? limitPage : response.body.total_pages;
    const secondResponse = await api.get(`${baseUrl}?page=${pageSecond}`).expect(200);

    expect(response.body.results).toBeDefined();
    expect(response.body.page).toBeDefined();
    expect(response.body.page_size).toBeDefined();
    expect(response.body.prev_page).toBeDefined();
    expect(response.body.next_page).toBeDefined();
    expect(response.body.total_pages).toBeDefined();
    expect(response.body.total_results).toBeDefined();

    expect(Array.isArray(response.body.results)).toBeTruthy();
    expect(response.body.total_results)
      .toBeLessThanOrEqual(response.body.total_pages * response.body.page_size);

    expect(response.body.total_results)
      .toBeGreaterThan((response.body.total_pages * response.body.page_size) - 20);

    expect(response.body.page_size).toBe(pageSize);
    expect(response.body.total_pages <= limitPage).toBeTruthy();

    // Right prev or next page - bottom limit
    expect(response.body.prev_page).toContain('');
    expect(response.body.next_page).toContain(`${urlToCheck}?page=${page + 1}`);

    // Right prev or next page - top limit
    expect(secondResponse.body.prev_page).toContain(`${urlToCheck}?page=${pageSecond - 1}`);
    expect(secondResponse.body.next_page).toContain('');
  });

  it('set default page to 1', async () => {
    const response = await api.get(`${baseUrl}`).expect(200);
    expect(response.body.page).toBe(1);
  });

  it('fails with status code 400 and array of errors if page is not valid', async () => {
    const page = 'one';
    const response = await api.get(`${baseUrl}?page=${page}`).expect(400);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors.length).toBeGreaterThan(0);
  });
});

describe('get trending movies', () => {
  const limitPage = 1000;
  const pageSize = 20;
  const baseUrl = '/api/v1.0/movies/trending';
  const urlToCheck = 'movies/trending';

  it('return right data with valid queries', async () => {
    const page = 1;

    const response = await api.get(`${baseUrl}?page=${page}`).expect(200).expect('Content-Type', /application\/json/);
    const pageSecond = limitPage < response.body.total_pages
      ? limitPage : response.body.total_pages;

    const secondResponse = await api.get(`${baseUrl}?page=${pageSecond}`).expect(200);

    expect(response.body.results).toBeDefined();
    expect(response.body.page).toBeDefined();
    expect(response.body.page_size).toBeDefined();
    expect(response.body.prev_page).toBeDefined();
    expect(response.body.next_page).toBeDefined();
    expect(response.body.total_pages).toBeDefined();
    expect(response.body.total_results).toBeDefined();

    expect(Array.isArray(response.body.results)).toBeTruthy();
    expect(response.body.total_results)
      .toBeLessThanOrEqual(response.body.total_pages * response.body.page_size);

    expect(response.body.total_results)
      .toBeGreaterThan((response.body.total_pages * response.body.page_size) - 20);

    expect(response.body.page_size).toBe(pageSize);
    expect(response.body.total_pages <= limitPage).toBeTruthy();

    // Right prev or next page - bottom limit
    expect(response.body.prev_page).toContain('');
    expect(response.body.next_page).toContain(`${urlToCheck}?page=${page + 1}`);

    // Right prev or next page - top limit
    expect(secondResponse.body.prev_page).toContain(`${urlToCheck}?page=${pageSecond - 1}`);
    expect(secondResponse.body.next_page).toContain('');
  });

  it('set default page to 1', async () => {
    const response = await api.get(`${baseUrl}`).expect(200);
    expect(response.body.page).toBe(1);
  });

  it('fails with status code 400 and array of errors if page is not valid', async () => {
    const page = 'one';
    const response = await api.get(`${baseUrl}?page=${page}`).expect(400);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors.length).toBeGreaterThan(0);
  });
});

describe('get movies by genre', () => {
  const limitPage = 500;
  const pageSize = 20;
  const baseUrl = '/api/v1.0/movies/genre';
  const urlToCheck = 'movies/genre';

  it('return right data with valid queries', async () => {
    const page = 1;
    const genres = '28,27';

    const response = await api.get(`${baseUrl}?page=${page}&genres=${genres}`).expect(200).expect('Content-Type', /application\/json/);

    const pageSecond = limitPage < response.body.total_pages
      ? limitPage : response.body.total_pages;

    const secondResponse = await api.get(`${baseUrl}?page=${pageSecond}&genres=${genres}`).expect(200);

    expect(response.body.results).toBeDefined();
    expect(response.body.page).toBeDefined();
    expect(response.body.page_size).toBeDefined();
    expect(response.body.prev_page).toBeDefined();
    expect(response.body.next_page).toBeDefined();
    expect(response.body.total_pages).toBeDefined();
    expect(response.body.total_results).toBeDefined();

    expect(Array.isArray(response.body.results)).toBeTruthy();
    expect(response.body.total_results)
      .toBeLessThanOrEqual(response.body.total_pages * response.body.page_size);

    expect(response.body.total_results)
      .toBeGreaterThan((response.body.total_pages * response.body.page_size) - 20);

    expect(response.body.page_size).toBe(pageSize);
    expect(response.body.total_pages <= limitPage).toBeTruthy();

    // Right prev or next page - bottom limit
    expect(response.body.prev_page).toContain('');
    expect(response.body.next_page).toContain(`${urlToCheck}?genres=${genres}&page=${page + 1}`);

    // Right prev or next page - top limit
    expect(secondResponse.body.prev_page).toContain(`${urlToCheck}?genres=${genres}&page=${pageSecond - 1}`);
    expect(secondResponse.body.next_page).toContain('');
  });

  it('set default page to 1', async () => {
    const genres = '28,27';
    const response = await api.get(`${baseUrl}?genres=${genres}`).expect(200);
    expect(response.body.page).toBe(1);
  });

  it('fails with status code 400 and array of errors if page or genres are not valid', async () => {
    const page = 'one';
    const genres = 'no valid genre';
    const response = await api.get(`${baseUrl}?page=${page}&genres=${genres}`).expect(400);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  it('fails with status code 400 and array of errors if genres is not defined', async () => {
    const response = await api.get(`${baseUrl}`).expect(400);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors.length).toBeGreaterThan(0);
  });
});

describe('get movies by search query', () => {
  const limitPage = 1000;
  const pageSize = 20;
  const baseUrl = '/api/v1.0/movies/search';
  const urlToCheck = 'movies/search';

  it('return right data with valid queries', async () => {
    const page = 1;
    const query = encodeURIComponent('mario');

    const response = await api.get(`${baseUrl}?page=${page}&query=${query}`).expect(200).expect('Content-Type', /application\/json/);

    const pageSecond = limitPage < response.body.total_pages
      ? limitPage : response.body.total_pages;

    const secondResponse = await api.get(`${baseUrl}?page=${pageSecond}&query=${query}`).expect(200);

    expect(response.body.query).toBeDefined();
    expect(response.body.results).toBeDefined();
    expect(response.body.page).toBeDefined();
    expect(response.body.page_size).toBeDefined();
    expect(response.body.prev_page).toBeDefined();
    expect(response.body.next_page).toBeDefined();
    expect(response.body.total_pages).toBeDefined();
    expect(response.body.total_results).toBeDefined();

    expect(Array.isArray(response.body.results)).toBeTruthy();
    expect(response.body.total_results)
      .toBeLessThanOrEqual(response.body.total_pages * response.body.page_size);

    expect(response.body.total_results)
      .toBeGreaterThan((response.body.total_pages * response.body.page_size) - 20);

    expect(response.body.page_size).toBe(pageSize);
    expect(response.body.total_pages <= limitPage).toBeTruthy();

    // Right prev or next page - bottom limit
    expect(response.body.prev_page).toContain('');
    expect(response.body.next_page).toContain(`${urlToCheck}?query=${query}&page=${page + 1}`);

    // Right prev or next page - top limit
    expect(secondResponse.body.prev_page).toContain(`${urlToCheck}?query=${query}&page=${pageSecond - 1}`);
    expect(secondResponse.body.next_page).toContain('');
  });

  it('set default page to 1', async () => {
    const query = encodeURIComponent('mario');
    const response = await api.get(`${baseUrl}?query=${query}`).expect(200);
    expect(response.body.page).toBe(1);
  });

  it('right handle of encoded query', async () => {
    const page = 2;
    const query = encodeURIComponent('The flash');

    const response = await api.get(`${baseUrl}?page=${page}&query=${query}`).expect(200).expect('Content-Type', /application\/json/);

    // The query is returned decoded
    expect(response.body.query).toBe(decodeURIComponent(query));

    // The prev and next pages are returned with the query enconded
    expect(response.body.next_page).toContain(`${urlToCheck}?query=${query}&page=${page + 1}`);
    expect(response.body.prev_page).toContain(`${urlToCheck}?query=${query}&page=${page - 1}`);
  });

  it('return right data when query is empty', async () => {
    const page = 1;
    const query = '';

    const response = await api.get(`${baseUrl}?page=${page}&query=${query}`).expect(200).expect('Content-Type', /application\/json/);
    expect(response.body).toMatchObject({
      page_size: 20,
      prev_page: '',
      next_page: '',
      page,
      results: [],
      total_results: 0,
      total_pages: 0,
      query: '',
    });
  });

  it('fails with status code 400 and array of errors if page is not valid', async () => {
    const page = 'one';
    const query = encodeURIComponent('mario');
    const response = await api.get(`${baseUrl}?page=${page}&query=${query}`).expect(400);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors.length).toBeGreaterThan(0);
  });
});
