import { useState, useEffect } from 'react'
import { getQuizHistory } from '../api/quiz'
import { getFlashcardStats } from '../api/flashcards'
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
    { label: 'Quizzes taken',  value: quizHistory.length,    icon: 'ti-pencil',     color: 'bg-primary-50 text-primary-600 dark:bg-primary-600/15 dark:text-primary-300' },
    { label: 'Average score',  value: avgScore + '%',         icon: 'ti-target-arrow', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' },
    { label: 'Cards mastered', value: fcStats.mastered || 0, icon: 'ti-cards',      color: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' },
    { label: 'Study streak',   value: streak + ' days',       icon: 'ti-flame',      color: 'bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300' },
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
        <div className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-lg px-3 py-2 text-xs shadow-card">
          <p className="font-medium text-ink-900 dark:text-white">{d.fullTopic}</p>
          <p className="text-ink-500">{d.accuracy}% accuracy</p>
          <p className="text-ink-400">{d.total} questions</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-muted dark:bg-[#0F172A] transition-colors duration-200 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink-900 dark:text-white">Progress</h1>
            <p className="text-sm text-ink-500 mt-1">Track your learning over time</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => exportProgressPDF({ quizHistory, fcStats, topicStats, streak })}
              className="flex items-center gap-2 bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] hover:border-primary-300 dark:hover:border-primary-600/40 text-ink-700 dark:text-gray-300 text-sm font-medium rounded-xl px-4 py-2.5 transition-colors shadow-soft"
            >
              <i className="ti ti-download" style={{ fontSize: 16 }} aria-hidden="true"></i>
              Export report
            </button>
            <button
              onClick={handleGeneratePlan}
              disabled={generatingPlan}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-5 py-2.5 transition-colors shadow-soft"
            >
              {generatingPlan ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
              ) : (
                <><i className="ti ti-sparkles" style={{ fontSize: 16 }} aria-hidden="true"></i>Generate study plan</>
              )}
            </button>
          </div>
        </div>

        {/* Study plan output */}
        {showPlan && studyPlan && (
          <div className="bg-white dark:bg-[#1E293B] border border-primary-200 dark:border-primary-600/30 rounded-2xl p-5 mb-6 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-primary-600 dark:text-primary-300 flex items-center gap-2">
                <i className="ti ti-sparkles" style={{ fontSize: 16 }} aria-hidden="true"></i>
                Your AI study plan
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => exportStudyPlanPDF({ studyPlan })}
                  className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <i className="ti ti-download" style={{ fontSize: 14 }} aria-hidden="true"></i>
                  Download PDF
                </button>
                <button onClick={() => setShowPlan(false)} className="text-ink-400 hover:text-ink-600 text-xs">
                  <i className="ti ti-x" style={{ fontSize: 14 }} aria-hidden="true"></i>
                </button>
              </div>
            </div>
            {studyPlan.weak_topics?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {studyPlan.weak_topics.map((t) => (
                  <span key={t.topic} className="text-xs bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300 px-2.5 py-1 rounded-full">
                    ⚠ {t.topic} — {t.accuracy}%
                  </span>
                ))}
              </div>
            )}
            {studyPlan.due_cards_today > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-300 mb-3">
                {studyPlan.due_cards_today} flashcard{studyPlan.due_cards_today > 1 ? 's' : ''} due today
              </p>
            )}
            <div className="text-sm text-ink-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
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
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {statCards.map((card) => (
                <div key={card.label} className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-xl p-4 shadow-soft">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${card.color}`}>
                    <i className={`ti ${card.icon}`} style={{ fontSize: 18 }} aria-hidden="true"></i>
                  </div>
                  <div className="text-xl font-semibold text-ink-900 dark:text-white">{card.value}</div>
                  <div className="text-xs text-ink-400 mt-0.5">{card.label}</div>
                </div>
              ))}
            </div>

            {/* Topic chart */}
            <div className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl p-5 mb-4 shadow-soft">
              <h2 className="text-sm font-semibold text-ink-900 dark:text-white mb-4">Topic performance</h2>
              {topicStats.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <i className="ti ti-chart-bar text-ink-400" style={{ fontSize: 28 }} aria-hidden="true"></i>
                  <p className="text-sm text-ink-500 mt-2">No quiz data yet</p>
                  <p className="text-xs text-ink-400 mt-1">Take a quiz to see your topic breakdown</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topicStats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="topic" tick={{ fill: '#9999b0', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9999b0', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139,92,246,0.05)' }} />
                    <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                      {topicStats.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.accuracy >= 80 ? '#10b981' : entry.accuracy >= 60 ? '#f59e0b' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Flashcard + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

              <div className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl p-5 shadow-soft">
                <h2 className="text-sm font-semibold text-ink-900 dark:text-white mb-4">Flashcard breakdown</h2>
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Total cards',  value: fcStats.total     || 0, color: 'bg-ink-400' },
                    { label: 'Mastered',     value: fcStats.mastered  || 0, color: 'bg-emerald-500' },
                    { label: 'Learning',     value: fcStats.learning  || 0, color: 'bg-amber-500' },
                    { label: 'New',          value: fcStats.new       || 0, color: 'bg-primary-500' },
                    { label: 'Due today',    value: fcStats.due_today || 0, color: 'bg-pink-500' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.color}`} />
                      <span className="text-sm text-ink-500 flex-1">{item.label}</span>
                      <span className="text-sm font-medium text-ink-900 dark:text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl p-5 shadow-soft">
                <h2 className="text-sm font-semibold text-ink-900 dark:text-white mb-4">Activity — last 30 days</h2>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}>
                  {last30.map((day) => (
                    <div
                      key={day.date}
                      title={`${day.date}: ${day.count} activities`}
                      className={`aspect-square rounded-sm transition-colors
                        ${day.count === 0 ? 'bg-surface-muted dark:bg-[#334155]' :
                          day.count === 1 ? 'bg-primary-300' :
                          day.count <= 3  ? 'bg-primary-400' :
                          'bg-primary-600'}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3 text-[10px] text-ink-400">
                  <span>Less</span>
                  <div className="w-3 h-3 rounded-sm bg-surface-muted dark:bg-[#334155]" />
                  <div className="w-3 h-3 rounded-sm bg-primary-300" />
                  <div className="w-3 h-3 rounded-sm bg-primary-400" />
                  <div className="w-3 h-3 rounded-sm bg-primary-600" />
                  <span>More</span>
                </div>
              </div>

            </div>

            {/* Recent quizzes */}
            <div className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl p-5 shadow-soft">
              <h2 className="text-sm font-semibold text-ink-900 dark:text-white mb-4">Recent quizzes</h2>
              {quizHistory.length === 0 ? (
                <p className="text-sm text-ink-500 text-center py-4">No quizzes taken yet</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {quizHistory.slice(0, 8).map((attempt) => (
                    <div key={attempt.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-surface-muted dark:hover:bg-[#1E293B] transition-colors">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0
                        ${attempt.score_percentage >= 80 ? 'bg-emerald-50 dark:bg-emerald-400/20 text-emerald-600 dark:text-emerald-400' :
                          attempt.score_percentage >= 60 ? 'bg-amber-50 dark:bg-amber-400/20 text-amber-600 dark:text-amber-400' :
                          'bg-red-50 dark:bg-red-400/20 text-red-500 dark:text-red-400'}`}>
                        {Math.round(attempt.score_percentage)}%
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-900 dark:text-white truncate">
                          {attempt.topic || 'General Engineering'}
                        </p>
                        <p className="text-xs text-ink-400">
                          {attempt.quiz_type.toUpperCase()} · {attempt.difficulty} · {attempt.correct_answers}/{attempt.total_questions} correct
                        </p>
                      </div>
                      <span className="text-xs text-ink-400 flex-shrink-0">
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
    </div>
  )
}