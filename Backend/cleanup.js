const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Category = require('./models/Category');
  try {
    await Category.deleteMany({ id: { $in: ['test-category', 'test-category-2', 'test-category-3'] } });
    console.log('Cleanup success');
  } catch (e) {
    console.error('Error:', e);
  }
  mongoose.disconnect();
});
