require('dotenv').config();
const genresTMDB = require('./movie-genres-TMDB');

const { PORT } = process.env;
const URL_FIND_ONE_MOVIE = (movieIdTMDB) => {
  const baseurl = process.env.BASE_URL_TMDB;
  const apiKey = process.env.API_KEY;
  return `${baseurl}/movie/${movieIdTMDB}?api_key=${apiKey}&language=en-US&include_adult=false`;
};

const URL_FIND_MOVIE_DETAILS = (movieIdTMDB) => {
  const baseurl = process.env.BASE_URL_TMDB;
  const apiKey = process.env.API_KEY;
  return `${baseurl}/movie/${movieIdTMDB}?language=en-US&page=1&api_key=${apiKey}&append_to_response=similar,videos,images&include_image_language=en,null`;
};

const URL_FIND_MOVIES_BY_GENRE = ({ genres, page }) => {
  const baseurl = process.env.BASE_URL_TMDB;
  const apiKey = process.env.API_KEY;
  return `${baseurl}/discover/movie?api_key=${apiKey}&include_adult=false&include_video=false&language=en-US&page=${page || 1}&sort_by=popularity.desc&with_genres=${genres}`;
};

const URL_POPULAR_MOVIES = (page) => {
  const baseurl = process.env.BASE_URL_TMDB;
  const apiKey = process.env.API_KEY;
  return `${baseurl}/movie/popular?api_key=${apiKey}&language=en-US&page=${page || 1}`;
};

const URL_LATEST_MOVIES = (page) => {
  const baseurl = process.env.BASE_URL_TMDB;
  const apiKey = process.env.API_KEY;
  return `${baseurl}/movie/now_playing?api_key=${apiKey}&language=en-US&page=${page || 1}`;
};

const URL_TRENDING_MOVIES = (page) => {
  const baseurl = process.env.BASE_URL_TMDB;
  const apiKey = process.env.API_KEY;
  return `${baseurl}/trending/movie/day?api_key=${apiKey}&language=en-US&page=${page || 1}`;
};

const URL_SEARCH_MOVIES = ({ query, page }) => {
  const baseurl = process.env.BASE_URL_TMDB;
  const apiKey = process.env.API_KEY;
  return `${baseurl}/search/movie?api_key=${apiKey}&include_adult=false&language=en-US&query=${query}&page=${page || 1}`;
};

const MONGODB_URI = process.env.NODE_ENV === 'development'
  ? process.env.DEV_MONGODB_URI
  : process.env.MONGODB_URI;

module.exports = {
  MONGODB_URI,
  PORT,
  URL_FIND_ONE_MOVIE,
  URL_FIND_MOVIE_DETAILS,
  URL_FIND_MOVIES_BY_GENRE,
  URL_POPULAR_MOVIES,
  URL_LATEST_MOVIES,
  URL_TRENDING_MOVIES,
  URL_SEARCH_MOVIES,
};
