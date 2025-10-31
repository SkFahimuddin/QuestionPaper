import React, {useState} from 'react';
import axios from 'axios';

export default function QuestionForm({ token, onSaved, onCheck }){
  const [questionText, setQuestionText] = useState('');
  const [marks, setMarks] = useState(2);
  const [section, setSection] = useState('A');
  const [co, setCo] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try{
      const res = await axios.post('http://localhost:5000/api/questions/submit', { questionText, marks: Number(marks), co }, { headers: { Authorization: 'Bearer '+token }});
      setMsg(res.data.message || 'Saved');
      setQuestionText('');
      onSaved();
      onCheck();
    }catch(err){
      setMsg(err.response?.data?.message || 'Error');
    }
  }

  return (
    <div>
      <h5>Submit Question</h5>
      <form onSubmit={submit}>
        <div className="mb-2"><textarea className="form-control" rows="3" placeholder="Question text" value={questionText} onChange={e=>setQuestionText(e.target.value)} /></div>
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
          </select>
        </div>
        <button className="btn btn-success" type="submit">Submit</button>
      </form>
      {msg && <div className="mt-2 alert alert-info">{msg}</div>}
    </div>
  );
}