import { useState, useEffect } from 'react'
import { generateFlashcards, getAllFlashcards, getDueFlashcards, reviewFlashcard, deleteAllFlashcards } from '../api/flashcards'

export default function Flashcards() {
  const [cards, setCards]               = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped]           = useState(false)
  const [mode, setMode]                 = useState('all')
  const [loading, setLoading]           = useState(false)
  const [generating, setGenerating]     = useState(false)
  const [error, setError]               = useState(null)
  const [config, setConfig]             = useState({ topic: '', count: 10 })
  const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0 })
  const [finished, setFinished]         = useState(false)

  useEffect(() => { fetchCards() }, [mode])

  const fetchCards = async () => {
    setLoading(true); setError(null)
    setCurrentIndex(0); setFlipped(false)
    setFinished(false); setSessionStats({ correct: 0, wrong: 0 })
    try {
      const data = mode === 'due' ? await getDueFlashcards() : await getAllFlashcards()
      setCards(data)
    } catch { setError('Failed to load flashcards') }
    finally { setLoading(false) }
  }

  const handleGenerate = async () => {
    setGenerating(true); setError(null)
    try {
      await generateFlashcards(config.topic || null, config.count)
      await fetchCards()
    } catch (err) { setError(err.response?.data?.detail || 'Failed to generate flashcards') }
    finally { setGenerating(false) }
  }

  const handleReview = async (quality) => {
    const card = cards[currentIndex]
    try {
      await reviewFlashcard(card.id, quality)
      setSessionStats(prev => ({
        correct: quality >= 3 ? prev.correct + 1 : prev.correct,
        wrong:   quality < 3  ? prev.wrong + 1  : prev.wrong,
      }))
      if (currentIndex + 1 >= cards.length) { setFinished(true) }
      else { setCurrentIndex(prev => prev + 1); setFlipped(false) }
    } catch (err) { console.error(err) }
  }

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete all flashcards?')) return
    try { await deleteAllFlashcards(); setCards([]); setCurrentIndex(0); setFinished(false) }
    catch (err) { console.error(err) }
  }

  const currentCard = cards[currentIndex]
  const progress = cards.length > 0 ? Math.round((currentIndex / cards.length) * 100) : 0

  return (
    <div className="h-full overflow-y-auto bg-surface-muted dark:bg-[#0F172A] transition-colors duration-200 p-6">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink-900 dark:text-white">Flashcards</h1>
            <p className="text-sm text-ink-500 mt-1">Spaced repetition powered by the SM-2 algorithm</p>
          </div>
          {cards.length > 0 && (
            <button onClick={handleDeleteAll} className="text-xs text-ink-400 hover:text-red-500 transition-colors flex items-center gap-1.5">
              <i className="ti ti-trash" style={{ fontSize: 14 }} aria-hidden="true"></i>
              Delete all
            </button>
          )}
        </div>

        {/* Generate */}
        <div className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl p-4 mb-6 shadow-soft">
          <p className="text-xs font-medium text-ink-500 mb-3">Generate new cards</p>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text" value={config.topic}
              onChange={e => setConfig({ ...config, topic: e.target.value })}
              placeholder="Topic (optional)"
              className="bg-surface-muted dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] focus:border-primary-400 rounded-xl px-3 py-2 text-sm text-ink-900 dark:text-white placeholder-ink-400 outline-none transition-colors flex-1 min-w-[160px]"
            />
            <select
              value={config.count}
              onChange={e => setConfig({ ...config, count: Number(e.target.value) })}
              className="bg-surface-muted dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-xl px-3 py-2 text-sm text-ink-900 dark:text-white outline-none"
            >
              {[5,10,15,20].map(n => <option key={n} value={n}>{n} cards</option>)}
            </select>
            <button
              onClick={handleGenerate} disabled={generating}
              className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-4 py-2 transition-colors flex items-center gap-2"
            >
              {generating ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</> : <><i className="ti ti-sparkles" style={{ fontSize: 16 }} aria-hidden="true"></i>Generate</>}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {/* Mode toggle */}
        {cards.length > 0 && (
          <div className="flex gap-2 mb-6">
            {['all','due'].map(m => (
              <button
                key={m} onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors border
                  ${mode === m ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white dark:bg-[#1E293B] border-surface-border dark:border-[#334155] text-ink-500 hover:text-ink-900 dark:hover:text-gray-200'}`}
              >
                {m === 'all' ? `All cards (${cards.length})` : 'Due today'}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && cards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <i className="ti ti-cards text-ink-400" style={{ fontSize: 36 }} aria-hidden="true"></i>
            <p className="text-sm text-ink-500 mt-3">No flashcards yet</p>
            <p className="text-xs text-ink-400 mt-1">Upload study materials and click Generate above</p>
          </div>
        )}

        {finished && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-3">
              <i className="ti ti-confetti" style={{ fontSize: 26 }} aria-hidden="true"></i>
            </div>
            <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-1">Session complete!</h2>
            <p className="text-sm text-ink-500 mb-4">{sessionStats.correct} correct · {sessionStats.wrong} to review</p>
            <div className="flex gap-3">
              <button onClick={fetchCards} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl px-5 py-2.5 transition-colors">Study again</button>
              <button onClick={() => setMode('due')} className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] hover:border-primary-300 text-ink-700 dark:text-gray-300 text-sm font-medium rounded-xl px-5 py-2.5 transition-colors">Review due cards</button>
            </div>
          </div>
        )}

        {!loading && !finished && currentCard && (
          <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-1.5 bg-surface-border dark:bg-[#334155] rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-ink-400 font-mono flex-shrink-0">{currentIndex + 1} / {cards.length}</span>
            </div>

            <div className="flex gap-3 mb-4">
              <span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-400/10 dark:text-emerald-300 px-2.5 py-1 rounded-full">✓ {sessionStats.correct} correct</span>
              <span className="text-xs text-red-500 bg-red-50 dark:bg-red-400/10 dark:text-red-300 px-2.5 py-1 rounded-full">✗ {sessionStats.wrong} to review</span>
              {currentCard.topic && <span className="text-xs text-ink-500 bg-surface-muted dark:bg-[#334155] px-2.5 py-1 rounded-full">{currentCard.topic}</span>}
            </div>

            <div className="flip-card cursor-pointer" style={{ height: '240px' }} onClick={() => setFlipped(prev => !prev)}>
              <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`}>
                <div className="flip-card-front bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-2xl flex flex-col items-center justify-center p-8 text-center shadow-soft">
                  <p className="text-[10px] uppercase tracking-widest text-ink-400 mb-4 font-medium">Question</p>
                  <p className="text-base font-medium text-ink-900 dark:text-white leading-relaxed">{currentCard.front}</p>
                  <p className="text-xs text-ink-400 mt-4">Click to reveal answer</p>
                </div>
                <div className="flip-card-back bg-primary-50 dark:bg-primary-600/10 border border-primary-200 dark:border-primary-600/30 rounded-2xl flex flex-col items-center justify-center p-8 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-primary-600 dark:text-primary-300 mb-4 font-medium">Answer</p>
                  <p className="text-base text-primary-700 dark:text-primary-200 leading-relaxed">{currentCard.back}</p>
                </div>
              </div>
            </div>

            {flipped && (
              <div className="mt-6">
                <p className="text-xs text-ink-400 text-center mb-3">How well did you know this?</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { quality: 0, label: 'Forgot',  color: 'bg-red-50 dark:bg-red-500/15 hover:bg-red-100 dark:hover:bg-red-500/25 text-red-500 border-red-200 dark:border-red-500/30' },
                    { quality: 2, label: 'Hard',     color: 'bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 text-amber-500 border-amber-200 dark:border-amber-500/30' },
                    { quality: 3, label: 'Good',     color: 'bg-yellow-50 dark:bg-yellow-500/15 hover:bg-yellow-100 dark:hover:bg-yellow-500/25 text-yellow-600 border-yellow-200 dark:border-yellow-500/30' },
                    { quality: 5, label: 'Perfect',  color: 'bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-600 border-emerald-200 dark:border-emerald-500/30' },
                  ].map(btn => (
                    <button
                      key={btn.quality} onClick={() => handleReview(btn.quality)}
                      className={`border rounded-xl py-2.5 text-xs font-medium transition-colors ${btn.color}`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-ink-400 text-center mt-2">SM-2 algorithm schedules your next review automatically</p>
              </div>
            )}

            {!flipped && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => { if (currentIndex + 1 >= cards.length) setFinished(true); else { setCurrentIndex(prev => prev + 1); setFlipped(false) } }}
                  className="text-xs text-ink-400 hover:text-ink-600 dark:hover:text-gray-300 transition-colors"
                >
                  Skip →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}