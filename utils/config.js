require('dotenv').config();

const { PORT } = process.env;
const URL_FIND_ONE_MOVIE = (movieIdTMDB) => {
  const baseurl = 'https://api.themoviedb.org/3/movie/';
  const apiKey = process.env.API_KEY;
  return `${baseurl}${movieIdTMDB}?api_key=${apiKey}&language=en-US&page=1&include_adult=false`;
};
const MONGODB_URI = process.env.NODE_ENV === 'development'
  ? process.env.DEV_MONGODB_URI
  : process.env.MONGODB_URI;

module.exports = {
  MONGODB_URI,
  PORT,
  URL_FIND_ONE_MOVIE,
};
