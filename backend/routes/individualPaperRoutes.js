const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Teacher = require('../models/Teacher');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_a_secret';

// --- Auth Middleware ---
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

// --- Check if all teachers have submitted ---
router.get('/can-generate', auth, async (req, res) => {
  const teachers = await Teacher.find({});
  if (teachers.length === 0) return res.json({ canGenerate: false, reason: 'No teachers registered' });
  const all = teachers.every(t => t.hasSubmitted);
  res.json({ canGenerate: all });
});

router.get('/generate-individual-paper', auth, async (req, res) => {
  const teacher = await Teacher.findOne({ teacherID: req.user.teacherID });
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  // ✅ Only get this teacher’s own questions
  const allQuestions = await Question.find({ teacherID: teacher.teacherID });

  if (allQuestions.length === 0)
    return res.status(400).json({ message: `No questions found for ${teacher.teacherID}` });

  // Helper: pick random items
  function getRandomItems(arr, count) {
    const shuffled = arr.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  // Separate questions by marks
  const twoMarkQs = allQuestions.filter(q => q.marks === 2);
  const threeMarkQs = allQuestions.filter(q => q.marks === 3);
  const fiveMarkQs = allQuestions.filter(q => q.marks === 5);

  // --- Group A (10 × 2 marks) ---
  const sectionA = getRandomItems(twoMarkQs, Math.min(10, twoMarkQs.length));

  // --- Group B (3 questions = 5 + 3 + 2) ---
  const usedFivesB = getRandomItems(fiveMarkQs, 3);
  const usedThreesB = getRandomItems(threeMarkQs, 3);
  const remainingTwos = twoMarkQs.filter(q => !sectionA.includes(q));
  const usedTwosB = getRandomItems(remainingTwos, 3);

  const sectionB = [];
  for (let i = 0; i < 3; i++) {
    const group = [usedFivesB[i], usedThreesB[i], usedTwosB[i]].filter(Boolean);
    if (group.length === 3) sectionB.push(group);
  }

  // --- Group C (3 questions = 5 + 5) ---
  const remainingFives = fiveMarkQs.filter(q => !usedFivesB.includes(q));
  const usedFivesC = getRandomItems(remainingFives, 6);
  const sectionC = [];
  for (let i = 0; i < 3; i++) {
    const group = [usedFivesC[i * 2], usedFivesC[i * 2 + 1]].filter(Boolean);
    if (group.length === 2) sectionC.push(group);
  }

  // --- HTML Output ---
  let html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>${teacher.subject} Question Paper</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: #fff;
        color: #111;
        margin: 40px;
        line-height: 1.6;
      }
      header {
        text-align: center;
        border-bottom: 2px solid #000;
        padding-bottom: 10px;
        margin-bottom: 30px;
      }
      h1 {
        font-size: 26px;
        margin: 0;
        text-transform: uppercase;
      }
      h2 {
        text-align: left;
        font-size: 20px;
        margin-top: 10px;
      }
      .meta {
        display: flex;
        justify-content: space-between;
        margin: 10px 0 20px 0;
        font-weight: bold;
      }
      section {
        margin-bottom: 40px;
      }
      h3 {
        text-align: center;
        border-bottom: 2px solid #000;
        padding-bottom: 5px;
        font-size: 18px;
        margin-bottom: 15px;
      }
      ol {
        padding-left: 20px;
      }
      ul {
        list-style-type: circle;
        padding-left: 25px;
      }
      li {
        margin: 8px 0;
      }
      strong {
        color: #000;
      }
      footer {
        text-align: center;
        margin-top: 60px;
        font-size: 14px;
        color: #555;
      }
    </style>
  </head>

  <body>
    <header>
      <h1>B.TECH (CSE & CSE_AI) — END SEMESTER EXAMINATION</h1>
      <h2>Subject: ${teacher.subject}</h2>
      <div class="meta">
        <span>Teacher: ${teacher.teacherID}</span>
        <span>Full Marks: 80 | Time: 3 Hours</span>
      </div>
    </header>

    <section>
      <p style="text-align: justify; font-weight: bold;">
        The figures in the right margin indicate full marks. Candidates are required to answer in their own words as far as practicable.
        Unless otherwise specified, notations/symbols have their usual meanings. Use of a non-programmable calculator is allowed.
      </p>
    </section>

    <section>
      <h3>Group A</h3>
      <div class="meta"><span>(Answer all questions)</span><span>10 × 2 = 20</span></div>
      <ol>
        ${sectionA.map(q => `
          <li><strong>[${q.co}] [${q.k}]</strong> ${q.questionText} <strong>(${q.marks}m)</strong></li>
        `).join('')}
      </ol>
    </section>

    <section>
      <h3>Group B</h3>
      <div class="meta"><span>(Answer all questions)</span><span>3 × (5 + 3 + 2) = 30</span></div>
      <ol>
        ${sectionB.map((grp, i) => `
          <li>
            <strong>Q${i + 1}: (5 + 3 + 2)</strong>
            <ul>
              ${grp.map(g => `<li><strong>[${g.co}] [${g.k}]</strong> ${g.questionText} <strong>(${g.marks}m)</strong></li>`).join('')}
            </ul>
          </li>
        `).join('')}
      </ol>
    </section>

    <section>
      <h3>Group C</h3>
      <div class="meta"><span>(Answer all questions)</span><span>3 × (5 + 5) = 30</span></div>
      <ol>
        ${sectionC.map((grp, i) => `
          <li>
            <strong>Q${i + 1}: (5 + 5)</strong>
            <ul>
              ${grp.map(g => `<li><strong>[${g.co}] [${g.k}]</strong> ${g.questionText} <strong>(${g.marks}m)</strong></li>`).join('')}
            </ul>
          </li>
        `).join('')}
      </ol>
    </section>

    <footer>
      <p>Generated for ${teacher.teacherID} — ${new Date().getFullYear()}</p>
    </footer>
  </body>
  </html>
  `;

  res.send(html);
});

module.exports = router;
