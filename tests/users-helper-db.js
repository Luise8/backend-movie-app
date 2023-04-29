const mongoose = require('mongoose');

function generateUserId(length) {
  const usersId = [];
  // const initialId = '6418e218c4aeca730255a0';
  for (let i = 0; i < length; i += 1) {
    usersId.push(new mongoose.Types.ObjectId().toString());
  }
  return usersId;
}
module.exports = {
  generateUserId,
};
