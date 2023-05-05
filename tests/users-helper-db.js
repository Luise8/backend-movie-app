const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/user');

function generateUserId(length) {
  const usersId = [];
  // const initialId = '6418e218c4aeca730255a0';
  for (let i = 0; i < length; i += 1) {
    usersId.push(new mongoose.Types.ObjectId().toString());
  }
  return usersId;
}

// USERS 13
const thirteenUsersId = [
  '64501354c41b5db06e01c5a4',
  '64501354c41b5db06e01c5a5',
  '64501354c41b5db06e01c5a6',
  '64501354c41b5db06e01c5a7',
  '64501354c41b5db06e01c5a8',
  '64501354c41b5db06e01c5a9',
  '64501354c41b5db06e01c5aa',
  '64501354c41b5db06e01c5ab',
  '64501354c41b5db06e01c5ac',
  '64501354c41b5db06e01c5ad',
  '64501354c41b5db06e01c5ae',
  '64501354c41b5db06e01c5af',
  '64501354c41b5db06e01c5b0',
];
function createThirteenUsers() {
  const users = [];
  for (let i = 0; i < thirteenUsersId.length; i += 1) {
    users.push(
      {
        _id: thirteenUsersId[i],
        username: `userNumber${i}`,
        photo: '',
        bio: '',
        date: new Date().toISOString(),
        passwordHash: bcrypt.hashSync(`userNumber${i}`, Number(process.env.saltRounds)),
        watchlist: new mongoose.Types.ObjectId().toString(),
      },
    );
  }
  return users;
}

const initialUsers = createThirteenUsers();

async function addInitialUsers() {
  await User.deleteMany({});

  const userObjects = initialUsers.map((user) => new User(user));
  const promiseArray = userObjects.map((user) => user.save());
  await Promise.all(promiseArray);
  console.log('Added users');
}

module.exports = {
  generateUserId,
  initialUsers,
  addInitialUsers,
};
