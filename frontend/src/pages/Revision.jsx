import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDueFlashcards } from '../api/flashcards'
import { getQuizMistakes, resolveQuizMistake } from '../api/quiz'
import { getStudyPlan } from '../api/progress'

export default function Revision() {
  const navigate = useNavigate()
  const [dueCards, setDueCards] = useState([])
  const [mistakes, setMistakes] = useState([])
  const [plan, setPlan]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

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
    } finally { setLoading(false) }
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

  const primaryWeakTopic =
    plan?.weak_topics?.find(t => t.is_weak)?.topic ||
    plan?.weak_topics?.[0]?.topic || ''

  const completionTotal = dueCards.length + mistakes.length + (primaryWeakTopic ? 1 : 0)

  return (
    <div className="rv-page-wrapper" style={{ height:'100%', overflowY:'auto', background:'#0C0C14', color:'#fff',
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{`
        .rv-card { background:#13131F; border:1px solid rgba(255,255,255,0.07); border-radius:16px; padding:22px; }
        .rv-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px;
                  font-size:13px; font-weight:700; cursor:pointer; border:none; transition:all 0.2s; font-family:inherit; }
        .rv-btn-primary { background:linear-gradient(135deg,#7C3AED,#6D28D9); color:#fff; }
        .rv-btn-primary:hover { background:linear-gradient(135deg,#8B5CF6,#7C3AED); }
        .rv-btn-ghost { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.65); }
        .rv-btn-ghost:hover { background:rgba(255,255,255,0.1); color:#fff; }
        .rv-btn-danger { background:rgba(239,68,68,0.12); color:#F87171;
                         border:1px solid rgba(239,68,68,0.25); }
        .rv-btn-danger:hover { background:rgba(239,68,68,0.2); }
        .mistake-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07);
                        border-radius:12px; padding:14px; transition:border-color 0.15s; }
        .mistake-card:hover { border-color:rgba(255,255,255,0.13); }
        .task-row { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px;
                    background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); }
        .week-day { padding:12px 14px; border-radius:12px; background:rgba(255,255,255,0.03);
                    border:1px solid rgba(255,255,255,0.07); transition:border-color 0.15s; }
        .week-day:hover { border-color:rgba(124,58,237,0.3); }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .fade-up { animation:fadeUp 0.25s ease; }
      `}</style>

      <div className="rv-content-padding" style={{ maxWidth:900, margin:'0 auto', padding:'28px 24px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          marginBottom:28, flexWrap:'wrap', gap:14 }}>
          <div>
            <h1 style={{ fontSize:30, fontWeight:800, margin:0, letterSpacing:'-0.5px' }}>
              Smart Revision
            </h1>
            <p style={{ color:'rgba(255,255,255,0.38)', fontSize:13, margin:'5px 0 0' }}>
              One focused session from due cards, quiz mistakes, and weak topics
            </p>
          </div>
          <button onClick={loadRevision} disabled={loading} className="rv-btn rv-btn-ghost">
            {loading
              ? <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)',
                  borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
              : '↻'} Refresh
          </button>
        </div>

        {error && (
          <div style={{ marginBottom:20, padding:'11px 16px', borderRadius:12, fontSize:13,
            background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#FCA5A5' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:80 }}>
            <div style={{ width:28, height:28, border:'3px solid #7C3AED',
              borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
          </div>
        ) : (
          <div className="fade-up">

            {/* Stat cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
              {[
                { label:'Due flashcards', value:dueCards.length,          icon:'🃏', color:'#10B981', bg:'rgba(16,185,129,0.15)',  action:()=>navigate('/flashcards',{state:{mode:'due'}}) },
                { label:'Open mistakes',  value:mistakes.length,           icon:'⚠️', color:'#EF4444', bg:'rgba(239,68,68,0.15)',   action:()=>navigate('/quiz') },
                { label:'Focus tasks',    value:plan?.today_tasks?.length||0, icon:'📋', color:'#7C3AED', bg:'rgba(124,58,237,0.15)', action:null },
              ].map(item => (
                <div key={item.label} className="rv-card"
                  onClick={item.action || undefined}
                  style={{ cursor:item.action?'pointer':'default', transition:'border-color 0.15s' }}
                  onMouseEnter={e=>{ if(item.action) e.currentTarget.style.borderColor='rgba(255,255,255,0.15)' }}
                  onMouseLeave={e=>{ if(item.action) e.currentTarget.style.borderColor='rgba(255,255,255,0.07)' }}>
                  <div style={{ width:40, height:40, borderRadius:11, background:item.bg,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:20, marginBottom:14 }}>{item.icon}</div>
                  <div style={{ fontSize:32, fontWeight:800, letterSpacing:'-0.5px',
                    color:item.color, marginBottom:4 }}>{item.value}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Today's Revision Path */}
            <div className="rv-card" style={{ marginBottom:16,
              borderColor:'rgba(124,58,237,0.3)', background:'rgba(124,58,237,0.06)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
                flexWrap:'wrap', gap:12, marginBottom:18 }}>
                <div>
                  <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:'#C4B5FD' }}>
                    📅 Today's Revision Path
                  </h2>
                  <p style={{ margin:'4px 0 0', fontSize:12, color:'rgba(255,255,255,0.38)' }}>
                    {completionTotal > 0
                      ? `${completionTotal} focused item${completionTotal===1?'':'s'} ready for you`
                      : 'No urgent review items yet — great job staying caught up!'}
                  </p>
                </div>
                <button onClick={()=>navigate('/flashcards',{state:{mode:'due'}})}
                  className="rv-btn rv-btn-primary">
                  Start with flashcards →
                </button>
              </div>

              {(plan?.today_tasks||[]).length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {plan.today_tasks.map((task, i) => {
                    const icons = { flashcards:'🃏', mistakes:'⚠️', quiz:'📝', explore:'📄' }
                    const routes = { flashcards:'/flashcards', mistakes:'/revision', quiz:'/quiz', explore:'/documents' }
                    const tagColors = {
                      high:   { bg:'rgba(239,68,68,0.18)',    color:'#FCA5A5' },
                      medium: { bg:'rgba(245,158,11,0.18)',   color:'#FCD34D' },
                      low:    { bg:'rgba(148,163,184,0.18)',  color:'#CBD5E1' },
                    }
                    const tc = tagColors[task.priority] || tagColors.low
                    return (
                      <button key={`${task.type}-${i}`}
                        onClick={()=>navigate(routes[task.type]||'/revision')}
                        className="task-row"
                        style={{ width:'100%', textAlign:'left', cursor:'pointer',
                          fontFamily:'inherit', transition:'border-color 0.15s' }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(124,58,237,0.35)'}
                        onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'}>
                        <div style={{ width:26, height:26, borderRadius:8, flexShrink:0,
                          background:'rgba(124,58,237,0.2)', display:'flex',
                          alignItems:'center', justifyContent:'center',
                          fontSize:12, fontWeight:700, color:'#C4B5FD' }}>{i+1}</div>
                        <span style={{ fontSize:13, color:'rgba(255,255,255,0.7)', flex:1 }}>{task.title}</span>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20,
                          background:tc.bg, color:tc.color, flexShrink:0 }}>{task.minutes} min</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Weekly Plan */}
            {plan?.weekly_plan?.length > 0 && (
              <div className="rv-card" style={{ marginBottom:16 }}>
                <h2 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700 }}>📆 Weekly Study Plan</h2>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
                  {plan.weekly_plan.map(day => (
                    <div key={day.day} className="week-day">
                      <div style={{ fontSize:11, fontWeight:700, color:'#7C3AED',
                        marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>{day.day}</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.5,
                        overflow:'hidden', display:'-webkit-box',
                        WebkitLineClamp:3, WebkitBoxOrient:'vertical' }}>{day.focus}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom grid: Mistakes + Weak Topic */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

              {/* Mistake Retry Queue */}
              <div className="rv-card">
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                  <h2 style={{ margin:0, fontSize:15, fontWeight:700 }}>⚠️ Mistake Retry Queue</h2>
                  <button onClick={()=>navigate('/quiz')}
                    style={{ fontSize:12, fontWeight:600, color:'#7C3AED', background:'none',
                      border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>
                    Open quiz →
                  </button>
                </div>

                {mistakes.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'28px 0', color:'rgba(255,255,255,0.28)', fontSize:13 }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
                    No open mistakes — nice work!
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {mistakes.slice(0,5).map(mistake => (
                      <div key={mistake.id} className="mistake-card">
                        <div style={{ display:'flex', gap:7, marginBottom:7, flexWrap:'wrap' }}>
                          <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700,
                            background:'rgba(124,58,237,0.2)', color:'#C4B5FD' }}>
                            {mistake.topic || 'General'}
                          </span>
                          <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600,
                            background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.45)' }}>
                            {mistake.quiz_type}
                          </span>
                        </div>
                        <p style={{ margin:'0 0 5px', fontSize:13, fontWeight:600, lineHeight:1.4,
                          color:'rgba(255,255,255,0.85)', overflow:'hidden', display:'-webkit-box',
                          WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                          {mistake.question}
                        </p>
                        <p style={{ margin:'0 0 10px', fontSize:11, color:'rgba(255,255,255,0.35)' }}>
                          ✓ {mistake.correct_answer || 'See explanation'}
                        </p>
                        <div style={{ display:'flex', gap:7 }}>
                          <button onClick={()=>navigate('/quiz',{state:{retryTopic:mistake.topic}})}
                            className="rv-btn rv-btn-ghost" style={{ padding:'6px 12px', fontSize:11 }}>
                            Retry topic
                          </button>
                          <button onClick={()=>handleResolve(mistake.id)}
                            className="rv-btn rv-btn-primary" style={{ padding:'6px 12px', fontSize:11 }}>
                            Mark resolved
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Weak Topic Practice */}
              <div className="rv-card">
                <h2 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700 }}>🎯 Weak Topic Practice</h2>

                {primaryWeakTopic ? (
                  <div>
                    <div style={{ padding:'16px', borderRadius:12, marginBottom:16,
                      background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#F87171', marginBottom:6,
                        textTransform:'uppercase', letterSpacing:0.5 }}>Focus area</div>
                      <div style={{ fontSize:18, fontWeight:700, color:'#fff', marginBottom:4 }}>
                        {primaryWeakTopic}
                      </div>
                      <div style={{ fontSize:12, color:'rgba(255,255,255,0.38)' }}>
                        {plan?.weak_topics?.[0]?.accuracy !== undefined
                          ? `${plan.weak_topics[0].accuracy}% accuracy — needs work`
                          : 'Needs practice based on recent performance'}
                      </div>
                    </div>

                    {plan?.weak_topics?.slice(0,4).map((t,i) => (
                      <div key={t.topic} style={{ display:'flex', alignItems:'center', gap:10,
                        padding:'8px 0', borderBottom: i < (plan.weak_topics.length-1) && i < 3
                          ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0,
                          background: t.accuracy < 50 ? '#EF4444' : '#F59E0B' }}/>
                        <span style={{ flex:1, fontSize:12, color:'rgba(255,255,255,0.65)' }}>{t.topic}</span>
                        <span style={{ fontSize:12, fontWeight:700,
                          color: t.accuracy < 50 ? '#F87171' : '#FCD34D' }}>{t.accuracy}%</span>
                      </div>
                    ))}

                    <button onClick={()=>navigate('/quiz',{state:{retryTopic:primaryWeakTopic}})}
                      className="rv-btn rv-btn-primary" style={{ marginTop:16, width:'100%',
                        justifyContent:'center', padding:'10px 0' }}>
                      ✨ Generate practice quiz
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign:'center', padding:'28px 0', color:'rgba(255,255,255,0.28)', fontSize:13 }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>🎯</div>
                    Take a few quizzes to unlock weak-topic practice
                  </div>
                )}

                {/* Due cards quick launch */}
                {dueCards.length > 0 && (
                  <div style={{ marginTop:16, padding:'14px', borderRadius:12,
                    background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:'#6EE7B7', marginBottom:2 }}>
                          🃏 {dueCards.length} card{dueCards.length!==1?'s':''} due
                        </div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.38)' }}>
                          Best reviewed while fresh
                        </div>
                      </div>
                      <button onClick={()=>navigate('/flashcards',{state:{mode:'due'}})}
                        className="rv-btn rv-btn-ghost" style={{ padding:'6px 12px', fontSize:11 }}>
                        Review →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}