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
    <div className="h-full overflow-y-auto p-6 bg-gray-50 dark:bg-[#0f0f13] transition-colors duration-200">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Flashcards</h1>
          <p className="text-sm text-gray-500 mt-1">Spaced repetition powered by SM-2 algorithm</p>
        </div>
        {cards.length > 0 && (
          <button onClick={handleDeleteAll} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Delete all</button>
        )}
      </div>

      {/* Generate */}
      <div className="bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] rounded-xl p-4 mb-6">
        <p className="text-xs font-medium text-gray-500 mb-3">Generate new cards</p>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text" value={config.topic}
            onChange={e => setConfig({ ...config, topic: e.target.value })}
            placeholder="Topic (optional)"
            className="bg-gray-50 dark:bg-[#222230] border border-gray-200 dark:border-[#333344] focus:border-[#7c6af7] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none transition-colors flex-1 min-w-[160px]"
          />
          <select
            value={config.count}
            onChange={e => setConfig({ ...config, count: Number(e.target.value) })}
            className="bg-gray-50 dark:bg-[#222230] border border-gray-200 dark:border-[#333344] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white outline-none"
          >
            {[5,10,15,20].map(n => <option key={n} value={n}>{n} cards</option>)}
          </select>
          <button
            onClick={handleGenerate} disabled={generating}
            className="bg-[#7c6af7] hover:bg-[#6b5ce7] disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors flex items-center gap-2"
          >
            {generating ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</> : '✨ Generate'}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
      </div>

      {/* Mode toggle */}
      {cards.length > 0 && (
        <div className="flex gap-2 mb-6">
          {['all','due'].map(m => (
            <button
              key={m} onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors border
                ${mode === m ? 'bg-[#7c6af7] border-[#7c6af7] text-white' : 'bg-transparent border-gray-300 dark:border-[#333344] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              {m === 'all' ? `All cards (${cards.length})` : 'Due today'}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#7c6af7] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && cards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-4xl mb-3">🃏</div>
          <p className="text-sm text-gray-500">No flashcards yet</p>
          <p className="text-xs text-gray-400 mt-1">Upload study materials and click Generate above</p>
        </div>
      )}

      {finished && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Session complete!</h2>
          <p className="text-sm text-gray-500 mb-4">{sessionStats.correct} correct · {sessionStats.wrong} to review</p>
          <div className="flex gap-3">
            <button onClick={fetchCards} className="bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-sm font-medium rounded-xl px-5 py-2.5 transition-colors">Study again</button>
            <button onClick={() => setMode('due')} className="bg-gray-100 dark:bg-[#222230] hover:bg-gray-200 dark:hover:bg-[#2a2a3a] text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl px-5 py-2.5 transition-colors">Review due cards</button>
          </div>
        </div>
      )}

      {!loading && !finished && currentCard && (
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-[#222230] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#7c6af7] to-[#5de0b0] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-gray-500 font-mono flex-shrink-0">{currentIndex + 1} / {cards.length}</span>
          </div>

          <div className="flex gap-3 mb-4">
            <span className="text-xs text-emerald-500 bg-emerald-50 dark:bg-emerald-400/10 px-2.5 py-1 rounded-full">✓ {sessionStats.correct} correct</span>
            <span className="text-xs text-red-400 bg-red-50 dark:bg-red-400/10 px-2.5 py-1 rounded-full">✗ {sessionStats.wrong} to review</span>
            {currentCard.topic && <span className="text-xs text-gray-400 bg-gray-100 dark:bg-[#222230] px-2.5 py-1 rounded-full">{currentCard.topic}</span>}
          </div>

          <div className="flip-card cursor-pointer" style={{ height: '240px' }} onClick={() => setFlipped(prev => !prev)}>
            <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`}>
              <div className="flip-card-front bg-white dark:bg-[#18181f] border border-gray-200 dark:border-[#222230] rounded-2xl flex flex-col items-center justify-center p-8 text-center">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-4 font-medium">Question</p>
                <p className="text-base font-medium text-gray-900 dark:text-white leading-relaxed">{currentCard.front}</p>
                <p className="text-xs text-gray-400 mt-4">Click to reveal answer</p>
              </div>
              <div className="flip-card-back bg-[#7c6af7]/10 border border-[#7c6af7]/30 rounded-2xl flex flex-col items-center justify-center p-8 text-center">
                <p className="text-[10px] uppercase tracking-widest text-[#7c6af7] mb-4 font-medium">Answer</p>
                <p className="text-base text-[#c4beff] leading-relaxed">{currentCard.back}</p>
              </div>
            </div>
          </div>

          {flipped && (
            <div className="mt-6">
              <p className="text-xs text-gray-400 text-center mb-3">How well did you know this?</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { quality: 0, label: 'Forgot',  color: 'bg-red-50 dark:bg-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/30 text-red-500 border-red-200 dark:border-red-500/30' },
                  { quality: 2, label: 'Hard',     color: 'bg-orange-50 dark:bg-orange-500/20 hover:bg-orange-100 dark:hover:bg-orange-500/30 text-orange-500 border-orange-200 dark:border-orange-500/30' },
                  { quality: 3, label: 'Good',     color: 'bg-yellow-50 dark:bg-yellow-500/20 hover:bg-yellow-100 dark:hover:bg-yellow-500/30 text-yellow-600 border-yellow-200 dark:border-yellow-500/30' },
                  { quality: 5, label: 'Perfect',  color: 'bg-emerald-50 dark:bg-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 text-emerald-600 border-emerald-200 dark:border-emerald-500/30' },
                ].map(btn => (
                  <button
                    key={btn.quality} onClick={() => handleReview(btn.quality)}
                    className={`border rounded-xl py-2.5 text-xs font-medium transition-colors ${btn.color}`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 text-center mt-2">SM-2 algorithm schedules your next review automatically</p>
            </div>
          )}

          {!flipped && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => { if (currentIndex + 1 >= cards.length) setFinished(true); else { setCurrentIndex(prev => prev + 1); setFlipped(false) } }}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                Skip →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}