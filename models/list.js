const mongoose = require('mongoose');

const listSchema = new mongoose.Schema({
  name: {
    type: String, required: true, minlength: 12, maxlength: 175,
  },
  description: { type: String, maxlength: 300 },
  date: { type: Date, required: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  movies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
  }],
});

listSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

module.exports = mongoose.model('List', listSchema);
