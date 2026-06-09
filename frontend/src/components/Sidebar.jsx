import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDocuments } from '../hooks/useDocuments'
import FileUpload from './FileUpload'

const navItems = [
  { path: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { path: '/chat',      icon: '💬', label: 'Q&A Chat' },
  { path: '/quiz',      icon: '📝', label: 'Quiz' },
  { path: '/flashcards',icon: '🃏', label: 'Flashcards' },
  { path: '/progress',  icon: '📊', label: 'Progress' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { documents, uploading, uploadProgress, upload, remove } = useDocuments()
  const navigate = useNavigate()
  const [uploadError, setUploadError] = useState(null)

  const handleUpload = async (file) => {
    try {
      setUploadError(null)
      await upload(file)
    } catch (err) {
      setUploadError(err.response?.data?.detail || 'Upload failed')
    }
  }

  return (
    <aside className="w-56 flex-shrink-0 bg-[#18181f] border-r border-[#222230] flex flex-col h-full overflow-hidden">

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[#222230]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c6af7] to-[#5de0b0] flex items-center justify-center text-base">
          🧠
        </div>
        <div>
          <div className="text-sm font-semibold">StudyBuddy</div>
          <div className="text-xs text-gray-500">AI Assistant</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-2 py-3 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-100
              ${isActive
                ? 'bg-[#7c6af7]/15 text-[#7c6af7] font-medium'
                : 'text-gray-400 hover:bg-[#222230] hover:text-gray-200'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Documents section */}
      <div className="flex-1 overflow-y-auto px-3 py-2 border-t border-[#222230]">
        <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 px-1 font-medium">
          Study Materials
        </p>

        <FileUpload
          onUpload={handleUpload}
          uploading={uploading}
          uploadProgress={uploadProgress}
        />

        {uploadError && (
          <p className="mt-2 text-xs text-red-400">{uploadError}</p>
        )}

        {/* Document list */}
        <div className="mt-2 flex flex-col gap-1">
          {documents.length === 0 && !uploading && (
            <p className="text-xs text-gray-600 text-center py-2">
              No documents yet
            </p>
          )}
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 bg-[#222230] rounded-lg px-2.5 py-2 group"
            >
              <span className="text-xs">
                {doc.file_type === 'pdf' ? '📕' : doc.file_type === 'docx' ? '📘' : '📄'}
              </span>
              <span className="text-xs text-gray-300 flex-1 truncate" title={doc.original_name}>
                {doc.original_name}
              </span>
              <button
                onClick={() => remove(doc.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-xs"
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* User + logout */}
      <div className="px-3 py-3 border-t border-[#222230]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#7c6af7]/20 flex items-center justify-center text-xs font-semibold text-[#7c6af7]">
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{user?.full_name}</div>
            <div className="text-[10px] text-gray-500 truncate">{user?.email}</div>
          </div>
          <button
            onClick={logout}
            className="text-gray-600 hover:text-red-400 transition-colors text-xs"
            title="Logout"
          >
            ⏻
          </button>
        </div>
      </div>
    </aside>
  )
}