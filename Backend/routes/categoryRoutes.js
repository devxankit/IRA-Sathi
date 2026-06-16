const express = require('express');
const router = express.Router();
const { getCategories, createCategory } = require('../controllers/categoryController');
const { authorizeAdmin } = require('../middleware/auth');

// Public or logged-in users might need to view categories, but let's just make it public to fetch
router.get('/', getCategories);

// Only admins can create categories
router.post('/', authorizeAdmin, createCategory);

module.exports = router;
