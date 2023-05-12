const mongoose = require('mongoose');

const profilePhotoSchema = new mongoose.Schema({
  image: {
    data: Buffer, contentType: String,
  },
});

module.exports = mongoose.model('ProfilePhoto', profilePhotoSchema);
