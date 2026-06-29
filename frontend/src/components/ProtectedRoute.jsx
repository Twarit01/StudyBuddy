import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{
        minHeight:'100vh', background:'#0C0C14',
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', gap:12
      }}>
        <div style={{
          width:28, height:28,
          border:'3px solid #7C3AED',
          borderTopColor:'transparent',
          borderRadius:'50%',
          animation:'spin 0.8s linear infinite'
        }}/>
        <span style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>Loading...</span>
        <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return children
}