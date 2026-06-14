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
  const timerRef                      = useRef(null)

  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            setTimerActive(false)
            handleSubmit(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [timerActive])

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const getTimerColor = () => {
    const total = config.timePerQuestion * questions.length
    const pct = timeLeft / total
    if (pct > 0.5) return 'text-emerald-500'
    if (pct > 0.25) return 'text-amber-500'
    return 'text-red-500'
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setQuestions([])
    setAnswers({})
    setEvaluations({})
    setScore(null)
    setSubmitted(false)
    clearInterval(timerRef.current)
    setTimerActive(false)
    try {
      const data = await generateQuiz(
        config.topic || 'General Engineering',
        config.quizType, config.difficulty, config.count
      )
      setQuestions(data.questions)
      if (config.timedMode) {
        const totalTime = config.timePerQuestion * data.questions.length
        setTimeLeft(totalTime)
        setStartTime(Date.now())
        setTimerActive(true)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate quiz')
    } finally {
      setGenerating(false)
    }
  }

  const handleMCQAnswer = (qIndex, optionLetter) => {
    if (submitted) return
    setAnswers(prev => ({ ...prev, [qIndex]: optionLetter }))
  }

  const handleTextAnswer = (qIndex, value) => {
    setAnswers(prev => ({ ...prev, [qIndex]: value }))
  }

  const handleEvaluateShort = async (qIndex) => {
    const q = questions[qIndex]
    const studentAnswer = answers[qIndex]
    if (!studentAnswer) return
    try {
      const result = await evaluateAnswer(q.question, studentAnswer, q.answer, q.key_points || [])
      setEvaluations(prev => ({ ...prev, [qIndex]: result }))
    } catch (err) { console.error(err) }
  }

  const handleSubmit = async (autoSubmit = false) => {
    if (submitting) return
    setSubmitting(true)
    clearInterval(timerRef.current)
    setTimerActive(false)
    const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : null
    let correct = 0
    questions.forEach((q, i) => {
      if (q.type === 'mcq' && answers[i] === q.correct_answer) correct++
      if ((q.type === 'short' || q.type === 'formula') && evaluations[i]?.is_correct) correct++
    })
    try {
      await submitQuiz({
        topic: config.topic || 'General Engineering',
        quiz_type: config.quizType,
        difficulty: config.difficulty,
        total_questions: questions.length,
        correct_answers: correct,
        questions_data: JSON.stringify(questions),
        time_taken_seconds: timeTaken,
        is_timed_exam: config.timedMode,
      })
      setScore({ correct, total: questions.length, timeTaken, autoSubmit })
      setSubmitted(true)
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }

  const handleReset = () => {
    setQuestions([]); setAnswers({}); setEvaluations({})
    setScore(null); setSubmitted(false)
    clearInterval(timerRef.current)
    setTimerActive(false); setTimeLeft(0); setStartTime(null)
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-muted dark:bg-[#0F172A] transition-colors duration-200 p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-white">Quiz generator</h1>
          <p className="text-sm text-ink-500 mt-1">AI-generated questions from your uploaded study materials</p>
        </div>

        {/* Config card */}
        <div className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl p-4 mb-6 shadow-soft">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-500">Topic</label>
              <select
                value={config.topic}
                onChange={e => setConfig({ ...config, topic: e.target.value })}
                className="bg-surface-muted dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-xl px-3 py-2 text-sm text-ink-900 dark:text-white outline-none focus:border-primary-400 transition-colors"
              >
                <option value="">Any topic</option>
                {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-500">Type</label>
              <select
                value={config.quizType}
                onChange={e => setConfig({ ...config, quizType: e.target.value })}
                className="bg-surface-muted dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-xl px-3 py-2 text-sm text-ink-900 dark:text-white outline-none focus:border-primary-400 transition-colors"
              >
                <option value="mcq">Multiple Choice</option>
                <option value="short">Short Answer</option>
                <option value="formula">Formula Recall</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-500">Difficulty</label>
              <select
                value={config.difficulty}
                onChange={e => setConfig({ ...config, difficulty: e.target.value })}
                className="bg-surface-muted dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-xl px-3 py-2 text-sm text-ink-900 dark:text-white outline-none focus:border-primary-400 transition-colors"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-500">Questions</label>
              <select
                value={config.count}
                onChange={e => setConfig({ ...config, count: Number(e.target.value) })}
                className="bg-surface-muted dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-xl px-3 py-2 text-sm text-ink-900 dark:text-white outline-none focus:border-primary-400 transition-colors"
              >
                {[3,5,8,10].map(n => <option key={n} value={n}>{n} questions</option>)}
              </select>
            </div>
          </div>

          {/* Timed mode toggle */}
          <div className="mt-4 flex items-center justify-between bg-surface-muted dark:bg-[#1E293B] rounded-xl px-4 py-3 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-600/15 text-primary-600 dark:text-primary-300 flex items-center justify-center flex-shrink-0">
                <i className="ti ti-clock" style={{ fontSize: 18 }} aria-hidden="true"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-ink-900 dark:text-white">Timed exam mode</p>
                <p className="text-xs text-ink-400 mt-0.5">Simulates real exam pressure — auto-submits when time runs out</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {config.timedMode && (
                <select
                  value={config.timePerQuestion}
                  onChange={e => setConfig({ ...config, timePerQuestion: Number(e.target.value) })}
                  className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-lg px-2 py-1.5 text-xs text-ink-900 dark:text-white outline-none"
                >
                  <option value={30}>30s / question</option>
                  <option value={60}>1min / question</option>
                  <option value={90}>90s / question</option>
                  <option value={120}>2min / question</option>
                </select>
              )}
              <button
                onClick={() => setConfig({ ...config, timedMode: !config.timedMode })}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${config.timedMode ? 'bg-primary-600' : 'bg-surface-border dark:bg-[#334155]'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${config.timedMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-xl px-6 py-2.5 text-sm transition-colors flex items-center gap-2"
          >
            {generating ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
            ) : <><i className="ti ti-sparkles" style={{ fontSize: 16 }} aria-hidden="true"></i>Generate quiz</>}
          </button>

          {error && (
            <p className="mt-3 text-xs text-red-500 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Timer bar */}
        {timerActive && timeLeft > 0 && (
          <div className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl px-5 py-3 mb-6 flex items-center justify-between shadow-soft">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-ink-900 dark:text-white">Time remaining</span>
              <span className={`text-xl font-mono font-bold ${getTimerColor()}`}>{formatTime(timeLeft)}</span>
            </div>
            <div className="flex-1 mx-6 h-2 bg-surface-muted dark:bg-[#334155] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  timeLeft / (config.timePerQuestion * questions.length) > 0.5 ? 'bg-emerald-500' :
                  timeLeft / (config.timePerQuestion * questions.length) > 0.25 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${(timeLeft / (config.timePerQuestion * questions.length)) * 100}%` }}
              />
            </div>
            <span className="text-xs text-ink-400">{config.count} questions · {config.timePerQuestion}s each</span>
          </div>
        )}

        {/* Score banner */}
        {score && (
          <div className={`mb-6 rounded-2xl p-4 border shadow-soft
            ${score.autoSubmit ? 'bg-amber-50 dark:bg-amber-400/10 border-amber-200 dark:border-amber-400/30' :
              score.correct / score.total >= 0.7 ? 'bg-emerald-50 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-400/30' :
              'bg-red-50 dark:bg-red-400/10 border-red-200 dark:border-red-400/30'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-ink-900 dark:text-white">
                  {score.autoSubmit ? "Time's up! Quiz auto-submitted" :
                   score.correct / score.total >= 0.7 ? 'Great job!' : 'Keep studying!'}
                </p>
                <p className="text-sm text-ink-500 mt-0.5">
                  You got {score.correct} out of {score.total} correct
                  ({Math.round((score.correct / score.total) * 100)}%)
                  {score.timeTaken && ` · Completed in ${formatTime(score.timeTaken)}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => exportQuizPDF({ questions, answers, evaluations, score, config })}
                  className="text-sm bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <i className="ti ti-download" style={{ fontSize: 14 }} aria-hidden="true"></i>
                  Download PDF
                </button>
                <button onClick={handleReset} className="text-sm text-primary-600 dark:text-primary-300 hover:underline">
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Questions */}
        {questions.length > 0 && (
          <div className="flex flex-col gap-4">
            {questions.map((q, qIndex) => (
              <div key={qIndex} className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl p-5 shadow-soft">

                <div className="flex items-start gap-3 mb-4">
                  <span className="text-xs font-mono text-ink-400 mt-0.5 flex-shrink-0">Q{qIndex + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-900 dark:text-white leading-relaxed">{q.question}</p>
                    <div className="flex gap-2 mt-1.5">
                      <span className="text-[10px] text-ink-500 bg-surface-muted dark:bg-[#334155] px-2 py-0.5 rounded-full">{q.topic || 'Engineering'}</span>
                      <span className="text-[10px] text-ink-500 bg-surface-muted dark:bg-[#334155] px-2 py-0.5 rounded-full capitalize">{q.difficulty}</span>
                    </div>
                  </div>
                </div>

                {/* MCQ */}
                {q.type === 'mcq' && q.options && (
                  <div className="flex flex-col gap-2">
                    {q.options.map((option, oIndex) => {
                      const letter = ['A','B','C','D'][oIndex]
                      const isSelected = answers[qIndex] === letter
                      const isCorrect  = submitted && letter === q.correct_answer
                      const isWrong    = submitted && isSelected && letter !== q.correct_answer
                      return (
                        <button
                          key={oIndex}
                          onClick={() => handleMCQAnswer(qIndex, letter)}
                          disabled={submitted}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-left border transition-all
                            ${isCorrect  ? 'bg-emerald-50 dark:bg-emerald-400/15 border-emerald-300 dark:border-emerald-400/50 text-emerald-600 dark:text-emerald-400' :
                              isWrong    ? 'bg-red-50 dark:bg-red-400/15 border-red-200 dark:border-red-400/50 text-red-500 dark:text-red-400' :
                              isSelected ? 'bg-primary-50 dark:bg-primary-600/15 border-primary-300 dark:border-primary-500/50 text-primary-700 dark:text-primary-300' :
                              'bg-surface-muted dark:bg-[#1E293B] border-surface-border dark:border-[#334155] text-ink-700 dark:text-gray-300 hover:border-primary-300'}
                            ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-[10px] font-mono flex-shrink-0">{letter}</span>
                          {option.replace(/^[A-D]\.\s*/, '')}
                        </button>
                      )
                    })}
                    {submitted && q.explanation && (
                      <div className="mt-2 bg-surface-muted dark:bg-[#1E293B] rounded-xl px-4 py-3 text-xs text-ink-500 border-l-2 border-emerald-400">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Explanation: </span>{q.explanation}
                      </div>
                    )}
                  </div>
                )}

                {/* Short / Formula */}
                {(q.type === 'short' || q.type === 'formula') && (
                  <div>
                    <textarea
                      value={answers[qIndex] || ''}
                      onChange={e => handleTextAnswer(qIndex, e.target.value)}
                      disabled={!!evaluations[qIndex]}
                      placeholder="Type your answer here..."
                      rows={3}
                      className="w-full bg-surface-muted dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] focus:border-primary-400 rounded-xl px-3 py-2.5 text-sm text-ink-900 dark:text-white placeholder-ink-400 outline-none resize-none transition-colors"
                    />
                    {!evaluations[qIndex] && !submitted && (
                      <button
                        onClick={() => handleEvaluateShort(qIndex)}
                        disabled={!answers[qIndex]}
                        className="mt-2 text-xs bg-surface-muted dark:bg-[#1E293B] hover:bg-surface-border dark:hover:bg-[#334155] border border-surface-border dark:border-[#334155] text-ink-700 dark:text-gray-300 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40"
                      >
                        Check answer
                      </button>
                    )}
                    {evaluations[qIndex] && (
                      <div className={`mt-3 rounded-xl px-4 py-3 text-xs border-l-2
                        ${evaluations[qIndex].is_correct
                          ? 'bg-emerald-50 dark:bg-emerald-400/10 border-emerald-400 text-emerald-600 dark:text-emerald-300'
                          : 'bg-red-50 dark:bg-red-400/10 border-red-400 text-red-500 dark:text-red-300'}`}>
                        <p className="font-medium mb-1">
                          Score: {evaluations[qIndex].score}/100
                          {evaluations[qIndex].is_correct ? ' ✓ Correct' : ' ✗ Needs review'}
                        </p>
                        <p className="text-ink-500">{evaluations[qIndex].feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Submit */}
            {!submitted && (
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting || Object.keys(answers).length === 0}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</>
                ) : 'Submit quiz'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}