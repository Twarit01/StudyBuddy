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
          .sort((a, b) => b.accuracy - a.accuracy)
          .slice(0, 4)

        // streak
        const activity = {}
        quizHistory.forEach((a) => {
          const d = new Date(a.created_at).toISOString().split('T')[0]
          activity[d] = true
        })
        let s = 0
        const today = new Date()
        for (let i = 0; i < 365; i++) {
          const d = new Date(today)
          d.setDate(d.getDate() - i)
          const key = d.toISOString().split('T')[0]
          if (activity[key]) s++
          else if (i > 0) break
        }

        setStats({
          quizzes: quizHistory.length,
          avgScore,
          flashcards: fcStats.total || 0,
          dueToday: fcStats.due_today || 0,
          docs: docs.length,
        })
        setTopicStats(topics)
        setRecentDocs(docs.slice(0, 5))
        setStreak(s)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const handleAsk = () => {
    if (!chatInput.trim()) return
    navigate('/chat', { state: { initialQuestion: chatInput } })
  }

  const quickStats = [
    { label: 'Documents',  value: stats.docs,         icon: 'ti-file-text',  color: 'primary' },
    { label: 'Flashcards', value: stats.flashcards,   icon: 'ti-cards',      color: 'green'   },
    { label: 'Quizzes',    value: stats.quizzes,      icon: 'ti-pencil',     color: 'amber'   },
    { label: 'Due today',  value: stats.dueToday,     icon: 'ti-clock',      color: 'pink'    },
    { label: 'Accuracy',   value: stats.avgScore + '%', icon: 'ti-chart-bar', color: 'teal'   },
  ]

  const colorMap = {
    primary: 'bg-primary-50 text-primary-600 dark:bg-primary-600/15 dark:text-primary-300',
    green:   'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    amber:   'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    pink:    'bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300',
    teal:    'bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300',
  }

  const quickActions = [
    { label: 'Upload document',  desc: 'Add new study material', icon: 'ti-upload',         path: '/documents' },
    { label: 'Start a quiz',     desc: 'Generate quiz from notes', icon: 'ti-pencil',        path: '/quiz' },
    { label: 'Review flashcards',desc: 'Spaced repetition review', icon: 'ti-cards',         path: '/flashcards' },
    { label: 'Study plan',       desc: 'AI-powered schedule',      icon: 'ti-calendar-stats',path: '/progress' },
  ]

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="h-full overflow-y-auto bg-surface-muted dark:bg-[#0F172A] transition-colors duration-200 p-6">

      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-white">
            {greeting}, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-ink-500 mt-1">What would you like to study today?</p>
        </div>

        {/* Ask box */}
        <div className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl p-4 shadow-soft mb-4">
          <div className="flex items-center gap-3">
            <i className="ti ti-sparkles text-primary-500" style={{ fontSize: 20 }} aria-hidden="true"></i>
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAsk()}
              placeholder="Ask anything about your documents..."
              className="flex-1 bg-transparent text-sm text-ink-900 dark:text-white placeholder-ink-400 outline-none"
            />
            <button
              onClick={handleAsk}
              className="w-9 h-9 rounded-xl bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <i className="ti ti-arrow-up" style={{ fontSize: 16 }} aria-hidden="true"></i>
            </button>
          </div>
        </div>

        {/* Quick action pills */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {quickActions.map(a => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className="flex items-center gap-3 bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-xl px-4 py-3 text-left hover:border-primary-300 dark:hover:border-primary-600/40 transition-colors shadow-soft"
            >
              <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-600/15 text-primary-600 dark:text-primary-300 flex items-center justify-center flex-shrink-0">
                <i className={`ti ${a.icon}`} style={{ fontSize: 18 }} aria-hidden="true"></i>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink-900 dark:text-white truncate">{a.label}</div>
                <div className="text-xs text-ink-400 truncate">{a.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              {quickStats.map(s => (
                <div key={s.label} className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-xl p-4 shadow-soft">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colorMap[s.color]}`}>
                    <i className={`ti ${s.icon}`} style={{ fontSize: 16 }} aria-hidden="true"></i>
                  </div>
                  <div className="text-xl font-semibold text-ink-900 dark:text-white">{s.value}</div>
                  <div className="text-xs text-ink-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Topic performance */}
              <div className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl p-5 shadow-soft">
                <h2 className="text-sm font-semibold text-ink-900 dark:text-white mb-4">Topic performance</h2>
                {topicStats.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <i className="ti ti-chart-bar text-ink-400" style={{ fontSize: 28 }} aria-hidden="true"></i>
                    <p className="text-sm text-ink-500 mt-2">No quiz data yet</p>
                    <p className="text-xs text-ink-400 mt-1">Take a quiz to see your topic breakdown</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {topicStats.map(t => (
                      <div key={t.topic}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-ink-700 dark:text-gray-300 font-medium">{t.topic}</span>
                          <span className="text-ink-500">{t.accuracy}%</span>
                        </div>
                        <div className="h-2 bg-surface-muted dark:bg-[#334155] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 rounded-full transition-all"
                            style={{ width: `${t.accuracy}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent documents */}
              <div className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl p-5 shadow-soft">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Recent documents</h2>
                  <button onClick={() => navigate('/documents')} className="text-xs text-primary-600 dark:text-primary-300 hover:underline">View all</button>
                </div>
                {recentDocs.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <i className="ti ti-file-off text-ink-400" style={{ fontSize: 28 }} aria-hidden="true"></i>
                    <p className="text-sm text-ink-500 mt-2">No documents uploaded</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {recentDocs.map(doc => (
                      <div key={doc.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-surface-muted dark:hover:bg-[#1E293B] transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0">
                          <i className="ti ti-file-text" style={{ fontSize: 16 }} aria-hidden="true"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-ink-900 dark:text-white truncate">{doc.original_name}</div>
                          <div className="text-xs text-ink-400">{(doc.file_size / 1024).toFixed(0)} KB · {doc.chunk_count} chunks</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Streak */}
            <div className="mt-4 bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl p-5 shadow-soft flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-500 flex items-center justify-center">
                  <i className="ti ti-flame" style={{ fontSize: 20 }} aria-hidden="true"></i>
                </div>
                <div>
                  <div className="text-lg font-semibold text-ink-900 dark:text-white">{streak} day{streak !== 1 ? 's' : ''} streak</div>
                  <div className="text-xs text-ink-400">Keep it going — study something today</div>
                </div>
              </div>
              {stats.dueToday > 0 && (
                <button
                  onClick={() => navigate('/flashcards')}
                  className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                >
                  Review {stats.dueToday} due cards
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}