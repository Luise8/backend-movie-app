const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  title: {
    type: String, required: true, minlength: 12, maxlength: 175,
  },
  body: {
    type: String, required: true, minlength: 400, maxlength: 10000,
  },
  date: { type: Date, required: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  movieId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true,
  },
});

reviewSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

module.exports = mongoose.model('Review', reviewSchema);
