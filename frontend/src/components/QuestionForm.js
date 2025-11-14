import React, {useState} from 'react';
import axios from 'axios';

export default function QuestionForm({ token, subject, onSaved, onCheck }){
  const [questionText, setQuestionText] = useState('');
  const [marks, setMarks] = useState(2);
  const [co, setCo] = useState('');
  const [k, setK] = useState('');
  const [module, setModule] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();

    if (!subject) {
      setMsg("❌ Please select a subject first");
      return;
    }

    const interrogativeRegex = /^(what|which|who|where|when|whom|whose|why|how)\b/i;
    if (interrogativeRegex.test(questionText.trim())) {
      setMsg("❌ Cannot accept interrogative questions (starting with what, which, who, where, how, etc.)");
      return;
    }

    try{
      const res = await axios.post('http://localhost:5000/api/questions/submit', 
        { questionText, marks: Number(marks), co, k, module, subject },
        { headers: { Authorization: 'Bearer '+token }}
      );
      setMsg(res.data.message || 'Saved');
      setQuestionText('');
      setModule('');
      onSaved();
      onCheck();
    }catch(err){
      setMsg(err.response?.data?.message || 'Error');
    }
  }

  return (
    <div>
      <h5>Submit Question for {subject}</h5>
      <form onSubmit={submit}>
        <div className="mb-2">
          <textarea 
            className="form-control" 
            rows="3" 
            placeholder="Question text" 
            value={questionText} 
            onChange={e=>setQuestionText(e.target.value)} 
          />
        </div>
        <div className="mb-2 d-flex gap-2">
          <select className="form-select" value={marks} onChange={e=>setMarks(e.target.value)}>
            <option value="2">2 marks</option>
            <option value="3">3 marks</option>
            <option value="5">5 marks</option>
          </select>
          <select className="form-select" value={co} onChange={(e) => setCo(e.target.value)}>
            <option value="">Select CO</option>
            <option value="CO1">CO1</option>
            <option value="CO2">CO2</option>
            <option value="CO3">CO3</option>
            <option value="CO4">CO4</option>
            <option value="CO5">CO5</option>
          </select>
          <select className="form-select" value={k} onChange={(e) => setK(e.target.value)}>
            <option value="">Select K</option>
            <option value="K1">K1</option>
            <option value="K2">K2</option>
            <option value="K3">K3</option>
            <option value="K4">K4</option>
            <option value="K5">K5</option>
          </select>
        </div>
        <div className="mb-2">
          <input
            type="text"
            className="form-control"
            placeholder="Enter module name"
            value={module}
            onChange={(e) => setModule(e.target.value)}
          />
        </div>
        <button className="btn btn-success" type="submit">Submit</button>
      </form>
      {msg && <div className="mt-2 alert alert-info">{msg}</div>}
    </div>
  );
}