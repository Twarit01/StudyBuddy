import { useRef, useState } from 'react'

const ALLOWED = ['pdf', 'docx', 'txt']
const MAX_MB = 50

export default function FileUpload({ onUpload, uploading, uploadProgress }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)

  const validateFile = (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!ALLOWED.includes(ext)) {
      return `File type .${ext} not allowed. Use PDF, DOCX, or TXT.`
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      return `File too large. Max size is ${MAX_MB}MB.`
    }
    return null
  }

  const handleFile = (file) => {
    const err = validateFile(file)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    onUpload(file)
  }

  const handleInputChange = (e) => {
    const file = e.target.files[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="w-full">
      {/* Drop zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-xl p-4 text-center cursor-pointer
          transition-all duration-150
          ${dragging
            ? 'border-[#7c6af7] bg-[#7c6af7]/10'
            : 'border-[#333344] hover:border-[#7c6af7] hover:bg-[#7c6af7]/5'
          }
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div className="text-2xl mb-2">📄</div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Drop PDF, DOCX, or TXT<br />or click to browse
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={handleInputChange}
          disabled={uploading}
        />
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Processing...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-1.5 bg-[#222230] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#7c6af7] to-[#5de0b0] rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-2 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}