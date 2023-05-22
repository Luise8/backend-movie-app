const mongoose = require('mongoose');

const listSchema = new mongoose.Schema({
  name: {
    type: String, required: true, minlength: 12, maxlength: 175,
  },
  description: { type: String, maxlength: 300 },
  date: { type: Date, required: true, immutable: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true,
  },
  movies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
  }],
});

listSchema.pre('validate', function (next) {
  if (this.movies.length > 100) {
    throw new Error('The maximum size of list is 100 movies');
  }
  next();
});

listSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

module.exports = mongoose.model('List', listSchema);
