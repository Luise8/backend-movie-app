const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

const userSchema = mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 5,
    maxlength: 20,
  },
  photo: { type: String, maxlength: 300 },
  bio: {
    type: String,
    maxlength: 300,
  },
  date: {
    type: Date,
    required: true,
    immutable: true,
  },
  passwordHash: String,
  lists: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'List',

    },
  ],
  watchlist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Watchlist',
    required: true,
    immutable: true,
  },
});

userSchema.plugin(uniqueValidator, { message: 'User validation failed, the username `{VALUE}` is taken' });

userSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    // the passwordHash should not be revealed
    delete returnedObject.passwordHash;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
