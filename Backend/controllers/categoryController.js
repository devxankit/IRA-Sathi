const Category = require('../models/Category');

// Get all categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ label: 1 });
    
    // Fallback: If DB is empty, maybe return the old hardcoded ones and seed them
    if (categories.length === 0) {
      const { FERTILIZER_CATEGORIES } = require('../utils/fertilizerCategories');
      // Seed them
      await Category.insertMany(FERTILIZER_CATEGORIES.map(c => ({
        id: c.id,
        label: c.label,
        description: c.description || ''
      })));
      const newCategories = await Category.find({}).sort({ label: 1 });
      return res.status(200).json({ success: true, data: newCategories });
    }

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error in getCategories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
};

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    const { label, description } = req.body;

    if (!label) {
      return res.status(400).json({
        success: false,
        message: 'Category label is required',
      });
    }

    // Generate an ID (e.g. "Micro Nutrients" -> "micro-nutrients")
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    // Check if exists
    const existing = await Category.findOne({ id });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists',
      });
    }

    const category = await Category.create({
      id,
      label,
      description: description || ''
    });

    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully'
    });
  } catch (error) {
    console.error('Error in createCategory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error.message
    });
  }
};
