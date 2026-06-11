import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getQuizHistory } from '../api/quiz'
import { getFlashcardStats } from '../api/flashcards'
import { getSessions } from '../api/chat'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ quizzes: 0, avgScore: 0, flashcards: 0, dueToday: 0 })
  const [weakTopics, setWeakTopics] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [quizHistory, fcStats] = await Promise.all([
          getQuizHistory(), getFlashcardStats()
        ])
        const avgScore = quizHistory.length
          ? Math.round(quizHistory.reduce((a, b) => a + b.score_percentage, 0) / quizHistory.length)
          : 0
        const topicMap = {}
        quizHistory.forEach((a) => {
          const t = a.topic || 'General'
          if (!topicMap[t]) topicMap[t] = { correct: 0, total: 0 }
          topicMap[t].total += a.total_questions
          topicMap[t].correct += a.correct_answers
        })
        const weak = Object.entries(topicMap)
          .map(([topic, s]) => ({ topic, accuracy: Math.round((s.correct / s.total) * 100) }))
          .filter(t => t.accuracy < 60)
          .sort((a, b) => a.accuracy - b.accuracy)
          .slice(0, 3)
        setStats({ quizzes: quizHistory.length, avgScore, flashcards: fcStats.total, dueToday: fcStats.due_today })
        setWeakTopics(weak)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const statCards = [
    { label: 'Quizzes taken',    value: stats.quizzes,        icon: '📝', color: 'text-[#7c6af7]' },
    { label: 'Average score',    value: stats.avgScore + '%', icon: '🎯', color: 'text-[#5de0b0]' },
    { label: 'Total flashcards', value: stats.flashcards,     icon: '🃏', color: 'text-[#f7a84a]' },
    { label: 'Due today',        value: stats.dueToday,       icon: '⏰', color: 'text-[#f76ab4]' },
  ]

  const quickActions = [
    { label: 'Ask a question',    icon: '💬', path: '/chat',       desc: 'Get instant answers from your notes' },
    { label: 'Take a quiz',       icon: '📝', path: '/quiz',       desc: 'Test your knowledge on any topic' },
    { label: 'Review flashcards', icon: '🃏', path: '/flashcards', desc: 'Study with spaced repetition' },
    { label: 'View progress',     icon: '📊', path: '/progress',   desc: 'See your weak topics and streak' },
  ]

  return (
    <div className="h-full overflow-y-auto p-6 bg-gray-50 dark:bg-[#0f0f13] transition-colors duration-200">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
          {user?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">Here's your study overview for today</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#7c6af7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {statCards.map((card) => (
              <div key={card.label} className="bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] rounded-xl p-4">
                <div className="text-xl mb-2">{card.icon}</div>
                <div className={`text-2xl font-semibold ${card.color}`}>{card.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Quick actions</h2>
              <div className="flex flex-col gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.path}
                    onClick={() => navigate(action.path)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-[#222230] hover:bg-gray-100 dark:hover:bg-[#2a2a3a] transition-colors text-left group"
                  >
                    <span className="text-lg">{action.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-[#7c6af7] transition-colors">
                        {action.label}
                      </div>
                      <div className="text-xs text-gray-500">{action.desc}</div>
                    </div>
                    <span className="ml-auto text-gray-400 group-hover:text-[#7c6af7] transition-colors">→</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Weak topics
                <span className="ml-2 text-xs text-gray-400 font-normal">below 60% accuracy</span>
              </h2>
              {weakTopics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <span className="text-3xl mb-2">🎉</span>
                  <p className="text-sm text-gray-500">No weak topics yet</p>
                  <p className="text-xs text-gray-400 mt-1">Take a quiz to see your topic breakdown</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {weakTopics.map((t) => (
                    <div key={t.topic}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-700 dark:text-gray-300">{t.topic}</span>
                        <span className="text-red-400 font-medium">{t.accuracy}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-[#222230] rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${t.accuracy}%` }} />
                      </div>
                    </div>
                  ))}
                  <button onClick={() => navigate('/quiz')} className="mt-2 text-xs text-[#7c6af7] hover:underline text-left">
                    Practice these topics →
                  </button>
                </div>
              )}
            </div>
          </div>

          {stats.dueToday > 0 && (
            <div className="mt-4 bg-[#7c6af7]/10 border border-[#7c6af7]/30 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#7c6af7]">
                  {stats.dueToday} flashcard{stats.dueToday > 1 ? 's' : ''} due today
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Keep your streak going — review them now</p>
              </div>
              <button
                onClick={() => navigate('/flashcards')}
                className="bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Review now
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}