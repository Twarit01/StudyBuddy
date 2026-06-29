import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Login      from './pages/Login'
import Register   from './pages/Register'
import Dashboard  from './pages/Dashboard'
import Chat       from './pages/Chat'
import Quiz       from './pages/Quiz'
import Flashcards from './pages/Flashcards'
import Progress   from './pages/Progress'
import Revision   from './pages/Revision'
import Documents  from './pages/Documents'
import DocumentReader from './pages/DocumentReader'
import Sidebar    from './components/Sidebar'

function AppLayout({ children }) {
  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#0C0C14' }}>
      <Sidebar />
      <main style={{ flex:1, overflow:'hidden' }}>
        {children}
      </main>
    </div>
  )
}

function RootRedirect() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0C0C14', display:'flex',
      alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:28, height:28, border:'3px solid #7C3AED',
        borderTopColor:'transparent', borderRadius:'50%',
        animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
}

function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0C0C14', display:'flex',
      alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:28, height:28, border:'3px solid #7C3AED',
        borderTopColor:'transparent', borderRadius:'50%',
        animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (isAuthenticated) return <Navigate to='/dashboard' replace />
  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login"    element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
            <Route path="/dashboard" element={
              <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
            } />
            <Route path="/documents" element={
              <ProtectedRoute><AppLayout><Documents /></AppLayout></ProtectedRoute>
            } />
            <Route path="/reader/:documentId" element={
              <ProtectedRoute><AppLayout><DocumentReader /></AppLayout></ProtectedRoute>
            } />
            <Route path="/chat" element={
              <ProtectedRoute><AppLayout><Chat /></AppLayout></ProtectedRoute>
            } />
            <Route path="/quiz" element={
              <ProtectedRoute><AppLayout><Quiz /></AppLayout></ProtectedRoute>
            } />
            <Route path="/flashcards" element={
              <ProtectedRoute><AppLayout><Flashcards /></AppLayout></ProtectedRoute>
            } />
            <Route path="/revision" element={
              <ProtectedRoute><AppLayout><Revision /></AppLayout></ProtectedRoute>
            } />
            <Route path="/progress" element={
              <ProtectedRoute><AppLayout><Progress /></AppLayout></ProtectedRoute>
            } />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}