const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 213,
  },
  photo: { type: String, maxlength: 300 },
  description: { type: String, required: true, maxlength: 1000 },
  date: { type: Date, required: true },
  release_date: {
    type: String,
    maxlength: 10,
  },
  idTMDB: {
    type: String, required: true, minlength: 1, maxlength: 20,
  },
  rateCount: {
    type: Number, default: 0,
  },
  rateValue: {
    type: Number, default: 0,
  },
  rateAverage: {
    type: Number, default: 0,
  },
});

movieSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

module.exports = mongoose.model('Movie', movieSchema);
