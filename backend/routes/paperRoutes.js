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

// check if enough teachers have submitted for a subject
router.get('/can-generate', auth, async (req, res) => {
  const { subject } = req.query;
  
  if (!subject) {
    return res.json({ canGenerate: false, reason: 'Subject is required' });
  }

  // Check if we have enough questions for the subject
  const questions = await Question.find({ subject });
  const twoMarkQs = questions.filter(q => q.marks === 2);
  const threeMarkQs = questions.filter(q => q.marks === 3);
  const fiveMarkQs = questions.filter(q => q.marks === 5);

  // Need: 10 (2-mark), 3 (3-mark), 9 (5-mark) = minimum
  const canGenerate = twoMarkQs.length >= 10 && threeMarkQs.length >= 3 && fiveMarkQs.length >= 9;
  
  res.json({ 
    canGenerate,
    reason: canGenerate ? null : `Not enough questions. Need: 10×2m (have ${twoMarkQs.length}), 3×3m (have ${threeMarkQs.length}), 9×5m (have ${fiveMarkQs.length})`
  });
});

// NEW: API endpoint to search for replacement questions
router.post('/search-replacements', auth, async (req, res) => {
  try {
    const { subject, module, co, k, marks } = req.body;
    
    if (!subject || !marks) {
      return res.status(400).json({ message: 'Subject and marks are required' });
    }

    const query = { subject, marks };
    if (module) query.module = module;
    if (co) query.co = co;
    if (k) query.k = k;

    const questions = await Question.find(query);
    res.json({ questions });
  } catch (err) {
    res.status(500).json({ message: 'Error searching questions', error: err.message });
  }
});

