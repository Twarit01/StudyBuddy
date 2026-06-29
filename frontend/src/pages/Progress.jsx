import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getQuizHistory } from '../api/quiz'
import { getFlashcardStats } from '../api/flashcards'
import { getStudyPlan } from '../api/progress'
import { getReadingStats } from '../api/reader'
import { exportStudyPlanPDF, exportProgressPDF } from '../utils/exportPDF'
import {
  ResponsiveContainer,
  AreaChart, Area,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

const localDateKey = (date) => {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const LEVEL_META = [
  { max:50,  label:'Beginner',     color:'#F59E0B', bg:'rgba(245,158,11,0.18)'  },
  { max:70,  label:'Intermediate', color:'#22D3EE', bg:'rgba(34,211,238,0.18)'  },
  { max:85,  label:'Advanced',     color:'#8B5CF6', bg:'rgba(139,92,246,0.18)'  },
  { max:101, label:'Expert',       color:'#10B981', bg:'rgba(16,185,129,0.18)'  },
]
const levelFor = (pct) => LEVEL_META.find(l => pct < l.max) || LEVEL_META[LEVEL_META.length-1]

const SUBJECT_BAR_COLORS = ['#8B5CF6','#22D3EE','#10B981','#F59E0B','#EC4899','#6366F1','#EF4444','#14B8A6']

const AreaTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#1A1A2D', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10,
      padding:'10px 14px', fontSize:12, color:'#fff', boxShadow:'0 8px 24px rgba(0,0,0,0.4)' }}>
      <p style={{ margin:'0 0 4px', fontWeight:700, color:'rgba(255,255,255,0.5)' }}>{label}</p>
      <p style={{ margin:0, fontWeight:700 }}>{payload[0].name}: {payload[0].value}</p>
    </div>
  )
}

