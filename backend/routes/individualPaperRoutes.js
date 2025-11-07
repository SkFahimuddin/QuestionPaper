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



// --- SECTION A: 10 random 2-mark questions ---
const sectionA = getRandomItems(twoMarkQs, 10);

// --- SECTION B: 3 questions (each 5+3+2 marks) ---


  const usedTwos = [...sectionA];
  const remainingTwos = twoMarkQs.filter(q => !usedTwos.includes(q));

  const usedFivesB = getRandomItems(fiveMarkQs, 3);
  const usedThreesB = getRandomItems(threeMarkQs, 3);
  const usedTwosB = getRandomItems(remainingTwos, 3);

  const sectionB = [];
  for (let i = 0; i < 3; i++) {
    // ✅ Push whatever exists (don’t skip if missing)
    const group = [usedFivesB[i], usedThreesB[i], usedTwosB[i]].filter(Boolean);
    if (group.length > 0) sectionB.push(group);
  }


// --- SECTION C: 3 questions (each 5+5 marks) ---
const remainingFives = fiveMarkQs.filter(q =>
  !sectionB.flat().includes(q)
);

const pairsCount = Math.min(Math.floor(remainingFives.length / 2) || 0, 3);
const sectionC = [];

if (pairsCount > 0) {
  for (let i = 0; i < pairsCount; i++) {
    const q1 = remainingFives[i * 2] || fiveMarkQs[i % fiveMarkQs.length];
    const q2 = remainingFives[i * 2 + 1] || fiveMarkQs[(i + 1) % fiveMarkQs.length];
    sectionC.push([q1, q2].filter(Boolean));
  }
} else {
  // fallback if not enough 5-mark questions
  const available = getRandomItems(fiveMarkQs, Math.min(fiveMarkQs.length, 3));
  for (let q of available) sectionC.push([q]);
}


  // Build a simple HTML view
  let html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Question Paper</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: #ffffffff;
        margin: 40px;
        color: #333;
      }
      header {
        text-align: center;
        margin-bottom: 40px;
        padding-bottom: 10px;
      }
      header h1 {
        font-size: 28px;
        margin: 0;
      }
      header h2 {
        text-align: left;
        font-size: 20px;
        margin-top: 5px;
        color: #000000ff;
      }
      section {
        background: #fff;
        padding: 25px 30px;
      }
      h3 {
        border-bottom: 2px solid #808080ff;
        padding-bottom: 5px;
        color: #000000ff;
        font-size: 18px;
      }
      ol {
        margin-top: 10px;
      }
      li {
        margin: 10px 0;
        line-height: 1.6;
      }
      ul {
        list-style-type: disc;
        margin-left: 25px;
      }
      strong {
        color: #444;
      }
      footer {
        text-align: center;
        margin-top: 50px;
        font-size: 14px;
        color: #666;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>B.TECH (CSE & CSE_AI), END SEMESTER EXAMINATIONS</h1>
      <h2>Subject name: ${teacher.subject} </h2>
      
      <div style="display: flex;justify-content: space-between;align-items: center;margin: 5px 20px 0 20px;font-size: 16px;color: #000;font-weight: 600;">
        <span>Full Marks: 80</span>
        <span>Time Allotted: 3hrs</span>
      </div>

    </header>
    <section style="border-top: 3px solid black;border-bottom: 3px solid black;">
      <p style="margin-right: 10em;margin-left: 10em;text-align: center; font-weight: bolder;">The figures in the right margin indicate full marks. Time Alottcd: 3 hours Candidates are required to give their answer in their own words as far as applicable. Unless otherwise specified, the notations / symbols have their usual meanings. Use of non-programmable calculator is allowed. </p>
    </section>

    <section>
      <h3 style="text-align: center;">Group A</h3>
      <div style="display: flex;justify-content: space-between;align-items: center;margin: 5px 20px 0 20px;font-size: 16px;color: #000;font-weight: 600;">
        <span style="font-weight: bold;">(Answer all questions )</span>
        <span style="font-weight: bold;font-size:large" >10*2=20</span>
      </div>
      <ol>
        ${sectionA.map(q => `
          <li> <strong>[${q.co}] [${q.k}] </strong> ${q.questionText} <strong>(${q.marks}m)</strong></li>
        `).join('')}
      </ol>
    </section>

    <section>
      <h3 style="text-align: center;">Group B</h3>
      <div style="display: flex;justify-content: space-between;align-items: center;margin: 5px 20px 0 20px;font-size: 16px;color: #000;font-weight: 600;">
        <span style="font-weight: bold;">(Answer all questions )</span>
        <span style="font-weight: bold;font-size:large">10*3=30</span>
      </div>
      <ol>
        ${sectionB.map((grp, i) => `
          <li>
            <strong style="display: flex;justify-content: space-between;align-items: center;margin: 5px 20px 0 20px;">Q${i + 1}: <span>5+3+2</span> </strong>
            <ul>
              ${grp.map(g => `<li><strong>[${g.co}][${g.k}]</strong> ${g.questionText} <strong>(${g.marks}m)</strong> </li>`).join('')}
            </ul>
          </li>
        `).join('')}
      </ol>
    </section>

    <section>
      <h3 style="text-align: center;">Group C</h3>
      <div style="display: flex;justify-content: space-between;align-items: center;margin: 5px 20px 0 20px;font-size: 16px;color: #000;font-weight: 600;">
        <span style="font-weight: bold;">(Answer all questions )</span>
        <span style="font-weight: bold;font-size:large">10*3=30</span>
      </div>
      <ol>
        ${sectionC.map((grp, i) => `
          <li>
            <strong style="display: flex;justify-content: space-between;align-items: center;margin: 5px 20px 0 20px;">Q${i + 1}: <span>5+5</span></strong>
            <ul>
              ${grp.map(g => `<li><strong>[${g.co}][${g.k}]</strong>${g.questionText} <strong>(${g.marks}m)</strong> </li>`).join('')}
            </ul>
          </li>
        `).join('')}
      </ol>
    </section>

    <footer>
      <p>Generated by Question Paper System © ${new Date().getFullYear()}</p>
    </footer>
  </body>
  </html>
  `;

  res.send(html);
});

module.exports = router;