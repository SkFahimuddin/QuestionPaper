import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function FormatBuilder({ token, subject, onClose, existingFormat }) {
  const [formatName, setFormatName] = useState('');
  const [totalMarks, setTotalMarks] = useState(80);
  const [duration, setDuration] = useState('3 hours');
  const [isShared, setIsShared] = useState(false);
  const [sections, setSections] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (existingFormat) {
      setFormatName(existingFormat.name);
      setTotalMarks(existingFormat.totalMarks);
      setDuration(existingFormat.duration);
      setIsShared(existingFormat.isShared);
      setSections(existingFormat.sections);
    } else {
      // Initialize with one empty section
      setSections([{
        name: 'Section A',
        description: 'Answer all questions',
        totalMarks: 20,
        questions: [{ marks: 2, count: 10, orOption: false, subQuestions: [] }]
      }]);
    }
  }, [existingFormat]);

  const addSection = () => {
    setSections([...sections, {
      name: `Section ${String.fromCharCode(65 + sections.length)}`,
      description: 'Answer all questions',
      totalMarks: 0,
      questions: []
    }]);
  };

  const updateSection = (index, field, value) => {
    const newSections = [...sections];
    newSections[index][field] = value;
    setSections(newSections);
  };

  const removeSection = (index) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const addQuestion = (sectionIndex) => {
    const newSections = [...sections];
    newSections[sectionIndex].questions.push({
      marks: 2,
      count: 1,
      orOption: false,
      subQuestions: []
    });
    setSections(newSections);
  };

  const updateQuestion = (sectionIndex, questionIndex, field, value) => {
    const newSections = [...sections];
    newSections[sectionIndex].questions[questionIndex][field] = value;
    setSections(newSections);
  };

  const removeQuestion = (sectionIndex, questionIndex) => {
    const newSections = [...sections];
    newSections[sectionIndex].questions.splice(questionIndex, 1);
    setSections(newSections);
  };

  const addSubQuestion = (sectionIndex, questionIndex) => {
    const newSections = [...sections];
    newSections[sectionIndex].questions[questionIndex].subQuestions.push({ marks: 2 });
    setSections(newSections);
  };

  const updateSubQuestion = (sectionIndex, questionIndex, subIndex, marks) => {
    const newSections = [...sections];
    newSections[sectionIndex].questions[questionIndex].subQuestions[subIndex].marks = marks;
    setSections(newSections);
  };

  const removeSubQuestion = (sectionIndex, questionIndex, subIndex) => {
    const newSections = [...sections];
    newSections[sectionIndex].questions[questionIndex].subQuestions.splice(subIndex, 1);
    setSections(newSections);
  };

  const saveFormat = async () => {
    if (!formatName || !subject) {
      setMsg('Please provide format name and subject');
      return;
    }

    try {
      const url = existingFormat 
        ? `http://localhost:5000/api/formats/${existingFormat._id}`
        : 'http://localhost:5000/api/formats/create';
      
      const method = existingFormat ? 'put' : 'post';

      await axios[method](url, {
        name: formatName,
        subject,
        totalMarks,
        duration,
        sections,
        isShared
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMsg('Format saved successfully!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error saving format');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      overflowY: 'auto',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '12px',
        minWidth: '700px',
        maxWidth: '900px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        marginTop: '20px'
      }}>
        <h4>Create Question Paper Format</h4>
        <p className="text-muted">Define your custom format for {subject}</p>

        {/* Basic Info */}
        <div className="mb-3">
          <label className="form-label">Format Name</label>
          <input
            type="text"
            className="form-control"
            value={formatName}
            onChange={(e) => setFormatName(e.target.value)}
            placeholder="e.g., Standard Format, Alternative Format"
          />
        </div>

        <div className="row mb-3">
          <div className="col-md-4">
            <label className="form-label">Total Marks</label>
            <input
              type="number"
              className="form-control"
              value={totalMarks}
              onChange={(e) => setTotalMarks(Number(e.target.value))}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Duration</label>
            <input
              type="text"
              className="form-control"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g., 3 hours"
            />
          </div>
          <div className="col-md-4">
            <label className="form-label d-block">Share with others</label>
            <input
              type="checkbox"
              className="form-check-input"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
            />
            <span className="ms-2">Allow other teachers to use</span>
          </div>
        </div>

        <hr />

        {/* Sections */}
        <h5>Sections</h5>
        {sections.map((section, sIndex) => (
          <div key={sIndex} style={{
            border: '1px solid #ddd',
            padding: '15px',
            marginBottom: '15px',
            borderRadius: '8px',
            backgroundColor: '#f8f9fa'
          }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6>Section {sIndex + 1}</h6>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => removeSection(sIndex)}
              >
                Remove Section
              </button>
            </div>

            <div className="row mb-2">
              <div className="col-md-4">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Section name (e.g., Section A)"
                  value={section.name}
                  onChange={(e) => updateSection(sIndex, 'name', e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Description"
                  value={section.description}
                  onChange={(e) => updateSection(sIndex, 'description', e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <input
                  type="number"
                  className="form-control"
                  placeholder="Total marks"
                  value={section.totalMarks}
                  onChange={(e) => updateSection(sIndex, 'totalMarks', Number(e.target.value))}
                />
              </div>
            </div>

            {/* Questions in this section */}
            <div className="ms-3">
              <strong>Questions:</strong>
              {section.questions.map((q, qIndex) => (
                <div key={qIndex} style={{
                  backgroundColor: 'white',
                  padding: '10px',
                  marginTop: '10px',
                  borderRadius: '6px',
                  border: '1px solid #dee2e6'
                }}>
                  <div className="d-flex gap-2 align-items-center mb-2">
                    <input
                      type="number"
                      className="form-control"
                      style={{ width: '100px' }}
                      placeholder="Marks"
                      value={q.marks}
                      onChange={(e) => updateQuestion(sIndex, qIndex, 'marks', Number(e.target.value))}
                    />
                    <span>×</span>
                    <input
                      type="number"
                      className="form-control"
                      style={{ width: '100px' }}
                      placeholder="Count"
                      value={q.count}
                      onChange={(e) => updateQuestion(sIndex, qIndex, 'count', Number(e.target.value))}
                    />
                    <label className="form-check-label ms-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={q.orOption}
                        onChange={(e) => updateQuestion(sIndex, qIndex, 'orOption', e.target.checked)}
                      />
                      OR option
                    </label>
                    <button
                      className="btn btn-sm btn-outline-primary ms-auto"
                      onClick={() => addSubQuestion(sIndex, qIndex)}
                    >
                      + Sub-Q
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => removeQuestion(sIndex, qIndex)}
                    >
                      ×
                    </button>
                  </div>

                  {/* Sub-questions */}
                  {q.subQuestions.length > 0 && (
                    <div className="ms-3">
                      <small className="text-muted">Sub-questions (e.g., 5+3+2):</small>
                      <div className="d-flex gap-2 flex-wrap mt-1">
                        {q.subQuestions.map((sub, subIndex) => (
                          <div key={subIndex} className="d-flex gap-1 align-items-center">
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              style={{ width: '60px' }}
                              value={sub.marks}
                              onChange={(e) => updateSubQuestion(sIndex, qIndex, subIndex, Number(e.target.value))}
                            />
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeSubQuestion(sIndex, qIndex, subIndex)}
                            >
                              ×
                            </button>
                            {subIndex < q.subQuestions.length - 1 && <span>+</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button
                className="btn btn-sm btn-outline-secondary mt-2"
                onClick={() => addQuestion(sIndex)}
              >
                + Add Question Type
              </button>
            </div>
          </div>
        ))}

        <button className="btn btn-outline-primary mb-3" onClick={addSection}>
          + Add Section
        </button>

        <hr />

        {msg && <div className="alert alert-info">{msg}</div>}

        <div className="d-flex gap-2 justify-content-end">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-success" onClick={saveFormat}>
            {existingFormat ? 'Update Format' : 'Save Format'}
          </button>
        </div>
      </div>
    </div>
  );
}