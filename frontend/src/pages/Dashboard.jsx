import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getQuizHistory } from '../api/quiz'
import { getFlashcardStats } from '../api/flashcards'
import { listDocuments } from '../api/documents'
import { getStudyPlan } from '../api/progress'
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line
} from 'recharts'

const localDateKey = (date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats]           = useState({ quizzes: 0, avgScore: 0, flashcards: 0, dueToday: 0, docs: 0 })
  const [topicStats, setTopicStats] = useState([])
  const [recentDocs, setRecentDocs] = useState([])
  const [lastDoc, setLastDoc]       = useState(null)
  const [streak, setStreak]         = useState(0)
  const [streakDays, setStreakDays] = useState([])
  const [weakTopics, setWeakTopics] = useState([])
  const [scoreTrend, setScoreTrend] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [chatInput, setChatInput]   = useState('')
  const [planItems, setPlanItems]   = useState([])
  const [planLoading, setPlanLoading] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      setError(null)
      try {
        const [quizHistory, fcStats, docs] = await Promise.all([
          getQuizHistory(), getFlashcardStats(), listDocuments()
        ])

        const avgScore = quizHistory.length
          ? Math.round(quizHistory.reduce((a, b) => a + b.score_percentage, 0) / quizHistory.length)
          : 0

        const topicMap = {}
        quizHistory.forEach((a) => {
          const t = a.topic || 'General'
          if (!topicMap[t]) topicMap[t] = { correct: 0, total: 0 }
          topicMap[t].total   += a.total_questions
          topicMap[t].correct += a.correct_answers
        })
        const allTopics = Object.entries(topicMap)
          .map(([topic, s]) => ({ topic, accuracy: Math.round((s.correct / s.total) * 100) }))
        const topics = [...allTopics].sort((a, b) => b.accuracy - a.accuracy).slice(0, 5)
        const weak = [...allTopics].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3)

        const activity = {}
        quizHistory.forEach(a => { activity[localDateKey(a.created_at)] = true })
        let s = 0
        const today = new Date()
        for (let i = 0; i < 365; i++) {
          const d = new Date(today); d.setDate(d.getDate() - i)
          const key = localDateKey(d)
          if (activity[key]) s++; else if (i > 0) break
        }

        const dayLabels = ['M','T','W','T','F','S','S']
        const weekStart = new Date(today)
        const dayOfWeek = (today.getDay() + 6) % 7
        weekStart.setDate(today.getDate() - dayOfWeek)
        const week = dayLabels.map((label, i) => {
          const d = new Date(weekStart); d.setDate(weekStart.getDate() + i)
          const key = localDateKey(d)
          return { label, filled: !!activity[key], isToday: key === localDateKey(today) }
        })

        const trend = quizHistory
          .slice()
          .reverse()
          .slice(-8)
          .map((a, i) => ({ i, score: Math.round(a.score_percentage) }))

        setStats({ quizzes: quizHistory.length, avgScore, flashcards: fcStats.total || 0, dueToday: fcStats.due_today || 0, docs: docs.length })
        setTopicStats(topics)
        setWeakTopics(weak)
        setRecentDocs(docs.slice(0, 4))
        setLastDoc(docs[0] || null)
        setStreak(s)
        setStreakDays(week)
        setScoreTrend(trend.length ? trend : [{ i: 0, score: 0 }])
      } catch (err) { console.error(err); setError('Could not load your dashboard. Please refresh and try again.') }
      finally { setLoading(false) }
    }
    fetchAll()
  }, [])

  const handleAsk = () => {
    if (!chatInput.trim()) return
    navigate('/chat', { state: { initialQuestion: chatInput } })
  }

  const handleGeneratePlan = async () => {
    setPlanLoading(true)
    try {
      const data = await getStudyPlan()
      const items = []
      if (data.due_cards_today > 0) {
        items.push({ icon: 'ti-cards', label: `Review ${data.due_cards_today} flashcard${data.due_cards_today > 1 ? 's' : ''}`, tag: 'Due today', tagColor: 'red', action: () => navigate('/flashcards') })
      }
      if (data.weak_topics?.length) {
        data.weak_topics.slice(0, 3).forEach((t, i) => {
          items.push({ icon: 'ti-pencil', label: `Quiz on ${t.topic}`, tag: i === 0 ? 'High priority' : 'Medium', tagColor: i === 0 ? 'amber' : 'slate', action: () => navigate('/quiz') })
        })
      }
      if (items.length === 0) {
        items.push({ icon: 'ti-sparkles', label: 'Take a quiz to build your study plan', tag: 'Get started', tagColor: 'indigo', action: () => navigate('/quiz') })
      }
      setPlanItems(items)
    } catch (err) {
      console.error(err)
      setPlanItems([{ icon: 'ti-alert-circle', label: 'Study plan is unavailable right now', tag: 'Try later', tagColor: 'red', action: () => {} }])
    }
    finally { setPlanLoading(false) }
  }

  useEffect(() => { if (!loading) handleGeneratePlan() }, [loading])

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'

  const tagColors = {
    red:    { bg: '#FEF2F2', darkBg: 'rgba(239,68,68,0.18)', text: '#DC2626', darkText: '#FCA5A5' },
    amber:  { bg: '#FFFBEB', darkBg: 'rgba(245,158,11,0.18)', text: '#D97706', darkText: '#FCD34D' },
    slate:  { bg: '#F1F5F9', darkBg: 'rgba(148,163,184,0.18)', text: '#64748B', darkText: '#CBD5E1' },
    indigo: { bg: '#EEF2FF', darkBg: 'rgba(99,102,241,0.18)', text: '#4F46E5', darkText: '#A5B4FC' },
  }

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFC] dark:bg-[#0B0F1A] transition-colors duration-200">
      <div className="flex flex-col xl:flex-row">

        {/* MAIN COLUMN */}
        <div className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-5xl mx-auto w-full">

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-display text-[#0F172A] dark:text-[#F1F5F9]">
                {greeting}, {user?.full_name?.split(' ')[0]} 👋
              </h1>
              <p className="text-body mt-1 text-[#64748B] dark:text-[#94A3B8]">
                You're <span className="font-semibold text-indigo-600 dark:text-indigo-400">{stats.avgScore}%</span> ready for your next exam. Let's keep the momentum going!
              </p>
            </div>
          </div>

          {/* Ask box */}
          <div className="p-1 mb-6 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-md">
            <div className="flex items-center gap-3 px-4 py-3">
              <i className="ti ti-sparkles" style={{ fontSize: 20, color: '#6366F1' }} aria-hidden="true"></i>
              <input
                type="text" value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAsk()}
                placeholder="Ask anything about your documents, topics, or concepts..."
                className="flex-1 bg-transparent text-sm outline-none text-[#0F172A] dark:text-[#F1F5F9] placeholder-[#94A3B8]"
              />
              <button onClick={handleAsk} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
                <i className="ti ti-arrow-right text-white" style={{ fontSize: 16 }} aria-hidden="true"></i>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="px-4 py-3 rounded-xl text-sm bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30">
              {error}
            </div>
          ) : (
            <>
              {/* Continue learning + Study plan */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

                {/* Continue learning */}
                <div className="p-6 rounded-2xl border shadow-sm relative overflow-hidden bg-white dark:bg-[#141B2D]"
                  style={{ borderColor: 'rgba(99,102,241,0.25)' }}>
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(34,211,238,0.04))' }} />
                  <div className="relative">
                    <p className="text-label mb-4 text-indigo-500 dark:text-indigo-300">Continue learning</p>
                    {lastDoc ? (
                      <>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-600">
                            <i className="ti ti-folder text-white" style={{ fontSize: 20 }} aria-hidden="true"></i>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9] truncate">{lastDoc.original_name}</p>
                            <p className="text-xs text-[#94A3B8]">Uploaded recently</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mb-5">
                          <div className="flex-1 progress-bar">
                            <div className="progress-fill progress-fill-indigo" style={{ width: `${lastDoc.chunk_count ? 82 : 0}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9] flex-shrink-0">{lastDoc.chunk_count ? '82%' : '0%'}</span>
                        </div>
                        <button onClick={() => navigate('/documents')} className="btn-primary text-sm">
                          Continue
                          <i className="ti ti-arrow-right" style={{ fontSize: 15 }} aria-hidden="true"></i>
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-start">
                        <p className="text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] mb-1">No documents yet</p>
                        <p className="text-xs text-[#94A3B8] mb-4">Upload your first study material to get started</p>
                        <button onClick={() => navigate('/documents')} className="btn-primary text-sm">
                          <i className="ti ti-upload" style={{ fontSize: 15 }} aria-hidden="true"></i>
                          Upload document
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Study Plan */}
                <div className="p-6 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-title text-[#0F172A] dark:text-[#F1F5F9]">AI Study Plan</h2>
                    <span className="badge badge-cyan">Recommended</span>
                  </div>
                  {planLoading ? (
                    <div className="flex justify-center py-6">
                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 mb-4">
                      {planItems.map((item, i) => {
                        const tc = tagColors[item.tagColor]
                        return (
                          <button key={i} onClick={item.action}
                            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#0B0F1A] transition-colors text-left">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 bg-slate-100 dark:bg-[#1F2937] text-slate-600 dark:text-slate-300">
                              {i + 1}
                            </div>
                            <span className="text-sm text-[#374151] dark:text-[#CBD5E1] flex-1">{item.label}</span>
                            <span className="text-[10px] font-medium px-2 py-1 rounded-full flex-shrink-0 dark:hidden"
                              style={{ background: tc.bg, color: tc.text }}>
                              {item.tag}
                            </span>
                            <span className="text-[10px] font-medium px-2 py-1 rounded-full flex-shrink-0 hidden dark:inline-block"
                              style={{ background: tc.darkBg, color: tc.darkText }}>
                              {item.tag}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <button onClick={() => navigate('/progress')} className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1">
                    View full plan
                    <i className="ti ti-arrow-right" style={{ fontSize: 12 }} aria-hidden="true"></i>
                  </button>
                </div>
              </div>

              {/* Stat row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {[
                  { icon: 'ti-folder',  color: '#6366F1', bg: '#EEF2FF', darkBg: 'rgba(99,102,241,0.18)',  value: stats.avgScore + '%', label: 'Study Score',       sub: 'Good progress' },
                  { icon: 'ti-flame',   color: '#F59E0B', bg: '#FFFBEB', darkBg: 'rgba(245,158,11,0.18)',  value: streak,               label: 'Current Streak',   sub: 'Keep it up!', suffix: ' days' },
                  { icon: 'ti-cards',   color: '#10B981', bg: '#ECFDF5', darkBg: 'rgba(16,185,129,0.18)',  value: stats.dueToday,       label: 'Flashcards Due',   sub: 'Ready to review' },
                  { icon: 'ti-pencil',  color: '#8B5CF6', bg: '#F5F3FF', darkBg: 'rgba(139,92,246,0.18)',  value: stats.quizzes,        label: 'Quizzes Completed',sub: 'This week' },
                ].map(s => (
                  <div key={s.label} className="p-4 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--icon-bg-light)] dark:bg-[var(--icon-bg-dark)]"
                        style={{ '--icon-bg-light': s.bg, '--icon-bg-dark': s.darkBg }}>
                        <i className={`ti ${s.icon}`} style={{ fontSize: 17, color: s.color }} aria-hidden="true"></i>
                      </div>
                    </div>
                    <div className="text-xl font-semibold text-[#0F172A] dark:text-[#F1F5F9]" style={{ letterSpacing: '-0.4px' }}>
                      {s.value}{s.suffix || ''}
                    </div>
                    <div className="text-xs text-[#94A3B8] mt-0.5">{s.label}</div>
                    <div className="text-[10px] mt-1" style={{ color: s.color }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Topic progress + Recent docs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

                {/* Topic progress with radar */}
                <div className="p-6 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-title text-[#0F172A] dark:text-[#F1F5F9]">Topic Progress</h2>
                    <button onClick={() => navigate('/progress')} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">View all</button>
                  </div>

                  {topicStats.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-center">
                      <i className="ti ti-chart-bar" style={{ fontSize: 28, color: '#CBD5E1' }} aria-hidden="true"></i>
                      <p className="text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] mt-3">No quiz data yet</p>
                      <p className="text-xs text-[#94A3B8] mt-1">Take a quiz to see your topic breakdown</p>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="w-32 h-32 flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={topicStats} outerRadius="75%">
                            <PolarGrid stroke="#E2E8F0" />
                            <PolarAngleAxis dataKey="topic" tick={{ fontSize: 0 }} />
                            <Radar dataKey="accuracy" stroke="#6366F1" fill="#6366F1" fillOpacity={0.25} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 flex flex-col gap-2.5">
                        {topicStats.map(t => (
                          <div key={t.topic}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium text-[#374151] dark:text-[#CBD5E1] truncate">{t.topic}</span>
                              <span className="font-semibold text-[#0F172A] dark:text-[#F1F5F9] flex-shrink-0 ml-2">{t.accuracy}%</span>
                            </div>
                            <div className="progress-bar" style={{ height: 5 }}>
                              <div className="progress-fill progress-fill-indigo" style={{ width: `${t.accuracy}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recent documents */}
                <div className="p-6 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-title text-[#0F172A] dark:text-[#F1F5F9]">Recent Documents</h2>
                    <button onClick={() => navigate('/documents')} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">View all</button>
                  </div>
                  {recentDocs.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-center">
                      <i className="ti ti-file-off" style={{ fontSize: 28, color: '#CBD5E1' }} aria-hidden="true"></i>
                      <p className="text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] mt-3">No documents yet</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {recentDocs.map(doc => (
                        <div key={doc.id} onClick={() => navigate('/documents')}
                          className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#0B0F1A] transition-colors cursor-pointer group">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: doc.file_type === 'pdf' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)' }}>
                            <i className="ti ti-file-text" style={{ fontSize: 16, color: doc.file_type === 'pdf' ? '#EF4444' : '#3B82F6' }} aria-hidden="true"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {doc.original_name}
                            </div>
                            <div className="text-[11px] text-[#94A3B8]">
                              {(doc.file_size / 1024).toFixed(0)} KB · {doc.chunk_count} chunks
                            </div>
                          </div>
                          <i className="ti ti-dots-vertical opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: 14, color: '#94A3B8' }} aria-hidden="true"></i>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* RIGHT RAIL */}
        {!loading && (
          <div className="w-full xl:w-72 flex-shrink-0 px-4 sm:px-5 py-6 xl:py-8 flex flex-col gap-4 border-t xl:border-t-0 xl:border-l border-[#F1F5F9] dark:border-[#1F2937]">

            {/* Study score gauge */}
            <div className="p-5 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
              <p className="text-title text-[#0F172A] dark:text-[#F1F5F9] mb-3">Study Score</p>
              <div className="flex flex-col items-center">
                <div className="relative w-28 h-28">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="9" className="dark:opacity-10" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke="url(#scoreGradient)" strokeWidth="9" strokeLinecap="round"
                      strokeDasharray={`${(stats.avgScore / 100) * 264} 264`}
                    />
                    <defs>
                      <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#6366F1" />
                        <stop offset="100%" stopColor="#22D3EE" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-[#0F172A] dark:text-[#F1F5F9]" style={{ letterSpacing: '-0.5px' }}>{stats.avgScore}%</span>
                  </div>
                </div>
                <p className="text-xs mt-2" style={{ color: stats.avgScore >= 70 ? '#10B981' : stats.avgScore >= 40 ? '#F59E0B' : '#EF4444' }}>
                  {stats.avgScore >= 70 ? 'Good progress' : stats.avgScore >= 40 ? 'Keep going' : 'Needs work'}
                </p>
                {scoreTrend.length > 1 && (
                  <div className="w-full h-10 mt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={scoreTrend}>
                        <Line type="monotone" dataKey="score" stroke="#6366F1" strokeWidth={2} dot={{ r: 2, fill: '#6366F1' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Streak */}
            <div className="p-5 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <i className="ti ti-flame" style={{ fontSize: 16, color: '#F59E0B' }} aria-hidden="true"></i>
                <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">{streak} day streak</p>
              </div>
              <p className="text-xs text-[#94A3B8] mb-3">Keep it up, {user?.full_name?.split(' ')[0]}!</p>
              <div className="flex justify-between">
                {streakDays.map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                      style={{
                        background: d.filled ? 'linear-gradient(135deg, #6366F1, #4F46E5)' : 'transparent',
                        border: d.filled ? 'none' : '1.5px solid #E2E8F0',
                      }}
                    >
                      {d.isToday && !d.filled && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                    </div>
                    <span className="text-[9px] text-[#94A3B8]">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Due today */}
            <div className="p-5 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <i className="ti ti-calendar-event" style={{ fontSize: 16, color: '#F59E0B' }} aria-hidden="true"></i>
                  <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">Due Today</p>
                </div>
                <span className="text-lg font-bold text-[#0F172A] dark:text-[#F1F5F9]">{stats.dueToday}</span>
              </div>
              <div className="flex flex-col gap-2 mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Flashcards</span>
                  <span className="font-medium text-[#0F172A] dark:text-[#F1F5F9]">{stats.dueToday}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Quizzes pending</span>
                  <span className="font-medium text-[#0F172A] dark:text-[#F1F5F9]">{weakTopics.length}</span>
                </div>
              </div>
              <button onClick={() => navigate('/flashcards')} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                Review now
                <i className="ti ti-arrow-right" style={{ fontSize: 12 }} aria-hidden="true"></i>
              </button>
            </div>

            {/* Weakest topics */}
            <div className="p-5 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <i className="ti ti-target-arrow" style={{ fontSize: 16, color: '#EF4444' }} aria-hidden="true"></i>
                <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">Weakest Topics</p>
              </div>
              {weakTopics.length === 0 ? (
                <p className="text-xs text-[#94A3B8]">No weak topics yet — take a few quizzes first</p>
              ) : (
                <div className="flex flex-col gap-4 mb-4">
                  {weakTopics.map(t => (
                    <div key={t.topic}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-[#374151] dark:text-[#CBD5E1]">{t.topic}</span>
                        <span className="font-semibold" style={{ color: t.accuracy < 50 ? '#EF4444' : '#F59E0B' }}>{t.accuracy}%</span>
                      </div>
                      <div className="progress-bar" style={{ height: 5 }}>
                        <div className="progress-fill" style={{ width: `${t.accuracy}%`, background: t.accuracy < 50 ? '#EF4444' : '#F59E0B' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => navigate('/quiz')} className="btn-primary text-xs w-full justify-center py-2">
                Practice now
                <i className="ti ti-arrow-right" style={{ fontSize: 13 }} aria-hidden="true"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
