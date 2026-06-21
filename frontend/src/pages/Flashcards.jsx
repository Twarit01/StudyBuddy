import { useState, useEffect } from 'react'
import { generateFlashcards, getAllFlashcards, getDueFlashcards, reviewFlashcard, deleteAllFlashcards } from '../api/flashcards'

const QUALITY_BUTTONS = [
  { quality: 0, label: 'Forgot',  sub: 'Reset',         bg: '#FEF2F2', darkBg: 'rgba(239,68,68,0.12)',  border: '#FECACA', darkBorder: 'rgba(239,68,68,0.3)',  color: '#DC2626' },
  { quality: 2, label: 'Hard',    sub: 'Almost',        bg: '#FFFBEB', darkBg: 'rgba(245,158,11,0.12)', border: '#FDE68A', darkBorder: 'rgba(245,158,11,0.3)', color: '#D97706' },
  { quality: 3, label: 'Good',    sub: 'Got it',        bg: '#ECFDF5', darkBg: 'rgba(16,185,129,0.12)', border: '#A7F3D0', darkBorder: 'rgba(16,185,129,0.3)', color: '#059669' },
  { quality: 5, label: 'Perfect', sub: 'Long interval', bg: '#EEF2FF', darkBg: 'rgba(99,102,241,0.12)', border: '#C7D2FE', darkBorder: 'rgba(99,102,241,0.3)', color: '#4F46E5' },
]

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
  const [isDark, setIsDark]             = useState(false)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

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
    try { await generateFlashcards(config.topic || null, config.count); await fetchCards() }
    catch (err) { setError(err.response?.data?.detail || 'Failed to generate') }
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
      if (currentIndex + 1 >= cards.length) setFinished(true)
      else { setCurrentIndex(prev => prev + 1); setFlipped(false) }
    } catch (err) { console.error(err) }
  }

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete all flashcards?')) return
    try { await deleteAllFlashcards(); setCards([]); setCurrentIndex(0); setFinished(false) }
    catch (err) { console.error(err) }
  }

  const currentCard = cards[currentIndex]
  const progress = cards.length > 0 ? (currentIndex / cards.length) * 100 : 0

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFC] dark:bg-[#0B0F1A] transition-colors duration-200">
      <div className="max-w-2xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-display text-[#0F172A] dark:text-[#F1F5F9]">Flashcards</h1>
            <p className="text-body mt-1 text-[#64748B] dark:text-[#94A3B8]">Spaced repetition powered by the SM-2 algorithm</p>
          </div>
          {cards.length > 0 && (
            <button onClick={handleDeleteAll} className="btn-secondary text-xs py-1.5 px-3 text-red-500 border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10">
              <i className="ti ti-trash" style={{ fontSize: 13 }} aria-hidden="true"></i>
              Delete all
            </button>
          )}
        </div>

        {/* Generate panel */}
        <div className="p-5 mb-6 rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
          <h2 className="text-title text-[#0F172A] dark:text-[#F1F5F9] mb-4">Generate flashcards</h2>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text" value={config.topic}
              onChange={e => setConfig({ ...config, topic: e.target.value })}
              placeholder="Topic (optional — leave blank for all documents)"
              className="flex-1 min-w-[200px] rounded-lg px-3 py-2 text-sm outline-none border transition-colors
                bg-[#F8FAFC] dark:bg-[#0B0F1A] border-[#E2E8F0] dark:border-[#1F2937]
                text-[#0F172A] dark:text-[#F1F5F9] placeholder-slate-400 focus:border-indigo-400"
            />
            <select
              value={config.count}
              onChange={e => setConfig({ ...config, count: Number(e.target.value) })}
              className="rounded-lg px-3 py-2 text-sm outline-none border w-auto
                bg-[#F8FAFC] dark:bg-[#0B0F1A] border-[#E2E8F0] dark:border-[#1F2937]
                text-[#0F172A] dark:text-[#F1F5F9]"
            >
              {[5,10,15,20].map(n => <option key={n} value={n}>{n} cards</option>)}
            </select>
            <button onClick={handleGenerate} disabled={generating} className="btn-primary text-sm">
              {generating
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
                : <><i className="ti ti-sparkles" style={{ fontSize: 15 }} aria-hidden="true"></i>Generate</>}
            </button>
          </div>
          {error && (
            <div className="mt-3 px-3 py-2 rounded-lg text-xs bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300">{error}</div>
          )}
        </div>

        {/* Mode tabs */}
        {cards.length > 0 && (
          <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white dark:bg-[#141B2D] border border-[#E2E8F0] dark:border-[#1F2937]">
            {[
              { id: 'all',  label: `All cards (${cards.length})` },
              { id: 'due',  label: 'Due today' },
            ].map(m => (
              <button
                key={m.id} onClick={() => setMode(m.id)}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: mode === m.id ? '#6366F1' : 'transparent',
                  color: mode === m.id ? '#ffffff' : (isDark ? '#94A3B8' : '#64748B'),
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && cards.length === 0 && (
          <div className="p-12 flex flex-col items-center text-center rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-[#EEF2FF] dark:bg-indigo-500/15">
              <i className="ti ti-cards" style={{ fontSize: 26, color: '#6366F1' }} aria-hidden="true"></i>
            </div>
            <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9] mb-1">No flashcards yet</p>
            <p className="text-caption text-[#94A3B8]">Upload study materials and generate cards above</p>
          </div>
        )}

        {finished && (
          <div className="p-12 flex flex-col items-center text-center rounded-2xl border bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-[#ECFDF5] dark:bg-emerald-500/15">
              <i className="ti ti-confetti" style={{ fontSize: 26, color: '#10B981' }} aria-hidden="true"></i>
            </div>
            <h2 className="text-lg font-semibold text-[#0F172A] dark:text-[#F1F5F9] mb-1" style={{ letterSpacing: '-0.3px' }}>Session complete!</h2>
            <div className="flex gap-6 mt-2 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: '#10B981', letterSpacing: '-0.5px' }}>{sessionStats.correct}</div>
                <div className="text-caption text-[#94A3B8]">correct</div>
              </div>
              <div className="w-px bg-[#E2E8F0] dark:bg-[#1F2937]" />
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: '#EF4444', letterSpacing: '-0.5px' }}>{sessionStats.wrong}</div>
                <div className="text-caption text-[#94A3B8]">to review</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={fetchCards} className="btn-primary text-sm">Study again</button>
              <button onClick={() => setMode('due')} className="btn-secondary text-sm">Review due</button>
            </div>
          </div>
        )}

        {!loading && !finished && currentCard && (
          <div>
            {/* Progress */}
            <div className="flex items-center gap-4 mb-5">
              <div className="flex-1 progress-bar">
                <div className="progress-fill progress-fill-cyan" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-mono text-slate-400 flex-shrink-0">
                {currentIndex + 1} / {cards.length}
              </span>
            </div>

            {/* Session stats */}
            <div className="flex gap-3 mb-5">
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#10B981' }}>
                <i className="ti ti-check" style={{ fontSize: 14 }} aria-hidden="true"></i>
                {sessionStats.correct} correct
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#EF4444' }}>
                <i className="ti ti-x" style={{ fontSize: 14 }} aria-hidden="true"></i>
                {sessionStats.wrong} to review
              </div>
              {currentCard.topic && (
                <span className="badge badge-indigo ml-auto">{currentCard.topic}</span>
              )}
            </div>

            {/* Card */}
            <div
              className="flip-card mb-5"
              style={{ height: '260px' }}
              onClick={() => setFlipped(prev => !prev)}
            >
              <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`}>

                {/* Front */}
                <div className="flip-card-front rounded-2xl border flex flex-col items-center justify-center p-8 text-center cursor-pointer bg-white dark:bg-[#141B2D] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm">
                  <p className="text-label mb-4 text-[#CBD5E1] dark:text-slate-500">Question</p>
                  <p className="text-base font-medium text-[#0F172A] dark:text-[#F1F5F9] leading-relaxed" style={{ letterSpacing: '-0.2px' }}>
                    {currentCard.front}
                  </p>
                  <div className="flex items-center gap-2 mt-6 text-xs text-[#CBD5E1] dark:text-slate-500">
                    <i className="ti ti-hand-click" style={{ fontSize: 14 }} aria-hidden="true"></i>
                    Click to reveal answer
                  </div>
                </div>

                {/* Back */}
                <div className="flip-card-back flex flex-col items-center justify-center p-8 text-center cursor-pointer rounded-2xl border bg-[#EEF2FF] dark:bg-indigo-500/10 border-[#C7D2FE] dark:border-indigo-500/30">
                  <p className="text-label mb-4 text-indigo-400 dark:text-indigo-300">Answer</p>
                  <p className="text-base font-medium leading-relaxed text-indigo-700 dark:text-indigo-200" style={{ letterSpacing: '-0.2px' }}>
                    {currentCard.back}
                  </p>
                </div>
              </div>
            </div>

            {/* Rating buttons */}
            {flipped ? (
              <div>
                <p className="text-caption text-center mb-3 text-[#94A3B8]">How well did you know this?</p>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {QUALITY_BUTTONS.map(btn => (
                    <button
                      key={btn.quality}
                      onClick={() => handleReview(btn.quality)}
                      className="flex flex-col items-center py-3 rounded-xl border transition-all hover:scale-105"
                      style={{ background: isDark ? btn.darkBg : btn.bg, borderColor: isDark ? btn.darkBorder : btn.border }}
                    >
                      <span className="text-sm font-semibold" style={{ color: btn.color }}>{btn.label}</span>
                      <span className="text-[10px] mt-0.5 text-[#94A3B8]">{btn.sub}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-center text-[#CBD5E1] dark:text-slate-500">
                  SM-2 algorithm schedules your next review automatically
                </p>
              </div>
            ) : (
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    if (currentIndex + 1 >= cards.length) setFinished(true)
                    else { setCurrentIndex(p => p + 1); setFlipped(false) }
                  }}
                  className="text-xs font-medium transition-colors text-[#CBD5E1] dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  Skip this card →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}