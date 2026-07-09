import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listDocuments } from '../api/documents'
import { generateMindMap } from '../api/mindmap'

// ── Colour palette per document ───────────────────────────────────────────────
const DOC_PALETTE = [
  { bg: 'rgba(124,58,237,0.18)', border: '#7C3AED', glow: 'rgba(124,58,237,0.5)'  },
  { bg: 'rgba(6,182,212,0.18)',  border: '#06B6D4', glow: 'rgba(6,182,212,0.5)'   },
  { bg: 'rgba(16,185,129,0.18)', border: '#10B981', glow: 'rgba(16,185,129,0.5)'  },
  { bg: 'rgba(245,158,11,0.18)', border: '#F59E0B', glow: 'rgba(245,158,11,0.5)'  },
  { bg: 'rgba(239,68,68,0.18)',  border: '#EF4444', glow: 'rgba(239,68,68,0.5)'   },
]

// ── Force simulation constants ────────────────────────────────────────────────
const REPULSION    = 8000   // node-to-node repulsion strength
const SPRING_K     = 0.04   // edge spring constant
const SPRING_REST  = 160    // ideal edge length (px)
const CENTER_K     = 0.01   // gravity toward canvas centre
const DAMPING      = 0.82   // velocity damping per tick
const NODE_W       = 140    // node rectangle width
const NODE_H       = 44     // node rectangle height

// ── Utility: initial random positions ────────────────────────────────────────
function initPositions(nodes, W, H) {
  return nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length
    const r     = Math.min(W, H) * 0.3
    return {
      ...n,
      x:  W / 2 + r * Math.cos(angle),
      y:  H / 2 + r * Math.sin(angle),
      vx: 0,
      vy: 0,
    }
  })
}

// ── Force tick ────────────────────────────────────────────────────────────────
function tick(nodes, edges, W, H) {
  const next = nodes.map(n => ({ ...n }))
  const cx = W / 2, cy = H / 2

  // Repulsion between all pairs
  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const dx = next[j].x - next[i].x
      const dy = next[j].y - next[i].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = REPULSION / (dist * dist)
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      next[i].vx -= fx; next[i].vy -= fy
      next[j].vx += fx; next[j].vy += fy
    }
  }

  // Spring attraction for edges
  const nodeMap = Object.fromEntries(next.map((n, idx) => [n.id, idx]))
  for (const e of edges) {
    const ai = nodeMap[e.source], bi = nodeMap[e.target]
    if (ai == null || bi == null) continue
    const dx   = next[bi].x - next[ai].x
    const dy   = next[bi].y - next[ai].y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const disp = dist - SPRING_REST
    const fx   = (dx / dist) * SPRING_K * disp
    const fy   = (dy / dist) * SPRING_K * disp
    next[ai].vx += fx; next[ai].vy += fy
    next[bi].vx -= fx; next[bi].vy -= fy
  }

  // Centre gravity
  for (const n of next) {
    n.vx += (cx - n.x) * CENTER_K
    n.vy += (cy - n.y) * CENTER_K
  }

  // Integrate + damp + clamp
  const pad = 80
  for (const n of next) {
    n.vx *= DAMPING; n.vy *= DAMPING
    n.x  = Math.max(pad, Math.min(W - pad, n.x + n.vx))
    n.y  = Math.max(pad, Math.min(H - pad, n.y + n.vy))
  }
  return next
}

