import React, { useState, useEffect, useCallback, useRef } from 'react'
import Head from 'next/head'
import {
  MdGridView,
  MdReceiptLong,
  MdSettings,
  MdAdd,
  MdClose,
  MdArchive,
  MdUnarchive,
  MdCancel,
  MdCameraAlt,
  MdCameraswitch,
  MdEdit,
  MdDragHandle,
} from 'react-icons/md'
import { loginAdmin, checkAdminSession } from '../utils/adminAuth'

// ── Types ──

type CatalogItem = {
  id: number
  name: string
  price_cents: number
  photo: string | null
  archived: boolean
  sort_order: number
  created_at: string
}

type FridgeUser = {
  id: number
  name: string
  photo: string | null
  balance_cents: number
  created_at: string
}

type Transaction = {
  id: number
  type: 'purchase' | 'payment'
  item_id: number | null
  quantity: number | null
  amount_cents: number
  created_at: string
  item_name: string | null
}

type Tab = 'catalog' | 'tabs'

// ── Helpers ──

const formatCents = (cents: number) => {
  const val = (cents / 100).toFixed(2)
  return `${val}€`
}

const adminFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { credentials: 'same-origin', ...opts })

const adminPost = (url: string, body: unknown) =>
  adminFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const adminPatch = (url: string, body?: unknown) =>
  adminFetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })

const adminPut = (url: string, body: unknown) =>
  adminFetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const adminDelete = (url: string) => adminFetch(url, { method: 'DELETE' })

const CANCEL_WINDOW_MS = 2 * 60 * 1000

const resizeImage = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const maxSize = 400
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#1a1a22'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

// ── Login Screen ──

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(false)
    const ok = await loginAdmin(password)
    setLoading(false)
    if (ok) onLogin()
    else setError(true)
  }

  return (
    <div className="flex items-center justify-center h-dvh p-8">
      <form
        onSubmit={handleSubmit}
        className="bg-[#1a1a22] p-10 rounded-2xl w-full max-w-[400px] flex flex-col gap-4"
      >
        <h1 className="text-2xl text-center mb-2">Fridge Inventory</h1>
        <input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="px-4 py-3.5 rounded-lg border border-[#333] bg-[#0f0f13] text-[#e8e8eb] text-base"
        />
        <button
          type="submit"
          disabled={loading}
          className="py-3.5 rounded-lg border-none bg-[#6366f1] text-white text-base font-semibold cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Logging in…' : 'Login'}
        </button>
        {error && <p className="text-[#f87171] text-center">Wrong password</p>}
      </form>
    </div>
  )
}

// ── Camera Capture Modal ──

function CameraCapture({
  onCapture,
  onClose,
  defaultFacingMode = 'user',
}: {
  onCapture: (data: string) => void
  onClose: () => void
  defaultFacingMode?: 'user' | 'environment'
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(defaultFacingMode)

  useEffect(() => {
    let cancelled = false
    streamRef.current?.getTracks().forEach((t) => t.stop())
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => {})
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [facingMode])

  const capture = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    const data = canvas.toDataURL('image/jpeg', 0.8)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    onCapture(data)
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a22] rounded-2xl p-6 w-full max-w-[600px] max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black" />
        <div className="flex justify-center mt-2">
          <button
            className="w-10 h-10 rounded-full border border-[#444] bg-transparent text-[#ccc] text-xl cursor-pointer flex items-center justify-center hover:text-white hover:border-[#666]"
            onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
            title="Switch camera"
          >
            <MdCameraswitch />
          </button>
        </div>
        <div className="flex gap-4 mt-3 justify-center">
          <button
            className="px-4 py-2 rounded-lg border border-[#444] bg-transparent text-[#ccc] text-sm cursor-pointer flex items-center gap-1"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-6 py-3 rounded-lg border-none bg-[#6366f1] text-white text-[0.95rem] font-semibold cursor-pointer"
            onClick={capture}
          >
            Take Photo
          </button>
        </div>
      </div>
    </div>
  )
}

// ── User Profile Modal ──

function UserProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user: FridgeUser
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(user.name)
  const [photo, setPhoto] = useState<string | null>(user.photo)
  const [showCamera, setShowCamera] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const data = await resizeImage(file)
    setPhoto(data)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const body: { name?: string; photo?: string | null } = {}
    if (name.trim() !== user.name) body.name = name.trim()
    if (photo !== user.photo) body.photo = photo
    if (Object.keys(body).length > 0) {
      await adminPatch(`/api/fridge/users/${user.id}`, body)
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a22] rounded-2xl p-6 w-full max-w-[500px] max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg">Edit Profile</h2>
          <button
            className="bg-transparent border-none text-[#888] text-[1.4rem] cursor-pointer flex p-1"
            onClick={onClose}
          >
            <MdClose />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex justify-center">
            {photo ? (
              <img
                src={photo}
                alt={name}
                className="w-24 h-24 object-cover rounded-full"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[#2a2a35] flex items-center justify-center text-3xl font-semibold text-[#888]">
                {name[0] || '?'}
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-center">
            <button
              className="px-4 py-2 rounded-lg border border-[#444] bg-transparent text-[#ccc] text-sm cursor-pointer flex items-center gap-1"
              onClick={() => setShowCamera(true)}
            >
              <MdCameraAlt /> Camera
            </button>
            <button
              className="px-4 py-2 rounded-lg border border-[#444] bg-transparent text-[#ccc] text-sm cursor-pointer flex items-center gap-1"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              hidden
            />
            {photo && (
              <button
                className="px-4 py-2 rounded-lg border border-[#444] bg-transparent text-[#f87171] text-sm cursor-pointer"
                onClick={() => setPhoto(null)}
              >
                Remove
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-4 py-3 rounded-lg border border-[#333] bg-[#0f0f13] text-[#e8e8eb] text-base"
          />
          <button
            className="px-6 py-3 rounded-lg border-none bg-[#6366f1] text-white text-[0.95rem] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-default"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={(data) => {
            setPhoto(data)
            setShowCamera(false)
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}

// ── Items Tab ──

function ItemsTab({
  items,
  users,
  onRefreshUsers,
  onRefreshItems,
}: {
  items: CatalogItem[]
  users: FridgeUser[]
  onRefreshUsers: () => void
  onRefreshItems: () => void
}) {
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [showNewUser, setShowNewUser] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserPhoto, setNewUserPhoto] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const [profileUser, setProfileUser] = useState<FridgeUser | null>(null)
  const [recentPurchases, setRecentPurchases] =
    useState<{ id: number; label: string; time: number }[]>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setRecentPurchases((prev) => prev?.filter((p) => Date.now() - p.time < CANCEL_WINDOW_MS))
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const activeItems = items.filter((i) => !i.archived)

  const addToTab = async (userId: number, userName: string) => {
    if (!selectedItem) return
    const totalCents = -(selectedItem.price_cents * quantity)
    const res = await adminPost('/api/fridge/transactions', {
      user_id: userId,
      type: 'purchase',
      item_id: selectedItem.id,
      quantity,
      amount_cents: totalCents,
    })
    if (res.ok) {
      const data = await res.json()
      setRecentPurchases((prev) => [
        ...(prev || []),
        {
          id: data.transaction.id,
          label: `${quantity}x ${selectedItem.name} → ${userName}`,
          time: Date.now(),
        },
      ])
      onRefreshUsers()
    }
    setSelectedItem(null)
    setQuantity(1)
  }

  const createUserAndAdd = async () => {
    if (!newUserName.trim()) return
    const res = await adminPost('/api/fridge/users', {
      name: newUserName.trim(),
      photo: newUserPhoto,
    })
    if (res.ok) {
      const data = await res.json()
      onRefreshUsers()
      await addToTab(data.user.id, data.user.name)
    }
    setShowNewUser(false)
    setNewUserName('')
    setNewUserPhoto(null)
  }

  const cancelPurchase = async (txId: number) => {
    const res = await adminDelete(`/api/fridge/transactions/${txId}`)
    if (res.ok) {
      setRecentPurchases((prev) => prev?.filter((p) => p.id !== txId))
      onRefreshUsers()
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const data = await resizeImage(file)
    setNewUserPhoto(data)
  }

  return (
    <div className="max-w-[900px] mx-auto relative">
      {/* Recent purchases toast */}
      {recentPurchases && recentPurchases.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {recentPurchases.map((p) => (
            <div
              key={p.id}
              className="flex justify-between items-center px-4 py-2.5 bg-[#1e293b] border border-[#334155] rounded-lg text-sm"
            >
              <span>{p.label}</span>
              <button
                onClick={() => cancelPurchase(p.id)}
                className="bg-transparent border-none text-[#f87171] cursor-pointer text-sm flex items-center gap-1"
              >
                <MdCancel /> Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Items grid */}
      <div className="grid grid-cols-3 gap-3">
        {activeItems.map((item) => (
          <button
            key={item.id}
            className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-3 text-center cursor-pointer transition-[transform,border-color] duration-150 flex flex-col items-center gap-1.5 active:scale-[0.97] hover:border-[#6366f1]"
            onClick={() => setSelectedItem(item)}
          >
            {item.photo ? (
              <img
                src={item.photo}
                alt={item.name}
                className="w-full aspect-square object-cover rounded-lg bg-[#1a1a22]"
              />
            ) : (
              <div className="w-full aspect-square rounded-lg bg-[#2a2a35] flex items-center justify-center text-[clamp(1.5rem,5vw,2.5rem)] font-semibold text-[#666]">
                {item.name[0]}
              </div>
            )}
            <div className="font-medium text-[clamp(0.75rem,2.5vw,1rem)]">{item.name}</div>
            <div className="text-[#6366f1] font-semibold text-[clamp(0.7rem,2vw,0.95rem)]">
              {formatCents(item.price_cents)}
            </div>
          </button>
        ))}
      </div>

      {/* Settings button — bottom right */}
      <button
        className="fixed bottom-4 right-4 z-10 w-12 h-12 rounded-full bg-[#1a1a22] border border-[#2a2a35] text-[#888] text-xl cursor-pointer flex items-center justify-center hover:text-[#ccc] hover:border-[#444] shadow-lg"
        onClick={() => setShowManage(true)}
        title="Manage Catalog"
      >
        <MdSettings />
      </button>

      {/* Manage catalog modal */}
      {showManage && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4"
          onClick={() => setShowManage(false)}
        >
          <div
            className="bg-[#1a1a22] rounded-2xl p-6 w-full max-w-[600px] max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg">Manage Catalog</h2>
              <button
                className="bg-transparent border-none text-[#888] text-[1.4rem] cursor-pointer flex p-1"
                onClick={() => setShowManage(false)}
              >
                <MdClose />
              </button>
            </div>
            <SettingsTab items={items} onRefreshItems={onRefreshItems} />
          </div>
        </div>
      )}

      {/* Select user modal */}
      {selectedItem && !showNewUser && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4"
          onClick={() => {
            setSelectedItem(null)
            setQuantity(1)
          }}
        >
          <div
            className="bg-[#1a1a22] rounded-2xl p-6 w-full max-w-[500px] max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg">Add {selectedItem.name} to tab</h2>
              <button
                className="bg-transparent border-none text-[#888] text-[1.4rem] cursor-pointer flex p-1"
                onClick={() => {
                  setSelectedItem(null)
                  setQuantity(1)
                }}
              >
                <MdClose />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 bg-[#0f0f13] rounded-lg">
              <label className="text-[#aaa]">Quantity:</label>
              <button
                className="w-9 h-9 rounded-full border border-[#444] bg-transparent text-[#e8e8eb] text-xl cursor-pointer flex items-center justify-center"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                −
              </button>
              <span className="text-xl font-semibold min-w-[2ch] text-center">{quantity}</span>
              <button
                className="w-9 h-9 rounded-full border border-[#444] bg-transparent text-[#e8e8eb] text-xl cursor-pointer flex items-center justify-center"
                onClick={() => setQuantity(quantity + 1)}
              >
                +
              </button>
              <span className="ml-auto text-[#6366f1] font-semibold">
                {formatCents(selectedItem.price_cents * quantity)}
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
              {users.map((user) => (
                <button
                  key={user.id}
                  className="bg-[#0f0f13] border border-[#2a2a35] rounded-xl p-3 text-center cursor-pointer transition-[border-color] duration-150 flex flex-col items-center gap-1.5 hover:border-[#6366f1]"
                  onClick={() => addToTab(user.id, user.name)}
                >
                  {user.photo ? (
                    <img
                      src={user.photo}
                      alt={user.name}
                      className="w-14 h-14 object-cover rounded-full"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[#2a2a35] flex items-center justify-center text-xl font-semibold text-[#888]">
                      {user.name[0]}
                    </div>
                  )}
                  <div className="text-xs break-words">{user.name}</div>
                </button>
              ))}
              <button
                className="bg-[#0f0f13] border border-dashed border-[#2a2a35] rounded-xl p-3 text-center cursor-pointer transition-[border-color] duration-150 flex flex-col items-center gap-1.5 hover:border-[#6366f1]"
                onClick={() => setShowNewUser(true)}
              >
                <div className="w-14 h-14 rounded-full bg-[#2a2a35] flex items-center justify-center text-xl font-semibold text-[#888]">
                  <MdAdd />
                </div>
                <div className="text-xs break-words">New User</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New user modal */}
      {showNewUser && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4"
          onClick={() => {
            setShowNewUser(false)
            setNewUserName('')
            setNewUserPhoto(null)
          }}
        >
          <div
            className="bg-[#1a1a22] rounded-2xl p-6 w-full max-w-[500px] max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg">New User</h2>
              <button
                className="bg-transparent border-none text-[#888] text-[1.4rem] cursor-pointer flex p-1"
                onClick={() => {
                  setShowNewUser(false)
                  setNewUserName('')
                  setNewUserPhoto(null)
                }}
              >
                <MdClose />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                autoFocus
                className="px-4 py-3 rounded-lg border border-[#333] bg-[#0f0f13] text-[#e8e8eb] text-base"
              />
              <div className="flex gap-4 items-center">
                {newUserPhoto ? (
                  <img
                    src={newUserPhoto}
                    alt="preview"
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-[#2a2a35] flex items-center justify-center text-xs text-[#666]">
                    No photo
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <button
                    className="px-4 py-2 rounded-lg border border-[#444] bg-transparent text-[#ccc] text-sm cursor-pointer flex items-center gap-1"
                    onClick={() => setShowCamera(true)}
                  >
                    <MdCameraAlt /> Camera
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg border border-[#444] bg-transparent text-[#ccc] text-sm cursor-pointer flex items-center gap-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    hidden
                  />
                </div>
              </div>
              <button
                className="px-6 py-3 rounded-lg border-none bg-[#6366f1] text-white text-[0.95rem] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-default"
                onClick={createUserAndAdd}
                disabled={!newUserName.trim()}
              >
                Create & Add to Tab
              </button>
            </div>
          </div>
        </div>
      )}

      {showCamera && (
        <CameraCapture
          onCapture={(data) => {
            setNewUserPhoto(data)
            setShowCamera(false)
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {profileUser && (
        <UserProfileModal
          user={profileUser}
          onClose={() => setProfileUser(null)}
          onSaved={onRefreshUsers}
        />
      )}
    </div>
  )
}

// ── Tabs Tab ──

function TabsTab({
  users,
  onRefreshUsers,
}: {
  users: FridgeUser[]
  onRefreshUsers: () => void
}) {
  const [selectedUser, setSelectedUser] = useState<FridgeUser | null>(null)
  const [history, setHistory] = useState<Transaction[]>([])
  const [showPay, setShowPay] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [profileUser, setProfileUser] = useState<FridgeUser | null>(null)
  const [showNewUser, setShowNewUser] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserPhoto, setNewUserPhoto] = useState<string | null>(null)
  const [showNewUserCamera, setShowNewUserCamera] = useState(false)
  const newUserFileRef = useRef<HTMLInputElement>(null)

  const loadHistory = useCallback(async (userId: number) => {
    setLoadingHistory(true)
    const res = await adminFetch(`/api/fridge/users/${userId}/history`)
    if (res.ok) {
      const data = await res.json()
      setHistory(data.transactions)
    }
    setLoadingHistory(false)
  }, [])

  const selectUser = (user: FridgeUser) => {
    setSelectedUser(user)
    loadHistory(user.id)
  }

  const handlePay = async () => {
    if (!selectedUser || !payAmount) return
    const cents = Math.round(parseFloat(payAmount) * 100)
    if (isNaN(cents) || cents <= 0) return
    await adminPost('/api/fridge/transactions', {
      user_id: selectedUser.id,
      type: 'payment',
      amount_cents: cents,
    })
    setShowPay(false)
    setPayAmount('')
    onRefreshUsers()
    loadHistory(selectedUser.id)
  }

  const cancelTransaction = async (txId: number) => {
    const res = await adminDelete(`/api/fridge/transactions/${txId}`)
    if (res.ok) {
      onRefreshUsers()
      if (selectedUser) loadHistory(selectedUser.id)
    }
  }

  const createUser = async () => {
    if (!newUserName.trim()) return
    const res = await adminPost('/api/fridge/users', {
      name: newUserName.trim(),
      photo: newUserPhoto,
    })
    if (res.ok) {
      onRefreshUsers()
    }
    setShowNewUser(false)
    setNewUserName('')
    setNewUserPhoto(null)
  }

  const handleNewUserFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const data = await resizeImage(file)
    setNewUserPhoto(data)
  }

  const sortedUsers = [...users].sort((a, b) => a.balance_cents - b.balance_cents)

  if (selectedUser) {
    const currentUser = users.find((u) => u.id === selectedUser.id) || selectedUser
    return (
      <div className="max-w-[900px] mx-auto relative">
        <button
          className="bg-transparent border-none text-[#6366f1] text-[0.95rem] cursor-pointer py-1 mb-3"
          onClick={() => {
            setSelectedUser(null)
            setHistory([])
          }}
        >
          ← Back
        </button>
        <div className="flex items-center gap-4 mb-4">
          <button
            className="bg-transparent border-none p-0 cursor-pointer"
            onClick={() => setProfileUser(currentUser)}
          >
            {currentUser.photo ? (
              <img
                src={currentUser.photo}
                alt={currentUser.name}
                className="w-16 h-16 object-cover rounded-full hover:ring-2 hover:ring-[#6366f1] transition-shadow"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#2a2a35] flex items-center justify-center text-2xl font-semibold text-[#888] hover:ring-2 hover:ring-[#6366f1] transition-shadow">
                {currentUser.name[0]}
              </div>
            )}
          </button>
          <div>
            <h2 className="text-xl">{currentUser.name}</h2>
            <div
              className={`text-xl font-bold ${currentUser.balance_cents < 0 ? 'text-[#f87171]' : 'text-[#4ade80]'}`}
            >
              {formatCents(currentUser.balance_cents)}
            </div>
          </div>
        </div>

        <button
          className="w-full px-6 py-3 rounded-lg border-none bg-[#6366f1] text-white text-[0.95rem] font-semibold cursor-pointer mb-6"
          onClick={() => setShowPay(true)}
        >
          Record Payment
        </button>

        {showPay && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4"
            onClick={() => setShowPay(false)}
          >
            <div
              className="bg-[#1a1a22] rounded-2xl p-6 w-full max-w-[500px] max-h-[85dvh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg">Record Payment</h2>
                <button
                  className="bg-transparent border-none text-[#888] text-[1.4rem] cursor-pointer flex p-1"
                  onClick={() => setShowPay(false)}
                >
                  <MdClose />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    autoFocus
                    className="flex-1 px-4 py-3 rounded-lg border border-[#333] bg-[#0f0f13] text-[#e8e8eb] text-base"
                  />
                  <span className="text-xl text-[#888]">€</span>
                </div>
                <button
                  className="px-6 py-3 rounded-lg border-none bg-[#6366f1] text-white text-[0.95rem] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-default"
                  onClick={handlePay}
                  disabled={!payAmount}
                >
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        )}

        <h3>History</h3>
        {loadingHistory ? (
          <p className="text-[#666] text-center py-8">Loading…</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {history.map((tx) => {
              const canCancel = Date.now() - new Date(tx.created_at).getTime() < CANCEL_WINDOW_MS
              return (
                <div key={tx.id} className="flex items-center gap-3 px-3 py-2.5 bg-[#1a1a22] rounded-lg">
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {tx.type === 'purchase'
                        ? `${tx.quantity}x ${tx.item_name || 'Unknown'}`
                        : 'Payment'}
                    </div>
                    <div className="text-xs text-[#666] mt-0.5">
                      {new Date(tx.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div
                    className={`font-semibold text-sm whitespace-nowrap ${tx.amount_cents > 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}
                  >
                    {formatCents(tx.amount_cents)}
                  </div>
                  {canCancel && (
                    <button
                      className="bg-transparent border-none text-[#f87171] cursor-pointer text-xl flex p-1 shrink-0"
                      onClick={() => cancelTransaction(tx.id)}
                    >
                      <MdCancel />
                    </button>
                  )}
                </div>
              )
            })}
            {history.length === 0 && (
              <p className="text-[#666] text-center py-8">No transactions yet</p>
            )}
          </div>
        )}

        {profileUser && (
          <UserProfileModal
            user={profileUser}
            onClose={() => setProfileUser(null)}
            onSaved={() => {
              onRefreshUsers()
              if (selectedUser) loadHistory(selectedUser.id)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="max-w-[900px] mx-auto relative">
      <h2 className="text-lg text-[#ccc] mb-3">Tabs</h2>
      <div className="flex flex-col gap-2">
        {sortedUsers.map((user) => (
          <button
            key={user.id}
            className="flex items-center gap-3 px-4 py-3 bg-[#1a1a22] border border-[#2a2a35] rounded-xl cursor-pointer transition-[border-color] duration-150 w-full text-left text-[#e8e8eb] hover:border-[#6366f1]"
            onClick={() => selectUser(user)}
          >
            <div
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                setProfileUser(user)
              }}
            >
              {user.photo ? (
                <img
                  src={user.photo}
                  alt={user.name}
                  className="w-11 h-11 object-cover rounded-full hover:ring-2 hover:ring-[#6366f1] transition-shadow cursor-pointer"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-[#2a2a35] flex items-center justify-center font-semibold text-[#888] hover:ring-2 hover:ring-[#6366f1] transition-shadow cursor-pointer">
                  {user.name[0]}
                </div>
              )}
            </div>
            <div className="flex-1 font-medium">{user.name}</div>
            <div
              className={`font-semibold text-[0.95rem] ${user.balance_cents < 0 ? 'text-[#f87171]' : 'text-[#4ade80]'}`}
            >
              {formatCents(user.balance_cents)}
            </div>
          </button>
        ))}
        {sortedUsers.length === 0 && (
          <p className="text-[#666] text-center py-8">No users yet</p>
        )}
        <button
          className="flex items-center gap-3 px-4 py-3 bg-transparent border border-dashed border-[#2a2a35] rounded-xl cursor-pointer transition-[border-color] duration-150 w-full text-left text-[#888] hover:border-[#6366f1]"
          onClick={() => setShowNewUser(true)}
        >
          <div className="w-11 h-11 rounded-full bg-[#2a2a35] flex items-center justify-center text-xl text-[#888] shrink-0">
            <MdAdd />
          </div>
          <div className="flex-1 font-medium">Add User</div>
        </button>
      </div>

      {showNewUser && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4"
          onClick={() => {
            setShowNewUser(false)
            setNewUserName('')
            setNewUserPhoto(null)
          }}
        >
          <div
            className="bg-[#1a1a22] rounded-2xl p-6 w-full max-w-[500px] max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg">New User</h2>
              <button
                className="bg-transparent border-none text-[#888] text-[1.4rem] cursor-pointer flex p-1"
                onClick={() => {
                  setShowNewUser(false)
                  setNewUserName('')
                  setNewUserPhoto(null)
                }}
              >
                <MdClose />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                autoFocus
                className="px-4 py-3 rounded-lg border border-[#333] bg-[#0f0f13] text-[#e8e8eb] text-base"
              />
              <div className="flex gap-4 items-center">
                {newUserPhoto ? (
                  <img
                    src={newUserPhoto}
                    alt="preview"
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-[#2a2a35] flex items-center justify-center text-xs text-[#666]">
                    No photo
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <button
                    className="px-4 py-2 rounded-lg border border-[#444] bg-transparent text-[#ccc] text-sm cursor-pointer flex items-center gap-1"
                    onClick={() => setShowNewUserCamera(true)}
                  >
                    <MdCameraAlt /> Camera
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg border border-[#444] bg-transparent text-[#ccc] text-sm cursor-pointer flex items-center gap-1"
                    onClick={() => newUserFileRef.current?.click()}
                  >
                    Upload
                  </button>
                  <input
                    ref={newUserFileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleNewUserFile}
                    hidden
                  />
                </div>
              </div>
              <button
                className="px-6 py-3 rounded-lg border-none bg-[#6366f1] text-white text-[0.95rem] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-default"
                onClick={createUser}
                disabled={!newUserName.trim()}
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewUserCamera && (
        <CameraCapture
          onCapture={(data) => {
            setNewUserPhoto(data)
            setShowNewUserCamera(false)
          }}
          onClose={() => setShowNewUserCamera(false)}
        />
      )}

      {profileUser && (
        <UserProfileModal
          user={profileUser}
          onClose={() => setProfileUser(null)}
          onSaved={onRefreshUsers}
        />
      )}
    </div>
  )
}

// ── Settings Tab ──

function SettingsTab({
  items,
  onRefreshItems,
}: {
  items: CatalogItem[]
  onRefreshItems: () => void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingPhotoItem, setEditingPhotoItem] = useState<CatalogItem | null>(null)
  const [editPhoto, setEditPhoto] = useState<string | null>(null)
  const [showEditCamera, setShowEditCamera] = useState(false)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const cents = Math.round(parseFloat(price) * 100)
    if (!name.trim() || isNaN(cents) || cents < 0) return
    setSubmitting(true)
    const res = await adminPost('/api/fridge/items', {
      name: name.trim(),
      price_cents: cents,
      photo,
    })
    if (res.ok) {
      setName('')
      setPrice('')
      setPhoto(null)
      onRefreshItems()
    }
    setSubmitting(false)
  }

  const toggleArchive = async (item: CatalogItem) => {
    await adminPatch(`/api/fridge/items/${item.id}`, { archived: !item.archived })
    onRefreshItems()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const data = await resizeImage(file)
    setPhoto(data)
  }

  const handleEditFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const data = await resizeImage(file)
    setEditPhoto(data)
  }

  const savePhoto = async () => {
    if (!editingPhotoItem) return
    setSavingPhoto(true)
    const res = await adminPatch(`/api/fridge/items/${editingPhotoItem.id}`, { photo: editPhoto })
    if (res.ok) {
      onRefreshItems()
      setEditingPhotoItem(null)
      setEditPhoto(null)
    }
    setSavingPhoto(false)
  }

  const activeItems = items.filter((i) => !i.archived)
  const archivedItems = items.filter((i) => i.archived)

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx)
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  const handleDrop = async (idx: number) => {
    if (draggedIdx === null || draggedIdx === idx) {
      setDraggedIdx(null)
      setDragOverIdx(null)
      return
    }
    const reordered = [...activeItems]
    const [moved] = reordered.splice(draggedIdx, 1)
    reordered.splice(idx, 0, moved)
    setDraggedIdx(null)
    setDragOverIdx(null)
    await adminPut('/api/fridge/items/reorder', { order: reordered.map((i) => i.id) })
    onRefreshItems()
  }

  const handleTouchStart = (idx: number) => {
    setDraggedIdx(idx)
  }

  return (
    <div className="max-w-[900px] mx-auto relative">
      <h2 className="text-lg text-[#ccc] mb-3">Add Catalog Item</h2>
      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 p-4 bg-[#1a1a22] rounded-xl mb-6"
      >
        <input
          type="text"
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-4 py-3 rounded-lg border border-[#333] bg-[#0f0f13] text-[#e8e8eb] text-base"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="flex-1 px-4 py-3 rounded-lg border border-[#333] bg-[#0f0f13] text-[#e8e8eb] text-base"
          />
          <span className="text-xl text-[#888]">€</span>
        </div>
        <div className="flex gap-4 items-center">
          {photo ? (
            <img src={photo} alt="preview" className="w-20 h-20 object-cover rounded-lg" />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-[#2a2a35] flex items-center justify-center text-xs text-[#666]">
              No photo
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-[#444] bg-transparent text-[#ccc] text-sm cursor-pointer flex items-center gap-1"
              onClick={() => setShowCamera(true)}
            >
              <MdCameraAlt /> Camera
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-[#444] bg-transparent text-[#ccc] text-sm cursor-pointer flex items-center gap-1"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              hidden
            />
          </div>
        </div>
        <button
          type="submit"
          className="px-6 py-3 rounded-lg border-none bg-[#6366f1] text-white text-[0.95rem] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-default"
          disabled={submitting || !name.trim() || price === ''}
        >
          {submitting ? 'Adding…' : 'Add Item'}
        </button>
      </form>

      <h2 className="text-lg text-[#ccc] mb-3">Catalog Items</h2>
      <div className="flex flex-col gap-2 mb-4">
        {activeItems.map((item, idx) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={() => {
              setDraggedIdx(null)
              setDragOverIdx(null)
            }}
            onTouchStart={() => handleTouchStart(idx)}
            className={`flex items-center gap-3 px-3 py-2.5 bg-[#1a1a22] rounded-lg transition-opacity ${
              draggedIdx === idx ? 'opacity-40' : ''
            } ${dragOverIdx === idx && draggedIdx !== idx ? 'ring-2 ring-[#6366f1]' : ''}`}
          >
            <div className="text-[#555] cursor-grab active:cursor-grabbing touch-none flex items-center">
              <MdDragHandle className="text-xl" />
            </div>
            {item.photo ? (
              <img
                src={item.photo}
                alt={item.name}
                className="w-11 h-11 object-cover rounded-lg shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-lg bg-[#2a2a35] flex items-center justify-center font-semibold text-[#888] shrink-0">
                {item.name[0]}
              </div>
            )}
            <div className="flex-1">
              <div className="font-medium text-sm">{item.name}</div>
              <div className="text-[#888] text-xs">{formatCents(item.price_cents)}</div>
            </div>
            <button
              className="bg-transparent border-none text-[#888] text-[1.3rem] cursor-pointer flex p-1 hover:text-[#6366f1]"
              onClick={() => {
                setEditingPhotoItem(item)
                setEditPhoto(item.photo)
              }}
              title="Change photo"
            >
              <MdEdit />
            </button>
            <button
              className="bg-transparent border-none text-[#888] text-[1.3rem] cursor-pointer flex p-1 hover:text-[#f87171]"
              onClick={() => toggleArchive(item)}
              title="Archive"
            >
              <MdArchive />
            </button>
          </div>
        ))}
        {activeItems.length === 0 && (
          <p className="text-[#666] text-center py-8">No items yet</p>
        )}
      </div>

      {archivedItems.length > 0 && (
        <>
          <button
            className="bg-transparent border-none text-[#6366f1] text-sm cursor-pointer py-2"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? 'Hide' : 'Show'} archived ({archivedItems.length})
          </button>
          {showArchived && (
            <div className="flex flex-col gap-2 mt-2">
              {archivedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-3 py-2.5 bg-[#1a1a22] rounded-lg opacity-50"
                >
                  {item.photo ? (
                    <img
                      src={item.photo}
                      alt={item.name}
                      className="w-11 h-11 object-cover rounded-lg shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-[#2a2a35] flex items-center justify-center font-semibold text-[#888] shrink-0">
                      {item.name[0]}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-[#888] text-xs">{formatCents(item.price_cents)}</div>
                  </div>
                  <button
                    className="bg-transparent border-none text-[#888] text-[1.3rem] cursor-pointer flex p-1 hover:text-[#6366f1]"
                    onClick={() => {
                      setEditingPhotoItem(item)
                      setEditPhoto(item.photo)
                    }}
                    title="Change photo"
                  >
                    <MdEdit />
                  </button>
                  <button
                    className="bg-transparent border-none text-[#888] text-[1.3rem] cursor-pointer flex p-1 hover:text-[#f87171]"
                    onClick={() => toggleArchive(item)}
                    title="Unarchive"
                  >
                    <MdUnarchive />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editingPhotoItem && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4"
          onClick={() => {
            setEditingPhotoItem(null)
            setEditPhoto(null)
          }}
        >
          <div
            className="bg-[#1a1a22] rounded-2xl p-6 w-full max-w-[500px] max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg">Change Photo — {editingPhotoItem.name}</h2>
              <button
                className="bg-transparent border-none text-[#888] text-[1.4rem] cursor-pointer flex p-1"
                onClick={() => {
                  setEditingPhotoItem(null)
                  setEditPhoto(null)
                }}
              >
                <MdClose />
              </button>
            </div>
            <div className="flex gap-4 items-center mb-4">
              {editPhoto ? (
                <img src={editPhoto} alt="preview" className="w-20 h-20 object-cover rounded-lg" />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-[#2a2a35] flex items-center justify-center text-xs text-[#666]">
                  No photo
                </div>
              )}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-[#444] bg-transparent text-[#ccc] text-sm cursor-pointer flex items-center gap-1"
                  onClick={() => setShowEditCamera(true)}
                >
                  <MdCameraAlt /> Camera
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-[#444] bg-transparent text-[#ccc] text-sm cursor-pointer flex items-center gap-1"
                  onClick={() => editFileInputRef.current?.click()}
                >
                  Upload
                </button>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleEditFileSelect}
                  hidden
                />
                {editPhoto && (
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border border-[#444] bg-transparent text-[#f87171] text-sm cursor-pointer"
                    onClick={() => setEditPhoto(null)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <button
              className="w-full px-6 py-3 rounded-lg border-none bg-[#6366f1] text-white text-[0.95rem] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-default"
              onClick={savePhoto}
              disabled={savingPhoto}
            >
              {savingPhoto ? 'Saving…' : 'Save Photo'}
            </button>
          </div>
        </div>
      )}

      {showEditCamera && (
        <CameraCapture
          onCapture={(data) => {
            setEditPhoto(data)
            setShowEditCamera(false)
          }}
          onClose={() => setShowEditCamera(false)}
        />
      )}

      {showCamera && (
        <CameraCapture
          onCapture={(data) => {
            setPhoto(data)
            setShowCamera(false)
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}

// ── Main Page ──

export default function FridgeInventoryPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('catalog')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [users, setUsers] = useState<FridgeUser[]>([])

  const loadItems = useCallback(async () => {
    const res = await adminFetch('/api/fridge/items')
    if (res.ok) {
      const data = await res.json()
      setItems(data.items)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    const res = await adminFetch('/api/fridge/users')
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users)
    }
  }, [])

  useEffect(() => {
    checkAdminSession().then((ok) => {
      setAuthed(ok)
      if (ok) {
        loadItems()
        loadUsers()
      }
    })
  }, [loadItems, loadUsers])

  const handleLogin = () => {
    setAuthed(true)
    loadItems()
    loadUsers()
  }

  if (authed === null) {
    return (
      <>
        <Head>
          <title>Fridge Inventory</title>
        </Head>
        <div className="flex items-center justify-center h-dvh text-xl text-[#888] bg-[#0f0f13] text-[#e8e8eb]">
          Loading…
        </div>
      </>
    )
  }

  if (!authed) {
    return (
      <>
        <Head>
          <title>Fridge Inventory</title>
        </Head>
        <div className="bg-[#0f0f13] text-[#e8e8eb]">
          <LoginScreen onLogin={handleLogin} />
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Fridge Inventory</title>
      </Head>
      <div className="flex flex-col h-dvh bg-[#0f0f13] text-[#e8e8eb] font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif] [&_*]:box-border [-webkit-tap-highlight-color:transparent]">
        <nav className="flex border-b border-[#2a2a35] bg-[#1a1a22] shrink-0 pt-[env(safe-area-inset-top,0)]">
          <button
            className={`flex-1 flex flex-col items-center gap-1 py-3 border-none bg-transparent text-sm cursor-pointer transition-colors duration-150 [&>svg]:text-3xl ${activeTab === 'catalog' ? 'text-[#6366f1]' : 'text-[#666]'}`}
            onClick={() => setActiveTab('catalog')}
          >
            <MdGridView />
            <span>Catalog</span>
          </button>
          <button
            className={`flex-1 flex flex-col items-center gap-1 py-3 border-none bg-transparent text-sm cursor-pointer transition-colors duration-150 [&>svg]:text-3xl ${activeTab === 'tabs' ? 'text-[#6366f1]' : 'text-[#666]'}`}
            onClick={() => setActiveTab('tabs')}
          >
            <MdReceiptLong />
            <span>Tabs</span>
          </button>
        </nav>
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'catalog' && (
            <ItemsTab
              items={items}
              users={users}
              onRefreshUsers={loadUsers}
              onRefreshItems={loadItems}
            />
          )}
          {activeTab === 'tabs' && <TabsTab users={users} onRefreshUsers={loadUsers} />}
        </div>
      </div>
    </>
  )
}
