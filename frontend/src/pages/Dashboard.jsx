import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getQuizHistory } from '../api/quiz'
import { getFlashcardStats } from '../api/flashcards'
import { listDocuments } from '../api/documents'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats]           = useState({ quizzes: 0, avgScore: 0, flashcards: 0, dueToday: 0, docs: 0 })
  const [topicStats, setTopicStats] = useState([])
  const [recentDocs, setRecentDocs] = useState([])
  const [streak, setStreak]         = useState(0)
  const [loading, setLoading]       = useState(true)
  const [chatInput, setChatInput]   = useState('')

  useEffect(() => {
    const fetchAll = async () => {
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
        const topics = Object.entries(topicMap)
          .map(([topic, s]) => ({ topic, accuracy: Math.round((s.correct / s.total) * 100) }))
          .sort((a, b) => b.accuracy - a.accuracy).slice(0, 4)
        let s = 0
        const activity = {}
        quizHistory.forEach(a => { const d = new Date(a.created_at).toISOString().split('T')[0]; activity[d] = true })
        const today = new Date()
        for (let i = 0; i < 365; i++) {
          const d = new Date(today); d.setDate(d.getDate() - i)
          const key = d.toISOString().split('T')[0]
          if (activity[key]) s++; else if (i > 0) break
        }
        setStats({ quizzes: quizHistory.length, avgScore, flashcards: fcStats.total || 0, dueToday: fcStats.due_today || 0, docs: docs.length })
        setTopicStats(topics)
        setRecentDocs(docs.slice(0, 5))
        setStreak(s)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    fetchAll()
  }, [])

  const handleAsk = () => {
    if (!chatInput.trim()) return
    navigate('/chat', { state: { initialQuestion: chatInput } })
  }

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'

  const quickActions = [
    { label: 'Upload document',   desc: 'Add study material',       icon: 'ti-upload',          path: '/documents', color: '#6366F1' },
    { label: 'Start a quiz',      desc: 'Test your knowledge',      icon: 'ti-pencil',          path: '/quiz',      color: '#06B6D4' },
    { label: 'Review flashcards', desc: 'Spaced repetition',        icon: 'ti-cards',           path: '/flashcards',color: '#10B981' },
    { label: 'Study plan',        desc: 'AI-powered schedule',      icon: 'ti-calendar-stats',  path: '/progress',  color: '#F59E0B' },
  ]

  const statCards = [
    { label: 'Documents',   value: stats.docs,             icon: 'ti-file-text',    color: '#6366F1', bg: '#EEF2FF',                   darkBg: 'rgba(99,102,241,0.12)' },
    { label: 'Flashcards',  value: stats.flashcards,       icon: 'ti-cards',        color: '#10B981', bg: '#ECFDF5',                   darkBg: 'rgba(16,185,129,0.12)' },
    { label: 'Quizzes',     value: stats.quizzes,          icon: 'ti-pencil',       color: '#F59E0B', bg: '#FFFBEB',                   darkBg: 'rgba(245,158,11,0.12)' },
    { label: 'Due today',   value: stats.dueToday,         icon: 'ti-clock',        color: '#EC4899', bg: '#FDF2F8',                   darkBg: 'rgba(236,72,153,0.12)' },
    { label: 'Accuracy',    value: stats.avgScore + '%',   icon: 'ti-chart-bar',    color: '#06B6D4', bg: '#ECFEFF',                   darkBg: 'rgba(6,182,212,0.12)'  },
  ]

  return (
    <div className="h-full overflow-y-auto transition-colors duration-200 bg-[#F8FAFC] dark:bg-[#0F172A]">
      <div className="max-w-6xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-display text-[#0F172A] dark:text-[#F8FAFC]">
            {greeting}, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-body mt-1" style={{ color: '#64748B' }}>What would you like to study today?</p>
        </div>

        {/* Ask box */}
        <div className="p-1 mb-8 rounded-2xl border bg-white dark:bg-[#1E293B] border-[#E2E8F0] dark:border-[#334155] shadow-md">
          <div className="flex items-center gap-3 px-4 py-3">
            <i className="ti ti-sparkles" style={{ fontSize: 20, color: '#6366F1' }} aria-hidden="true"></i>
            <input
              type="text" value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAsk()}
              placeholder="Ask anything about your documents..."
              className="flex-1 bg-transparent text-sm outline-none text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8]"
            />
            <button onClick={handleAsk}
              className="btn-primary py-2 px-4 text-xs rounded-lg">
              Ask
              <i className="ti ti-arrow-up" style={{ fontSize: 14 }} aria-hidden="true"></i>
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {quickActions.map(a => (
            <button key={a.path} onClick={() => navigate(a.path)}
            className="p-4 text-left flex items-center gap-3 group cursor-pointer rounded-2xl border bg-white dark:bg-[#1E293B] border-[#E2E8F0] dark:border-[#334155] hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors shadow-sm"><div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                style={{ background: `${a.color}15` }}>
                <i className={`ti ${a.icon}`} style={{ fontSize: 20, color: a.color }} aria-hidden="true"></i>
              </div>
              <div>
                <div className="text-title text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{a.label}</div>
                <div className="text-caption mt-0.5" style={{ color: '#94A3B8' }}>{a.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
              {statCards.map(s => (
                <div key={s.label} className="p-5 rounded-2xl border bg-white dark:bg-[#1E293B] border-[#E2E8F0] dark:border-[#334155] shadow-sm">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: s.bg }}>
                    <i className={`ti ${s.icon}`} style={{ fontSize: 18, color: s.color }} aria-hidden="true"></i>
                  </div>
                  <div className="text-2xl font-semibold text-[#0F172A] dark:text-[#F8FAFC]" style={{ letterSpacing: '-0.5px' }}>{s.value}</div>
                  <div className="text-caption mt-1" style={{ color: '#94A3B8' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Topic performance */}
              <div className="p-6 rounded-2xl border bg-white dark:bg-[#1E293B] border-[#E2E8F0] dark:border-[#334155] shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-title text-[#0F172A] dark:text-[#F8FAFC]">Topic performance</h2><span className="badge badge-cyan">Quiz stats</span>
                </div>
                {topicStats.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-3">
                      <i className="ti ti-chart-bar" style={{ fontSize: 22, color: '#94A3B8' }} aria-hidden="true"></i>
                    </div>
                    <p className="text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC]">No quiz data yet</p>
                    <p className="text-caption mt-1" style={{ color: '#94A3B8' }}>Take a quiz to see your topic breakdown</p>
                    <button onClick={() => navigate('/quiz')} className="btn-primary mt-4 text-xs py-1.5 px-3">
                      Take a quiz
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {topicStats.map(t => (
                      <div key={t.topic}>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0]">{t.topic}</span>
                          <span className="text-sm font-semibold"
                            style={{ color: t.accuracy >= 80 ? '#10B981' : t.accuracy >= 60 ? '#F59E0B' : '#EF4444' }}>
                            {t.accuracy}%
                          </span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill progress-fill-indigo" style={{ width: `${t.accuracy}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent documents */}
              <div className="p-6 rounded-2xl border bg-white dark:bg-[#1E293B] border-[#E2E8F0] dark:border-[#334155] shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-title text-[#0F172A] dark:text-[#F8FAFC]">Recent documents</h2><button onClick={() => navigate('/documents')}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">View all</button>
                </div>
                {recentDocs.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-3">
                      <i className="ti ti-file-off" style={{ fontSize: 22, color: '#94A3B8' }} aria-hidden="true"></i>
                    </div>
                    <p className="text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC]">No documents yet</p>
                    <p className="text-caption mt-1" style={{ color: '#94A3B8' }}>Upload your first study material</p>
                    <button onClick={() => navigate('/documents')} className="btn-primary mt-4 text-xs py-1.5 px-3">
                      Upload document
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {recentDocs.map(doc => (
                      <div key={doc.id}
                        onClick={() => navigate('/documents')}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: '#FEF2F2' }}>
                          <i className="ti ti-file-text" style={{ fontSize: 17, color: '#EF4444' }} aria-hidden="true"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {doc.original_name}
                          </div>
                          <div className="text-caption" style={{ color: '#94A3B8' }}>
                            {(doc.file_size / 1024).toFixed(0)} KB · {doc.chunk_count} chunks
                          </div>
                        </div>
                        <i className="ti ti-chevron-right opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: 14, color: '#94A3B8' }} aria-hidden="true"></i>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Streak banner */}
            {streak > 0 || stats.dueToday > 0 ? (
              <div className="mt-6 p-5 rounded-2xl border bg-white dark:bg-[#1E293B] border-[#E2E8F0] dark:border-[#334155] shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: '#FFFBEB' }}>
                    <i className="ti ti-flame" style={{ fontSize: 22, color: '#F59E0B' }} aria-hidden="true"></i>
                  </div>
                  <div>
                    <div className="text-title text-[#0F172A] dark:text-[#F8FAFC]">
                      {streak} day{streak !== 1 ? 's' : ''} study streak
                    </div>
                    <div className="text-caption mt-0.5" style={{ color: '#94A3B8' }}>
                      Keep it going — study something today
                    </div>
                  </div>
                </div>
                {stats.dueToday > 0 && (
                  <button onClick={() => navigate('/flashcards')} className="btn-primary text-sm">
                    <i className="ti ti-cards" style={{ fontSize: 15 }} aria-hidden="true"></i>
                    Review {stats.dueToday} cards
                  </button>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}