import { useState, useEffect } from 'react'
import { getQuizHistory } from '../api/quiz'
import { getFlashcardStats } from '../api/flashcards'
import { getSessions } from '../api/chat'
import { getStudyPlan } from '../api/progress'
import { exportStudyPlanPDF, exportProgressPDF } from '../utils/exportPDF'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'

export default function Progress() {
  const [quizHistory, setQuizHistory]       = useState([])
  const [fcStats, setFcStats]               = useState({})
  const [topicStats, setTopicStats]         = useState([])
  const [activityMap, setActivityMap]       = useState({})
  const [loading, setLoading]               = useState(true)
  const [streak, setStreak]                 = useState(0)
  const [studyPlan, setStudyPlan]           = useState(null)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [planError, setPlanError]           = useState(null)
  const [showPlan, setShowPlan]             = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [history, fc] = await Promise.all([
        getQuizHistory(),
        getFlashcardStats(),
      ])
      setQuizHistory(history)
      setFcStats(fc)

      const topicMap = {}
      history.forEach((attempt) => {
        const t = attempt.topic || 'General'
        if (!topicMap[t]) topicMap[t] = { correct: 0, total: 0 }
        topicMap[t].total   += attempt.total_questions
        topicMap[t].correct += attempt.correct_answers
      })
      const stats = Object.entries(topicMap).map(([topic, s]) => ({
        topic:     topic.length > 14 ? topic.slice(0, 14) + '…' : topic,
        fullTopic: topic,
        accuracy:  Math.round((s.correct / s.total) * 100),
        total:     s.total,
      }))
      setTopicStats(stats)

      const activity = {}
      history.forEach((a) => {
        const d = new Date(a.created_at).toISOString().split('T')[0]
        activity[d] = (activity[d] || 0) + 1
      })
      setActivityMap(activity)

      let s = 0
      const today = new Date()
      for (let i = 0; i < 365; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const key = d.toISOString().split('T')[0]
        if (activity[key]) s++
        else if (i > 0) break
      }
      setStreak(s)
    } catch (err) {
      console.error('Failed to load progress', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePlan = async () => {
    setGeneratingPlan(true)
    setPlanError(null)
    setShowPlan(false)
    try {
      const data = await getStudyPlan()
      setStudyPlan(data)
      setShowPlan(true)
    } catch (err) {
      setPlanError(err.response?.data?.detail || 'Failed to generate study plan')
    } finally {
      setGeneratingPlan(false)
    }
  }

  const avgScore = quizHistory.length
    ? Math.round(quizHistory.reduce((a, b) => a + b.score_percentage, 0) / quizHistory.length)
    : 0

  const statCards = [
    { label: 'Quizzes taken',  value: quizHistory.length,    icon: '📝', color: 'text-[#7c6af7]' },
    { label: 'Average score',  value: avgScore + '%',         icon: '🎯', color: 'text-[#5de0b0]' },
    { label: 'Cards mastered', value: fcStats.mastered || 0, icon: '🃏', color: 'text-[#f7a84a]' },
    { label: 'Study streak',   value: streak + ' days',       icon: '🔥', color: 'text-[#f76ab4]' },
  ]

  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const key = d.toISOString().split('T')[0]
    return { date: key, day: d.getDate(), count: activityMap[key] || 0 }
  })

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.length) {
      const d = payload[0].payload
      return (
        <div className="bg-white dark:bg-[#222230] border border-gray-200 dark:border-[#333344] rounded-lg px-3 py-2 text-xs shadow-lg">
          <p className="font-medium text-gray-900 dark:text-white">{d.fullTopic}</p>
          <p className="text-gray-500">{d.accuracy}% accuracy</p>
          <p className="text-gray-400">{d.total} questions</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-full overflow-y-auto p-6 bg-gray-50 dark:bg-[#0f0f13] transition-colors duration-200">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Progress</h1>
          <p className="text-sm text-gray-500 mt-1">Track your learning over time</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportProgressPDF({ quizHistory, fcStats, topicStats, streak })}
            className="flex items-center gap-2 bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] hover:border-[#7c6af7] text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl px-4 py-2.5 transition-all"
          >
            📥 Export Report
          </button>
          <button
            onClick={handleGeneratePlan}
            disabled={generatingPlan}
            className="flex items-center gap-2 bg-gradient-to-r from-[#7c6af7] to-[#5de0b0] hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-5 py-2.5 transition-all"
          >
            {generatingPlan ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
            ) : '✨ Generate Study Plan'}
          </button>
        </div>
      </div>

      {/* Study plan output */}
      {showPlan && studyPlan && (
        <div className="bg-gradient-to-br from-[#7c6af7]/10 to-[#5de0b0]/10 border border-[#7c6af7]/30 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#7c6af7]">✨ Your AI Study Plan</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => exportStudyPlanPDF({ studyPlan })}
                className="text-xs bg-[#7c6af7] hover:bg-[#6b5ce7] text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                📥 Download PDF
              </button>
              <button onClick={() => setShowPlan(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕ Close</button>
            </div>
          </div>
          {studyPlan.weak_topics?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {studyPlan.weak_topics.map((t) => (
                <span key={t.topic} className="text-xs bg-red-400/10 text-red-400 border border-red-400/20 px-2.5 py-1 rounded-full">
                  ⚠️ {t.topic} — {t.accuracy}%
                </span>
              ))}
            </div>
          )}
          {studyPlan.due_cards_today > 0 && (
            <p className="text-xs text-[#5de0b0] mb-3">
              📅 {studyPlan.due_cards_today} flashcard{studyPlan.due_cards_today > 1 ? 's' : ''} due today
            </p>
          )}
          <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {studyPlan.study_plan}
          </div>
        </div>
      )}

      {planError && (
        <div className="bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/30 rounded-xl px-4 py-3 text-sm text-red-500 dark:text-red-400 mb-6">
          {planError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#7c6af7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {statCards.map((card) => (
              <div key={card.label} className="bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] rounded-xl p-4 transition-colors">
                <div className="text-xl mb-2">{card.icon}</div>
                <div className={`text-2xl font-semibold ${card.color}`}>{card.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Topic chart */}
          <div className="bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] rounded-xl p-5 mb-4 transition-colors">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Topic performance</h2>
            {topicStats.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <span className="text-2xl mb-2">📊</span>
                <p className="text-sm text-gray-500">No quiz data yet</p>
                <p className="text-xs text-gray-400 mt-1">Take a quiz to see your topic breakdown</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topicStats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="topic" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,106,247,0.05)' }} />
                  <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                    {topicStats.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.accuracy >= 80 ? '#5de0b0' : entry.accuracy >= 60 ? '#f7a84a' : '#f76a6a'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Flashcard + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

            <div className="bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] rounded-xl p-5 transition-colors">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Flashcard breakdown</h2>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Total cards',  value: fcStats.total     || 0, color: 'bg-gray-400' },
                  { label: 'Mastered',     value: fcStats.mastered  || 0, color: 'bg-[#5de0b0]' },
                  { label: 'Learning',     value: fcStats.learning  || 0, color: 'bg-[#f7a84a]' },
                  { label: 'New',          value: fcStats.new       || 0, color: 'bg-[#7c6af7]' },
                  { label: 'Due today',    value: fcStats.due_today || 0, color: 'bg-[#f76ab4]' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.color}`} />
                    <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">{item.label}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] rounded-xl p-5 transition-colors">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Activity — last 30 days</h2>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}>
                {last30.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.count} activities`}
                    className={`aspect-square rounded-sm transition-colors
                      ${day.count === 0 ? 'bg-gray-100 dark:bg-[#222230]' :
                        day.count === 1 ? 'bg-[#7c6af7]/40' :
                        day.count <= 3  ? 'bg-[#7c6af7]/70' :
                        'bg-[#7c6af7]'}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-400">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-[#222230]" />
                <div className="w-3 h-3 rounded-sm bg-[#7c6af7]/40" />
                <div className="w-3 h-3 rounded-sm bg-[#7c6af7]/70" />
                <div className="w-3 h-3 rounded-sm bg-[#7c6af7]" />
                <span>More</span>
              </div>
            </div>

          </div>

          {/* Recent quizzes */}
          <div className="bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] rounded-xl p-5 transition-colors">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Recent quizzes</h2>
            {quizHistory.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No quizzes taken yet</p>
            ) : (
              <div className="flex flex-col gap-2">
                {quizHistory.slice(0, 8).map((attempt) => (
                  <div key={attempt.id} className="flex items-center gap-3 bg-gray-50 dark:bg-[#222230] rounded-lg px-3 py-2.5 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0
                      ${attempt.score_percentage >= 80 ? 'bg-emerald-100 dark:bg-emerald-400/20 text-emerald-600 dark:text-emerald-400' :
                        attempt.score_percentage >= 60 ? 'bg-yellow-100 dark:bg-yellow-400/20 text-yellow-600 dark:text-yellow-400' :
                        'bg-red-100 dark:bg-red-400/20 text-red-500 dark:text-red-400'}`}>
                      {Math.round(attempt.score_percentage)}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {attempt.topic || 'General Engineering'}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {attempt.quiz_type.toUpperCase()} · {attempt.difficulty} · {attempt.correct_answers}/{attempt.total_questions} correct
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {new Date(attempt.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </>
      )}
    </div>
  )
}