const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Teacher = require('../models/Teacher');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_a_secret';

function auth(req, res, next){
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

// Get all unique subjects for a teacher
router.get('/subjects', auth, async (req, res) => {
  try {
    const subjects = await Question.distinct('subject', { teacherID: req.user.teacherID });
    res.json({ subjects });
  } catch(err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// submit a question
router.post('/submit', auth, async (req, res) => {
  try {
    const { questionText, marks, co, k, module, subject } = req.body;

    if (!questionText || !marks || !co || !subject) {
      return res.status(400).json({ message: 'Missing fields' });
    }

    // Automatically assign section based on marks
    let section = '';
    if (marks == 2) section = 'A';
    if (marks==2||marks == 3 || marks == 5) section = 'B';
    if(marks ==5) section = 'C';

    const q = new Question({
      teacherID: req.user.teacherID,
      questionText,
      marks,
      co,
      k,
      module,
      section,
      subject,
    });

    await q.save();
    res.json({ message: 'Question saved successfully', section });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// fetch questions for logged-in teacher (filtered by subject)
router.get('/my', auth, async (req, res) => {
  const { subject } = req.query;
  
  if (!subject) {
    return res.status(400).json({ message: 'Subject is required' });
  }

  const qs = await Question.find({
    teacherID: req.user.teacherID,
    subject: subject,
  });
  res.json(qs);
});

// admin: get all questions for a subject
router.get('/all', auth, async (req, res) => {
  const { subject } = req.query;
  
  if (!subject) {
    return res.status(400).json({ message: 'Subject is required' });
  }

  const qs = await Question.find({ subject });
  res.json(qs);
});

module.exports = router;