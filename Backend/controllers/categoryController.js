const Category = require('../models/Category');
const { FERTILIZER_CATEGORIES } = require('../utils/fertilizerCategories');

// Hardcoded fallback so categories always load even when MongoDB is unreachable
const FALLBACK_CATEGORIES = FERTILIZER_CATEGORIES.map(c => ({
  id: c.id,
  label: c.name || c.label,
  description: c.description || ''
}));

// Get all categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ label: 1 });
    
    // Fallback: If DB is empty, seed with hardcoded list and return them
    if (categories.length === 0) {
      try {
        await Category.insertMany(FALLBACK_CATEGORIES);
        const newCategories = await Category.find({}).sort({ label: 1 });
        return res.status(200).json({ success: true, data: newCategories });
      } catch (seedErr) {
        // Even seeding failed (e.g. DB still unavailable) — return hardcoded fallback
        console.warn('Could not seed categories, returning hardcoded fallback:', seedErr.message);
        return res.status(200).json({ success: true, data: FALLBACK_CATEGORIES });
      }
    }

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    // MongoDB unreachable (e.g. no internet / Atlas DNS failure) — return hardcoded fallback
    console.error('Error in getCategories (returning fallback):', error.message);
    return res.status(200).json({
      success: true,
      data: FALLBACK_CATEGORIES,
      _fallback: true, // flag to indicate this came from fallback
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
