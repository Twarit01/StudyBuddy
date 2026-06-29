import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { generateQuiz, evaluateAnswer, getQuizMistakes, resolveQuizMistake, submitQuiz } from '../api/quiz'
import { listDocuments } from '../api/documents'
import { exportQuizPDF } from '../utils/exportPDF'

const GENERIC_TOPICS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'Computer Science', 'History', 'English', 'Economics',
  'Engineering', 'Geography',
]

const extractTopicsFromDoc = (doc) => {
  const topics = new Set()
  const name = (doc.original_name || '').replace(/\.(pdf|txt|docx)$/i, '').replace(/[_-]/g, ' ')
  if (name) topics.add(name)
  if (doc.subject_name) topics.add(doc.subject_name)
  const keywords = [
    'Physics','Mathematics','Calculus','Algebra','Chemistry','Biology',
    'History','English','Economics','Computer Science','Data Structures',
    'Algorithms','Thermodynamics','Mechanics','Electromagnetism','Optics',
    'Organic Chemistry','Statistics','Geometry','Trigonometry',
    'Machine Learning','Programming','Networking','Database','Operating Systems',
  ]
  const combined = (doc.original_name + ' ' + (doc.summary || '')).toLowerCase()
  keywords.forEach(k => { if (combined.includes(k.toLowerCase())) topics.add(k) })
  return [...topics].filter(Boolean).slice(0, 12)
}

