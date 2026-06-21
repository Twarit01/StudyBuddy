import { useState, useEffect, useRef } from 'react'
import { generateQuiz, evaluateAnswer, submitQuiz } from '../api/quiz'
import { exportQuizPDF } from '../utils/exportPDF'

const TOPICS = [
  'Circuit Analysis', 'Thermodynamics', 'Fluid Mechanics',
  'Control Systems', 'Digital Logic', 'Structural Analysis',
  'Electromagnetics', 'Signal Processing', 'Engineering Mathematics',
]

export default function Quiz() {
  const [config, setConfig] = useState({
    topic: '', quizType: 'mcq', difficulty: 'medium',
    count: 5, timedMode: false, timePerQuestion: 60,
  })
  const [questions, setQuestions]     = useState([])
  const [answers, setAnswers]         = useState({})
  const [evaluations, setEvaluations] = useState({})
  const [score, setScore]             = useState(null)
  const [generating, setGenerating]   = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [submitted, setSubmitted]     = useState(false)
  const [error, setError]             = useState(null)
  const [timeLeft, setTimeLeft]       = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [startTime, setStartTime]     = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current); setTimerActive(false); handleSubmit(true); return 0 }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [timerActive])

  const formatTime = (secs) => `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`

  const timerPct = questions.length ? timeLeft / (config.timePerQuestion * questions.length) : 0
  const timerColor = timerPct > 0.5 ? '#10B981' : timerPct > 0.25 ? '#F59E0B' : '#EF4444'

  const handleGenerate = async () => {
    setGenerating(true); setError(null)
    setQuestions([]); setAnswers({}); setEvaluations({})
    setScore(null); setSubmitted(false)
    clearInterval(timerRef.current); setTimerActive(false)
    try {
      const data = await generateQuiz(config.topic || 'General Engineering', config.quizType, config.difficulty, config.count)
      setQuestions(data.questions)
      if (config.timedMode) {
        const t = config.timePerQuestion * data.questions.length
        setTimeLeft(t); setStartTime(Date.now()); setTimerActive(true)
      }
    } catch (err) { setError(err.response?.data?.detail || 'Failed to generate quiz') }
    finally { setGenerating(false) }
  }

  const handleMCQAnswer = (qi, letter) => { if (!submitted) setAnswers(p => ({ ...p, [qi]: letter })) }
  const handleTextAnswer = (qi, val) => setAnswers(p => ({ ...p, [qi]: val }))

  const handleEvaluateShort = async (qi) => {
    const q = questions[qi]; const ans = answers[qi]; if (!ans) return
    try { const r = await evaluateAnswer(q.question, ans, q.answer, q.key_points || []); setEvaluations(p => ({ ...p, [qi]: r })) }
    catch (err) { console.error(err) }
  }

  const handleSubmit = async (auto = false) => {
    if (submitting) return
    setSubmitting(true); clearInterval(timerRef.current); setTimerActive(false)
    const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : null
    let correct = 0
    questions.forEach((q, i) => {
      if (q.type === 'mcq' && answers[i] === q.correct_answer) correct++
      if ((q.type === 'short' || q.type === 'formula') && evaluations[i]?.is_correct) correct++
    })
    try {
      await submitQuiz({
        topic: config.topic || 'General Engineering', quiz_type: config.quizType,
        difficulty: config.difficulty, total_questions: questions.length,
        correct_answers: correct, questions_data: JSON.stringify(questions),
        time_taken_seconds: timeTaken, is_timed_exam: config.timedMode,
      })
      setScore({ correct, total: questions.length, timeTaken, auto }); setSubmitted(true)
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }

  const handleReset = () => {
    setQuestions([]); setAnswers({}); setEvaluations({})
    setScore(null); setSubmitted(false)
    clearInterval(timerRef.current); setTimerActive(false); setTimeLeft(0); setStartTime(null)
  }

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFC] dark:bg-[#0B0F1A] transition-colors duration-200">
      <div className="max-w-3xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-display text-[#0F172A] dark:text-[#F1F5F9]">Quiz generator</h1>
          <p className="text-body mt-1 text-[#64748B] dark:text-[#94A3B8]">AI-generated questions from your uploaded study materials</p>
        </div>

        {/* Config */}
        <div className="p-6 mb-6 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
          <h2 className="text-title text-[#0F172A] dark:text-[#F1F5F9] mb-4">Configure quiz</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Topic', key: 'topic', type: 'select',
                options: [{ value: '', label: 'Any topic' }, ...TOPICS.map(t => ({ value: t, label: t }))] },
              { label: 'Type', key: 'quizType', type: 'select',
                options: [{ value: 'mcq', label: 'Multiple choice' }, { value: 'short', label: 'Short answer' }, { value: 'formula', label: 'Formula recall' }] },
              { label: 'Difficulty', key: 'difficulty', type: 'select',
                options: [{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }] },
              { label: 'Questions', key: 'count', type: 'select',
                options: [3,5,8,10].map(n => ({ value: n, label: `${n} questions` })) },
            ].map(field => (
              <div key={field.key}>
                <label className="text-label mb-1.5 block text-[#94A3B8]">{field.label}</label>
                <select
                  value={config[field.key]}
                  onChange={e => setConfig({ ...config, [field.key]: field.key === 'count' ? Number(e.target.value) : e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none border transition-colors
                    bg-[#F8FAFC] dark:bg-[#0B0F1A] border-[#E2E8F0] dark:border-[#1F2937]
                    text-[#0F172A] dark:text-[#F1F5F9] focus:border-indigo-400"
                >
                  {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Timed mode */}
          <div className="flex items-center justify-between p-4 rounded-xl mb-4 bg-[#F8FAFC] dark:bg-[#0B0F1A] border border-[#E2E8F0] dark:border-[#1F2937]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#EEF2FF] dark:bg-indigo-500/15">
                <i className="ti ti-clock" style={{ fontSize: 18, color: '#6366F1' }} aria-hidden="true"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]">Timed exam mode</p>
                <p className="text-caption text-[#94A3B8]">Auto-submits when time runs out</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {config.timedMode && (
                <select
                  value={config.timePerQuestion}
                  onChange={e => setConfig({ ...config, timePerQuestion: Number(e.target.value) })}
                  className="rounded-lg px-2 py-1.5 text-xs outline-none border
                    bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937]
                    text-[#0F172A] dark:text-[#F1F5F9]"
                >
                  <option value={30}>30s / question</option>
                  <option value={60}>1 min / question</option>
                  <option value={90}>90s / question</option>
                  <option value={120}>2 min / question</option>
                </select>
              )}
              <button
                onClick={() => setConfig({ ...config, timedMode: !config.timedMode })}
                className="relative w-11 h-6 rounded-full transition-colors duration-200"
                style={{ background: config.timedMode ? '#6366F1' : '#E2E8F0' }}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${config.timedMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          <button onClick={handleGenerate} disabled={generating} className="btn-primary text-sm">
            {generating
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
              : <><i className="ti ti-sparkles" style={{ fontSize: 16 }} aria-hidden="true"></i>Generate quiz</>}
          </button>

          {error && (
            <div className="mt-3 px-4 py-3 rounded-xl text-sm bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30">
              {error}
            </div>
          )}
        </div>

        {/* Timer */}
        {timerActive && timeLeft > 0 && (
          <div className="p-4 mb-6 flex items-center gap-4 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-50 dark:bg-red-500/10">
              <i className="ti ti-clock" style={{ fontSize: 18, color: timerColor }} aria-hidden="true"></i>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium text-[#0F172A] dark:text-[#F1F5F9]">Time remaining</span>
                <span className="font-mono font-semibold" style={{ color: timerColor }}>{formatTime(timeLeft)}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${timerPct * 100}%`, background: timerColor, transition: 'width 1s linear' }} />
              </div>
            </div>
            <span className="text-caption flex-shrink-0 text-[#94A3B8]">{config.timePerQuestion}s/q</span>
          </div>
        )}

        {/* Score banner */}
        {score && (
          <div className="p-5 mb-6 rounded-2xl border shadow-sm bg-white dark:bg-[#141B2D]"
            style={{ borderColor: score.correct / score.total >= 0.7 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold" style={{ color: score.correct / score.total >= 0.7 ? '#16A34A' : '#DC2626', letterSpacing: '-1px' }}>
                  {Math.round((score.correct / score.total) * 100)}%
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                    {score.auto ? "Time's up — quiz submitted" : score.correct / score.total >= 0.7 ? 'Great job!' : 'Keep studying!'}
                  </p>
                  <p className="text-caption mt-0.5 text-[#64748B] dark:text-[#94A3B8]">
                    {score.correct}/{score.total} correct
                    {score.timeTaken && ` · ${formatTime(score.timeTaken)}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportQuizPDF({ questions, answers, evaluations, score, config })}
                  className="btn-secondary text-xs py-2 px-3">
                  <i className="ti ti-download" style={{ fontSize: 13 }} aria-hidden="true"></i>
                  Download PDF
                </button>
                <button onClick={handleReset} className="btn-primary text-xs py-2 px-3">Try again</button>
              </div>
            </div>
          </div>
        )}

        {/* Questions */}
        {questions.length > 0 && (
          <div className="flex flex-col gap-4">
            {questions.map((q, qi) => (
              <div key={qi} className="p-5 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-semibold bg-[#EEF2FF] dark:bg-indigo-500/15"
                    style={{ color: '#6366F1' }}>
                    {qi + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] leading-relaxed">{q.question}</p>
                    <div className="flex gap-1.5 mt-2">
                      <span className="badge badge-indigo">{q.topic || 'Engineering'}</span>
                      <span className="badge bg-[#F8FAFC] dark:bg-[#0B0F1A] text-[#64748B] dark:text-[#94A3B8]">{q.difficulty}</span>
                    </div>
                  </div>
                </div>

                {/* MCQ */}
                {q.type === 'mcq' && q.options && (
                  <div className="flex flex-col gap-2 ml-10">
                    {q.options.map((opt, oi) => {
                      const letter = ['A','B','C','D'][oi]
                      const isSelected = answers[qi] === letter
                      const isCorrect  = submitted && letter === q.correct_answer
                      const isWrong    = submitted && isSelected && !isCorrect
                      let bgClass = 'bg-[#F8FAFC] dark:bg-[#0B0F1A]'
                      let borderClass = 'border-[#E2E8F0] dark:border-[#1F2937]'
                      let textClass = 'text-[#374151] dark:text-[#CBD5E1]'
                      if (isCorrect) { bgClass = 'bg-emerald-50 dark:bg-emerald-500/10'; borderClass = 'border-emerald-300 dark:border-emerald-500/40'; textClass = 'text-emerald-600 dark:text-emerald-300' }
                      else if (isWrong) { bgClass = 'bg-red-50 dark:bg-red-500/10'; borderClass = 'border-red-300 dark:border-red-500/40'; textClass = 'text-red-600 dark:text-red-300' }
                      else if (isSelected) { bgClass = 'bg-[#EEF2FF] dark:bg-indigo-500/10'; borderClass = 'border-indigo-300 dark:border-indigo-500/40'; textClass = 'text-indigo-700 dark:text-indigo-300' }
                      return (
                        <button
                          key={oi}
                          onClick={() => handleMCQAnswer(qi, letter)}
                          disabled={submitted}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left border transition-all ${bgClass} ${borderClass} ${textClass}`}
                          style={{ cursor: submitted ? 'default' : 'pointer' }}
                        >
                          <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-semibold flex-shrink-0 bg-black/5 dark:bg-white/10">
                            {letter}
                          </span>
                          {opt.replace(/^[A-D]\.\s*/, '')}
                          {isCorrect && <i className="ti ti-check ml-auto" style={{ fontSize: 15 }} aria-hidden="true"></i>}
                          {isWrong && <i className="ti ti-x ml-auto" style={{ fontSize: 15 }} aria-hidden="true"></i>}
                        </button>
                      )
                    })}
                    {submitted && q.explanation && (
                      <div className="mt-1 px-4 py-3 rounded-xl text-xs leading-relaxed bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
                        style={{ borderLeft: '3px solid #22D3EE' }}>
                        <span className="font-semibold">Explanation: </span>{q.explanation}
                      </div>
                    )}
                  </div>
                )}

                {/* Short / Formula */}
                {(q.type === 'short' || q.type === 'formula') && (
                  <div className="ml-10">
                    <textarea
                      value={answers[qi] || ''}
                      onChange={e => handleTextAnswer(qi, e.target.value)}
                      disabled={!!evaluations[qi]}
                      placeholder="Type your answer here..."
                      rows={3}
                      className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none border transition-colors
                        bg-[#F8FAFC] dark:bg-[#0B0F1A] border-[#E2E8F0] dark:border-[#1F2937]
                        text-[#0F172A] dark:text-[#F1F5F9] placeholder-slate-400 focus:border-indigo-400"
                    />
                    {!evaluations[qi] && !submitted && (
                      <button
                        onClick={() => handleEvaluateShort(qi)}
                        disabled={!answers[qi]}
                        className="btn-secondary text-xs py-1.5 px-3 mt-2">
                        Check answer
                      </button>
                    )}
                    {evaluations[qi] && (
                      <div className="mt-3 px-4 py-3 rounded-xl text-xs leading-relaxed"
                        style={{
                          background: evaluations[qi].is_correct ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          borderLeft: `3px solid ${evaluations[qi].is_correct ? '#10B981' : '#EF4444'}`,
                        }}>
                        <p className="font-semibold mb-1 text-[#0F172A] dark:text-[#F1F5F9]">Score: {evaluations[qi].score}/100 · {evaluations[qi].is_correct ? 'Correct' : 'Needs review'}</p>
                        <p className="text-[#64748B] dark:text-[#94A3B8]">{evaluations[qi].feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {!submitted && (
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting || Object.keys(answers).length === 0}
                className="btn-primary justify-center py-3 text-sm"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
              >
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</>
                  : <><i className="ti ti-check" style={{ fontSize: 16 }} aria-hidden="true"></i>Submit quiz</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}