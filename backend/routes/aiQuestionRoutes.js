const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_a_secret';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Auth Middleware
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

// Generate AI questions based on criteria
router.post('/generate-questions', auth, async (req, res) => {
  try {
    const { subject, module, co, k, marks, count = 10 } = req.body;

    if (!subject || !marks) {
      return res.status(400).json({ message: 'Subject and marks are required' });
    }

    // Create prompt for OpenAI
    const prompt = `Generate ${count} academic examination questions for the following criteria:

Subject: ${subject}
${module ? `Module: ${module}` : ''}
${co ? `Course Outcome (CO): ${co}` : ''}
${k ? `Bloom's Taxonomy Level (K): ${k}` : ''}
Marks: ${marks}

Requirements:
1. Each question should be an imperative statement (not interrogative - don't start with what, where, when, who, why, how, which)
2. Questions should be academically rigorous and appropriate for B.Tech students
3. Questions should be clear and unambiguous
4. For ${marks} marks questions, the complexity should be appropriate
5. Return ONLY a JSON array of questions in this exact format:
[
  {
    "questionText": "Explain the concept...",
    "marks": ${marks},
    "co": "${co || 'CO1'}",
    "k": "${k || 'K2'}",
    "module": "${module || 'General'}"
  }
]

Generate exactly ${count} unique questions. Return ONLY the JSON array, no additional text.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert academic question paper generator. Generate questions as imperative statements (e.g., 'Explain...', 'Describe...', 'Analyze...'). Return only valid JSON arrays with no additional text or markdown formatting."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 2000
    });

    let questionsText = completion.choices[0].message.content.trim();
    
    // Remove markdown code blocks if present
    questionsText = questionsText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Parse the response
    const questions = JSON.parse(questionsText);

    // Validate the questions
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Invalid response format from AI');
    }

    // Add AI identifier to each question
    const enrichedQuestions = questions.map((q, index) => ({
      _id: `ai_${Date.now()}_${index}`,
      ...q,
      isAI: true,
      subject
    }));

    res.json({ 
      questions: enrichedQuestions,
      source: 'openai'
    });

  } catch (err) {
    console.error('OpenAI Error:', err);
    res.status(500).json({ 
      message: 'Error generating AI questions', 
      error: err.message 
    });
  }
});

module.exports = router;