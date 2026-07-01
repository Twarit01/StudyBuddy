import { useXP } from '../context/XPContext'

export default function XPToastContainer() {
  const { toasts, dismissToast } = useXP()

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10,
      pointerEvents: 'none',
    }}>
      <style>{`
        @keyframes xpSlideIn {
          from { opacity: 0; transform: translateX(40px) scale(0.9); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes xpPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
      `}</style>
      {toasts.map(t => (
        <div key={t.id}
          onClick={() => dismissToast(t.id)}
          style={{
            pointerEvents: 'auto', cursor: 'pointer',
            animation: 'xpSlideIn 0.35s cubic-bezier(.34,1.56,.64,1)',
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 18px', borderRadius: 14,
            background: t.leveledUp
              ? 'linear-gradient(135deg,#F59E0B,#EF4444)'
              : 'linear-gradient(135deg,#7C3AED,#6D28D9)',
            boxShadow: t.leveledUp
              ? '0 8px 32px rgba(245,158,11,0.5)'
              : '0 8px 28px rgba(124,58,237,0.45)',
            minWidth: 220,
            fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
          }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
            animation: t.leveledUp ? 'xpPulse 0.6s ease infinite' : 'none',
          }}>
            {t.leveledUp ? '🎉' : '⚡'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.2px' }}>
              +{t.amount} XP
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.leveledUp ? `Level up! Now level ${t.level} 🚀` : t.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}