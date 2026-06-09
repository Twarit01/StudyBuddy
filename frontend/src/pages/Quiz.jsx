import { useState } from 'react'
import { generateQuiz, evaluateAnswer, submitQuiz } from '../api/quiz'

const TOPICS = [
  'Circuit Analysis', 'Thermodynamics', 'Fluid Mechanics',
  'Control Systems', 'Digital Logic', 'Structural Analysis',
  'Electromagnetics', 'Signal Processing', 'Engineering Mathematics',
]

export default function Quiz() {
  const [config, setConfig] = useState({
    topic: '',
    quizType: 'mcq',
    difficulty: 'medium',
    count: 5,
  })
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [evaluations, setEvaluations] = useState({})
  const [score, setScore] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setQuestions([])
    setAnswers({})
    setEvaluations({})
    setScore(null)
    setSubmitted(false)

    try {
      const data = await generateQuiz(
        config.topic || 'General Engineering',
        config.quizType,
        config.difficulty,
        config.count
      )
      setQuestions(data.questions)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate quiz')
    } finally {
      setGenerating(false)
    }
  }

  const handleMCQAnswer = (qIndex, optionLetter) => {
    if (submitted) return
    setAnswers((prev) => ({ ...prev, [qIndex]: optionLetter }))
  }

  const handleTextAnswer = (qIndex, value) => {
    setAnswers((prev) => ({ ...prev, [qIndex]: value }))
  }

  const handleEvaluateShort = async (qIndex) => {
    const q = questions[qIndex]
    const studentAnswer = answers[qIndex]
    if (!studentAnswer) return

    try {
      const result = await evaluateAnswer(
        q.question,
        studentAnswer,
        q.answer,
        q.key_points || []
      )
      setEvaluations((prev) => ({ ...prev, [qIndex]: result }))
    } catch (err) {
      console.error('Evaluation failed', err)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)

    // Calculate MCQ score
    let correct = 0
    questions.forEach((q, i) => {
      if (q.type === 'mcq' && answers[i] === q.correct_answer) {
        correct++
      }
      if ((q.type === 'short' || q.type === 'formula') && evaluations[i]?.is_correct) {
        correct++
      }
    })

    const scoreData = {
      topic: config.topic || 'General Engineering',
      quiz_type: config.quizType,
      difficulty: config.difficulty,
      total_questions: questions.length,
      correct_answers: correct,
      questions_data: JSON.stringify(questions),
    }

    try {
      await submitQuiz(scoreData)
      setScore({ correct, total: questions.length })
      setSubmitted(true)
    } catch (err) {
      console.error('Failed to submit quiz', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setQuestions([])
    setAnswers({})
    setEvaluations({})
    setScore(null)
    setSubmitted(false)
  }

  return (
    <div className="h-full overflow-y-auto p-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Quiz Generator</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI-generated questions from your uploaded study materials
        </p>
      </div>

      {/* Config */}
      <div className="bg-[#18181f] border border-[#222230] rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Topic */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-400">Topic</label>
            <select
              value={config.topic}
              onChange={(e) => setConfig({ ...config, topic: e.target.value })}
              className="bg-[#222230] border border-[#333344] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#7c6af7] transition-colors"
            >
              <option value="">Any topic</option>
              {TOPICS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-400">Type</label>
            <select
              value={config.quizType}
              onChange={(e) => setConfig({ ...config, quizType: e.target.value })}
              className="bg-[#222230] border border-[#333344] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#7c6af7] transition-colors"
            >
              <option value="mcq">Multiple Choice</option>
              <option value="short">Short Answer</option>
              <option value="formula">Formula Recall</option>
            </select>
          </div>

          {/* Difficulty */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-400">Difficulty</label>
            <select
              value={config.difficulty}
              onChange={(e) => setConfig({ ...config, difficulty: e.target.value })}
              className="bg-[#222230] border border-[#333344] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#7c6af7] transition-colors"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* Count */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-400">Questions</label>
            <select
              value={config.count}
              onChange={(e) => setConfig({ ...config, count: Number(e.target.value) })}
              className="bg-[#222230] border border-[#333344] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#7c6af7] transition-colors"
            >
              {[3, 5, 8, 10].map((n) => (
                <option key={n} value={n}>{n} questions</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="mt-4 bg-[#7c6af7] hover:bg-[#6b5ce7] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl px-6 py-2.5 text-sm transition-colors flex items-center gap-2"
        >
          {generating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating...
            </>
          ) : '✨ Generate Quiz'}
        </button>

        {error && (
          <p className="mt-3 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Score banner */}
      {score && (
        <div className={`
          mb-6 rounded-xl p-4 border flex items-center justify-between
          ${score.correct / score.total >= 0.7
            ? 'bg-emerald-400/10 border-emerald-400/30'
            : 'bg-red-400/10 border-red-400/30'
          }
        `}>
          <div>
            <p className="font-semibold">
              {score.correct / score.total >= 0.7 ? '🎉 Great job!' : '📚 Keep studying!'}
            </p>
            <p className="text-sm text-gray-400 mt-0.5">
              You got {score.correct} out of {score.total} correct
              ({Math.round((score.correct / score.total) * 100)}%)
            </p>
          </div>
          <button
            onClick={handleReset}
            className="text-sm text-[#7c6af7] hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Questions */}
      {questions.length > 0 && (
        <div className="flex flex-col gap-4">
          {questions.map((q, qIndex) => (
            <div
              key={qIndex}
              className="bg-[#18181f] border border-[#222230] rounded-xl p-5"
            >
              {/* Question header */}
              <div className="flex items-start gap-3 mb-4">
                <span className="text-xs font-mono text-gray-600 mt-0.5 flex-shrink-0">
                  Q{qIndex + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium leading-relaxed">{q.question}</p>
                  <div className="flex gap-2 mt-1.5">
                    <span className="text-[10px] text-gray-600 bg-[#222230] px-2 py-0.5 rounded-full">
                      {q.topic || 'Engineering'}
                    </span>
                    <span className="text-[10px] text-gray-600 bg-[#222230] px-2 py-0.5 rounded-full capitalize">
                      {q.difficulty}
                    </span>
                  </div>
                </div>
              </div>

              {/* MCQ options */}
              {q.type === 'mcq' && q.options && (
                <div className="flex flex-col gap-2">
                  {q.options.map((option, oIndex) => {
                    const letter = ['A', 'B', 'C', 'D'][oIndex]
                    const isSelected = answers[qIndex] === letter
                    const isCorrect = submitted && letter === q.correct_answer
                    const isWrong = submitted && isSelected && letter !== q.correct_answer

                    return (
                      <button
                        key={oIndex}
                        onClick={() => handleMCQAnswer(qIndex, letter)}
                        disabled={submitted}
                        className={`
                          flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-left
                          border transition-all duration-150
                          ${isCorrect ? 'bg-emerald-400/15 border-emerald-400/50 text-emerald-400' :
                            isWrong ? 'bg-red-400/15 border-red-400/50 text-red-400' :
                            isSelected ? 'bg-[#7c6af7]/15 border-[#7c6af7]/50 text-[#7c6af7]' :
                            'bg-[#222230] border-[#333344] text-gray-300 hover:border-[#7c6af7]/40'
                          }
                          ${submitted ? 'cursor-default' : 'cursor-pointer'}
                        `}
                      >
                        <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-[10px] font-mono flex-shrink-0">
                          {letter}
                        </span>
                        {option.replace(/^[A-D]\.\s*/, '')}
                      </button>
                    )
                  })}

                  {/* Explanation after submit */}
                  {submitted && q.explanation && (
                    <div className="mt-2 bg-[#222230] rounded-lg px-4 py-3 text-xs text-gray-400 border-l-2 border-[#5de0b0]">
                      <span className="text-[#5de0b0] font-medium">Explanation: </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              )}

              {/* Short / Formula answer */}
              {(q.type === 'short' || q.type === 'formula') && (
                <div>
                  <textarea
                    value={answers[qIndex] || ''}
                    onChange={(e) => handleTextAnswer(qIndex, e.target.value)}
                    disabled={!!evaluations[qIndex]}
                    placeholder="Type your answer here..."
                    rows={3}
                    className="w-full bg-[#222230] border border-[#333344] focus:border-[#7c6af7] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none resize-none transition-colors"
                  />
                  {!evaluations[qIndex] && !submitted && (
                    <button
                      onClick={() => handleEvaluateShort(qIndex)}
                      disabled={!answers[qIndex]}
                      className="mt-2 text-xs bg-[#222230] hover:bg-[#2a2a3a] border border-[#333344] text-gray-300 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40"
                    >
                      Check answer
                    </button>
                  )}

                  {/* Evaluation result */}
                  {evaluations[qIndex] && (
                    <div className={`
                      mt-3 rounded-lg px-4 py-3 text-xs border-l-2
                      ${evaluations[qIndex].is_correct
                        ? 'bg-emerald-400/10 border-emerald-400 text-emerald-300'
                        : 'bg-red-400/10 border-red-400 text-red-300'
                      }
                    `}>
                      <p className="font-medium mb-1">
                        Score: {evaluations[qIndex].score}/100
                        {evaluations[qIndex].is_correct ? ' ✓ Correct' : ' ✗ Needs review'}
                      </p>
                      <p className="text-gray-400">{evaluations[qIndex].feedback}</p>
                      {evaluations[qIndex].missing_points?.length > 0 && (
                        <p className="mt-1 text-gray-500">
                          Missing: {evaluations[qIndex].missing_points.join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Submit button */}
          {!submitted && (
            <button
              onClick={handleSubmit}
              disabled={submitting || Object.keys(answers).length === 0}
              className="bg-[#5de0b0] hover:bg-[#4bc99d] disabled:opacity-40 text-[#0f0f13] font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#0f0f13]/30 border-t-[#0f0f13] rounded-full animate-spin" />
                  Submitting...
                </>
              ) : 'Submit Quiz'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}