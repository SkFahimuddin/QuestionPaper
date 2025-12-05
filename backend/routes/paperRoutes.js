const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Teacher = require('../models/Teacher');
const PaperFormat = require('../models/PaperFormat');
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

  const questions = await Question.find({ subject });
  const twoMarkQs = questions.filter(q => q.marks === 2);
  const threeMarkQs = questions.filter(q => q.marks === 3);
  const fiveMarkQs = questions.filter(q => q.marks === 5);

  const canGenerate = twoMarkQs.length >= 10 && threeMarkQs.length >= 3 && fiveMarkQs.length >= 9;
  
  res.json({ 
    canGenerate,
    reason: canGenerate ? null : `Not enough questions. Need: 10×2m (have ${twoMarkQs.length}), 3×3m (have ${threeMarkQs.length}), 9×5m (have ${fiveMarkQs.length})`
  });
});

// Search both DB and AI questions
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

    const dbQuestions = await Question.find(query);
    
    res.json({ 
      questions: dbQuestions,
      hasAI: true // Indicates AI questions can be generated
    });
  } catch (err) {
    res.status(500).json({ message: 'Error searching questions', error: err.message });
  }
});

// Generate paper with custom format
router.get('/generate-with-format', auth, async (req, res) => {
  const { subject, formatId } = req.query;
  
  if (!subject || !formatId) {
    return res.status(400).json({ message: 'Subject and formatId are required' });
  }

  try {
    const format = await PaperFormat.findById(formatId);
    if (!format) {
      return res.status(404).json({ message: 'Format not found' });
    }

    const allQuestions = await Question.find({ subject });
    
    if (allQuestions.length === 0) {
      return res.status(400).json({ message: `No questions found for ${subject}` });
    }

    const html = generatePaperHTML(format, allQuestions, subject);
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error generating paper' });
  }
});