export default function Progress() {
  const navigate = useNavigate()

  const [quizHistory, setQuizHistory]       = useState([])
  const [fcStats, setFcStats]               = useState({})
  const [topicStats, setTopicStats]         = useState([])
  const [activityMap, setActivityMap]       = useState({})
  const [loading, setLoading]               = useState(true)
  const [loadError, setLoadError]           = useState(null)
  const [streak, setStreak]                 = useState(0)
  const [studyPlan, setStudyPlan]           = useState(null)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [planError, setPlanError]           = useState(null)
  const [showPlan, setShowPlan]             = useState(false)
  const [period, setPeriod]                 = useState('week')
  const [readingStats, setReadingStats]     = useState(null)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true); setLoadError(null)
    try {
      const [history, fc, reading] = await Promise.all([
        getQuizHistory(), getFlashcardStats(), getReadingStats()
      ])
      setQuizHistory(history); setFcStats(fc); setReadingStats(reading)

      const topicMap = {}
      history.forEach(a => {
        const t = a.topic || 'General'
        if (!topicMap[t]) topicMap[t] = { correct:0, total:0 }
        topicMap[t].total   += a.total_questions
        topicMap[t].correct += a.correct_answers
      })
      setTopicStats(Object.entries(topicMap).map(([topic, s]) => ({
        topic, fullTopic: topic,
        accuracy: Math.round((s.correct/s.total)*100),
        total: s.total,
      })))

      const activity = {}
      history.forEach(a => {
        const d = localDateKey(a.created_at)
        activity[d] = (activity[d] || 0) + 1
      })
      setActivityMap(activity)

      let s = 0
      const today = new Date()
      for (let i = 0; i < 365; i++) {
        const d = new Date(today); d.setDate(d.getDate()-i)
        if (activity[localDateKey(d)]) s++; else if (i>0) break
      }
      setStreak(s)
    } catch (err) {
      console.error(err)
      setLoadError('Could not load your progress. Please refresh and try again.')
    } finally { setLoading(false) }
  }

  const handleGeneratePlan = async () => {
    setGeneratingPlan(true); setPlanError(null); setShowPlan(false)
    try { const data = await getStudyPlan(); setStudyPlan(data); setShowPlan(true) }
    catch (err) { setPlanError(err.response?.data?.detail || 'Failed to generate study plan') }
    finally { setGeneratingPlan(false) }
  }

  const avgScore = quizHistory.length
    ? Math.round(quizHistory.reduce((a,b) => a+b.score_percentage, 0) / quizHistory.length) : 0

  const scoreByDay = (() => {
    const map = {}
    quizHistory.forEach(a => {
      const d = new Date(a.created_at)
      const dow = (d.getDay()+6)%7
      const label = DAY_LABELS[dow]
      if (!map[label]) map[label] = []
      map[label].push(a.score_percentage)
    })
    return DAY_LABELS.map(label => ({
      day: label,
      score: map[label]?.length
        ? Math.round(map[label].reduce((a,b)=>a+b,0)/map[label].length)
        : null,
    })).filter(d => d.score !== null)
  })()

  const hoursByDay = (() => {
    const map = {}
    quizHistory.forEach(a => {
      const d = new Date(a.created_at)
      const dow = (d.getDay()+6)%7
      const label = DAY_LABELS[dow]
      map[label] = (map[label]||0) + 0.5
    })
    return DAY_LABELS.map(label => ({ day:label, hours: +(map[label]||0).toFixed(1) }))
  })()

  const totalHoursThisWeek = hoursByDay.reduce((a,b)=>a+b.hours, 0).toFixed(1)
  const bestScore = quizHistory.length ? Math.max(...quizHistory.map(q=>q.score_percentage)) : 0
  const bestDay   = scoreByDay.reduce((best, d) => (!best || d.score > best.score) ? d : best, null)

  const radarData = topicStats.slice(0,6).map(t => ({ topic: t.topic.split(' ')[0], accuracy: t.accuracy }))

  const last30 = Array.from({ length:30 }, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-(29-i))
    const key = localDateKey(d)
    return { date:key, count: activityMap[key]||0 }
  })

  return (
    <div style={{ height:'100%', overflowY:'auto', background:'#0C0C14', color:'#fff',
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{`
        .an-card { background:#13131F; border:1px solid rgba(255,255,255,0.07); border-radius:18px; padding:26px; }
        .an-btn { display:inline-flex; align-items:center; gap:7px; padding:8px 18px; border-radius:10px;
                  font-size:13px; font-weight:700; cursor:pointer; border:none; transition:all 0.2s; font-family:inherit; }
        .an-btn-primary { background:linear-gradient(135deg,#7C3AED,#6D28D9); color:#fff; }
        .an-btn-primary:hover { background:linear-gradient(135deg,#8B5CF6,#7C3AED); }
        .an-btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .an-btn-ghost { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.65); }
        .an-btn-ghost:hover { background:rgba(255,255,255,0.1); color:#fff; }
        .period-btn { padding:7px 18px; border-radius:20px; font-size:13px; font-weight:600;
                      cursor:pointer; border:none; transition:all 0.2s; font-family:inherit; }
        .period-btn.active { background:linear-gradient(135deg,#7C3AED,#6D28D9); color:#fff; }
        .period-btn.inactive { background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.5); }
        .period-btn.inactive:hover { background:rgba(255,255,255,0.12); color:#fff; }
        .quiz-row { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:11px; transition:background 0.15s; }
        .quiz-row:hover { background:rgba(255,255,255,0.04); }
        .scroll-thin::-webkit-scrollbar { width:4px; }
        .scroll-thin::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:4px; }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .fade-up { animation:fadeUp 0.3s ease; }
        .pbar-track { height:8px; background:rgba(255,255,255,0.07); border-radius:20px; overflow:hidden; flex:1; }
        .pbar-fill  { height:100%; border-radius:20px; transition:width 0.5s; }
      `}</style>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'28px 28px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          marginBottom:28, flexWrap:'wrap', gap:14 }}>
          <div>
            <h1 style={{ fontSize:30, fontWeight:800, margin:0, letterSpacing:'-0.5px' }}>
              Learning Analytics
            </h1>
            <p style={{ color:'rgba(255,255,255,0.38)', fontSize:13, margin:'5px 0 0' }}>
              Your full performance picture at a glance
            </p>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ display:'flex', gap:4, padding:4, borderRadius:24,
              background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.07)' }}>
              {['week','month','year'].map(p => (
                <button key={p} onClick={()=>setPeriod(p)}
                  className={`period-btn ${period===p?'active':'inactive'}`}>
                  {p.charAt(0).toUpperCase()+p.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={()=>exportProgressPDF({quizHistory, fcStats, topicStats, streak})}
              className="an-btn an-btn-ghost">↓ Export</button>
            <button onClick={handleGeneratePlan} disabled={generatingPlan}
              className="an-btn an-btn-primary">
              {generatingPlan
                ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)',
                    borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> Generating...</>
                : '✨ AI Study Plan'}
            </button>
          </div>
        </div>

        {/* AI Study Plan */}
        {showPlan && studyPlan && (
          <div className="an-card fade-up" style={{ marginBottom:20,
            borderColor:'rgba(124,58,237,0.4)', background:'rgba(124,58,237,0.07)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
              <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:'#C4B5FD' }}>✨ Your AI Study Plan</h2>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>exportStudyPlanPDF({studyPlan})} className="an-btn an-btn-ghost"
                  style={{ padding:'6px 12px', fontSize:11 }}>↓ Download</button>
                <button onClick={()=>setShowPlan(false)}
                  style={{ width:28, height:28, borderRadius:8, background:'rgba(255,255,255,0.07)',
                    border:'none', cursor:'pointer', color:'rgba(255,255,255,0.5)', fontSize:14,
                    display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
              </div>
            </div>
            {studyPlan.weak_topics?.length>0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:14 }}>
                {studyPlan.weak_topics.map(t=>(
                  <span key={t.topic} style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                    background:'rgba(239,68,68,0.18)', color:'#FCA5A5' }}>⚠ {t.topic} — {t.accuracy}%</span>
                ))}
              </div>
            )}
            {studyPlan.due_cards_today>0 && (
              <p style={{ margin:'0 0 14px', fontSize:13, color:'#22D3EE' }}>
                📅 {studyPlan.due_cards_today} flashcard{studyPlan.due_cards_today>1?'s':''} due today
              </p>
            )}
            {studyPlan.today_tasks?.length>0 && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
                {studyPlan.today_tasks.slice(0,3).map((task,i)=>(
                  <button key={`${task.type}-${i}`}
                    onClick={()=>navigate(task.type==='flashcards'?'/flashcards':task.type==='mistakes'?'/revision':'/quiz')}
                    style={{ textAlign:'left', padding:'12px 14px', borderRadius:12, cursor:'pointer',
                      background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                      fontFamily:'inherit', transition:'border-color 0.15s' }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(124,58,237,0.4)'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'}>
                    <p style={{ margin:'0 0 4px', fontSize:11, fontWeight:700, color:'#7C3AED' }}>Today · {task.minutes} min</p>
                    <p style={{ margin:0, fontSize:12, color:'rgba(255,255,255,0.7)' }}>{task.title}</p>
                  </button>
                ))}
              </div>
            )}
            {studyPlan.weekly_plan?.length>0 && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:14 }}>
                {studyPlan.weekly_plan.map(day=>(
                  <div key={day.day} style={{ padding:'10px 12px', borderRadius:10,
                    background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
                    <p style={{ margin:'0 0 4px', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.85)' }}>{day.day}</p>
                    <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.4)', lineHeight:1.4,
                      overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                      {day.focus}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize:13, lineHeight:1.75, whiteSpace:'pre-wrap', color:'rgba(255,255,255,0.65)' }}>
              {studyPlan.study_plan}
            </div>
          </div>
        )}

        {planError && (
          <div style={{ padding:'11px 16px', borderRadius:10, fontSize:13, marginBottom:16,
            background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#FCA5A5' }}>
            {planError}
          </div>
        )}

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:80 }}>
            <div style={{ width:28, height:28, border:'3px solid #7C3AED',
              borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
          </div>
        ) : loadError ? (
          <div style={{ padding:'13px 16px', borderRadius:12, fontSize:13,
            background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#FCA5A5' }}>
            {loadError}
          </div>
        ) : (
          <div className="fade-up">

            {/* Row 1: Study Hours + Quiz Scores */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

              <div className="an-card">
                <div style={{ marginBottom:16 }}>
                  <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>Study Hours</h2>
                  <p style={{ margin:'5px 0 0', fontSize:12, color:'rgba(255,255,255,0.38)' }}>
                    {totalHoursThisWeek} hrs this week
                    {quizHistory.length>0 && <span style={{ color:'#10B981', marginLeft:6 }}>↑ Active</span>}
                  </p>
                </div>
                {hoursByDay.every(d=>d.hours===0) ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                    padding:'32px 0', color:'rgba(255,255,255,0.25)', fontSize:13, textAlign:'center' }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>📊</div>
                    Take quizzes to track study hours
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={hoursByDay} margin={{ top:8, right:0, left:-28, bottom:0 }}>
                      <defs>
                        <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="#7C3AED" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false}/>
                      <XAxis dataKey="day" tick={{ fill:'rgba(255,255,255,0.3)', fontSize:11 }}
                        axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fill:'rgba(255,255,255,0.3)', fontSize:11 }}
                        axisLine={false} tickLine={false}/>
                      <Tooltip content={<AreaTooltip/>}/>
                      <Area type="monotone" dataKey="hours" name="hours"
                        stroke="#7C3AED" strokeWidth={2.5}
                        fill="url(#hoursGrad)" dot={false} activeDot={{ r:5, fill:'#7C3AED' }}/>
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="an-card">
                <div style={{ marginBottom:16 }}>
                  <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>Quiz Scores</h2>
                  <p style={{ margin:'5px 0 0', fontSize:12, color:'rgba(255,255,255,0.38)' }}>
                    Avg {avgScore}%
                    {bestDay && <span style={{ marginLeft:6 }}>· Best {Math.round(bestScore)}% on {bestDay.day}</span>}
                  </p>
                </div>
                {scoreByDay.length===0 ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                    padding:'32px 0', color:'rgba(255,255,255,0.25)', fontSize:13, textAlign:'center' }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>🎯</div>
                    Take a quiz to see your score trend
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={scoreByDay} margin={{ top:8, right:0, left:-28, bottom:0 }}>
                      <defs>
                        <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.35}/>
                          <stop offset="100%" stopColor="#22D3EE" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false}/>
                      <XAxis dataKey="day" tick={{ fill:'rgba(255,255,255,0.3)', fontSize:11 }}
                        axisLine={false} tickLine={false}/>
                      <YAxis domain={[50,100]} tick={{ fill:'rgba(255,255,255,0.3)', fontSize:11 }}
                        axisLine={false} tickLine={false}/>
                      <Tooltip content={<AreaTooltip/>}/>
                      <Area type="monotone" dataKey="score" name="score"
                        stroke="#22D3EE" strokeWidth={2.5}
                        fill="url(#scoreGrad)" dot={false} activeDot={{ r:5, fill:'#22D3EE' }}/>
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Row 2: Subject Radar + Subject Breakdown */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:16, marginBottom:16 }}>

              <div className="an-card">
                <h2 style={{ margin:'0 0 6px', fontSize:18, fontWeight:700 }}>Subject Radar</h2>
                {radarData.length < 3 ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                    padding:'40px 0', color:'rgba(255,255,255,0.25)', fontSize:13, textAlign:'center' }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>🕸️</div>
                    Take quizzes across 3+ topics to see your radar
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={radarData} outerRadius="72%">
                      <PolarGrid stroke="rgba(255,255,255,0.1)" gridType="polygon"/>
                      <PolarAngleAxis dataKey="topic"
                        tick={{ fill:'rgba(255,255,255,0.45)', fontSize:11, fontWeight:600 }}/>
                      <Radar dataKey="accuracy" stroke="#7C3AED" strokeWidth={2}
                        fill="#7C3AED" fillOpacity={0.25}
                        dot={{ r:3, fill:'#7C3AED' }}/>
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="an-card">
                <h2 style={{ margin:'0 0 20px', fontSize:18, fontWeight:700 }}>Subject Breakdown</h2>
                {topicStats.length===0 ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                    padding:'40px 0', color:'rgba(255,255,255,0.25)', fontSize:13, textAlign:'center' }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>📈</div>
                    No quiz data yet — take a quiz to see your breakdown
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    {topicStats.slice(0,6).map((t,i)=>{
                      const lv = levelFor(t.accuracy)
                      const barColor = SUBJECT_BAR_COLORS[i % SUBJECT_BAR_COLORS.length]
                      return (
                        <div key={t.topic} style={{ display:'flex', alignItems:'center', gap:14 }}>
                          <div style={{ width:120, fontSize:13, fontWeight:500,
                            color:'rgba(255,255,255,0.75)', flexShrink:0,
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {t.topic}
                          </div>
                          <div className="pbar-track">
                            <div className="pbar-fill" style={{ width:`${t.accuracy}%`, background:barColor }}/>
                          </div>
                          <div style={{ width:36, textAlign:'right', fontSize:13, fontWeight:700,
                            color:'rgba(255,255,255,0.85)', flexShrink:0 }}>
                            {t.accuracy}%
                          </div>
                          <div style={{ width:90, flexShrink:0 }}>
                            <span style={{ padding:'3px 10px', borderRadius:20, fontSize:10,
                              fontWeight:700, background:lv.bg, color:lv.color }}>
                              {lv.label}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Stat chips */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
              {[
                { icon:'📝', value:quizHistory.length,  label:'Quizzes taken',  color:'#8B5CF6', bg:'rgba(139,92,246,0.15)' },
                { icon:'🎯', value:avgScore+'%',         label:'Average score',  color:'#10B981', bg:'rgba(16,185,129,0.15)'  },
                { icon:'🃏', value:fcStats.mastered||0, label:'Cards mastered', color:'#F59E0B', bg:'rgba(245,158,11,0.15)'  },
                { icon:'🔥', value:streak+' days',       label:'Study streak',   color:'#EC4899', bg:'rgba(236,72,153,0.15)'  },
              ].map(c=>(
                <div key={c.label} style={{ background:'#13131F', border:'1px solid rgba(255,255,255,0.07)',
                  borderRadius:16, padding:'18px 16px' }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:c.bg,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:18, marginBottom:12 }}>{c.icon}</div>
                  <div style={{ fontSize:24, fontWeight:800, letterSpacing:'-0.5px', marginBottom:3 }}>{c.value}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.38)' }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Reading analytics */}
            {readingStats && (
              <div className="an-card" style={{ marginBottom:16 }}>
                <h2 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700 }}>Reading Progress</h2>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
                  {[
                    { label:'Documents read', value: readingStats.total_documents_read },
                    { label:'Saved notes', value: readingStats.total_notes },
                    { label:'Avg. completion', value: `${readingStats.average_progress}%` },
                  ].map(item => (
                    <div key={item.label} style={{ background:'rgba(255,255,255,0.03)',
                      border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'14px 16px' }}>
                      <div style={{ fontSize:22, fontWeight:800, marginBottom:4 }}>{item.value}</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,0.38)' }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                {readingStats.recent_documents?.length > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)',
                      letterSpacing:0.5, textTransform:'uppercase' }}>Recently opened</div>
                    {readingStats.recent_documents.slice(0, 5).map(doc => (
                      <button key={doc.document_id} onClick={() => navigate(`/reader/${doc.document_id}`, {
                        state: { page: doc.last_page },
                      })} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                        background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)',
                        borderRadius:10, cursor:'pointer', textAlign:'left', width:'100%', fontFamily:'inherit' }}>
                        <span style={{ fontSize:16 }}>📖</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.85)',
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {doc.document_name}
                          </div>
                          <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)' }}>
                            Page {doc.last_page} · {Math.round(doc.percent)}% complete
                          </div>
                        </div>
                        <span style={{ fontSize:11, color:'#7C3AED', fontWeight:600 }}>Open →</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Row 4: Flashcard breakdown + Activity heatmap */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

              <div className="an-card">
                <h2 style={{ margin:'0 0 18px', fontSize:16, fontWeight:700 }}>Flashcard Breakdown</h2>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {[
                    { label:'Total cards', value:fcStats.total||0,     color:'rgba(255,255,255,0.3)' },
                    { label:'Mastered',    value:fcStats.mastered||0,  color:'#10B981' },
                    { label:'Learning',    value:fcStats.learning||0,  color:'#F59E0B' },
                    { label:'New',         value:fcStats.new||0,       color:'#6366F1' },
                    { label:'Due today',   value:fcStats.due_today||0, color:'#EC4899' },
                  ].map(item=>(
                    <div key={item.label} style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:item.color }}/>
                      <span style={{ flex:1, fontSize:13, color:'rgba(255,255,255,0.55)' }}>{item.label}</span>
                      <span style={{ fontSize:13, fontWeight:700 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:18 }}>
                  <button onClick={()=>navigate('/flashcards')}
                    style={{ fontSize:12, fontWeight:600, color:'#7C3AED', background:'none',
                      border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>
                    Review flashcards →
                  </button>
                </div>
              </div>

              <div className="an-card">
                <h2 style={{ margin:'0 0 18px', fontSize:16, fontWeight:700 }}>Activity — last 30 days</h2>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(10,1fr)', gap:5 }}>
                  {last30.map(day=>(
                    <div key={day.date} title={`${day.date}: ${day.count} activities`}
                      style={{ aspectRatio:'1', borderRadius:5,
                        background: day.count===0 ? 'rgba(255,255,255,0.06)'
                          : day.count===1 ? 'rgba(124,58,237,0.35)'
                          : day.count<=3  ? 'rgba(124,58,237,0.65)'
                          : '#7C3AED',
                        transition:'transform 0.15s', cursor:'default' }}
                      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.2)'}
                      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}/>
                  ))}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:14,
                  fontSize:10, color:'rgba(255,255,255,0.3)' }}>
                  <span>Less</span>
                  {['rgba(255,255,255,0.06)','rgba(124,58,237,0.35)','rgba(124,58,237,0.65)','#7C3AED'].map((bg,i)=>(
                    <div key={i} style={{ width:12, height:12, borderRadius:3, background:bg }}/>
                  ))}
                  <span>More</span>
                </div>
              </div>
            </div>

            {/* Row 5: Recent Quizzes */}
            <div className="an-card">
              <h2 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700 }}>Recent Quizzes</h2>
              {quizHistory.length===0 ? (
                <div style={{ textAlign:'center', padding:'28px 0', color:'rgba(255,255,255,0.28)', fontSize:13 }}>
                  No quizzes taken yet — start one from the Quiz page
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  {quizHistory.slice(0,8).map(attempt=>{
                    const pct   = Math.round(attempt.score_percentage)
                    const color = pct>=80 ? '#10B981' : pct>=60 ? '#F59E0B' : '#EF4444'
                    const bg    = pct>=80 ? 'rgba(16,185,129,0.12)' : pct>=60 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'
                    return (
                      <div key={attempt.id} className="quiz-row">
                        <div style={{ width:42, height:42, borderRadius:11, flexShrink:0,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:12, fontWeight:800, background:bg, color }}>
                          {pct}%
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ margin:0, fontSize:13, fontWeight:600,
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                            color:'rgba(255,255,255,0.88)' }}>
                            {attempt.topic || 'General Engineering'}
                          </p>
                          <p style={{ margin:'2px 0 0', fontSize:11, color:'rgba(255,255,255,0.35)' }}>
                            {attempt.quiz_type?.toUpperCase()} · {attempt.difficulty}
                            &nbsp;· {attempt.correct_answers}/{attempt.total_questions} correct
                          </p>
                        </div>
                        <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:80, height:4, borderRadius:4,
                            background:'rgba(255,255,255,0.07)', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:4 }}/>
                          </div>
                          <span style={{ fontSize:11, color:'rgba(255,255,255,0.28)', flexShrink:0 }}>
                            {new Date(attempt.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}