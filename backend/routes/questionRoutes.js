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

// submit a question
router.post('/submit', auth, async (req, res) => {
  try {
    const { questionText, marks, co, k , module} = req.body; // ✅ now using CO instead of section

    if (!questionText || !marks || !co) {
      return res.status(400).json({ message: 'Missing fields' });
    }

    // ✅ Automatically assign section based on marks
    let section = '';
    if (marks == 2) section = 'A';
    if (marks==2||marks == 3 || marks == 5) section = 'B';
    if(marks ==5) section = 'C'; // default fallback if marks don’t match any rule

    const teacher = await Teacher.findOne({ teacherID: req.user.teacherID });
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // ✅ Create and save question
    const q = new Question({
      teacherID: req.user.teacherID,
      questionText,
      marks,
      co,       // ✅ include CO
      k,
      module,
      section,  // ✅ assigned automatically
      subject: teacher.subject,
    });

    await q.save();

    // ✅ Mark teacher as having submitted
    await Teacher.updateOne(
      { teacherID: req.user.teacherID },
      { hasSubmitted: true }
    );

    res.json({ message: 'Question saved successfully', section });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// fetch questions for logged-in teacher
router.get('/my', auth, async (req, res) => {
  const teacher = await Teacher.findOne({ teacherID: req.user.teacherID });
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  const qs = await Question.find({
    teacherID: req.user.teacherID,
    subject: teacher.subject, // ✅ Only fetch their subject questions
  });
  res.json(qs);
});

// admin: get all questions
router.get('/all', auth, async (req, res) => {
 const teacher = await Teacher.findOne({ teacherID: req.user.teacherID });
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  const qs = await Question.find({ subject: teacher.subject });
  res.json(qs);
});

module.exports = router;