// generate paper (simple greedy selection to match format)
router.get('/generate', auth, async (req, res) => {
  const { subject } = req.query;
  
  if (!subject) {
    return res.status(400).json({ message: 'Subject is required' });
  }

  const allQuestions = await Question.find({ subject });

  if (allQuestions.length === 0) {
    return res.status(400).json({ message: `No questions found for subject: ${subject}` });
  }

  // Helper function to get random items from an array
  function getRandomItems(arr, count) {
    const shuffled = arr.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  // Separate questions by marks
  const twoMarkQs = allQuestions.filter(q => q.marks === 2);
  const fiveMarkQs = allQuestions.filter(q => q.marks === 5);

  // --- SECTION A: 10 random 2-mark questions ---
  const sectionA = getRandomItems(twoMarkQs, 10);

  // --- SECTION B: 3 questions (each 5+3+2 marks) ---
  const sectionB = [];
  const threeMarkQs = allQuestions.filter(q => q.marks === 3);
  const usedFivesB = getRandomItems(fiveMarkQs, 3);
  const usedThreesB = getRandomItems(threeMarkQs, 3);
  const remainingTwos = twoMarkQs.filter(q => !sectionA.includes(q));
  const usedTwosB = getRandomItems(remainingTwos, 3);

  for (let i = 0; i < 3; i++) {
    const group = [usedFivesB[i], usedThreesB[i], usedTwosB[i]].filter(Boolean);
    if (group.length === 3) sectionB.push(group);
  }

  // --- SECTION C: 3 questions (each 5+5 marks) ---
  const remainingFives = fiveMarkQs.filter(q => !usedFivesB.includes(q));
  const usedFivesC = getRandomItems(remainingFives, 6);
  const sectionC = [];
  for (let i = 0; i < 3; i++) {
    const group = [usedFivesC[i * 2], usedFivesC[i * 2 + 1]].filter(Boolean);
    if (group.length === 2) sectionC.push(group);
  }

  // Build HTML (same as before, but with subject parameter)
  let html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Question Paper - ${subject}</title>
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
        position: relative;
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
      .replace-btn {
        background: #007bff;
        color: white;
        border: none;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        margin-left: 10px;
      }
      .replace-btn:hover {
        background: #0056b3;
      }
      .modal {
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.5);
      }
      .modal-content {
        background-color: #fefefe;
        margin: 5% auto;
        padding: 20px;
        border: 1px solid #888;
        width: 80%;
        max-width: 800px;
        border-radius: 8px;
        max-height: 80vh;
        overflow-y: auto;
      }
      .close {
        color: #aaa;
        float: right;
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
      }
      .close:hover {
        color: #000;
      }
      .filter-form {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 6px;
        margin-bottom: 20px;
      }
      .filter-form input, .filter-form button {
        margin: 5px;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      .filter-form button {
        background: #28a745;
        color: white;
        border: none;
        cursor: pointer;
      }
      .filter-form button:hover {
        background: #218838;
      }
      .question-list {
        margin-top: 20px;
      }
      .question-item {
        background: #fff;
        border: 1px solid #ddd;
        padding: 15px;
        margin: 10px 0;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.3s;
      }
      .question-item:hover {
        background: #e7f3ff;
        border-color: #007bff;
      }
      .question-item.selected {
        background: #d4edda;
        border-color: #28a745;
      }
      .select-question-btn {
        background: #28a745;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 10px;
      }
      .select-question-btn:hover {
        background: #218838;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>B.TECH (CSE & CSE_AI), END SEMESTER EXAMINATIONS</h1>
      <h2>Subject name: ${subject}</h2>
      
      <div style="display: flex;justify-content: space-between;align-items: center;margin: 5px 20px 0 20px;font-size: 16px;color: #000;font-weight: 600;">
        <span>Full Marks: 80</span>
        <span>Time Allotted: 3hrs</span>
      </div>
    </header>

    <section style="border-top: 3px solid black;border-bottom: 3px solid black;">
      <p style="margin-right: 10em;margin-left: 10em;text-align: center; font-weight: bolder;">The figures in the right margin indicate full marks. Time Allotted: 3 hours. Candidates are required to give their answer in their own words as far as applicable. Unless otherwise specified, the notations / symbols have their usual meanings. Use of non-programmable calculator is allowed.</p>
    </section>

    <section>
      <h3 style="text-align: center;">Group A</h3>
      <div style="display: flex;justify-content: space-between;align-items: center;margin: 5px 20px 0 20px;font-size: 16px;color: #000;font-weight: 600;">
        <span style="font-weight: bold;">(Answer all questions)</span>
        <span style="font-weight: bold;font-size:large">10*2=20</span>
      </div>
      <ol>
        ${sectionA.map((q, idx) => `
          <li id="q-a-${idx}"> 
            <strong>[${q.co}] [${q.k}]</strong> 
            <span class="question-text">${q.questionText}</span> 
            <strong>(${q.marks}m)</strong>
            <button class="replace-btn" onclick="openReplaceModal('${q._id}', '${subject}', '${q.module || ''}', '${q.co}', '${q.k}', ${q.marks}, 'q-a-${idx}')">Replace</button>
          </li>
        `).join('')}
      </ol>
    </section>

    <section>
      <h3 style="text-align: center;">Group B</h3>
      <div style="display: flex;justify-content: space-between;align-items: center;margin: 5px 20px 0 20px;font-size: 16px;color: #000;font-weight: 600;">
        <span style="font-weight: bold;">(Answer all questions)</span>
        <span style="font-weight: bold;font-size:large">10*3=30</span>
      </div>
      <ol>
        ${sectionB.map((grp, i) => `
          <li>
            <strong style="display: flex;justify-content: space-between;align-items: center;margin: 5px 20px 0 20px;">Q${i + 1}: <span>5+3+2</span></strong>
            <ul>
              ${grp.map((g, gIdx) => `
                <li id="q-b-${i}-${gIdx}">
                  <strong>[${g.co}][${g.k}]</strong> 
                  <span class="question-text">${g.questionText}</span> 
                  <strong>(${g.marks}m)</strong>
                  <button class="replace-btn" onclick="openReplaceModal('${g._id}', '${subject}', '${g.module || ''}', '${g.co}', '${g.k}', ${g.marks}, 'q-b-${i}-${gIdx}')">Replace</button>
                </li>
              `).join('')}
            </ul>
          </li>
        `).join('')}
      </ol>
    </section>

    <section>
      <h3 style="text-align: center;">Group C</h3>
      <div style="display: flex;justify-content: space-between;align-items: center;margin: 5px 20px 0 20px;font-size: 16px;color: #000;font-weight: 600;">
        <span style="font-weight: bold;">(Answer all questions)</span>
        <span style="font-weight: bold;font-size:large">10*3=30</span>
      </div>
      <ol>
        ${sectionC.map((grp, i) => `
          <li>
            <strong style="display: flex;justify-content: space-between;align-items: center;margin: 5px 20px 0 20px;">Q${i + 1}: <span>5+5</span></strong>
            <ul>
              ${grp.map((g, gIdx) => `
                <li id="q-c-${i}-${gIdx}">
                  <strong>[${g.co}][${g.k}]</strong>
                  <span class="question-text">${g.questionText}</span> 
                  <strong>(${g.marks}m)</strong>
                  <button class="replace-btn" onclick="openReplaceModal('${g._id}', '${subject}', '${g.module || ''}', '${g.co}', '${g.k}', ${g.marks}, 'q-c-${i}-${gIdx}')">Replace</button>
                </li>
              `).join('')}
            </ul>
          </li>
        `).join('')}
      </ol>
    </section>

    <!-- Modal -->
    <div id="replaceModal" class="modal">
      <div class="modal-content">
        <span class="close" onclick="closeModal()">&times;</span>
        <h2>Replace Question</h2>
        
        <div class="filter-form">
          <h3>Search Criteria</h3>
          <input type="text" id="filterModule" placeholder="Module (optional)">
          <input type="text" id="filterCO" placeholder="CO (optional)">
          <input type="text" id="filterK" placeholder="K Level (optional)">
          <input type="number" id="filterMarks" placeholder="Marks" readonly>
          <button onclick="searchQuestions()">Search</button>
        </div>

        <div id="questionsList" class="question-list">
          <p>Click "Search" to find replacement questions</p>
        </div>
      </div>
    </div>

    <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
      <button onclick="generateFinalPaper()" style="
        background: #28a745;
        color: white;
        border: none;
        padding: 15px 40px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 18px;
        font-weight: bold;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        transition: all 0.3s;
      " onmouseover="this.style.background='#218838'" onmouseout="this.style.background='#28a745'">
        📄 Generate Final Question Paper
      </button>
      <p style="margin-top: 10px; color: #666; font-size: 14px;">
        Click to generate a clean version without replace buttons
      </p>
    </div>

    <footer>
      <p>Generated by Question Paper System © ${new Date().getFullYear()}</p>
    </footer>

    <script>
      let currentQuestionId = null;
      let currentElementId = null;
      let currentSubject = '${subject}';
      let selectedQuestion = null;

      function openReplaceModal(questionId, subject, module, co, k, marks, elementId) {
        currentQuestionId = questionId;
        currentElementId = elementId;
        currentSubject = subject;
        
        document.getElementById('filterModule').value = module;
        document.getElementById('filterCO').value = co;
        document.getElementById('filterK').value = k;
        document.getElementById('filterMarks').value = marks;
        
        document.getElementById('replaceModal').style.display = 'block';
        document.getElementById('questionsList').innerHTML = '<p>Click "Search" to find replacement questions</p>';
        selectedQuestion = null;
      }

      function closeModal() {
        document.getElementById('replaceModal').style.display = 'none';
        selectedQuestion = null;
      }

      async function searchQuestions() {
        const module = document.getElementById('filterModule').value;
        const co = document.getElementById('filterCO').value;
        const k = document.getElementById('filterK').value;
        const marks = document.getElementById('filterMarks').value;

        const token = localStorage.getItem('token');
        
        if (!token) {
          alert('Authentication token not found. Please login again.');
          document.getElementById('questionsList').innerHTML = '<p>Authentication required. Please refresh and login.</p>';
          return;
        }

        document.getElementById('questionsList').innerHTML = '<p>Searching...</p>';
        
        try {
          const response = await fetch('http://localhost:5000/api/paper/search-replacements', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
              subject: currentSubject,
              module: module || undefined,
              co: co || undefined,
              k: k || undefined,
              marks: parseInt(marks)
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error:', errorText);
            throw new Error('Server returned ' + response.status + ': ' + errorText);
          }

          const data = await response.json();
          
          console.log('Received questions:', data.questions?.length || 0);
          
          if (data.questions && data.questions.length > 0) {
            displayQuestions(data.questions.filter(q => q._id !== currentQuestionId));
          } else {
            document.getElementById('questionsList').innerHTML = '<p>No matching questions found</p>';
          }
        } catch (error) {
          console.error('Error details:', error);
          document.getElementById('questionsList').innerHTML = '<p>Error: ' + error.message + '</p>';
        }
      }

      function displayQuestions(questions) {
        const listDiv = document.getElementById('questionsList');
        
        if (questions.length === 0) {
          listDiv.innerHTML = '<p>No other questions found with these criteria</p>';
          return;
        }

        listDiv.innerHTML = '<h3>Select a replacement question:</h3>' + 
          questions.map(q => \`
            <div class="question-item" onclick="selectQuestion('\${q._id}', this)" data-question-id="\${q._id}">
              <strong>[CO: \${q.co}] [K: \${q.k}] [Module: \${q.module || 'N/A'}] [Marks: \${q.marks}]</strong>
              <p>\${q.questionText}</p>
            </div>
          \`).join('');
      }

      function selectQuestion(questionId, element) {
        document.querySelectorAll('.question-item').forEach(item => {
          item.classList.remove('selected');
        });
        
        element.classList.add('selected');
        
        selectedQuestion = {
          id: questionId,
          element: element
        };

        if (!element.querySelector('.select-question-btn')) {
          const btn = document.createElement('button');
          btn.className = 'select-question-btn';
          btn.textContent = 'Use This Question';
          btn.onclick = (e) => {
            e.stopPropagation();
            replaceQuestion();
          };
          element.appendChild(btn);
        }
      }

      function replaceQuestion() {
        if (!selectedQuestion) {
          alert('Please select a question first');
          return;
        }

        const targetElement = document.getElementById(currentElementId);
        const selectedElement = selectedQuestion.element;
        
        const questionText = selectedElement.querySelector('p').textContent;
        const metaInfo = selectedElement.querySelector('strong').textContent;
        
        const coMatch = metaInfo.match(/\\[CO:\\s*([^\\]]+)\\]/);
        const kMatch = metaInfo.match(/\\[K:\\s*([^\\]]+)\\]/);
        const marksMatch = metaInfo.match(/\\[Marks:\\s*(\\d+)\\]/);
        
        const co = coMatch ? coMatch[1].trim() : '';
        const k = kMatch ? kMatch[1].trim() : '';
        const marks = marksMatch ? marksMatch[1] : '';

        console.log('Extracted values:', { co, k, marks, metaInfo });

        const questionTextSpan = targetElement.querySelector('.question-text');
        if (questionTextSpan) {
          questionTextSpan.textContent = questionText;
          
          const strongTags = targetElement.querySelectorAll('strong');
          if (strongTags[0]) {
            strongTags[0].textContent = '[' + co + '] [' + k + '] ';
          }
        }

        closeModal();
        alert('Question replaced successfully!');
      }

      window.onclick = function(event) {
        const modal = document.getElementById('replaceModal');
        if (event.target == modal) {
          closeModal();
        }
      }

      function generateFinalPaper() {
        const finalWindow = window.open('', '_blank');
        const clonedDoc = document.cloneNode(true);
        
        const replaceButtons = clonedDoc.querySelectorAll('.replace-btn');
        replaceButtons.forEach(btn => btn.remove());
        
        const modal = clonedDoc.querySelector('#replaceModal');
        if (modal) modal.remove();
        
        const buttonSection = clonedDoc.querySelector('div[style*="text-align: center"][style*="margin: 30px 0"]');
        if (buttonSection) buttonSection.remove();
        
        const scripts = clonedDoc.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        const printSection = clonedDoc.createElement('div');
        printSection.style.cssText = 'text-align: center; margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; page-break-inside: avoid;';
        printSection.innerHTML = \`
          <button onclick="window.print()" style="
            background: #007bff;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            margin-right: 10px;
          ">🖨️ Print Paper</button>
          <button onclick="window.close()" style="
            background: #6c757d;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
          ">✖️ Close</button>
        \`;
        
        const footer = clonedDoc.querySelector('footer');
        if (footer) {
          footer.parentNode.insertBefore(printSection, footer);
        }
        
        const printStyle = clonedDoc.createElement('style');
        printStyle.textContent = \`
          @media print {
            button {
              display: none !important;
            }
            .no-print {
              display: none !important;
            }
            body {
              margin: 0;
              padding: 20px;
            }
          }
        \`;
        clonedDoc.head.appendChild(printStyle);
        
        finalWindow.document.write('<!DOCTYPE html>');
        finalWindow.document.write(clonedDoc.documentElement.outerHTML);
        finalWindow.document.close();
        finalWindow.focus();
      }
    </script>
  </body>
  </html>
  `;

  res.send(html);
});

module.exports = router;