function takeMovieDataArray(arrayResponse) {
  return arrayResponse.map((movie) => {
    const movieRefined = {
      name: movie.title,
      photo: movie.poster_path ? `https://image.tmdb.org/t/p/w185/${movie.poster_path}` : '',
      description: movie.overview,
      date: new Date(),
      release_date: movie.release_date,
      idTMDB: movie.id,
    };
    return movieRefined;
  });
}
function takeMovieData(response) {
  const movieRefined = {
    name: response.title,
    photo: response.poster_path ? `https://image.tmdb.org/t/p/w185/${response.poster_path}` : '',
    description: response.overview,
    date: new Date(),
    release_date: response.release_date,
    idTMDB: response.id,
  };
  return movieRefined;
}

module.exports = {
  takeMovieData,
};