export default function Quiz() {
  const location = useLocation()

  const [step, setStep]                       = useState('pick')
  const [documents, setDocuments]             = useState([])
  const [documentsError, setDocumentsError]   = useState(null)
  const [selectedDocs, setSelectedDocs]       = useState([])
  const [topicMode, setTopicMode]             = useState('whole')
  const [availableTopics, setAvailableTopics] = useState([])
  const [customTopic, setCustomTopic]         = useState('')

  const [config, setConfig] = useState({
    topic: '', quizType: 'mcq', difficulty: 'medium',
    count: 5, timedMode: false, timePerQuestion: 60, documentId: '',
  })

  const [mistakes, setMistakes]                   = useState([])
  const [mistakesLoading, setMistakesLoading]     = useState(false)
  const [mistakesError, setMistakesError]         = useState(null)
  const [questions, setQuestions]                 = useState([])
  const [answers, setAnswers]                     = useState({})
  const [evaluations, setEvaluations]             = useState({})
  const [evaluating, setEvaluating]               = useState({})
  const [evaluationErrors, setEvaluationErrors]   = useState({})
  const [score, setScore]                         = useState(null)
  const [generating, setGenerating]               = useState(false)
  const [submitting, setSubmitting]               = useState(false)
  const [submitted, setSubmitted]                 = useState(false)
  const [error, setError]                         = useState(null)
  const [timeLeft, setTimeLeft]                   = useState(0)
  const [timerActive, setTimerActive]             = useState(false)
  const [startTime, setStartTime]                 = useState(null)
  const [currentQ, setCurrentQ]                   = useState(0)
  const timerRef      = useRef(null)
  const submittingRef = useRef(false)

  useEffect(() => {
    const load = async () => {
      try { setDocuments(await listDocuments()) }
      catch { setDocumentsError('Could not load documents') }
    }
    load()
    loadMistakes()
  }, [])

  useEffect(() => {
    if (location.state?.documentId) {
      const id = String(location.state.documentId)
      setSelectedDocs([id])
      setConfig(prev => ({ ...prev, documentId: id }))
    }
    if (location.state?.retryTopic) {
      setConfig(prev => ({ ...prev, topic: location.state.retryTopic, count: 3, difficulty: 'medium' }))
      setTopicMode('topic')
      setCustomTopic(location.state.retryTopic)
      setStep('pick')
    }
  }, [location.state])

  useEffect(() => {
    if (selectedDocs.length === 0) {
      setAvailableTopics(GENERIC_TOPICS)
      return
    }
    const selected = documents.filter(d => selectedDocs.includes(String(d.id)))
    const topics = new Set()
    selected.forEach(doc => extractTopicsFromDoc(doc).forEach(t => topics.add(t)))
    const topicList = [...topics]
    setAvailableTopics(topicList.length > 0 ? topicList : GENERIC_TOPICS)
    setConfig(prev => ({ ...prev, topic: '' }))
    setCustomTopic('')
  }, [selectedDocs, documents])

  useEffect(() => {
    if (!timerActive) return
    timerRef.current = setInterval(() => setTimeLeft(prev => Math.max(prev - 1, 0)), 1000)
    return () => clearInterval(timerRef.current)
  }, [timerActive])

  useEffect(() => {
    if (timerActive && timeLeft === 0 && questions.length > 0) handleSubmit(true)
  }, [timerActive, timeLeft, questions.length])

  const formatTime = (secs) => `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`
  const timerPct   = questions.length ? timeLeft / (config.timePerQuestion * questions.length) : 0
  const timerColor = timerPct > 0.5 ? '#10B981' : timerPct > 0.25 ? '#F59E0B' : '#EF4444'

  const loadMistakes = async () => {
    setMistakesLoading(true); setMistakesError(null)
    try { setMistakes(await getQuizMistakes(false, 8)) }
    catch { setMistakesError('Could not load mistake notebook') }
    finally { setMistakesLoading(false) }
  }

  const toggleDoc = (docId) => {
    const id = String(docId)
    setSelectedDocs(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleStartQuiz = async () => {
    setGenerating(true); setError(null)
    setQuestions([]); setAnswers({}); setEvaluations({})
    setEvaluationErrors({}); setEvaluating({})
    setScore(null); setSubmitted(false); setCurrentQ(0)
    clearInterval(timerRef.current); setTimerActive(false)

    const topic = topicMode === 'topic'
      ? (customTopic.trim() || config.topic || '')
      : ''

    const docId = selectedDocs.length === 1 ? selectedDocs[0] : null

    const finalTopic = topic || (selectedDocs.length > 0
      ? extractTopicsFromDoc(documents.find(d => String(d.id) === selectedDocs[0]) || {})[0] || 'General'
      : 'General')

    try {
      const data = await generateQuiz(
        finalTopic, config.quizType, config.difficulty,
        config.count, docId
      )
      setQuestions(data.questions)
      setStep('quiz')
      if (config.timedMode) {
        const t = config.timePerQuestion * data.questions.length
        setTimeLeft(t); setStartTime(Date.now()); setTimerActive(true)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate quiz. Please try again.')
    } finally { setGenerating(false) }
  }

  const handleMCQAnswer = (qi, letter) => { if (!submitted) setAnswers(p => ({ ...p, [qi]: letter })) }
  const handleTextAnswer = (qi, val) => {
    if (submitted) return
    setAnswers(p => ({ ...p, [qi]: val }))
    setEvaluationErrors(p => ({ ...p, [qi]: null }))
  }

  const handleEvaluateShort = async (qi) => {
    const q = questions[qi]; const ans = answers[qi]; if (!ans) return
    setEvaluating(p => ({ ...p, [qi]: true }))
    setEvaluationErrors(p => ({ ...p, [qi]: null }))
    try {
      const r = await evaluateAnswer(q.question, ans, q.answer, q.key_points || [])
      setEvaluations(p => ({ ...p, [qi]: r })); return r
    } catch (err) {
      setEvaluationErrors(p => ({ ...p, [qi]: err.response?.data?.detail || 'Could not check answer.' }))
      throw err
    } finally { setEvaluating(p => ({ ...p, [qi]: false })) }
  }

  const evaluatePendingShortAnswers = async () => {
    const next = { ...evaluations }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if ((q.type === 'short' || q.type === 'formula') && answers[i]?.trim() && !next[i]) {
        const r = await handleEvaluateShort(i); next[i] = r
      }
    }
    return next
  }

  const buildMistakes = (resolved) =>
    questions.flatMap((q, i) => {
      const sa = answers[i] || ''
      if (q.type === 'mcq') {
        if (sa === q.correct_answer) return []
        return [{ topic: q.topic || config.topic || 'General', quiz_type: q.type,
          question: q.question, student_answer: sa || 'No answer',
          correct_answer: q.correct_answer, explanation: q.explanation || null }]
      }
      const ev = resolved[i]
      if (!sa.trim() || ev?.is_correct) return []
      return [{ topic: q.topic || config.topic || 'General', quiz_type: q.type,
        question: q.question, student_answer: sa,
        correct_answer: q.answer, explanation: ev?.feedback || q.explanation || null }]
    })

  const handleSubmit = async (auto = false) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true); setError(null)
    clearInterval(timerRef.current); setTimerActive(false)
    const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : null
    let correct = 0
    try {
      const resolved = await evaluatePendingShortAnswers()
      questions.forEach((q, i) => {
        if (q.type === 'mcq' && answers[i] === q.correct_answer) correct++
        if ((q.type === 'short' || q.type === 'formula') && resolved[i]?.is_correct) correct++
      })
      await submitQuiz({
        topic: config.topic || 'General', quiz_type: config.quizType,
        difficulty: config.difficulty, total_questions: questions.length,
        correct_answers: correct, questions_data: JSON.stringify(questions),
        mistakes: buildMistakes(resolved), time_taken_seconds: timeTaken,
        is_timed_exam: config.timedMode,
      })
      setScore({ correct, total: questions.length, timeTaken, auto })
      setSubmitted(true)
      loadMistakes()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not submit quiz.')
      if (config.timedMode && !submitted && timeLeft > 0) setTimerActive(true)
    } finally { submittingRef.current = false; setSubmitting(false) }
  }

  const handleReset = () => {
    setQuestions([]); setAnswers({}); setEvaluations({})
    setEvaluationErrors({}); setEvaluating({})
    setScore(null); setSubmitted(false); setCurrentQ(0)
    clearInterval(timerRef.current); setTimerActive(false)
    setTimeLeft(0); setStartTime(null); setStep('pick')
  }

  const handleResolveMistake = async (id) => {
    try { await resolveQuizMistake(id); setMistakes(prev => prev.filter(m => m.id !== id)) }
    catch { setMistakesError('Could not update this mistake') }
  }

  const handleRetryMistake = (mistake) => {
    setConfig(prev => ({
      ...prev,
      quizType: mistake.quiz_type === 'formula' ? 'formula' : mistake.quiz_type === 'short' ? 'short' : 'mcq',
      count: 3, difficulty: 'medium',
    }))
    setTopicMode('topic')
    setCustomTopic(mistake.topic || '')
    setStep('pick')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scorePct   = score ? Math.round((score.correct / score.total) * 100) : 0
  const scoreColor = scorePct >= 70 ? '#10B981' : scorePct >= 40 ? '#F59E0B' : '#EF4444'
  const selectedDocNames = selectedDocs.length === 0
    ? 'All documents'
    : documents.filter(d => selectedDocs.includes(String(d.id))).map(d => d.original_name).join(', ')

  return (
    <div style={{ height:'100%', overflowY:'auto', background:'#0C0C14', color:'#fff',
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{`
        .qz-card { background:#13131F; border:1px solid rgba(255,255,255,0.07); border-radius:16px; padding:22px; }
        .qz-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 20px; border-radius:11px;
                  font-size:13px; font-weight:700; cursor:pointer; border:none; transition:all 0.2s; font-family:inherit; }
        .qz-btn-primary { background:linear-gradient(135deg,#7C3AED,#6D28D9); color:#fff; }
        .qz-btn-primary:hover { background:linear-gradient(135deg,#8B5CF6,#7C3AED); }
        .qz-btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .qz-btn-ghost { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.65); }
        .qz-btn-ghost:hover { background:rgba(255,255,255,0.1); color:#fff; }
        .qz-btn-green { background:linear-gradient(135deg,#10B981,#059669); color:#fff; }
        .qz-select { background:#0C0C14; border:1px solid rgba(255,255,255,0.1); border-radius:10px;
                     padding:8px 12px; color:#fff; font-size:13px; outline:none; cursor:pointer; width:100%; }
        .doc-tile { padding:14px 16px; border-radius:12px; border:1.5px solid rgba(255,255,255,0.08);
                    cursor:pointer; transition:all 0.15s; background:rgba(255,255,255,0.03); text-align:left;
                    display:flex; align-items:center; gap:12px; width:100%; font-family:inherit; }
        .doc-tile:hover { border-color:rgba(124,58,237,0.4); background:rgba(124,58,237,0.07); }
        .doc-tile.selected { border-color:#7C3AED; background:rgba(124,58,237,0.15); }
        .topic-chip { padding:7px 14px; border-radius:20px; font-size:12px; font-weight:600;
                      border:1.5px solid; cursor:pointer; transition:all 0.15s; font-family:inherit;
                      white-space:nowrap; background:none; }
        .topic-chip.sel   { background:rgba(124,58,237,0.2); border-color:#7C3AED; color:#C4B5FD; }
        .topic-chip.unsel { background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.1); color:rgba(255,255,255,0.55); }
        .topic-chip.unsel:hover { border-color:rgba(124,58,237,0.4); color:#C4B5FD; }
        .mode-btn { flex:1; padding:12px 0; border-radius:12px; font-size:13px; font-weight:700;
                    cursor:pointer; border:2px solid; transition:all 0.15s; font-family:inherit; text-align:center; }
        .opt-btn { display:flex; align-items:center; gap:12px; padding:13px 16px; border-radius:12px;
                   font-size:13px; text-align:left; border:1.5px solid; cursor:pointer;
                   transition:all 0.15s; width:100%; font-family:inherit; }
        .opt-default  { background:rgba(255,255,255,0.03); border-color:rgba(255,255,255,0.1); color:rgba(255,255,255,0.8); }
        .opt-default:hover { background:rgba(255,255,255,0.07); border-color:rgba(255,255,255,0.2); }
        .opt-selected { background:rgba(124,58,237,0.15); border-color:rgba(124,58,237,0.5); color:#C4B5FD; }
        .opt-correct  { background:rgba(16,185,129,0.12); border-color:rgba(16,185,129,0.4); color:#6EE7B7; }
        .opt-wrong    { background:rgba(239,68,68,0.12);  border-color:rgba(239,68,68,0.4);  color:#FCA5A5; }
        .toggle-wrap  { position:relative; width:44px; height:24px; border-radius:12px;
                        cursor:pointer; border:none; transition:background 0.2s; flex-shrink:0; }
        .toggle-thumb { position:absolute; top:3px; width:18px; height:18px; background:#fff;
                        border-radius:50%; transition:transform 0.2s; }
        .mistake-row  { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07);
                        border-radius:12px; padding:14px; }
        .progress-track { height:4px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden; }
        .progress-fill  { height:100%; border-radius:4px; transition:width 0.3s; }
        .textarea-dark  { background:#0C0C14; border:1px solid rgba(255,255,255,0.1); border-radius:10px;
                          padding:10px 12px; color:#fff; font-size:13px; outline:none; resize:none;
                          font-family:inherit; width:100%; box-sizing:border-box; }
        .textarea-dark:focus { border-color:rgba(124,58,237,0.5); }
        .textarea-dark::placeholder { color:rgba(255,255,255,0.25); }
        .section-label { font-size:10px; font-weight:700; color:rgba(255,255,255,0.35);
                         letter-spacing:1px; text-transform:uppercase; margin-bottom:10px; }
        @keyframes spin   { to { transform:rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
        .fade-up { animation:fadeUp 0.25s ease; }
      `}</style>

      <div style={{ maxWidth:780, margin:'0 auto', padding:'28px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:11, color:'#7C3AED', fontWeight:700, letterSpacing:1, marginBottom:6,
            display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#7C3AED', display:'inline-block' }}/>
            AI-powered · grounded in your documents
          </div>
          <h1 style={{ fontSize:28, fontWeight:800, margin:0, letterSpacing:'-0.5px' }}>Quiz Generator</h1>
          <p style={{ color:'rgba(255,255,255,0.4)', fontSize:13, margin:'5px 0 0' }}>
            Generate AI questions from your study materials · timed exam mode · mistake notebook
          </p>
        </div>

        {/* Mistake Notebook */}
        <div className="qz-card" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <h2 style={{ margin:0, fontSize:15, fontWeight:700 }}>⚠️ Mistake Notebook</h2>
              <p style={{ margin:'3px 0 0', fontSize:11, color:'rgba(255,255,255,0.38)' }}>
                Missed questions saved for retry practice
              </p>
            </div>
            <button onClick={loadMistakes} disabled={mistakesLoading}
              className="qz-btn qz-btn-ghost" style={{ padding:'6px 14px', fontSize:12 }}>
              {mistakesLoading
                ? <div style={{ width:13, height:13, border:'2px solid rgba(255,255,255,0.3)',
                    borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                : '↻'} Refresh
            </button>
          </div>
          {mistakesError && (
            <div style={{ marginBottom:10, padding:'8px 12px', borderRadius:9, fontSize:12,
              background:'rgba(239,68,68,0.1)', color:'#FCA5A5' }}>{mistakesError}</div>
          )}
          {mistakesLoading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:24 }}>
              <div style={{ width:20, height:20, border:'2px solid #7C3AED',
                borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
            </div>
          ) : mistakes.length === 0 ? (
            <div style={{ padding:'20px 0', textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:13 }}>
              No open mistakes — take a quiz to build your review list ✓
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {mistakes.slice(0,4).map(m => (
                <div key={m.id} className="mistake-row">
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ display:'flex', gap:6, marginBottom:7, flexWrap:'wrap' }}>
                        <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700,
                          background:'rgba(124,58,237,0.2)', color:'#C4B5FD' }}>{m.topic || 'General'}</span>
                        <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600,
                          background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.45)' }}>{m.quiz_type}</span>
                      </div>
                      <p style={{ margin:0, fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.88)',
                        lineHeight:1.4, overflow:'hidden', display:'-webkit-box',
                        WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{m.question}</p>
                      <p style={{ margin:'4px 0 0', fontSize:11, color:'rgba(255,255,255,0.38)' }}>
                        ✓ {m.correct_answer || 'See explanation'}
                      </p>
                    </div>
                    <div style={{ display:'flex', gap:7, flexShrink:0 }}>
                      <button onClick={() => handleRetryMistake(m)} className="qz-btn qz-btn-ghost"
                        style={{ padding:'6px 12px', fontSize:11 }}>Retry</button>
                      <button onClick={() => handleResolveMistake(m.id)} className="qz-btn qz-btn-primary"
                        style={{ padding:'6px 12px', fontSize:11 }}>Resolved</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── STEP: PICK ── */}
        {step === 'pick' && (
          <div className="fade-up">
            <div className="qz-card" style={{ marginBottom:16 }}>
              <h2 style={{ margin:'0 0 18px', fontSize:15, fontWeight:700 }}>⚙️ Configure Your Quiz</h2>

              {/* Step 1: Pick documents */}
              <div style={{ marginBottom:22 }}>
                <div className="section-label">Step 1 — Choose source material</div>
                {documentsError && (
                  <div style={{ marginBottom:10, padding:'8px 12px', borderRadius:9, fontSize:12,
                    background:'rgba(239,68,68,0.1)', color:'#FCA5A5' }}>{documentsError}</div>
                )}
                {documents.length === 0 ? (
                  <div style={{ padding:20, borderRadius:12, textAlign:'center', fontSize:13,
                    color:'rgba(255,255,255,0.35)', background:'rgba(255,255,255,0.03)',
                    border:'1px dashed rgba(255,255,255,0.1)' }}>
                    No documents uploaded yet — go to Documents to upload study material
                  </div>
                ) : (
                  <>
                    <button onClick={() => setSelectedDocs([])}
                      className={`doc-tile${selectedDocs.length === 0 ? ' selected' : ''}`}
                      style={{ marginBottom:8 }}>
                      <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
                        background: selectedDocs.length === 0 ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.07)',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>📚</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, marginBottom:2 }}>All Documents</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.38)' }}>
                          Use all {documents.length} uploaded document{documents.length !== 1 ? 's' : ''} as source
                        </div>
                      </div>
                      {selectedDocs.length === 0 && (
                        <div style={{ width:20, height:20, borderRadius:'50%', background:'#7C3AED',
                          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <span style={{ color:'#fff', fontSize:11 }}>✓</span>
                        </div>
                      )}
                    </button>

                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {documents.map(doc => {
                        const isSel = selectedDocs.includes(String(doc.id))
                        return (
                          <button key={doc.id} onClick={() => toggleDoc(doc.id)}
                            className={`doc-tile${isSel ? ' selected' : ''}`}>
                            <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
                              background: isSel ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.07)',
                              display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>📄</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:600, overflow:'hidden',
                                textOverflow:'ellipsis', whiteSpace:'nowrap',
                                color: isSel ? '#C4B5FD' : 'rgba(255,255,255,0.85)' }}>
                                {doc.original_name}
                              </div>
                              <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>
                                {doc.chunk_count} chunks · {doc.file_type?.toUpperCase()}
                                {doc.subject_name ? ` · ${doc.subject_name}` : ''}
                              </div>
                            </div>
                            {isSel && (
                              <div style={{ width:20, height:20, borderRadius:'50%', background:'#7C3AED',
                                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                <span style={{ color:'#fff', fontSize:11 }}>✓</span>
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {selectedDocs.length > 1 && (
                      <div style={{ marginTop:8, padding:'7px 12px', borderRadius:9, fontSize:12,
                        background:'rgba(34,211,238,0.1)', color:'#22D3EE',
                        border:'1px solid rgba(34,211,238,0.2)' }}>
                        ✓ {selectedDocs.length} documents selected — AI will combine them for questions
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Step 2: Whole doc or topic */}
              <div style={{ marginBottom:22 }}>
                <div className="section-label">Step 2 — Quiz scope</div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => setTopicMode('whole')} className="mode-btn"
                    style={{
                      background: topicMode==='whole' ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
                      borderColor: topicMode==='whole' ? '#7C3AED' : 'rgba(255,255,255,0.1)',
                      color: topicMode==='whole' ? '#C4B5FD' : 'rgba(255,255,255,0.5)',
                    }}>
                    <div style={{ fontSize:20, marginBottom:4 }}>📄</div>
                    <div style={{ fontWeight:700 }}>Whole Document</div>
                    <div style={{ fontSize:11, fontWeight:400, marginTop:3, opacity:0.7 }}>Questions from everything</div>
                  </button>
                  <button onClick={() => setTopicMode('topic')} className="mode-btn"
                    style={{
                      background: topicMode==='topic' ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
                      borderColor: topicMode==='topic' ? '#7C3AED' : 'rgba(255,255,255,0.1)',
                      color: topicMode==='topic' ? '#C4B5FD' : 'rgba(255,255,255,0.5)',
                    }}>
                    <div style={{ fontSize:20, marginBottom:4 }}>🎯</div>
                    <div style={{ fontWeight:700 }}>Specific Topic</div>
                    <div style={{ fontSize:11, fontWeight:400, marginTop:3, opacity:0.7 }}>Focus on one area</div>
                  </button>
                </div>
              </div>

              {/* Step 3: Topic picker */}
              {topicMode === 'topic' && (
                <div style={{ marginBottom:22 }}>
                  <div className="section-label">Step 3 — Pick a topic from your document</div>
                  {availableTopics.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:12 }}>
                      {availableTopics.map(t => (
                        <button key={t}
                          onClick={() => { setConfig(p => ({...p, topic:t})); setCustomTopic(t) }}
                          className={`topic-chip ${(customTopic===t || config.topic===t) ? 'sel' : 'unsel'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                  <input type="text" value={customTopic}
                    onChange={e => { setCustomTopic(e.target.value); setConfig(p => ({...p, topic:e.target.value})) }}
                    placeholder="Or type a custom topic (e.g. Newton's Laws, Integration, Binary Trees...)"
                    style={{ width:'100%', boxSizing:'border-box', background:'#0C0C14',
                      border:'1px solid rgba(255,255,255,0.1)', borderRadius:11,
                      padding:'11px 14px', color:'#fff', fontSize:13, outline:'none',
                      transition:'border-color 0.2s', fontFamily:'inherit' }}
                    onFocus={e => e.target.style.borderColor='rgba(124,58,237,0.5)'}
                    onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.1)'}
                  />
                </div>
              )}

              {/* Step 3/4: Quiz settings */}
              <div style={{ marginBottom:22 }}>
                <div className="section-label">
                  {topicMode === 'topic' ? 'Step 4' : 'Step 3'} — Quiz settings
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                  {[
                    { label:'Type', key:'quizType', options:[
                      {value:'mcq',     label:'Multiple Choice'},
                      {value:'short',   label:'Short Answer'},
                      {value:'formula', label:'Formula Recall'},
                    ]},
                    { label:'Difficulty', key:'difficulty', options:[
                      {value:'easy',   label:'Easy'},
                      {value:'medium', label:'Medium'},
                      {value:'hard',   label:'Hard'},
                    ]},
                    { label:'Questions', key:'count',
                      options:[3,5,8,10].map(n => ({value:n, label:`${n} questions`})) },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)',
                        marginBottom:6, letterSpacing:0.5 }}>{f.label.toUpperCase()}</div>
                      <select value={config[f.key]}
                        onChange={e => setConfig(p => ({...p, [f.key]: f.key==='count' ? Number(e.target.value) : e.target.value}))}
                        className="qz-select">
                        {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timed mode */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'14px 16px', borderRadius:12, marginBottom:20,
                background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:34, height:34, borderRadius:10, background:'rgba(124,58,237,0.15)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>⏱️</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600 }}>Timed Exam Mode</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.38)' }}>Auto-submits when time runs out</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {config.timedMode && (
                    <select value={config.timePerQuestion}
                      onChange={e => setConfig(p => ({...p, timePerQuestion:Number(e.target.value)}))}
                      className="qz-select" style={{ width:'auto' }}>
                      <option value={30}>30s/q</option>
                      <option value={60}>1 min/q</option>
                      <option value={90}>90s/q</option>
                      <option value={120}>2 min/q</option>
                    </select>
                  )}
                  <button onClick={() => setConfig(p => ({...p, timedMode:!p.timedMode}))}
                    className="toggle-wrap"
                    style={{ background: config.timedMode ? '#7C3AED' : 'rgba(255,255,255,0.1)' }}>
                    <div className="toggle-thumb"
                      style={{ transform: config.timedMode ? 'translateX(20px)' : 'translateX(3px)' }}/>
                  </button>
                </div>
              </div>

              {/* Quiz summary */}
              <div style={{ padding:'14px 16px', borderRadius:12, marginBottom:16,
                background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.2)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#C4B5FD', marginBottom:6 }}>Quiz Summary</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.55)', lineHeight:1.8 }}>
                  📄 Source: <strong style={{ color:'rgba(255,255,255,0.8)' }}>{selectedDocNames}</strong><br/>
                  🎯 Scope: <strong style={{ color:'rgba(255,255,255,0.8)' }}>
                    {topicMode === 'whole' ? 'Whole document' : `Topic: ${customTopic || config.topic || 'not selected yet'}`}
                  </strong><br/>
                  📝 Type: <strong style={{ color:'rgba(255,255,255,0.8)' }}>
                    {config.quizType === 'mcq' ? 'Multiple Choice' : config.quizType === 'short' ? 'Short Answer' : 'Formula Recall'}
                  </strong> · {config.count} questions · {config.difficulty}
                  {config.timedMode && <><br/>⏱️ Timed: <strong style={{ color:'rgba(255,255,255,0.8)' }}>{config.timePerQuestion}s per question</strong></>}
                </div>
              </div>

              {error && (
                <div style={{ marginBottom:14, padding:'11px 14px', borderRadius:10, fontSize:13,
                  background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#FCA5A5' }}>
                  {error}
                </div>
              )}

              <button onClick={handleStartQuiz}
                disabled={generating || (topicMode==='topic' && !customTopic.trim() && !config.topic)}
                className="qz-btn qz-btn-primary"
                style={{ width:'100%', justifyContent:'center', padding:'13px 0', fontSize:14 }}>
                {generating
                  ? <><div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)',
                      borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> Generating questions...</>
                  : '✨ Start Quiz'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: QUIZ ── */}
        {step === 'quiz' && (
          <div className="fade-up">

            {/* Timer */}
            {timerActive && timeLeft > 0 && (
              <div className="qz-card" style={{ marginBottom:14, display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:'rgba(239,68,68,0.12)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>⏰</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
                    <span style={{ fontWeight:600 }}>Time remaining</span>
                    <span style={{ fontFamily:'monospace', fontWeight:700, color:timerColor }}>{formatTime(timeLeft)}</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill"
                      style={{ width:`${timerPct*100}%`, background:timerColor, transition:'width 1s linear' }}/>
                  </div>
                </div>
              </div>
            )}

            {/* Score banner */}
            {score && (
              <div className="qz-card" style={{ marginBottom:14,
                borderColor: scorePct>=70 ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                    <div style={{ fontSize:42, fontWeight:800, color:scoreColor, letterSpacing:'-1px', lineHeight:1 }}>
                      {scorePct}%
                    </div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, marginBottom:3 }}>
                        {score.auto ? "Time's up!" : scorePct>=70 ? '🎉 Great job!' : '📖 Keep studying!'}
                      </div>
                      <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)' }}>
                        {score.correct}/{score.total} correct
                        {score.timeTaken && ` · ${formatTime(score.timeTaken)}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => exportQuizPDF({questions, answers, evaluations, score, config})}
                      className="qz-btn qz-btn-ghost" style={{ padding:'8px 14px', fontSize:12 }}>
                      ↓ Download PDF
                    </button>
                    <button onClick={handleReset} className="qz-btn qz-btn-primary"
                      style={{ padding:'8px 16px', fontSize:12 }}>← New Quiz</button>
                  </div>
                </div>
              </div>
            )}

            {/* Nav bar */}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px',
              background:'#13131F', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, marginBottom:12 }}>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.45)', flexShrink:0 }}>
                {currentQ+1} of {questions.length}
              </span>
              <div style={{ flex:1, display:'flex', gap:4 }}>
                {questions.map((_,i) => (
                  <div key={i} onClick={() => setCurrentQ(i)}
                    style={{ flex:1, height:4, borderRadius:4, cursor:'pointer',
                      background: i===currentQ ? '#7C3AED'
                        : answers[i]!==undefined ? 'rgba(124,58,237,0.4)'
                        : 'rgba(255,255,255,0.1)',
                      transition:'background 0.2s' }}/>
                ))}
              </div>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.38)', flexShrink:0 }}>
                {Object.keys(answers).length}/{questions.length} answered
              </span>
              <button onClick={handleReset} className="qz-btn qz-btn-ghost"
                style={{ padding:'5px 10px', fontSize:11 }}>← Back</button>
            </div>

            {/* Questions */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {questions.map((q, qi) => (
                <div key={qi} className="qz-card"
                  style={{ borderColor: qi===currentQ ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.07)' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:16 }}>
                    <div style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center',
                      justifyContent:'center', flexShrink:0, fontWeight:700, fontSize:12,
                      background: qi===currentQ ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.07)',
                      color: qi===currentQ ? '#C4B5FD' : 'rgba(255,255,255,0.5)',
                      border: qi===currentQ ? '1px solid rgba(124,58,237,0.4)' : '1px solid transparent' }}>
                      {qi+1}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                        {q.topic && (
                          <span style={{ fontSize:10, fontWeight:700, color:'#7C3AED',
                            letterSpacing:1, textTransform:'uppercase' }}>{q.topic}</span>
                        )}
                        <span style={{ fontSize:10, color:'rgba(255,255,255,0.35)' }}>·</span>
                        <span style={{ fontSize:10, color:'rgba(255,255,255,0.35)',
                          textTransform:'uppercase', letterSpacing:0.5 }}>{q.difficulty}</span>
                      </div>
                      <p style={{ margin:0, fontSize:14, fontWeight:600, lineHeight:1.55,
                        color:'rgba(255,255,255,0.92)' }}>{q.question}</p>
                    </div>
                  </div>

                  {q.type === 'mcq' && q.options && (
                    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                      {q.options.map((opt, oi) => {
                        const letter  = ['A','B','C','D'][oi]
                        const isSel   = answers[qi] === letter
                        const isCorr  = submitted && letter === q.correct_answer
                        const isWrong = submitted && isSel && !isCorr
                        let cls = 'opt-default'
                        if (isCorr) cls = 'opt-correct'
                        else if (isWrong) cls = 'opt-wrong'
                        else if (isSel) cls = 'opt-selected'
                        return (
                          <button key={oi} onClick={() => handleMCQAnswer(qi, letter)}
                            disabled={submitted} className={`opt-btn ${cls}`}>
                            <span style={{ width:26, height:26, borderRadius:7, display:'flex',
                              alignItems:'center', justifyContent:'center', fontSize:11,
                              fontWeight:700, flexShrink:0, background:'rgba(255,255,255,0.08)' }}>{letter}</span>
                            <span style={{ flex:1 }}>{opt.replace(/^[A-D]\.\s*/, '')}</span>
                            {isCorr  && <span style={{ fontSize:14 }}>✓</span>}
                            {isWrong && <span style={{ fontSize:14 }}>✗</span>}
                          </button>
                        )
                      })}
                      {submitted && q.explanation && (
                        <div style={{ marginTop:4, padding:'10px 13px', borderRadius:10, fontSize:12,
                          lineHeight:1.6, background:'rgba(34,211,238,0.08)',
                          borderLeft:'3px solid #22D3EE', color:'rgba(255,255,255,0.75)' }}>
                          <span style={{ fontWeight:700, color:'#22D3EE' }}>Explanation: </span>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  )}

                  {(q.type === 'short' || q.type === 'formula') && (
                    <div>
                      <textarea value={answers[qi] || ''}
                        onChange={e => handleTextAnswer(qi, e.target.value)}
                        disabled={submitted || !!evaluations[qi] || evaluating[qi]}
                        placeholder="Type your answer here..." rows={3}
                        className="textarea-dark"/>
                      {!evaluations[qi] && !submitted && (
                        <button onClick={() => handleEvaluateShort(qi)}
                          disabled={!answers[qi] || evaluating[qi]}
                          className="qz-btn qz-btn-ghost"
                          style={{ marginTop:8, padding:'6px 14px', fontSize:12 }}>
                          {evaluating[qi] ? 'Checking...' : '✓ Check answer'}
                        </button>
                      )}
                      {evaluationErrors[qi] && (
                        <div style={{ marginTop:8, padding:'8px 12px', borderRadius:9, fontSize:12,
                          background:'rgba(239,68,68,0.1)', color:'#FCA5A5' }}>
                          {evaluationErrors[qi]}
                        </div>
                      )}
                      {evaluations[qi] && (
                        <div style={{ marginTop:10, padding:'12px 14px', borderRadius:10,
                          fontSize:12, lineHeight:1.6,
                          background: evaluations[qi].is_correct ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          borderLeft:`3px solid ${evaluations[qi].is_correct ? '#10B981' : '#EF4444'}` }}>
                          <p style={{ margin:'0 0 5px', fontWeight:700, fontSize:13 }}>
                            Score: {evaluations[qi].score}/100 · {evaluations[qi].is_correct ? '✓ Correct' : '✗ Needs review'}
                          </p>
                          <p style={{ margin:0, color:'rgba(255,255,255,0.6)' }}>{evaluations[qi].feedback}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {!submitted && (
                <button onClick={() => handleSubmit(false)}
                  disabled={submitting || Object.keys(answers).length === 0}
                  className="qz-btn qz-btn-green"
                  style={{ justifyContent:'center', padding:'13px 0', fontSize:14, width:'100%' }}>
                  {submitting
                    ? <><div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)',
                        borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> Submitting...</>
                    : '✓ Submit Quiz'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}