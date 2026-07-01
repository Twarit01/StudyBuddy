import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { generateFlashcards, getAllFlashcards, getDueFlashcards, reviewFlashcard, deleteAllFlashcards } from '../api/flashcards'
import { listDocuments } from '../api/documents'
import { useXP } from '../context/XPContext'

const QUALITY_BUTTONS = [
  { quality:0, label:'Forgot',  sub:'Reset',         color:'#EF4444', bg:'rgba(239,68,68,0.12)',   border:'rgba(239,68,68,0.3)'   },
  { quality:2, label:'Hard',    sub:'Almost',         color:'#F59E0B', bg:'rgba(245,158,11,0.12)',  border:'rgba(245,158,11,0.3)'  },
  { quality:3, label:'Good',    sub:'Got it',         color:'#10B981', bg:'rgba(16,185,129,0.12)',  border:'rgba(16,185,129,0.3)'  },
  { quality:5, label:'Perfect', sub:'Long interval',  color:'#7C3AED', bg:'rgba(124,58,237,0.12)', border:'rgba(124,58,237,0.3)'  },
]

export default function Flashcards() {
  const location = useLocation()
  const { showXPEvents } = useXP()

  const [cards, setCards]               = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped]           = useState(false)
  const [mode, setMode]                 = useState('all')
  const [loading, setLoading]           = useState(false)
  const [generating, setGenerating]     = useState(false)
  const [reviewing, setReviewing]       = useState(false)
  const [error, setError]               = useState(null)
  const [documents, setDocuments]       = useState([])
  const [documentsError, setDocumentsError] = useState(null)
  const [config, setConfig]             = useState({ topic:'', count:10, documentId:'' })
  const [sessionStats, setSessionStats] = useState({ correct:0, wrong:0 })
  const [finished, setFinished]         = useState(false)

  useEffect(() => { fetchCards() }, [mode])

  useEffect(() => {
    const load = async () => {
      try { setDocuments(await listDocuments()) }
      catch (err) { console.error(err); setDocumentsError('Could not load documents') }
    }
    load()
  }, [])

  useEffect(() => {
    if (location.state?.documentId)
      setConfig(prev => ({ ...prev, documentId: String(location.state.documentId) }))
    if (location.state?.mode === 'due') setMode('due')
  }, [location.state])

  const fetchCards = async () => {
    setLoading(true); setError(null)
    setCurrentIndex(0); setFlipped(false)
    setFinished(false); setSessionStats({ correct:0, wrong:0 })
    try {
      const data = mode==='due' ? await getDueFlashcards() : await getAllFlashcards()
      setCards(data)
    } catch { setError('Failed to load flashcards') }
    finally { setLoading(false) }
  }

  const handleGenerate = async () => {
    setGenerating(true); setError(null)
    try {
      await generateFlashcards(config.topic || null, config.count, config.documentId || null)
      await fetchCards()
    } catch (err) { setError(err.response?.data?.detail || 'Failed to generate') }
    finally { setGenerating(false) }
  }

  const handleReview = async (quality) => {
    const card = cards[currentIndex]
    if (!card || reviewing) return
    setReviewing(true); setError(null)
    try {
      const result = await reviewFlashcard(card.id, quality)
      setSessionStats(prev => ({
        correct: quality >= 3 ? prev.correct + 1 : prev.correct,
        wrong:   quality < 3  ? prev.wrong + 1  : prev.wrong,
      }))
      if (result?.xp_awarded > 0) {
        showXPEvents([{ awarded: result.xp_awarded, label: 'Reviewed a flashcard' }])
      }
      if (currentIndex+1 >= cards.length) setFinished(true)
      else { setCurrentIndex(prev => prev+1); setFlipped(false) }
    } catch (err) { console.error(err); setError('Could not save your review. Please try again.') }
    finally { setReviewing(false) }
  }

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete all flashcards?')) return
    try { await deleteAllFlashcards(); setCards([]); setCurrentIndex(0); setFinished(false) }
    catch (err) { console.error(err) }
  }

  const handleSkip = () => {
    if (currentIndex+1 >= cards.length) setFinished(true)
    else { setCurrentIndex(p => p+1); setFlipped(false) }
  }

  const currentCard = cards[currentIndex]
  const progress    = cards.length > 0 ? (currentIndex / cards.length) * 100 : 0
  const known       = sessionStats.correct
  const learning    = sessionStats.wrong

  return (
    <div style={{ height:'100%', overflowY:'auto', background:'#0C0C14', color:'#fff',
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{`
        .fc-card { background:#13131F; border:1px solid rgba(255,255,255,0.07); border-radius:16px; padding:20px; }
        .fc-input { background:#0C0C14; border:1px solid rgba(255,255,255,0.1); border-radius:10px;
                    padding:8px 12px; color:#fff; font-size:13px; outline:none; font-family:inherit;
                    transition:border-color 0.2s; }
        .fc-input:focus { border-color:rgba(124,58,237,0.5); }
        .fc-input::placeholder { color:rgba(255,255,255,0.25); }
        .fc-select { background:#0C0C14; border:1px solid rgba(255,255,255,0.1); border-radius:10px;
                     padding:8px 12px; color:#fff; font-size:13px; outline:none; cursor:pointer; }
        .fc-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px;
                  font-size:13px; font-weight:700; cursor:pointer; border:none; transition:all 0.2s; }
        .fc-btn-primary { background:linear-gradient(135deg,#7C3AED,#6D28D9); color:#fff; }
        .fc-btn-primary:hover { background:linear-gradient(135deg,#8B5CF6,#7C3AED); }
        .fc-btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .fc-btn-ghost { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.7); }
        .fc-btn-ghost:hover { background:rgba(255,255,255,0.1); color:#fff; }
        .fc-btn-danger { background:rgba(239,68,68,0.12); color:#F87171;
                         border:1px solid rgba(239,68,68,0.25); }
        .fc-btn-danger:hover { background:rgba(239,68,68,0.2); }
        .flip-container { perspective:1200px; cursor:pointer; }
        .flip-inner { position:relative; width:100%; transition:transform 0.55s cubic-bezier(.4,0,.2,1);
                      transform-style:preserve-3d; }
        .flip-inner.flipped { transform:rotateY(180deg); }
        .flip-face { position:absolute; width:100%; height:100%; backface-visibility:hidden;
                     border-radius:18px; display:flex; flex-direction:column;
                     align-items:center; justify-content:center; padding:32px; box-sizing:border-box; }
        .flip-front { background:#1A1A2D; border:1px solid rgba(255,255,255,0.08); }
        .flip-back  { background:linear-gradient(135deg,rgba(124,58,237,0.2),rgba(79,70,229,0.15));
                      border:1px solid rgba(124,58,237,0.35); transform:rotateY(180deg); }
        .qual-btn { display:flex; flex-direction:column; align-items:center; padding:14px 8px;
                    border-radius:12px; border:1px solid; cursor:pointer; transition:all 0.15s;
                    font-family:inherit; }
        .qual-btn:hover { transform:translateY(-2px); }
        .qual-btn:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
        .mode-tab { flex:1; padding:8px 0; border-radius:9px; font-size:12px; font-weight:600;
                    cursor:pointer; border:none; transition:all 0.2s; font-family:inherit; }
        .progress-track { height:4px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden; }
        .progress-fill  { height:100%; border-radius:4px; transition:width 0.4s; }
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .fade-up { animation:fadeUp 0.25s ease; }
      `}</style>

      <div style={{ maxWidth:640, margin:'0 auto', padding:'28px 24px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          marginBottom:24, gap:12 }}>
          <div>
            <h1 style={{ fontSize:28, fontWeight:800, margin:0, letterSpacing:'-0.5px' }}>Flashcards</h1>
            <p style={{ color:'rgba(255,255,255,0.4)', fontSize:13, margin:'5px 0 0' }}>
              Spaced repetition · SM-2 algorithm · {cards.length} cards loaded
            </p>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
            {/* Session stat pills */}
            <div style={{ display:'flex', gap:6 }}>
              <div style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700,
                background:'rgba(16,185,129,0.15)', color:'#6EE7B7', border:'1px solid rgba(16,185,129,0.25)' }}>
                {known} known
              </div>
              <div style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700,
                background:'rgba(239,68,68,0.15)', color:'#FCA5A5', border:'1px solid rgba(239,68,68,0.25)' }}>
                {learning} learning
              </div>
              <div style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700,
                background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.5)' }}>
                {Math.max(0, cards.length - currentIndex)} left
              </div>
            </div>
            {cards.length > 0 && (
              <button onClick={handleDeleteAll} className="fc-btn fc-btn-danger"
                style={{ padding:'6px 12px', fontSize:11 }}>🗑 Delete all</button>
            )}
          </div>
        </div>

        {/* Generate Panel */}
        <div className="fc-card" style={{ marginBottom:16 }}>
          <h2 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700 }}>✨ Generate Flashcards</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:10, alignItems:'end' }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)',
                marginBottom:5, letterSpacing:0.5 }}>TOPIC</div>
              <input type="text" value={config.topic}
                onChange={e=>setConfig({...config, topic:e.target.value})}
                placeholder="Topic (optional)"
                className="fc-input" style={{ width:'100%', boxSizing:'border-box' }}/>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)',
                marginBottom:5, letterSpacing:0.5 }}>DOCUMENT</div>
              <select value={config.documentId}
                onChange={e=>setConfig({...config, documentId:e.target.value})}
                className="fc-select">
                <option value="">All documents</option>
                {documents.map(d => <option key={d.id} value={d.id}>{d.original_name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)',
                marginBottom:5, letterSpacing:0.5 }}>COUNT</div>
              <select value={config.count}
                onChange={e=>setConfig({...config, count:Number(e.target.value)})}
                className="fc-select">
                {[5,10,15,20].map(n => <option key={n} value={n}>{n} cards</option>)}
              </select>
            </div>
            <button onClick={handleGenerate} disabled={generating} className="fc-btn fc-btn-primary">
              {generating
                ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)',
                    borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                    Generating...</>
                : '✨ Generate'}
            </button>
          </div>
          {(error || documentsError) && (
            <div style={{ marginTop:10, padding:'8px 12px', borderRadius:9, fontSize:12,
              background:'rgba(239,68,68,0.1)', color:'#FCA5A5' }}>
              {error || documentsError}
            </div>
          )}
        </div>

        {/* Mode Tabs */}
        {cards.length > 0 && (
          <div style={{ display:'flex', gap:4, padding:4, borderRadius:12, marginBottom:16,
            background:'#13131F', border:'1px solid rgba(255,255,255,0.07)' }}>
            {[
              { id:'all', label:`All cards (${cards.length})` },
              { id:'due', label:'Due today' },
            ].map(m => (
              <button key={m.id} onClick={()=>setMode(m.id)} className="mode-tab"
                style={{
                  background: mode===m.id ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : 'transparent',
                  color: mode===m.id ? '#fff' : 'rgba(255,255,255,0.45)',
                }}>
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
            <div style={{ width:24, height:24, border:'3px solid #7C3AED',
              borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
          </div>
        )}

        {/* Empty state */}
        {!loading && cards.length===0 && !finished && (
          <div className="fc-card fade-up" style={{ display:'flex', flexDirection:'column',
            alignItems:'center', textAlign:'center', padding:'52px 32px' }}>
            <div style={{ width:56, height:56, borderRadius:16, background:'rgba(124,58,237,0.15)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, marginBottom:16 }}>🃏</div>
            <p style={{ fontSize:15, fontWeight:700, marginBottom:5 }}>No flashcards yet</p>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.38)', margin:0 }}>
              Upload study materials and generate cards above
            </p>
          </div>
        )}

        {/* Session Complete */}
        {finished && (
          <div className="fc-card fade-up" style={{ display:'flex', flexDirection:'column',
            alignItems:'center', textAlign:'center', padding:'52px 32px' }}>
            <div style={{ width:56, height:56, borderRadius:16, background:'rgba(16,185,129,0.15)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, marginBottom:16 }}>🎉</div>
            <h2 style={{ fontSize:22, fontWeight:800, margin:'0 0 6px', letterSpacing:'-0.5px' }}>
              Session complete!
            </h2>
            <div style={{ display:'flex', gap:32, margin:'16px 0 28px' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:32, fontWeight:800, color:'#10B981', letterSpacing:'-0.5px' }}>
                  {sessionStats.correct}
                </div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:3 }}>correct</div>
              </div>
              <div style={{ width:1, background:'rgba(255,255,255,0.08)' }}/>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:32, fontWeight:800, color:'#EF4444', letterSpacing:'-0.5px' }}>
                  {sessionStats.wrong}
                </div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:3 }}>to review</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={fetchCards} className="fc-btn fc-btn-primary">Study again</button>
              <button onClick={()=>setMode('due')} className="fc-btn fc-btn-ghost">Review due</button>
            </div>
          </div>
        )}

        {/* Active Card */}
        {!loading && !finished && currentCard && (
          <div className="fade-up">
            {/* Progress bar */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div className="progress-track" style={{ flex:1 }}>
                <div className="progress-fill"
                  style={{ width:`${progress}%`, background:'linear-gradient(90deg,#7C3AED,#22D3EE)' }}/>
              </div>
              <span style={{ fontSize:11, fontFamily:'monospace', color:'rgba(255,255,255,0.38)', flexShrink:0 }}>
                {currentIndex+1} / {cards.length}
              </span>
            </div>

            {/* Dot indicators */}
            <div style={{ display:'flex', gap:5, marginBottom:20, justifyContent:'center' }}>
              {cards.map((_,i) => (
                <div key={i} style={{ width:i===currentIndex?20:6, height:6, borderRadius:3,
                  background: i<currentIndex ? '#10B981' : i===currentIndex ? '#7C3AED' : 'rgba(255,255,255,0.12)',
                  transition:'all 0.3s' }}/>
              ))}
            </div>

            {/* Flip card */}
            <div className="flip-container"
              style={{ height:'clamp(220px,42vh,320px)', marginBottom:20 }}
              onClick={()=>setFlipped(p=>!p)}>
              <div className={`flip-inner${flipped?' flipped':''}`} style={{ height:'100%' }}>
                {/* Front */}
                <div className="flip-face flip-front" style={{ textAlign:'center' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)',
                    letterSpacing:2, textTransform:'uppercase', marginBottom:16 }}>Question</div>
                  <p style={{ fontSize:16, fontWeight:600, lineHeight:1.6, margin:0,
                    color:'rgba(255,255,255,0.9)' }}>{currentCard.front}</p>
                  <div style={{ position:'absolute', bottom:20, fontSize:11, color:'rgba(255,255,255,0.25)',
                    display:'flex', alignItems:'center', gap:5 }}>
                    <span>↺</span> Tap to flip
                  </div>
                </div>
                {/* Back */}
                <div className="flip-face flip-back" style={{ textAlign:'center' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'rgba(196,181,253,0.7)',
                    letterSpacing:2, textTransform:'uppercase', marginBottom:16 }}>Answer</div>
                  <p style={{ fontSize:16, fontWeight:600, lineHeight:1.6, margin:0,
                    color:'rgba(255,255,255,0.95)' }}>{currentCard.back}</p>
                </div>
              </div>
            </div>

            {/* Topic badge */}
            {currentCard.topic && (
              <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
                <span style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700,
                  background:'rgba(124,58,237,0.2)', color:'#C4B5FD',
                  border:'1px solid rgba(124,58,237,0.3)' }}>{currentCard.topic}</span>
              </div>
            )}

            {/* Rating buttons (after flip) or Skip */}
            {flipped ? (
              <div>
                <p style={{ fontSize:12, textAlign:'center', color:'rgba(255,255,255,0.38)', marginBottom:12 }}>
                  How well did you know this?
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:10 }}>
                  {QUALITY_BUTTONS.map(btn => (
                    <button key={btn.quality} onClick={()=>handleReview(btn.quality)}
                      disabled={reviewing} className="qual-btn"
                      style={{ background:btn.bg, borderColor:btn.border }}>
                      <span style={{ fontSize:14, fontWeight:700, color:btn.color }}>{btn.label}</span>
                      <span style={{ fontSize:10, color:'rgba(255,255,255,0.38)', marginTop:3 }}>{btn.sub}</span>
                    </button>
                  ))}
                </div>
                <p style={{ fontSize:10, textAlign:'center', color:'rgba(255,255,255,0.2)', margin:0 }}>
                  SM-2 algorithm schedules your next review automatically
                </p>
              </div>
            ) : (
              <div style={{ display:'flex', justifyContent:'center' }}>
                <button onClick={handleSkip}
                  style={{ background:'none', border:'none', cursor:'pointer', fontSize:12,
                    color:'rgba(255,255,255,0.3)', fontFamily:'inherit', transition:'color 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,0.6)'}
                  onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}>
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