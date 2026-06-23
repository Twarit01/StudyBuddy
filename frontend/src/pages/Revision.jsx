import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDueFlashcards } from '../api/flashcards'
import { getQuizMistakes, resolveQuizMistake } from '../api/quiz'
import { getStudyPlan } from '../api/progress'

export default function Revision() {
  const navigate = useNavigate()
  const [dueCards, setDueCards] = useState([])
  const [mistakes, setMistakes] = useState([])
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { loadRevision() }, [])

  const loadRevision = async () => {
    setLoading(true); setError(null)
    try {
      const [cards, openMistakes, studyPlan] = await Promise.all([
        getDueFlashcards(),
        getQuizMistakes(false, 10),
        getStudyPlan(),
      ])
      setDueCards(cards)
      setMistakes(openMistakes)
      setPlan(studyPlan)
    } catch (err) {
      console.error(err)
      setError('Could not build your revision session. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (mistakeId) => {
    try {
      await resolveQuizMistake(mistakeId)
      setMistakes(prev => prev.filter(m => m.id !== mistakeId))
    } catch (err) {
      console.error(err)
      setError('Could not update that mistake.')
    }
  }

  const primaryWeakTopic = plan?.weak_topics?.find(t => t.is_weak)?.topic || plan?.weak_topics?.[0]?.topic || ''
  const completionTotal = dueCards.length + mistakes.length + (primaryWeakTopic ? 1 : 0)

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFC] dark:bg-[#0B0F1A] transition-colors duration-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-display text-[#0F172A] dark:text-[#F1F5F9]">Smart revision</h1>
            <p className="text-body mt-1 text-[#64748B] dark:text-[#94A3B8]">
              One focused session from due cards, quiz mistakes, and weak topics.
            </p>
          </div>
          <button onClick={loadRevision} disabled={loading} className="btn-secondary text-sm justify-center">
            <i className="ti ti-refresh" style={{ fontSize: 15 }} aria-hidden="true"></i>
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl text-sm bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Due flashcards', value: dueCards.length, icon: 'ti-cards', color: '#10B981' },
                { label: 'Open mistakes', value: mistakes.length, icon: 'ti-alert-circle', color: '#EF4444' },
                { label: 'Focus tasks', value: plan?.today_tasks?.length || 0, icon: 'ti-list-check', color: '#6366F1' },
              ].map(item => (
                <div key={item.label} className="p-5 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
                  <i className={`ti ${item.icon}`} style={{ fontSize: 20, color: item.color }} aria-hidden="true"></i>
                  <div className="text-2xl font-semibold mt-3 text-[#0F172A] dark:text-[#F1F5F9]">{item.value}</div>
                  <div className="text-caption mt-1 text-[#94A3B8]">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="p-6 mb-6 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-title text-[#0F172A] dark:text-[#F1F5F9]">Today&apos;s revision path</h2>
                  <p className="text-caption mt-1 text-[#94A3B8]">
                    {completionTotal > 0 ? `${completionTotal} focused item${completionTotal === 1 ? '' : 's'} ready` : 'No urgent review items yet'}
                  </p>
                </div>
                <button onClick={() => navigate('/flashcards', { state: { mode: 'due' } })} className="btn-primary text-sm justify-center">
                  Start with flashcards
                  <i className="ti ti-arrow-right" style={{ fontSize: 14 }} aria-hidden="true"></i>
                </button>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                {(plan?.today_tasks || []).map((task, i) => (
                  <div key={`${task.type}-${i}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0F1A]">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold bg-[#EEF2FF] dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">{i + 1}</div>
                    <span className="flex-1 text-sm text-[#374151] dark:text-[#CBD5E1]">{task.title}</span>
                    <span className="text-xs text-[#94A3B8]">{task.minutes} min</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-title text-[#0F172A] dark:text-[#F1F5F9]">Mistake retry queue</h2>
                  <button onClick={() => navigate('/quiz')} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Open quiz</button>
                </div>
                {mistakes.length === 0 ? (
                  <p className="text-sm text-[#94A3B8] py-6 text-center">No open mistakes. Nice work.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {mistakes.slice(0, 5).map(mistake => (
                      <div key={mistake.id} className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0F1A] border border-[#E2E8F0] dark:border-[#1F2937]">
                        <p className="text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] line-clamp-2">{mistake.question}</p>
                        <p className="text-xs text-[#94A3B8] mt-1">{mistake.topic || 'General'} · Correct: {mistake.correct_answer || 'Review explanation'}</p>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => navigate('/quiz', { state: { retryTopic: mistake.topic } })} className="btn-secondary text-xs py-1.5 px-3">Retry topic</button>
                          <button onClick={() => handleResolve(mistake.id)} className="btn-primary text-xs py-1.5 px-3">Mark resolved</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
                <h2 className="text-title text-[#0F172A] dark:text-[#F1F5F9] mb-4">Weak-topic practice</h2>
                {primaryWeakTopic ? (
                  <div>
                    <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mb-4">
                      Your next best quiz topic is <span className="font-semibold text-indigo-600 dark:text-indigo-300">{primaryWeakTopic}</span>.
                    </p>
                    <button onClick={() => navigate('/quiz', { state: { retryTopic: primaryWeakTopic } })} className="btn-primary text-sm">
                      Generate practice quiz
                      <i className="ti ti-arrow-right" style={{ fontSize: 14 }} aria-hidden="true"></i>
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-[#94A3B8] py-6 text-center">Take a few quizzes to unlock weak-topic practice.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
