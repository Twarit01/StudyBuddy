import { useState, useEffect } from 'react'
import { getQuizHistory } from '../api/quiz'
import { getFlashcardStats } from '../api/flashcards'
import { getStudyPlan } from '../api/progress'
import { exportStudyPlanPDF, exportProgressPDF } from '../utils/exportPDF'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'

const localDateKey = (date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function Progress() {
  const [quizHistory, setQuizHistory]       = useState([])
  const [fcStats, setFcStats]               = useState({})
  const [topicStats, setTopicStats]         = useState([])
  const [activityMap, setActivityMap]       = useState({})
  const [loading, setLoading]               = useState(true)
  const [loadError, setLoadError]           = useState(null)
  const [streak, setStreak]                 = useState(0)
  const [studyPlan, setStudyPlan]           = useState(null)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [planError, setPlanError]           = useState(null)
  const [showPlan, setShowPlan]             = useState(false)
  const [isDark, setIsDark]                 = useState(false)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true); setLoadError(null)
    try {
      const [history, fc] = await Promise.all([getQuizHistory(), getFlashcardStats()])
      setQuizHistory(history); setFcStats(fc)

      const topicMap = {}
      history.forEach((attempt) => {
        const t = attempt.topic || 'General'
        if (!topicMap[t]) topicMap[t] = { correct: 0, total: 0 }
        topicMap[t].total   += attempt.total_questions
        topicMap[t].correct += attempt.correct_answers
      })
      setTopicStats(Object.entries(topicMap).map(([topic, s]) => ({
        topic:     topic.length > 14 ? topic.slice(0, 14) + '…' : topic,
        fullTopic: topic,
        accuracy:  Math.round((s.correct / s.total) * 100),
        total:     s.total,
      })))

      const activity = {}
      history.forEach((a) => {
        const d = localDateKey(a.created_at)
        activity[d] = (activity[d] || 0) + 1
      })
      setActivityMap(activity)

      let s = 0
      const today = new Date()
      for (let i = 0; i < 365; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i)
        const key = localDateKey(d)
        if (activity[key]) s++; else if (i > 0) break
      }
      setStreak(s)
    } catch (err) { console.error('Failed to load progress', err); setLoadError('Could not load your progress. Please refresh and try again.') }
    finally { setLoading(false) }
  }

  const handleGeneratePlan = async () => {
    setGeneratingPlan(true); setPlanError(null); setShowPlan(false)
    try { const data = await getStudyPlan(); setStudyPlan(data); setShowPlan(true) }
    catch (err) { setPlanError(err.response?.data?.detail || 'Failed to generate study plan') }
    finally { setGeneratingPlan(false) }
  }

  const avgScore = quizHistory.length
    ? Math.round(quizHistory.reduce((a, b) => a + b.score_percentage, 0) / quizHistory.length)
    : 0

  const statCards = [
    { label: 'Quizzes taken',  value: quizHistory.length,     icon: 'ti-pencil',         color: '#6366F1', bg: '#EEF2FF', darkBg: 'rgba(99,102,241,0.15)' },
    { label: 'Average score',  value: avgScore + '%',          icon: 'ti-target-arrow',   color: '#10B981', bg: '#ECFDF5', darkBg: 'rgba(16,185,129,0.15)' },
    { label: 'Cards mastered', value: fcStats.mastered || 0,  icon: 'ti-cards',          color: '#F59E0B', bg: '#FFFBEB', darkBg: 'rgba(245,158,11,0.15)' },
    { label: 'Study streak',   value: streak + ' days',        icon: 'ti-flame',          color: '#EC4899', bg: '#FDF2F8', darkBg: 'rgba(236,72,153,0.15)' },
  ]

  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i))
    const key = localDateKey(d)
    return { date: key, count: activityMap[key] || 0 }
  })

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.length) {
      const d = payload[0].payload
      return (
        <div className="px-3 py-2 rounded-lg text-xs bg-white dark:bg-[#141B2D] border border-[#E2E8F0] dark:border-[#1F2937]" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <p className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">{d.fullTopic}</p>
          <p className="text-[#64748B] dark:text-[#94A3B8]">{d.accuracy}% accuracy</p>
          <p className="text-[#94A3B8]">{d.total} questions</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFC] dark:bg-[#0B0F1A] transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-display text-[#0F172A] dark:text-[#F1F5F9]">Progress</h1>
            <p className="text-body mt-1 text-[#64748B] dark:text-[#94A3B8]">Track your learning over time</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <button onClick={() => exportProgressPDF({ quizHistory, fcStats, topicStats, streak })} className="btn-secondary text-sm">
              <i className="ti ti-download" style={{ fontSize: 15 }} aria-hidden="true"></i>
              Export report
            </button>
            <button onClick={handleGeneratePlan} disabled={generatingPlan} className="btn-primary text-sm">
              {generatingPlan
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
                : <><i className="ti ti-sparkles" style={{ fontSize: 15 }} aria-hidden="true"></i>Generate study plan</>}
            </button>
          </div>
        </div>

        {/* Study plan */}
        {showPlan && studyPlan && (
          <div className="p-6 mb-6 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#C7D2FE] dark:border-indigo-500/30 shadow-sm">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-title flex items-center gap-2" style={{ color: '#4F46E5' }}>
                <i className="ti ti-sparkles" style={{ fontSize: 17 }} aria-hidden="true"></i>
                Your AI study plan
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={() => exportStudyPlanPDF({ studyPlan })} className="btn-primary text-xs py-1.5 px-3">
                  <i className="ti ti-download" style={{ fontSize: 13 }} aria-hidden="true"></i>
                  Download
                </button>
                <button onClick={() => setShowPlan(false)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-[#1F2937] text-slate-400">
                  <i className="ti ti-x" style={{ fontSize: 14 }} aria-hidden="true"></i>
                </button>
              </div>
            </div>
            {studyPlan.weak_topics?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {studyPlan.weak_topics.map((t) => (
                  <span key={t.topic} className="badge badge-red">⚠ {t.topic} — {t.accuracy}%</span>
                ))}
              </div>
            )}
            {studyPlan.due_cards_today > 0 && (
              <p className="text-sm mb-4 flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                <i className="ti ti-calendar-event" style={{ fontSize: 15 }} aria-hidden="true"></i>
                {studyPlan.due_cards_today} flashcard{studyPlan.due_cards_today > 1 ? 's' : ''} due today
              </p>
            )}
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-[#374151] dark:text-[#CBD5E1]">{studyPlan.study_plan}</div>
          </div>
        )}

        {planError && (
          <div className="px-4 py-3 rounded-xl text-sm mb-6 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300">{planError}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <div className="px-4 py-3 rounded-xl text-sm bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30">
            {loadError}
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {statCards.map((card) => (
                <div key={card.label} className="p-5 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4" style={{ background: isDark ? card.darkBg : card.bg }}>
                    <i className={`ti ${card.icon}`} style={{ fontSize: 18, color: card.color }} aria-hidden="true"></i>
                  </div>
                  <div className="text-2xl font-semibold text-[#0F172A] dark:text-[#F1F5F9]" style={{ letterSpacing: '-0.5px' }}>{card.value}</div>
                  <div className="text-caption mt-1 text-[#94A3B8]">{card.label}</div>
                </div>
              ))}
            </div>

            {/* Topic chart */}
            <div className="p-6 mb-6 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-title text-[#0F172A] dark:text-[#F1F5F9]">Topic performance</h2>
                <span className="badge badge-cyan">By accuracy</span>
              </div>
              {topicStats.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <i className="ti ti-chart-bar" style={{ fontSize: 28, color: '#CBD5E1' }} aria-hidden="true"></i>
                  <p className="text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] mt-3">No quiz data yet</p>
                  <p className="text-caption mt-1 text-[#94A3B8]">Take a quiz to see your topic breakdown</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topicStats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="topic" tick={{ fill: isDark ? '#64748B' : '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: isDark ? '#64748B' : '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                    <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                      {topicStats.map((entry, index) => (
                        <Cell key={index} fill={entry.accuracy >= 80 ? '#10B981' : entry.accuracy >= 60 ? '#F59E0B' : '#EF4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

              {/* Flashcard breakdown */}
              <div className="p-6 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
                <h2 className="text-title text-[#0F172A] dark:text-[#F1F5F9] mb-5">Flashcard breakdown</h2>
                <div className="flex flex-col gap-4">
                  {[
                    { label: 'Total cards', value: fcStats.total     || 0, color: '#94A3B8' },
                    { label: 'Mastered',    value: fcStats.mastered  || 0, color: '#10B981' },
                    { label: 'Learning',    value: fcStats.learning  || 0, color: '#F59E0B' },
                    { label: 'New',         value: fcStats.new       || 0, color: '#6366F1' },
                    { label: 'Due today',   value: fcStats.due_today || 0, color: '#EC4899' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-sm flex-1 text-[#64748B] dark:text-[#94A3B8]">{item.label}</span>
                      <span className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity heatmap */}
              <div className="p-6 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
                <h2 className="text-title text-[#0F172A] dark:text-[#F1F5F9] mb-5">Activity — last 30 days</h2>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}>
                  {last30.map((day) => (
                    <div
                      key={day.date}
                      title={`${day.date}: ${day.count} activities`}
                      className="aspect-square rounded-md"
                      style={{
                        background: day.count === 0 ? (isDark ? '#1F2937' : '#F1F5F9') :
                          day.count === 1 ? 'rgba(34,211,238,0.4)' :
                          day.count <= 3  ? 'rgba(34,211,238,0.7)' : '#22D3EE',
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-4 text-[10px] text-[#94A3B8]">
                  <span>Less</span>
                  <div className="w-3 h-3 rounded-sm" style={{ background: isDark ? '#1F2937' : '#F1F5F9' }} />
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(34,211,238,0.4)' }} />
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(34,211,238,0.7)' }} />
                  <div className="w-3 h-3 rounded-sm" style={{ background: '#22D3EE' }} />
                  <span>More</span>
                </div>
              </div>
            </div>

            {/* Recent quizzes */}
            <div className="p-6 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
              <h2 className="text-title text-[#0F172A] dark:text-[#F1F5F9] mb-5">Recent quizzes</h2>
              {quizHistory.length === 0 ? (
                <p className="text-sm text-center py-4 text-[#94A3B8]">No quizzes taken yet</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {quizHistory.slice(0, 8).map((attempt) => (
                    <div key={attempt.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#0B0F1A] transition-colors">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0"
                        style={{
                          background: attempt.score_percentage >= 80 ? (isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5') : attempt.score_percentage >= 60 ? (isDark ? 'rgba(245,158,11,0.15)' : '#FFFBEB') : (isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2'),
                          color: attempt.score_percentage >= 80 ? '#16A34A' : attempt.score_percentage >= 60 ? '#D97706' : '#DC2626',
                        }}>
                        {Math.round(attempt.score_percentage)}%
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] truncate">{attempt.topic || 'General Engineering'}</p>
                        <p className="text-caption text-[#94A3B8]">
                          {attempt.quiz_type.toUpperCase()} · {attempt.difficulty} · {attempt.correct_answers}/{attempt.total_questions} correct
                        </p>
                      </div>
                      <span className="text-caption flex-shrink-0 text-[#CBD5E1] dark:text-slate-500">
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
