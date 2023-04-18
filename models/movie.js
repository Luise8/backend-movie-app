const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  name: { type: String, required: true },
  photo: String,
  description: { type: String, required: true },
  date: { type: Date, required: true },
  idTMDB: {
    type: String, required: true,
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
  reviewList: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReviewList',
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