// Helper function to generate paper HTML based on format
function generatePaperHTML(format, allQuestions, subject) {
  function getRandomItems(arr, count) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, arr.length));
  }

  // Process each section
  const sectionsHTML = format.sections.map((section, sIndex) => {
    let sectionHTML = `
      <section>
        <h3 style="text-align: center;">${section.name}</h3>
        <div style="display: flex;justify-content: space-between;align-items: center;margin: 5px 20px 0 20px;font-size: 16px;color: #000;font-weight: 600;">
          <span style="font-weight: bold;">${section.description || 'Answer all questions'}</span>
          <span style="font-weight: bold;font-size:large">${section.totalMarks}</span>
        </div>
        <ol>
    `;

    section.questions.forEach((questionType, qIndex) => {
      const { marks, count, subQuestions } = questionType;

      if (subQuestions && subQuestions.length > 0) {
        // Grouped questions (e.g., 5+3+2)
        const subMarksStr = subQuestions.map(sq => sq.marks).join('+');
        
        for (let i = 0; i < count; i++) {
          sectionHTML += `
            <li>
              <strong style="display: flex;justify-content: space-between;align-items: center;margin: 5px 20px 0 20px;">
                Q${i + 1}: <span>${subMarksStr}</span>
              </strong>
              <ul>
          `;

          subQuestions.forEach((subQ, subIdx) => {
            const availableQuestions = allQuestions.filter(q => q.marks === subQ.marks);
            const selected = getRandomItems(availableQuestions, 1)[0];
            
            if (selected) {
              const qId = `q-s${sIndex}-q${qIndex}-g${i}-sub${subIdx}`;
              sectionHTML += `
                <li id="${qId}">
                  <strong>[${selected.co}][${selected.k}]</strong>
                  <span class="question-text">${selected.questionText}</span>
                  <strong>(${selected.marks}m)</strong>
                  <button class="replace-btn" onclick="openReplaceModal('${selected._id}', '${subject}', '${selected.module || ''}', '${selected.co}', '${selected.k}', ${selected.marks}, '${qId}')">Replace</button>
                </li>
              `;
            }
          });

          sectionHTML += `</ul></li>`;
        }
      } else {
        // Simple questions
        const availableQuestions = allQuestions.filter(q => q.marks === marks);
        const selected = getRandomItems(availableQuestions, count);

        selected.forEach((q, idx) => {
          const qId = `q-s${sIndex}-q${qIndex}-${idx}`;
          sectionHTML += `
            <li id="${qId}">
              <strong>[${q.co}][${q.k}]</strong>
              <span class="question-text">${q.questionText}</span>
              <strong>(${q.marks}m)</strong>
              <button class="replace-btn" onclick="openReplaceModal('${q._id}', '${subject}', '${q.module || ''}', '${q.co}', '${q.k}', ${q.marks}, '${qId}')">Replace</button>
            </li>
          `;
        });
      }
    });

    sectionHTML += `</ol></section>`;
    return sectionHTML;
  }).join('');

  // Complete HTML with Replace Modal, AI Generation, and Generate Final Paper
  return `
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
        .question-item.ai-question {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
        }
        .question-item.ai-question:hover {
          background: #ffe69c;
        }
        .ai-badge {
          display: inline-block;
          background: #ffc107;
          color: #000;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: bold;
          margin-left: 8px;
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
        .refresh-btn {
          background: #17a2b8;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-left: 10px;
        }
        .refresh-btn:hover {
          background: #138496;
        }
        .tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
          border-bottom: 2px solid #ddd;
        }
        .tab {
          padding: 10px 20px;
          cursor: pointer;
          border: none;
          background: none;
          font-weight: 500;
          color: #666;
          border-bottom: 3px solid transparent;
        }
        .tab.active {
          color: #007bff;
          border-bottom-color: #007bff;
        }
        .tab:hover {
          color: #0056b3;
        }
        .loading {
          text-align: center;
          padding: 20px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <header>
        <h1>B.TECH (CSE & CSE_AI), END SEMESTER EXAMINATIONS</h1>
        <h2>Subject: ${subject}</h2>
        <div style="display: flex;justify-content: space-between;align-items: center;margin: 5px 20px 0 20px;font-size: 16px;color: #000;font-weight: 600;">
          <span>Full Marks: ${format.totalMarks}</span>
          <span>Time Allotted: ${format.duration}</span>
        </div>
      </header>

      <section style="border-top: 3px solid black;border-bottom: 3px solid black;">
        <p style="margin-right: 10em;margin-left: 10em;text-align: center; font-weight: bolder;">The figures in the right margin indicate full marks. Time Allotted: 3 hours. Candidates are required to give their answer in their own words as far as applicable. Unless otherwise specified, the notations / symbols have their usual meanings. Use of non-programmable calculator is allowed.</p>
      </section>

      ${sectionsHTML}

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
            <button onclick="searchQuestions()">Search Database</button>
          </div>

          <div class="tabs">
            <button class="tab active" onclick="switchTab('database')">Database Questions</button>
            <button class="tab" onclick="switchTab('ai')">AI Generated Questions</button>
          </div>

          <div id="questionsList" class="question-list">
            <p>Click "Search Database" to find replacement questions</p>
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
        let currentTab = 'database';
        let aiQuestions = [];
        let currentCriteria = {};

        function openReplaceModal(questionId, subject, module, co, k, marks, elementId) {
          currentQuestionId = questionId;
          currentElementId = elementId;
          currentSubject = subject;
          currentCriteria = { module, co, k, marks };
          
          document.getElementById('filterModule').value = module;
          document.getElementById('filterCO').value = co;
          document.getElementById('filterK').value = k;
          document.getElementById('filterMarks').value = marks;
          
          document.getElementById('replaceModal').style.display = 'block';
          document.getElementById('questionsList').innerHTML = '<p>Click "Search Database" to find replacement questions or switch to "AI Generated Questions" tab</p>';
          selectedQuestion = null;
          currentTab = 'database';
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab')[0].classList.add('active');
        }

        function closeModal() {
          document.getElementById('replaceModal').style.display = 'none';
          selectedQuestion = null;
          aiQuestions = [];
        }

        function switchTab(tab) {
          currentTab = tab;
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          event.target.classList.add('active');
          
          if (tab === 'database') {
            searchQuestions();
          } else {
            generateAIQuestions();
          }
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

          document.getElementById('questionsList').innerHTML = '<div class="loading">Searching database...</div>';
          
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
            
            console.log('Database questions received:', data.questions);
            
            if (data.questions && data.questions.length > 0) {
              const filteredQuestions = data.questions.filter(q => q._id !== currentQuestionId);
              console.log('Displaying questions:', filteredQuestions);
              displayQuestions(filteredQuestions, false);
            } else {
              document.getElementById('questionsList').innerHTML = '<p>No matching questions found in database</p>';
            }
          } catch (error) {
            console.error('Error details:', error);
            document.getElementById('questionsList').innerHTML = '<p>Error: ' + error.message + '</p>';
          }
        }

        async function generateAIQuestions() {
          const token = localStorage.getItem('token');
          
          if (!token) {
            alert('Authentication required');
            return;
          }

          const { module, co, k, marks } = currentCriteria;

          document.getElementById('questionsList').innerHTML = '<div class="loading">🤖 AI is generating questions... Please wait...</div>';
          
          try {
            const response = await fetch('http://localhost:5000/api/ai-questions/generate-questions', {
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
                marks: parseInt(marks),
                count: 10
              })
            });

            if (!response.ok) {
              throw new Error('Failed to generate AI questions');
            }

            const data = await response.json();
            aiQuestions = data.questions;
            displayQuestions(aiQuestions, true);
          } catch (error) {
            console.error('AI Generation Error:', error);
            document.getElementById('questionsList').innerHTML = 
              '<p style="color: red;">Error generating AI questions: ' + error.message + 
              '<br>Please check your OpenAI API key configuration.</p>';
          }
        }

        async function refreshAIQuestions() {
          generateAIQuestions();
        }

        function displayQuestions(questions, isAI) {
          const listDiv = document.getElementById('questionsList');
          
          console.log('Displaying questions:', questions.length, 'isAI:', isAI);
          
          if (!questions || questions.length === 0) {
            listDiv.innerHTML = '<p>No questions found</p>';
            return;
          }

          let html = '<div style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">';
          html += '<h3>Select a replacement question:</h3>';
          
          if (isAI) {
            html += '<button class="refresh-btn" onclick="refreshAIQuestions()">🔄 Refresh AI Questions</button>';
          }
          
          html += '</div>';
          
          questions.forEach((q, index) => {
            const escapedText = (q.questionText || '').replace(/'/g, "&#39;").replace(/"/g, '&quot;');
            const displayText = (q.questionText || 'No text').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            html += \`
              <div class="question-item \${q.isAI ? 'ai-question' : ''}" 
                   id="question-item-\${index}"
                   data-question-id="\${q._id || ''}" 
                   data-co="\${q.co || ''}" 
                   data-k="\${q.k || ''}"
                   data-question-text="\${escapedText}"
                   style="cursor: pointer;">
                <strong>
                  [CO: \${q.co || 'N/A'}] [K: \${q.k || 'N/A'}] [Module: \${q.module || 'N/A'}] [Marks: \${q.marks || 0}]
                  \${q.isAI ? '<span class="ai-badge">AI Generated</span>' : ''}
                </strong>
                <p>\${displayText}</p>
              </div>
            \`;
          });
          
          listDiv.innerHTML = html;
          
          questions.forEach((q, index) => {
            const element = document.getElementById(\`question-item-\${index}\`);
            if (element) {
              element.onclick = function() {
                const questionText = this.getAttribute('data-question-text');
                const co = this.getAttribute('data-co');
                const k = this.getAttribute('data-k');
                const qId = this.getAttribute('data-question-id');
                selectQuestion(qId, co, k, questionText, this);
              };
            }
          });
        }

        function selectQuestion(questionId, co, k, questionText, element) {
          document.querySelectorAll('.question-item').forEach(item => {
            item.classList.remove('selected');
            const existingBtn = item.querySelector('.select-question-btn');
            if (existingBtn) existingBtn.remove();
          });
          
          element.classList.add('selected');
          
          selectedQuestion = {
            id: questionId,
            co: co,
            k: k,
            text: questionText,
            element: element
          };

          const btn = document.createElement('button');
          btn.className = 'select-question-btn';
          btn.textContent = '✓ Use This Question';
          btn.style.marginTop = '10px';
          btn.onclick = (e) => {
            e.stopPropagation();
            replaceQuestion();
          };
          element.appendChild(btn);
        }

        function replaceQuestion() {
          if (!selectedQuestion) {
            alert('Please select a question first');
            return;
          }

          const targetElement = document.getElementById(currentElementId);
          
          const questionText = selectedQuestion.text;
          const co = selectedQuestion.co;
          const k = selectedQuestion.k;

          const questionTextSpan = targetElement.querySelector('.question-text');
          if (questionTextSpan) {
            questionTextSpan.textContent = questionText;
            
            const strongTags = targetElement.querySelectorAll('strong');
            if (strongTags[0]) {
              strongTags[0].textContent = '[' + co + '][' + k + ']';
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
}

module.exports = router;