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
    if (pct > 0.5) return 'text-[#5de0b0]'
    if (pct > 0.25) return 'text-[#f7a84a]'
    return 'text-red-400'
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
    <div className="h-full overflow-y-auto p-6 bg-gray-50 dark:bg-[#0f0f13] transition-colors duration-200">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Quiz Generator</h1>
        <p className="text-sm text-gray-500 mt-1">AI-generated questions from your uploaded study materials</p>
      </div>

      {/* Config card */}
      <div className="bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] rounded-xl p-4 mb-6 transition-colors">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Topic</label>
            <select
              value={config.topic}
              onChange={e => setConfig({ ...config, topic: e.target.value })}
              className="bg-gray-50 dark:bg-[#222230] border border-gray-200 dark:border-[#333344] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#7c6af7] transition-colors"
            >
              <option value="">Any topic</option>
              {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Type</label>
            <select
              value={config.quizType}
              onChange={e => setConfig({ ...config, quizType: e.target.value })}
              className="bg-gray-50 dark:bg-[#222230] border border-gray-200 dark:border-[#333344] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#7c6af7] transition-colors"
            >
              <option value="mcq">Multiple Choice</option>
              <option value="short">Short Answer</option>
              <option value="formula">Formula Recall</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Difficulty</label>
            <select
              value={config.difficulty}
              onChange={e => setConfig({ ...config, difficulty: e.target.value })}
              className="bg-gray-50 dark:bg-[#222230] border border-gray-200 dark:border-[#333344] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#7c6af7] transition-colors"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Questions</label>
            <select
              value={config.count}
              onChange={e => setConfig({ ...config, count: Number(e.target.value) })}
              className="bg-gray-50 dark:bg-[#222230] border border-gray-200 dark:border-[#333344] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#7c6af7] transition-colors"
            >
              {[3,5,8,10].map(n => <option key={n} value={n}>{n} questions</option>)}
            </select>
          </div>
        </div>

        {/* Timed mode toggle */}
        <div className="mt-4 flex items-center justify-between bg-gray-50 dark:bg-[#222230] border border-gray-200 dark:border-transparent rounded-xl px-4 py-3 transition-colors">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">⏱️ Timed Exam Mode</p>
            <p className="text-xs text-gray-500 mt-0.5">Simulates real exam pressure — auto-submits when time runs out</p>
          </div>
          <div className="flex items-center gap-3">
            {config.timedMode && (
              <select
                value={config.timePerQuestion}
                onChange={e => setConfig({ ...config, timePerQuestion: Number(e.target.value) })}
                className="bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#333344] rounded-lg px-2 py-1.5 text-xs text-gray-900 dark:text-white outline-none"
              >
                <option value={30}>30s / question</option>
                <option value={60}>1min / question</option>
                <option value={90}>90s / question</option>
                <option value={120}>2min / question</option>
              </select>
            )}
            <button
              onClick={() => setConfig({ ...config, timedMode: !config.timedMode })}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${config.timedMode ? 'bg-[#7c6af7]' : 'bg-gray-300 dark:bg-[#333344]'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${config.timedMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="mt-4 bg-[#7c6af7] hover:bg-[#6b5ce7] disabled:opacity-50 text-white font-medium rounded-xl px-6 py-2.5 text-sm transition-colors flex items-center gap-2"
        >
          {generating ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
          ) : '✨ Generate Quiz'}
        </button>

        {error && (
          <p className="mt-3 text-xs text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>

      {/* Timer bar */}
      {timerActive && timeLeft > 0 && (
        <div className="bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] rounded-xl px-5 py-3 mb-6 flex items-center justify-between transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-900 dark:text-white">⏱️ Time remaining</span>
            <span className={`text-xl font-mono font-bold ${getTimerColor()}`}>{formatTime(timeLeft)}</span>
          </div>
          <div className="flex-1 mx-6 h-2 bg-gray-100 dark:bg-[#222230] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                timeLeft / (config.timePerQuestion * questions.length) > 0.5 ? 'bg-[#5de0b0]' :
                timeLeft / (config.timePerQuestion * questions.length) > 0.25 ? 'bg-[#f7a84a]' : 'bg-red-400'
              }`}
              style={{ width: `${(timeLeft / (config.timePerQuestion * questions.length)) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{config.count} questions · {config.timePerQuestion}s each</span>
        </div>
      )}

      {/* Score banner */}
      {score && (
        <div className={`mb-6 rounded-xl p-4 border
          ${score.autoSubmit ? 'bg-yellow-50 dark:bg-yellow-400/10 border-yellow-200 dark:border-yellow-400/30' :
            score.correct / score.total >= 0.7 ? 'bg-emerald-50 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-400/30' :
            'bg-red-50 dark:bg-red-400/10 border-red-200 dark:border-red-400/30'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {score.autoSubmit ? '⏰ Time\'s up! Quiz auto-submitted' :
                 score.correct / score.total >= 0.7 ? '🎉 Great job!' : '📚 Keep studying!'}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                You got {score.correct} out of {score.total} correct
                ({Math.round((score.correct / score.total) * 100)}%)
                {score.timeTaken && ` · Completed in ${formatTime(score.timeTaken)}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => exportQuizPDF({ questions, answers, evaluations, score, config })}
                className="text-sm bg-[#7c6af7] hover:bg-[#6b5ce7] text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                📥 Download PDF
              </button>
              <button onClick={handleReset} className="text-sm text-[#7c6af7] hover:underline">
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
            <div key={qIndex} className="bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] rounded-xl p-5 transition-colors">

              <div className="flex items-start gap-3 mb-4">
                <span className="text-xs font-mono text-gray-400 mt-0.5 flex-shrink-0">Q{qIndex + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">{q.question}</p>
                  <div className="flex gap-2 mt-1.5">
                    <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-[#222230] px-2 py-0.5 rounded-full">{q.topic || 'Engineering'}</span>
                    <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-[#222230] px-2 py-0.5 rounded-full capitalize">{q.difficulty}</span>
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
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-left border transition-all
                          ${isCorrect  ? 'bg-emerald-50 dark:bg-emerald-400/15 border-emerald-300 dark:border-emerald-400/50 text-emerald-600 dark:text-emerald-400' :
                            isWrong    ? 'bg-red-50 dark:bg-red-400/15 border-red-200 dark:border-red-400/50 text-red-500 dark:text-red-400' :
                            isSelected ? 'bg-[#7c6af7]/10 border-[#7c6af7]/50 text-[#7c6af7]' :
                            'bg-gray-50 dark:bg-[#222230] border-gray-200 dark:border-[#333344] text-gray-700 dark:text-gray-300 hover:border-[#7c6af7]/40'}
                          ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-[10px] font-mono flex-shrink-0">{letter}</span>
                        {option.replace(/^[A-D]\.\s*/, '')}
                      </button>
                    )
                  })}
                  {submitted && q.explanation && (
                    <div className="mt-2 bg-gray-50 dark:bg-[#222230] rounded-lg px-4 py-3 text-xs text-gray-500 dark:text-gray-400 border-l-2 border-[#5de0b0]">
                      <span className="text-[#5de0b0] font-medium">Explanation: </span>{q.explanation}
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
                    className="w-full bg-gray-50 dark:bg-[#222230] border border-gray-200 dark:border-[#333344] focus:border-[#7c6af7] rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none resize-none transition-colors"
                  />
                  {!evaluations[qIndex] && !submitted && (
                    <button
                      onClick={() => handleEvaluateShort(qIndex)}
                      disabled={!answers[qIndex]}
                      className="mt-2 text-xs bg-gray-100 dark:bg-[#222230] hover:bg-gray-200 dark:hover:bg-[#2a2a3a] border border-gray-200 dark:border-[#333344] text-gray-600 dark:text-gray-300 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40"
                    >
                      Check answer
                    </button>
                  )}
                  {evaluations[qIndex] && (
                    <div className={`mt-3 rounded-lg px-4 py-3 text-xs border-l-2
                      ${evaluations[qIndex].is_correct
                        ? 'bg-emerald-50 dark:bg-emerald-400/10 border-emerald-400 text-emerald-600 dark:text-emerald-300'
                        : 'bg-red-50 dark:bg-red-400/10 border-red-400 text-red-500 dark:text-red-300'}`}>
                      <p className="font-medium mb-1">
                        Score: {evaluations[qIndex].score}/100
                        {evaluations[qIndex].is_correct ? ' ✓ Correct' : ' ✗ Needs review'}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400">{evaluations[qIndex].feedback}</p>
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
              className="bg-[#5de0b0] hover:bg-[#4bc99d] disabled:opacity-40 text-[#0f0f13] font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-[#0f0f13]/30 border-t-[#0f0f13] rounded-full animate-spin" />Submitting...</>
              ) : 'Submit Quiz'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}