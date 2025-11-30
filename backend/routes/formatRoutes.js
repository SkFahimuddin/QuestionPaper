const express = require('express');
const router = express.Router();
const PaperFormat = require('../models/PaperFormat');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_a_secret';

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'Unauthorized' });
  const token = header.split(' ')[1];
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Create new format
router.post('/create', auth, async (req, res) => {
  try {
    const { name, subject, totalMarks, duration, sections, isShared } = req.body;
    
    const format = new PaperFormat({
      name,
      subject,
      createdBy: req.user.teacherID,
      totalMarks,
      duration,
      sections,
      isShared: isShared || false
    });

    await format.save();
    res.json({ message: 'Format created successfully', formatId: format._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating format', error: err.message });
  }
});

// Get formats for a subject (own + shared)
router.get('/list', auth, async (req, res) => {
  try {
    const { subject } = req.query;
    
    if (!subject) {
      return res.status(400).json({ message: 'Subject is required' });
    }

    const formats = await PaperFormat.find({
      subject,
      $or: [
        { createdBy: req.user.teacherID },
        { isShared: true }
      ]
    }).sort({ createdAt: -1 });

    res.json({ formats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching formats' });
  }
});

// Get format by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const format = await PaperFormat.findById(req.params.id);
    
    if (!format) {
      return res.status(404).json({ message: 'Format not found' });
    }

    res.json({ format });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching format' });
  }
});

// Update format
router.put('/:id', auth, async (req, res) => {
  try {
    const format = await PaperFormat.findById(req.params.id);
    
    if (!format) {
      return res.status(404).json({ message: 'Format not found' });
    }

    if (format.createdBy !== req.user.teacherID) {
      return res.status(403).json({ message: 'Not authorized to update this format' });
    }

    const { name, totalMarks, duration, sections, isShared } = req.body;
    
    format.name = name || format.name;
    format.totalMarks = totalMarks || format.totalMarks;
    format.duration = duration || format.duration;
    format.sections = sections || format.sections;
    format.isShared = isShared !== undefined ? isShared : format.isShared;

    await format.save();
    res.json({ message: 'Format updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating format' });
  }
});

// Delete format
router.delete('/:id', auth, async (req, res) => {
  try {
    const format = await PaperFormat.findById(req.params.id);
    
    if (!format) {
      return res.status(404).json({ message: 'Format not found' });
    }

    if (format.createdBy !== req.user.teacherID) {
      return res.status(403).json({ message: 'Not authorized to delete this format' });
    }

    await PaperFormat.findByIdAndDelete(req.params.id);
    res.json({ message: 'Format deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting format' });
  }
});

module.exports = router;