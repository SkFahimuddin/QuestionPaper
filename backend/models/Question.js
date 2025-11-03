const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  teacherID: { type: String, required: true },
  questionText: { type: String, required: true },
  marks: { type: Number, required: true },
  section: { type: String, enum: ['A','B','C'], required: true },
  co: {type: String,required: true},
  k: {type: String ,required: true},
  module:{type: String,required: true},
  subject: { type: String, required: true },
});

module.exports = mongoose.model('Question', QuestionSchema);