// ── Curved edge path ──────────────────────────────────────────────────────────
function edgePath(ax, ay, bx, by) {
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  // Slight perpendicular offset for curve
  const dx = bx - ax, dy = by - ay
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const cx  = mx - (dy / len) * 30
  const cyP = my + (dx / len) * 30
  return `M ${ax} ${ay} Q ${cx} ${cyP} ${bx} ${by}`
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MindMap() {
  const navigate = useNavigate()

  // Document selection
  const [docs, setDocs]       = useState([])
  const [selected, setSelected] = useState([])
  const [docsLoading, setDocsLoading] = useState(true)

  // Graph data
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [docColorMap, setDocColorMap] = useState({})

  // UI states
  const [generating, setGenerating] = useState(false)
  const [error, setError]           = useState(null)
  const [activeNode, setActiveNode] = useState(null)

  // Canvas & interaction
  const svgRef      = useRef(null)
  const rafRef      = useRef(null)
  const nodesRef    = useRef([])
  const dragging    = useRef(null)   // { nodeId, startX, startY }
  const panning     = useRef(null)   // { startX, startY }
  const simRunning  = useRef(false)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const transformRef = useRef({ x: 0, y: 0, scale: 1 })

  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 })
  const containerRef = useRef(null)

  // ── Load documents ──────────────────────────────────────────────────────────
  useEffect(() => {
    listDocuments().then(d => {
      setDocs(d.filter(doc => doc.is_processed))
      setDocsLoading(false)
    }).catch(() => setDocsLoading(false))
  }, [])

  // ── Observe canvas size ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setCanvasSize({ w: width, h: height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Force simulation loop ───────────────────────────────────────────────────
  const startSim = useCallback((initialNodes, edgeList, W, H) => {
    if (simRunning.current) cancelAnimationFrame(rafRef.current)
    simRunning.current = true
    nodesRef.current   = initPositions(initialNodes, W, H)

    let ticks = 0
    const MAX_TICKS = 300

    function loop() {
      nodesRef.current = tick(nodesRef.current, edgeList, W, H)
      setNodes([...nodesRef.current])
      ticks++
      if (ticks < MAX_TICKS && simRunning.current) {
        rafRef.current = requestAnimationFrame(loop)
      } else {
        simRunning.current = false
      }
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current)
    simRunning.current = false
  }, [])

  // ── Generate ────────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selected.length) return
    setError(null)
    setGenerating(true)
    setActiveNode(null)
    setNodes([])
    setEdges([])
    setTransform({ x: 0, y: 0, scale: 1 })
    transformRef.current = { x: 0, y: 0, scale: 1 }

    try {
      const graph = await generateMindMap(selected)

      // Assign colour per unique doc_id
      const uniqueDocs = [...new Set(graph.nodes.map(n => n.doc_id))]
      const colorMap   = {}
      uniqueDocs.forEach((id, i) => { colorMap[id] = DOC_PALETTE[i % DOC_PALETTE.length] })
      setDocColorMap(colorMap)

      setEdges(graph.edges)
      startSim(graph.nodes, graph.edges, canvasSize.w, canvasSize.h)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate mind map. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Toggle document selection ───────────────────────────────────────────────
  const toggleDoc = (id) =>
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  // ── Pointer interaction helpers ─────────────────────────────────────────────
  const toSVGCoords = (e) => {
    const svg   = svgRef.current
    if (!svg) return { x: e.clientX, y: e.clientY }
    const rect  = svg.getBoundingClientRect()
    const t     = transformRef.current
    return {
      x: (e.clientX - rect.left - t.x) / t.scale,
      y: (e.clientY - rect.top  - t.y) / t.scale,
    }
  }

  const onNodePointerDown = (e, nodeId) => {
    e.stopPropagation()
    e.preventDefault()
    const coords = toSVGCoords(e)
    dragging.current = { nodeId, startX: coords.x, startY: coords.y }
    // Stop simulation while dragging
    simRunning.current = false
    cancelAnimationFrame(rafRef.current)
  }

  const onSVGPointerDown = (e) => {
    if (dragging.current) return
    panning.current = { startX: e.clientX, startY: e.clientY, tx: transformRef.current.x, ty: transformRef.current.y }
  }

  const onPointerMove = (e) => {
    if (dragging.current) {
      const coords = toSVGCoords(e)
      nodesRef.current = nodesRef.current.map(n =>
        n.id === dragging.current.nodeId
          ? { ...n, x: coords.x, y: coords.y, vx: 0, vy: 0 }
          : n
      )
      setNodes([...nodesRef.current])
      return
    }
    if (panning.current) {
      const dx = e.clientX - panning.current.startX
      const dy = e.clientY - panning.current.startY
      const newT = { ...transformRef.current, x: panning.current.tx + dx, y: panning.current.ty + dy }
      transformRef.current = newT
      setTransform(newT)
    }
  }

  const onPointerUp = (e) => {
    if (dragging.current) {
      // Resume simulation from current positions
      startSim(nodesRef.current, edges, canvasSize.w, canvasSize.h)
      dragging.current = null
      return
    }
    panning.current = null
  }

  const onWheel = (e) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const newScale = Math.max(0.3, Math.min(3, transformRef.current.scale * factor))
    const newT = { ...transformRef.current, scale: newScale }
    transformRef.current = newT
    setTransform(newT)
  }

  const onNodeClick = (e, node) => {
    e.stopPropagation()
    setActiveNode(prev => prev?.id === node.id ? null : node)
  }

  const onCanvasClick = () => setActiveNode(null)

  // ── Connected nodes for detail panel ───────────────────────────────────────
  const connectedNodes = activeNode
    ? edges
        .filter(e => e.source === activeNode.id || e.target === activeNode.id)
        .map(e => {
          const otherId = e.source === activeNode.id ? e.target : e.source
          const other   = nodes.find(n => n.id === otherId)
          const dir     = e.source === activeNode.id ? '→' : '←'
          return other ? { node: other, label: e.label, dir } : null
        })
        .filter(Boolean)
    : []

  // ── Rendering ───────────────────────────────────────────────────────────────
  const { x: tx, y: ty, scale } = transform

  return (
    <div className="mindmap-page" style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#0C0C14', color: '#fff',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      overflow: 'hidden',
    }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="mindmap-topbar" style={{
        padding: '14px 20px', background: '#0E0E1A',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px' }}>
            🕸️ Concept Mind Map
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>
            Select up to 5 documents and visualise how concepts connect
          </p>
        </div>

        {/* Doc selector */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          {docsLoading ? (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Loading documents…</span>
          ) : docs.length === 0 ? (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
              No processed documents yet. Upload a document first.
            </span>
          ) : (
            docs.map(doc => {
              const on = selected.includes(doc.id)
              return (
                <button key={doc.id} onClick={() => toggleDoc(doc.id)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: on ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                  border: on ? '1px solid #7C3AED' : '1px solid rgba(255,255,255,0.1)',
                  color: on ? '#C4B5FD' : 'rgba(255,255,255,0.6)',
                }}>
                  {on ? '✓ ' : ''}{doc.original_name.slice(0, 22)}{doc.original_name.length > 22 ? '…' : ''}
                </button>
              )
            })
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {nodes.length > 0 && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
              {nodes.length} concepts · {edges.length} connections
            </span>
          )}
          <button
            onClick={() => { setNodes([]); setEdges([]); setActiveNode(null); setSelected([]) }}
            disabled={nodes.length === 0}
            style={{
              padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              cursor: nodes.length ? 'pointer' : 'not-allowed', border: 'none',
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
            }}>
            Clear
          </button>
          <button
            onClick={handleGenerate}
            disabled={!selected.length || generating}
            style={{
              padding: '7px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700,
              cursor: selected.length && !generating ? 'pointer' : 'not-allowed',
              border: 'none',
              background: selected.length && !generating
                ? 'linear-gradient(135deg,#7C3AED,#4F46E5)'
                : 'rgba(124,58,237,0.3)',
              color: '#fff',
              boxShadow: selected.length ? '0 4px 14px rgba(124,58,237,0.35)' : 'none',
              transition: 'all 0.2s',
            }}>
            {generating ? '⏳ Generating…' : '✨ Generate Map'}
          </button>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          margin: '12px 20px 0', padding: '10px 16px', borderRadius: 10,
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#FCA5A5', fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* ── SVG Canvas ─────────────────────────────────────────────────── */}
        <div
          ref={containerRef}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: panning.current ? 'grabbing' : 'grab' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {/* Empty state */}
          {nodes.length === 0 && !generating && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 14,
              color: 'rgba(255,255,255,0.18)',
            }}>
              <div style={{ fontSize: 72 }}>🕸️</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Select documents above and click Generate Map</div>
              <div style={{ fontSize: 12 }}>Concepts and their connections will appear here</div>
            </div>
          )}

          {/* Loading overlay */}
          {generating && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16,
              background: 'rgba(12,12,20,0.85)', backdropFilter: 'blur(6px)',
            }}>
              <div style={{
                width: 52, height: 52, border: '4px solid rgba(124,58,237,0.3)',
                borderTopColor: '#7C3AED', borderRadius: '50%',
                animation: 'spin 0.9s linear infinite',
              }} />
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: 600 }}>
                StudyBuddy is mapping your concepts…
              </div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                This takes 10–20 seconds for larger documents
              </div>
            </div>
          )}

          <svg
            ref={svgRef}
            width="100%" height="100%"
            style={{ display: 'block', userSelect: 'none' }}
            onClick={onCanvasClick}
            onPointerDown={onSVGPointerDown}
            onWheel={onWheel}
          >
            <defs>
              {/* Arrow marker */}
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="rgba(255,255,255,0.25)" />
              </marker>
              {/* Glow filters per doc */}
              {Object.entries(docColorMap).map(([docId, col]) => (
                <filter key={docId} id={`glow-${docId}`} x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={col.border} floodOpacity="0.8" />
                </filter>
              ))}
            </defs>

            <g transform={`translate(${tx},${ty}) scale(${scale})`}>
              {/* ── Edges ─────────────────────────────────────────────── */}
              {edges.map((e, i) => {
                const src = nodes.find(n => n.id === e.source)
                const tgt = nodes.find(n => n.id === e.target)
                if (!src || !tgt) return null
                const ax = src.x, ay = src.y, bx = tgt.x, by = tgt.y
                const mx = (ax + bx) / 2, my = (ay + by) / 2
                const isActive = activeNode && (e.source === activeNode.id || e.target === activeNode.id)
                return (
                  <g key={`e-${i}`}>
                    <path
                      d={edgePath(ax, ay, bx, by)}
                      fill="none"
                      stroke={isActive ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.12)'}
                      strokeWidth={isActive ? 2 : 1.5}
                      markerEnd="url(#arrow)"
                      strokeDasharray={isActive ? 'none' : '5,5'}
                    />
                    {/* Edge label */}
                    <rect x={mx - 32} y={my - 9} width={64} height={18} rx={9}
                      fill="#141422" stroke="rgba(255,255,255,0.07)" />
                    <text x={mx} y={my + 5} textAnchor="middle"
                      style={{ fontSize: 9, fill: 'rgba(255,255,255,0.45)', fontWeight: 500, pointerEvents: 'none' }}>
                      {e.label.length > 14 ? e.label.slice(0, 13) + '…' : e.label}
                    </text>
                  </g>
                )
              })}

              {/* ── Nodes ─────────────────────────────────────────────── */}
              {nodes.map(node => {
                const col      = docColorMap[node.doc_id] || DOC_PALETTE[0]
                const isActive = activeNode?.id === node.id
                const rx = node.x - NODE_W / 2
                const ry = node.y - NODE_H / 2
                return (
                  <g key={node.id}
                    style={{ cursor: 'pointer' }}
                    onClick={e => onNodeClick(e, node)}
                    onPointerDown={e => onNodePointerDown(e, node.id)}
                  >
                    {/* Glow ring when active */}
                    {isActive && (
                      <rect x={rx - 4} y={ry - 4} width={NODE_W + 8} height={NODE_H + 8}
                        rx={16} fill="none"
                        stroke={col.border} strokeWidth={2}
                        filter={`url(#glow-${node.doc_id})`}
                        opacity={0.9}
                      />
                    )}
                    {/* Node body */}
                    <rect x={rx} y={ry} width={NODE_W} height={NODE_H}
                      rx={12}
                      fill={isActive ? col.bg.replace('0.18', '0.35') : col.bg}
                      stroke={isActive ? col.border : col.border.replace(')', ',0.55)')}
                      strokeWidth={isActive ? 2 : 1.5}
                    />
                    {/* Label */}
                    <text x={node.x} y={node.y + 5} textAnchor="middle"
                      style={{
                        fontSize: 12, fontWeight: 700,
                        fill: isActive ? '#fff' : 'rgba(255,255,255,0.88)',
                        pointerEvents: 'none',
                      }}>
                      {node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Zoom controls */}
          {nodes.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 20, right: activeNode ? 340 : 20,
              display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10,
              transition: 'right 0.28s ease',
            }}>
              {[
                { label: '+', action: () => { const ns = Math.min(3, transform.scale * 1.2); const t = {...transformRef.current, scale: ns}; transformRef.current = t; setTransform(t) } },
                { label: '–', action: () => { const ns = Math.max(0.3, transform.scale / 1.2); const t = {...transformRef.current, scale: ns}; transformRef.current = t; setTransform(t) } },
                { label: '⟳', action: () => { const t = {x:0,y:0,scale:1}; transformRef.current = t; setTransform(t) } },
              ].map(({ label, action }) => (
                <button key={label} onClick={action} style={{
                  width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(14,14,26,0.9)', color: 'rgba(255,255,255,0.7)',
                  fontSize: 18, cursor: 'pointer', backdropFilter: 'blur(8px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{label}</button>
              ))}
            </div>
          )}
        </div>

        {/* ── Detail Panel ────────────────────────────────────────────────── */}
        {activeNode && (
          <div className="mindmap-detail-panel" style={{
            width: 320, flexShrink: 0, background: '#0E0E1A',
            borderLeft: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'slideInRight 0.22s ease',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'inline-block', marginBottom: 6,
                  padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                  background: (docColorMap[activeNode.doc_id] || DOC_PALETTE[0]).bg,
                  border: `1px solid ${(docColorMap[activeNode.doc_id] || DOC_PALETTE[0]).border}`,
                  color: (docColorMap[activeNode.doc_id] || DOC_PALETTE[0]).border,
                }}>
                  {activeNode.document} · p.{activeNode.page}
                </div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>
                  {activeNode.label}
                </h2>
              </div>
              <button onClick={() => setActiveNode(null)} style={{
                width: 28, height: 28, borderRadius: 8, border: 'none',
                background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer', fontSize: 15, flexShrink: 0, marginLeft: 10,
              }}>✕</button>
            </div>

            {/* Description */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.72)' }}>
                {activeNode.description || 'No description available.'}
              </p>
            </div>

            {/* Open in Reader */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <button
                onClick={() => navigate(`/reader/${activeNode.doc_id}`, { state: { page: activeNode.page } })}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
                }}>
                📖 Open in Reader — Page {activeNode.page}
              </button>
            </div>

            {/* Connected concepts */}
            {connectedNodes.length > 0 && (
              <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700,
                  color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Connected Concepts ({connectedNodes.length})
                </p>
                {connectedNodes.map(({ node, label, dir }, i) => {
                  const col = docColorMap[node.doc_id] || DOC_PALETTE[0]
                  return (
                    <div key={i}
                      onClick={() => setActiveNode(node)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                        borderRadius: 10, marginBottom: 6, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: col.bg, border: `1px solid ${col.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12,
                      }}>🔗</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dir} {node.label}
                        </p>
                        <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                          {label}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Animations ──────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideInRight {
          from { transform: translateX(30px); opacity: 0 }
          to   { transform: translateX(0);    opacity: 1 }
        }
      `}</style>
    </div>
  )
}
