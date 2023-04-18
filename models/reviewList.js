const mongoose = require('mongoose');

const reviewListSchema = new mongoose.Schema({
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reviews',
  }],
  movie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
  },
});

reviewListSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

module.exports = mongoose.model('ReviewList', reviewListSchema);
