import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useXP } from '../context/XPContext'
import { getQuizHistory } from '../api/quiz'
import { getFlashcardStats } from '../api/flashcards'
import { listDocuments } from '../api/documents'
import { getStudyPlan } from '../api/progress'
import { getReadingStats } from '../api/reader'
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line
} from 'recharts'

const localDateKey = (date) => {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const ACHIEVEMENTS = [
  { id:'first_steps',   icon:'🎯', label:'First Steps',    xp:50,  desc:'Ask your first question',   locked:false },
  { id:'speed_reader',  icon:'📚', label:'Speed Reader',   xp:100, desc:'Upload 3 documents',         locked:false },
  { id:'night_owl',     icon:'🦉', label:'Night Owl',      xp:75,  desc:'Study after 10 PM',          locked:false },
  { id:'perfect_score', icon:'⭐', label:'Perfect Score',  xp:200, desc:'Score 100% on a quiz',       locked:false },
  { id:'streak_master', icon:'🔥', label:'Streak Master',  xp:150, desc:'7 day streak',               locked:false },
  { id:'ai_whisperer',  icon:'🤖', label:'AI Whisperer',   xp:100, desc:'50 chat messages',           locked:true  },
  { id:'knowledge_god', icon:'👑', label:'Knowledge God',  xp:500, desc:'Master all subjects',        locked:true  },
  { id:'marathon',      icon:'🏃', label:'Marathon',       xp:300, desc:'Study 10h in a week',        locked:true  },
]

function CircularProgress({ pct, color, size = 40 }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--db-border-light)" strokeWidth={4}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
        style={{ transition:'stroke-dasharray 0.6s ease' }}/>
    </svg>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const { xp } = useXP()
  const navigate  = useNavigate()

  const [stats, setStats]             = useState({ quizzes:0, avgScore:0, flashcards:0, dueToday:0, docs:0 })
  const [topicStats, setTopicStats]   = useState([])
  const [recentDocs, setRecentDocs]   = useState([])
  const [lastDoc, setLastDoc]         = useState(null)
  const [continueReading, setContinueReading] = useState(null)
  const [streakDays, setStreakDays]   = useState([])
  const [weakTopics, setWeakTopics]   = useState([])
  const [scoreTrend, setScoreTrend]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [chatInput, setChatInput]     = useState('')
  const [planItems, setPlanItems]     = useState([])
  const [planLoading, setPlanLoading] = useState(false)
  const [dailyGoals, setDailyGoals]   = useState([
    { id:1, label:'Study 2 hours',           done:true  },
    { id:2, label:'Complete 1 quiz',         done:false },
    { id:3, label:'Review 20 flashcards',    done:true  },
    { id:4, label:'Read 1 document section', done:false },
  ])

  const hr       = new Date().getHours()
  const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'
  const todayStr = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })

  useEffect(() => {
    const fetchAll = async () => {
      setError(null)
      try {
        const [quizHistory, fcStats, docs, readingStats] = await Promise.all([
          getQuizHistory(), getFlashcardStats(), listDocuments(), getReadingStats()
        ])

        const avgScore = quizHistory.length
          ? Math.round(quizHistory.reduce((a,b) => a + b.score_percentage, 0) / quizHistory.length) : 0

        const topicMap = {}
        quizHistory.forEach(a => {
          const t = a.topic || 'General'
          if (!topicMap[t]) topicMap[t] = { correct:0, total:0 }
          topicMap[t].total   += a.total_questions
          topicMap[t].correct += a.correct_answers
        })
        const allTopics = Object.entries(topicMap)
          .map(([topic,s]) => ({ topic, accuracy: Math.round((s.correct/s.total)*100) }))
        const topics = [...allTopics].sort((a,b) => b.accuracy - a.accuracy).slice(0,5)
        const weak   = [...allTopics].sort((a,b) => a.accuracy - b.accuracy).slice(0,3)

        const activity = {}
        quizHistory.forEach(a => { activity[localDateKey(a.created_at)] = true })

        const dayLabels  = ['M','T','W','T','F','S','S']
        const today       = new Date()
        const weekStart  = new Date(today)
        const dow        = (today.getDay() + 6) % 7
        weekStart.setDate(today.getDate() - dow)
        const week = dayLabels.map((label, i) => {
          const d = new Date(weekStart); d.setDate(weekStart.getDate() + i)
          return { label, filled:!!activity[localDateKey(d)], isToday: localDateKey(d) === localDateKey(today) }
        })

        const trend = quizHistory.slice().reverse().slice(-8)
          .map((a,i) => ({ i, score: Math.round(a.score_percentage) }))

        setStats({ quizzes:quizHistory.length, avgScore, flashcards:fcStats.total||0, dueToday:fcStats.due_today||0, docs:docs.length })
        setTopicStats(topics)
        setWeakTopics(weak)
        setRecentDocs(docs.slice(0,4))
        setLastDoc(docs[0] || null)
        setContinueReading(readingStats?.recent_documents?.[0] || null)
        setStreakDays(week)
        setScoreTrend(trend.length ? trend : [{ i:0, score:0 }])
      } catch (err) {
        console.error(err)
        setError('Could not load your dashboard. Please refresh and try again.')
      } finally { setLoading(false) }
    }
    fetchAll()
  }, [])

  useEffect(() => { if (!loading) loadPlan() }, [loading])

  const loadPlan = async () => {
    setPlanLoading(true)
    try {
      const data = await getStudyPlan()
      const items = []
      const nav = {
        flashcards: () => navigate('/flashcards', { state:{ mode:'due' } }),
        mistakes:   () => navigate('/revision'),
        quiz:       () => navigate('/quiz'),
        explore:    () => navigate('/documents'),
      }
      if (data.today_tasks?.length) {
        data.today_tasks.slice(0,3).forEach(task => {
          const icons = { flashcards:'🃏', mistakes:'⚠️', quiz:'📝', explore:'📄' }
          const tagColors = { high:'red', medium:'amber', low:'slate' }
          items.push({
            icon: icons[task.type] || '✨',
            label: task.title,
            tag: `${task.minutes} min`,
            tagColor: tagColors[task.priority] || 'slate',
            action: nav[task.type] || (() => navigate('/revision')),
          })
        })
      }
      if (!items.length) items.push({
        icon:'✨', label:'Start a smart revision session', tag:'Get started',
        tagColor:'indigo', action:() => navigate('/revision')
      })
      setPlanItems(items)
    } catch {
      setPlanItems([{ icon:'⚠️', label:'Study plan unavailable right now', tag:'Try later', tagColor:'red', action:()=>{} }])
    } finally { setPlanLoading(false) }
  }

  const handleAsk = () => {
    if (!chatInput.trim()) return
    navigate('/chat', { state:{ initialQuestion: chatInput } })
  }

  const toggleGoal = (id) => setDailyGoals(prev => prev.map(g => g.id===id ? {...g, done:!g.done} : g))
  const doneGoals  = dailyGoals.filter(g => g.done).length
  const goalPct    = Math.round((doneGoals / dailyGoals.length) * 100)

  const LEVEL_COLORS = ['#F59E0B','#22D3EE','#8B5CF6','#10B981','#EC4899','#3B82F6']
  const LEVELS       = ['Beginner','Intermediate','Advanced','Expert','Intermediate','Expert']
  const subjectCards = topicStats.slice(0,6).map((t,i) => ({
    ...t, color: LEVEL_COLORS[i % LEVEL_COLORS.length], level: LEVELS[i % LEVELS.length]
  }))

  const recommendations = [
    weakTopics[0] && {
      icon:'🎯', color:'#2D1B4E', border:'#7C3AED',
      title:'Weak Area Detected',
      body:`You score ${weakTopics[0].accuracy}% on ${weakTopics[0].topic}. Review before your next quiz.`,
      cta:'Start Review →', action:()=>navigate('/quiz')
    },
    stats.dueToday > 0 && {
      icon:'🃏', color:'#1A2D1A', border:'#16A34A',
      title:`${stats.dueToday} Cards Due`,
      body:'Spaced repetition review is due now. Best to tackle them while still fresh.',
      cta:'Review Now →', action:()=>navigate('/flashcards',{state:{mode:'due'}})
    },
    {
      icon:'⏰', color:'#1A1A2D', border:'#3B82F6',
      title:'Prime Study Window',
      body:'Your quiz scores are higher in the morning. Schedule your toughest topics now.',
      cta:'Take a Quiz →', action:()=>navigate('/quiz')
    },
    stats.docs > 0 && {
      icon:'🏆', color:'#1A2D1A', border:'#10B981',
      title:'Almost Expert',
      body:`You have ${stats.docs} document${stats.docs!==1?'s':''} uploaded. Keep studying!`,
      cta:'Continue →', action:()=>navigate('/documents')
    },
  ].filter(Boolean).slice(0,4)

  const tagColorMap = {
    red:    { bg:'rgba(239,68,68,0.18)',    text:'#FCA5A5' },
    amber:  { bg:'rgba(245,158,11,0.18)',   text:'#FCD34D' },
    slate:  { bg:'rgba(148,163,184,0.18)',  text:'#CBD5E1' },
    indigo: { bg:'rgba(99,102,241,0.18)',   text:'#A5B4FC' },
  }

  return (
    <div className="db-page-scroll" style={{
      height: '100%',
      overflowY: 'auto',
      background: isDark ? '#0C0C14' : '#F8FAFC',
      color: isDark ? '#fff' : '#0F172A',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      '--db-bg': isDark ? '#0C0C14' : '#F8FAFC',
      '--db-text': isDark ? '#fff' : '#0F172A',
      '--db-card-bg': isDark ? '#13131F' : '#ffffff',
      '--db-card-border': isDark ? 'rgba(255,255,255,0.07)' : '#E2E8F0',
      '--db-border': isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
      '--db-border-light': isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
      '--db-text-muted': isDark ? 'rgba(255,255,255,0.38)' : '#64748B',
      '--db-text-sub': isDark ? 'rgba(255,255,255,0.42)' : '#475569',
      '--db-text-light': isDark ? 'rgba(255,255,255,0.75)' : '#334155',
      '--db-hover-bg': isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
      '--db-inner-bg': isDark ? '#1A1A28' : '#ffffff',
      '--db-ach-bg': isDark ? '#1A1A28' : '#ffffff',
      '--db-input-bg': isDark ? '#13131F' : '#ffffff',
    }}>
      <style>{`
        .db-card { background: var(--db-card-bg); border: 1px solid var(--db-card-border); border-radius: 16px; }
        .db-btn  { display:inline-flex; align-items:center; gap:6px; padding:7px 16px; border-radius:10px;
                   font-size:12px; font-weight:600; cursor:pointer; border:none; transition:all 0.2s; }
        .db-btn-ghost  { background: var(--db-hover-bg); color: var(--db-text-sub); }
        .db-btn-ghost:hover  { background: var(--db-border); color: var(--db-text); }
        .db-btn-primary { background:linear-gradient(135deg,#7C3AED,#6D28D9); color:#fff; }
        .db-btn-primary:hover { background:linear-gradient(135deg,#8B5CF6,#7C3AED); }
        .goal-check { width:20px; height:20px; border-radius:50%; border:2px solid var(--db-border);
                      display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:all 0.2s; }
        .goal-check.done { background:#10B981; border-color:#10B981; }
        .rec-card { border-radius:14px; padding:16px; cursor:pointer; transition:all 0.2s; border:1px solid; }
        .rec-card:hover { transform:translateY(-2px); filter:brightness(1.1); }
        .subject-card { border-radius:12px; padding:14px; cursor:pointer; transition:all 0.15s;
                        background: var(--db-inner-bg); border:1px solid var(--db-card-border); }
        .subject-card:hover { border-color: var(--db-border); background: var(--db-hover-bg); }
        .ach-card { border-radius:12px; padding:12px; text-align:center; background: var(--db-ach-bg);
                    border:1px solid var(--db-card-border); transition:all 0.15s; cursor:default; }
        .ach-card.locked { opacity:0.4; filter:grayscale(1); }
        .doc-row { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px;
                   cursor:pointer; transition:background 0.15s; }
        .doc-row:hover { background: var(--db-hover-bg); }
        .plan-row { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:10px;
                    cursor:pointer; transition:background 0.15s; background:transparent; border:none; width:100%; text-align:left; }
        .plan-row:hover { background: var(--db-hover-bg); }
        .rem-row { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px;
                   cursor:pointer; transition:background 0.15s; }
        .rem-row:hover { background: var(--db-hover-bg); }
        .xp-text { background:linear-gradient(135deg,#F59E0B,#EF4444);
                   -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
        .fade-in { animation: fadeIn 0.3s ease; }
      `}</style>

      {/* Header */}
      <div className="db-header" style={{ padding:'28px 28px 0', display:'flex', alignItems:'flex-start',
        justifyContent:'space-between', flexWrap:'wrap', gap:14 }}>
        <div>
          <div style={{ fontSize:11, color: 'var(--db-text-muted)', marginBottom:4 }}>{todayStr}</div>
          <h1 style={{ fontSize:30, fontWeight:700, margin:0, letterSpacing:'-0.5px' }}>
            {greeting}, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p style={{ color: 'var(--db-text-sub)', fontSize:13, margin:'5px 0 0' }}>
            {stats.avgScore > 0
              ? `You're ${stats.avgScore}% ready for your next exam — keep the momentum going!`
              : "Ready to study? Let's go!"}
          </p>
        </div>
        <div className="db-header-stats" style={{ display:'flex', gap:10, flexShrink:0 }}>
          <div className="db-card" style={{ padding:'10px 18px', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:20 }}>🔥</span>
            <div>
              <div style={{ fontSize:20, fontWeight:800, lineHeight:1 }}>{xp.current_streak ?? 0}</div>
              <div style={{ fontSize:10, color: 'var(--db-text-muted)', marginTop:2 }}>day streak</div>
            </div>
          </div>
          <div className="db-card" style={{ padding:'10px 18px', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:18 }}>⚡</span>
            <div>
              <div style={{ fontSize:20, fontWeight:800, lineHeight:1 }} className="xp-text">
                {(xp.total_xp || 0).toLocaleString()}
              </div>
              <div style={{ fontSize:10, color: 'var(--db-text-muted)', marginTop:2 }}>
                Level {xp.level || 1} · total XP
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ask-anything bar */}
      <div className="db-ask-bar" style={{ margin:'20px 28px 0' }}>
        <div style={{ background:'var(--db-card-bg)', border:'1px solid var(--db-border)', borderRadius:14,
          display:'flex', alignItems:'center', gap:10, padding:'12px 16px' }}>
          <span style={{ fontSize:18, flexShrink:0 }}>✨</span>
          <input
            type="text" value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key==='Enter' && handleAsk()}
            placeholder="Ask anything about your documents, topics, or concepts..."
            style={{ flex:1, background:'transparent', border:'none', outline:'none',
              color:'var(--db-text)', fontSize:13, fontFamily:'inherit' }}
          />
          <button onClick={handleAsk}
            style={{ width:34, height:34, borderRadius:10, border:'none',
              background:'linear-gradient(135deg,#7C3AED,#6D28D9)',
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', flexShrink:0, fontSize:16, color:'#fff' }}>
            →
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:80 }}>
          <div style={{ width:30, height:30, border:'3px solid #7C3AED',
            borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
        </div>
      ) : error ? (
        <div style={{ margin:'20px 28px', padding:'14px 18px',
          background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
          borderRadius:12, color:'#FCA5A5', fontSize:13 }}>{error}</div>
      ) : (
        <div className="db-main-grid fade-in" style={{ padding:'20px 28px',
          display:'grid', gridTemplateColumns:'1fr 308px', gap:20 }}>

          {/* LEFT COLUMN */}
          <div style={{ display:'flex', flexDirection:'column', gap:18, minWidth:0 }}>

            {/* Continue Learning + Study Plan */}
            <div className="db-top-cards" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div className="db-card" style={{ padding:20, position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', inset:0, pointerEvents:'none',
                  background:'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(34,211,238,0.04))' }}/>
                <div style={{ position:'relative' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#7C3AED', letterSpacing:1,
                    marginBottom:12, textTransform:'uppercase' }}>Continue learning</div>
                  {continueReading || lastDoc ? (
                    <>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                        <div style={{ width:38, height:38, borderRadius:10, background:'rgba(124,58,237,0.2)',
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>📖</div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, overflow:'hidden',
                            textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {continueReading?.document_name || lastDoc.original_name}
                          </div>
                          <div style={{ fontSize:11, color: 'var(--db-text-muted)' }}>
                            {continueReading
                              ? `Page ${continueReading.last_page} · ${Math.round(continueReading.percent)}% read`
                              : 'Uploaded recently'}
                          </div>
                        </div>
                      </div>
                      <div style={{ height:4, background: 'var(--db-border-light)', borderRadius:4,
                        marginBottom:14, overflow:'hidden' }}>
                        <div style={{ height:'100%',
                          width: `${continueReading?.percent ?? (lastDoc?.chunk_count ? 82 : 0)}%`,
                          background:'linear-gradient(90deg,#7C3AED,#22D3EE)', borderRadius:4 }}/>
                      </div>
                      <button className="db-btn db-btn-primary" onClick={() => {
                        const docId = continueReading?.document_id || lastDoc?.id
                        navigate(`/reader/${docId}`, {
                          state: { page: continueReading?.last_page || 1 },
                        })
                      }}>
                        Continue reading →
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>No documents yet</div>
                      <div style={{ fontSize:11, color: 'var(--db-text-muted)', marginBottom:14 }}>
                        Upload your first study material to get started
                      </div>
                      <button className="db-btn db-btn-primary" onClick={()=>navigate('/documents')}>
                        📤 Upload document
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="db-card" style={{ padding:20 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <h2 style={{ margin:0, fontSize:14, fontWeight:700 }}>AI Study Plan</h2>
                  <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20,
                    background:'rgba(34,211,238,0.15)', color:'#22D3EE' }}>Recommended</span>
                </div>
                {planLoading ? (
                  <div style={{ display:'flex', justifyContent:'center', padding:20 }}>
                    <div style={{ width:20, height:20, border:'2px solid #7C3AED',
                      borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:12 }}>
                    {planItems.map((item,i) => {
                      const tc = tagColorMap[item.tagColor] || tagColorMap.slate
                      return (
                        <button key={i} onClick={item.action} className="plan-row">
                          <div style={{ width:22, height:22, borderRadius:'50%', background: 'var(--db-border-light)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:11, fontWeight:700, color: 'var(--db-text-sub)', flexShrink:0 }}>
                            {i+1}
                          </div>
                          <span style={{ fontSize:12, color: 'var(--db-text-light)', flex:1 }}>{item.label}</span>
                          <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20,
                            background:tc.bg, color:tc.text, flexShrink:0 }}>{item.tag}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                <button onClick={()=>navigate('/revision')}
                  style={{ fontSize:11, fontWeight:600, color:'#22D3EE', background:'none',
                    border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:4 }}>
                  Start smart revision →
                </button>
              </div>
            </div>

            {/* Stat row */}
            <div className="db-stat-row" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {[
                { icon:'⏱️', value: stats.avgScore ? `${stats.avgScore}%` : '—', label:'Study Score',     sub:'Good progress', color:'#8B5CF6' },
                { icon:'📊', value: stats.quizzes,                               label:'Quizzes Done',     sub:'This session',  color:'#22D3EE' },
                { icon:'🃏', value: stats.dueToday,                              label:'Flashcards Due',   sub:'Ready to review',color:'#10B981' },
                { icon:'📄', value: stats.docs,                                  label:'Documents',        sub:'Uploaded',      color:'#F59E0B' },
              ].map(s => (
                <div key={s.label} className="db-card" style={{ padding:'16px 14px' }}>
                  <div style={{ width:34, height:34, borderRadius:9,
                    background:`${s.color}22`, display:'flex', alignItems:'center',
                    justifyContent:'center', fontSize:16, marginBottom:10 }}>{s.icon}</div>
                  <div style={{ fontSize:24, fontWeight:800, letterSpacing:'-0.5px' }}>{s.value}</div>
                  <div style={{ fontSize:11, color: 'var(--db-text-muted)', marginTop:2 }}>{s.label}</div>
                  <div style={{ fontSize:10, color:s.color, marginTop:3 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Topic Progress + Recent Docs */}
            <div className="db-bottom-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div className="db-card" style={{ padding:20 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <h2 style={{ margin:0, fontSize:14, fontWeight:700 }}>Topic Progress</h2>
                  <button className="db-btn db-btn-ghost" onClick={()=>navigate('/progress')}
                    style={{ padding:'4px 10px', fontSize:11 }}>View all</button>
                </div>
                {topicStats.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'28px 0', color: 'var(--db-text-muted)' }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>📊</div>
                    <p style={{ margin:0, fontSize:12 }}>Take a quiz to see your topic breakdown</p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ height:110 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={topicStats} outerRadius="70%">
                          <PolarGrid stroke="var(--db-border-light)" />
                          <PolarAngleAxis dataKey="topic" tick={{ fontSize:0 }} />
                          <Radar dataKey="accuracy" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    {topicStats.map(t => (
                      <div key={t.topic}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:11 }}>
                          <span style={{ color: 'var(--db-text-light)', overflow:'hidden',
                            textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'70%' }}>{t.topic}</span>
                          <span style={{ fontWeight:700, flexShrink:0 }}>{t.accuracy}%</span>
                        </div>
                        <div style={{ height:4, background: 'var(--db-border-light)', borderRadius:4, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${t.accuracy}%`,
                            background:'linear-gradient(90deg,#7C3AED,#22D3EE)', borderRadius:4 }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="db-card" style={{ padding:20 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <h2 style={{ margin:0, fontSize:14, fontWeight:700 }}>Recent Documents</h2>
                  <button className="db-btn db-btn-ghost" onClick={()=>navigate('/documents')}
                    style={{ padding:'4px 10px', fontSize:11 }}>View all</button>
                </div>
                {recentDocs.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'28px 0', color: 'var(--db-text-muted)' }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>📁</div>
                    <p style={{ margin:0, fontSize:12 }}>No documents yet</p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {recentDocs.map(doc => (
                      <div key={doc.id} className="doc-row" onClick={()=>navigate(`/reader/${doc.id}`)}>
                        <div style={{ width:34, height:34, borderRadius:9, flexShrink:0,
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
                          background: doc.file_type==='pdf' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)' }}>📄</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, overflow:'hidden',
                            textOverflow:'ellipsis', whiteSpace:'nowrap',
                            color: 'var(--db-text-light)' }}>{doc.original_name}</div>
                          <div style={{ fontSize:10, color: 'var(--db-text-muted)', marginTop:2 }}>
                            {(doc.file_size/1024).toFixed(0)} KB · {doc.chunk_count} chunks
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Subject Mastery */}
            {subjectCards.length > 0 && (
              <div className="db-card" style={{ padding:20 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                  <h2 style={{ margin:0, fontSize:14, fontWeight:700 }}>Subject Mastery</h2>
                  <button className="db-btn db-btn-ghost" onClick={()=>navigate('/progress')}
                    style={{ padding:'4px 10px', fontSize:11 }}>All subjects →</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                  {subjectCards.map(t => (
                    <div key={t.topic} className="subject-card" onClick={()=>navigate('/quiz')}>
                      <div style={{ fontSize:9, fontWeight:700, color:t.color, letterSpacing:1,
                        marginBottom:3, textTransform:'uppercase' }}>{t.level}</div>
                      <div style={{ fontSize:13, fontWeight:700, marginBottom:10,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.topic}</div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', gap:2 }}>
                          {[...Array(4)].map((_,j) => (
                            <div key={j} style={{ width:18, height:3, borderRadius:2,
                              background: j < Math.round((t.accuracy/100)*4) ? t.color : 'var(--db-border)' }}/>
                          ))}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <CircularProgress pct={t.accuracy} color={t.color} size={36}/>
                          <span style={{ fontSize:12, fontWeight:700, color:t.color }}>{t.accuracy}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Recommendations */}
            <div className="db-card" style={{ padding:20 }}>
              <h2 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700 }}>✨ AI Recommendations</h2>
              {recommendations.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px 0', color: 'var(--db-text-muted)', fontSize:12 }}>
                  Take a quiz to get personalised AI recommendations
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {recommendations.map((r,i) => (
                    <div key={i} className="rec-card" onClick={r.action}
                      style={{ background:r.color, borderColor:r.border }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <div style={{ width:32, height:32, borderRadius:9, background: 'var(--db-border)',
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>{r.icon}</div>
                        <div style={{ fontSize:13, fontWeight:700 }}>{r.title}</div>
                      </div>
                      <p style={{ margin:'0 0 10px', fontSize:11, color: 'var(--db-text-sub)', lineHeight:1.5 }}>{r.body}</p>
                      <div style={{ fontSize:11, fontWeight:700, color:r.border }}>{r.cta}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="db-right-col" style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Study Score gauge */}
            <div className="db-card" style={{ padding:18 }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Study Score</div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div style={{ position:'relative', width:110, height:110 }}>
                  <svg viewBox="0 0 100 100" style={{ width:'100%', height:'100%', transform:'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--db-border-light)" strokeWidth={8}/>
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth={8} strokeLinecap="round"
                      stroke="url(#scoreGrad)"
                      strokeDasharray={`${(stats.avgScore/100)*264} 264`}
                      style={{ transition:'stroke-dasharray 0.6s ease' }}/>
                    <defs>
                      <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#7C3AED"/>
                        <stop offset="100%" stopColor="#22D3EE"/>
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.5px' }}>{stats.avgScore}%</span>
                  </div>
                </div>
                <p style={{ margin:'8px 0 0', fontSize:12, fontWeight:600,
                  color: stats.avgScore>=70 ? '#10B981' : stats.avgScore>=40 ? '#F59E0B' : '#EF4444' }}>
                  {stats.avgScore>=70 ? 'Good progress' : stats.avgScore>=40 ? 'Keep going' : 'Needs work'}
                </p>
                {scoreTrend.length > 1 && (
                  <div style={{ width:'100%', height:36, marginTop:10 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={scoreTrend}>
                        <Line type="monotone" dataKey="score" stroke="#7C3AED"
                          strokeWidth={2} dot={{ r:2, fill:'#7C3AED' }}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>



            {/* Due Today */}
            <div className="db-card" style={{ padding:18 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <span style={{ fontSize:15 }}>📅</span>
                  <div style={{ fontSize:13, fontWeight:700 }}>Due Today</div>
                </div>
                <span style={{ fontSize:20, fontWeight:800 }}>{stats.dueToday}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                  <span style={{ color: 'var(--db-text-sub)' }}>Flashcards</span>
                  <span style={{ fontWeight:600 }}>{stats.dueToday}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                  <span style={{ color: 'var(--db-text-sub)' }}>Quizzes pending</span>
                  <span style={{ fontWeight:600 }}>{weakTopics.length}</span>
                </div>
              </div>
              <button onClick={()=>navigate('/flashcards')}
                style={{ fontSize:11, fontWeight:600, color:'#7C3AED', background:'none',
                  border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:4 }}>
                Review now →
              </button>
            </div>

            {/* Weakest Topics */}
            <div className="db-card" style={{ padding:18 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:14 }}>
                <span style={{ fontSize:15 }}>🎯</span>
                <div style={{ fontSize:13, fontWeight:700 }}>Weakest Topics</div>
              </div>
              {weakTopics.length === 0 ? (
                <p style={{ fontSize:11, color: 'var(--db-text-muted)', margin:0 }}>
                  No weak topics yet — take a few quizzes first
                </p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:14 }}>
                  {weakTopics.map(t => (
                    <div key={t.topic}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:5 }}>
                        <span style={{ color: 'var(--db-text-light)' }}>{t.topic}</span>
                        <span style={{ fontWeight:700, color: t.accuracy<50 ? '#EF4444' : '#F59E0B' }}>{t.accuracy}%</span>
                      </div>
                      <div style={{ height:4, background: 'var(--db-border-light)', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${t.accuracy}%`, borderRadius:4,
                          background: t.accuracy<50 ? '#EF4444' : '#F59E0B' }}/>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button className="db-btn db-btn-primary" onClick={()=>navigate('/quiz')}
                style={{ width:'100%', justifyContent:'center', padding:'8px 0' }}>
                Practice now →
              </button>
            </div>

            {/* Revision Reminders */}
            <div className="db-card" style={{ padding:18 }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Revision Reminders</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[
                  { title: weakTopics[0]?.topic || 'Flashcard Review', sub:'Today · Review session', color:'#7C3AED', urgent:true  },
                  { title: weakTopics[1]?.topic || 'Quiz Practice',    sub:'Tomorrow · 9 AM',        color:'#22D3EE', urgent:false },
                  { title: 'Mixed Practice',                            sub:'Thursday',               color:'#F59E0B', urgent:false },
                ].map((r,i) => (
                  <div key={i} className="rem-row" onClick={()=>navigate('/revision')}>
                    <div style={{ width:3, height:32, borderRadius:3, background:r.color, flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, overflow:'hidden',
                        textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</div>
                      <div style={{ fontSize:10, color: 'var(--db-text-muted)' }}>{r.sub}</div>
                    </div>
                    {r.urgent && (
                      <span style={{ background:'rgba(239,68,68,0.2)', color:'#F87171',
                        fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:20 }}>Soon</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}