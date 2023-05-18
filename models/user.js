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
  photo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProfilePhoto',
    required: true,
    immutable: true,
  },
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

userSchema.post(['find', 'findOne', 'findOneAndUpdate'], function (res) {
  if (!this.mongooseOptions().lean) {
    return;
  }
  if (Array.isArray(res)) {
    res.forEach(transformDoc);
    return;
  }
  transformDoc(res);
});

function transformDoc(doc) {
  if (doc === null) {
    return null;
  }
  if (doc._id != null) {
    doc.id = doc._id.toString();
    delete doc._id;
  }
  delete doc.__v;
  delete doc.passwordHash;

  for (const key of Object.keys(doc)) {
    if (doc[key] !== null && doc[key].constructor.name === 'Object') {
      transformDoc(doc[key]);
    } else if (Array.isArray(doc[key])) {
      for (const el of doc[key]) {
        if (el != null && el.constructor.name === 'Object') {
          transformDoc(el);
        }
      }
    }
  }
}

const User = mongoose.model('User', userSchema);

module.exports = User;
