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
} from 'react-icons/md'
import { loginAdmin, checkAdminSession } from '../utils/adminAuth'

// ── Types ──

type CatalogItem = {
  id: number
  name: string
  price_cents: number
  photo: string | null
  archived: boolean
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
    <div className="fridge-login">
      <form onSubmit={handleSubmit}>
        <h1>Fridge Inventory</h1>
        <input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Login'}
        </button>
        {error && <p className="error">Wrong password</p>}
      </form>
    </div>
  )
}

// ── Camera Capture Modal ──

function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (data: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
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
  }, [])

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal camera-modal" onClick={(e) => e.stopPropagation()}>
        <video ref={videoRef} autoPlay playsInline muted />
        <div className="camera-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={capture}>
            Take Photo
          </button>
        </div>
      </div>
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
    <div className="tab-content">
      {/* Recent purchases toast */}
      {recentPurchases && recentPurchases.length > 0 && (
        <div className="recent-purchases">
          {recentPurchases.map((p) => (
            <div key={p.id} className="purchase-toast">
              <span>{p.label}</span>
              <button onClick={() => cancelPurchase(p.id)} className="btn-cancel">
                <MdCancel /> Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="catalog-header">
        <button className="btn-gear" onClick={() => setShowManage(true)} title="Manage Catalog">
          <MdSettings />
        </button>
      </div>

      {/* Items grid */}
      <div className="items-grid">
        {activeItems.map((item) => (
          <button key={item.id} className="item-card" onClick={() => setSelectedItem(item)}>
            {item.photo ? (
              <img src={item.photo} alt={item.name} className="item-photo" />
            ) : (
              <div className="item-photo-placeholder">{item.name[0]}</div>
            )}
            <div className="item-name">{item.name}</div>
            <div className="item-price">{formatCents(item.price_cents)}</div>
          </button>
        ))}
      </div>

      {/* Manage catalog modal */}
      {showManage && (
        <div className="modal-overlay" onClick={() => setShowManage(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Manage Catalog</h2>
              <button className="btn-icon" onClick={() => setShowManage(false)}>
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
          className="modal-overlay"
          onClick={() => {
            setSelectedItem(null)
            setQuantity(1)
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add {selectedItem.name} to tab</h2>
              <button
                className="btn-icon"
                onClick={() => {
                  setSelectedItem(null)
                  setQuantity(1)
                }}
              >
                <MdClose />
              </button>
            </div>
            <div className="quantity-row">
              <label>Quantity:</label>
              <button className="btn-qty" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                −
              </button>
              <span className="qty-value">{quantity}</span>
              <button className="btn-qty" onClick={() => setQuantity(quantity + 1)}>
                +
              </button>
              <span className="qty-total">{formatCents(selectedItem.price_cents * quantity)}</span>
            </div>
            <div className="users-grid">
              {users.map((user) => (
                <button
                  key={user.id}
                  className="user-card"
                  onClick={() => addToTab(user.id, user.name)}
                >
                  {user.photo ? (
                    <img src={user.photo} alt={user.name} className="user-photo" />
                  ) : (
                    <div className="user-photo-placeholder">{user.name[0]}</div>
                  )}
                  <div className="user-card-name">{user.name}</div>
                </button>
              ))}
              <button className="user-card add-user-card" onClick={() => setShowNewUser(true)}>
                <div className="user-photo-placeholder">
                  <MdAdd />
                </div>
                <div className="user-card-name">New User</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New user modal */}
      {showNewUser && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowNewUser(false)
            setNewUserName('')
            setNewUserPhoto(null)
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New User</h2>
              <button
                className="btn-icon"
                onClick={() => {
                  setShowNewUser(false)
                  setNewUserName('')
                  setNewUserPhoto(null)
                }}
              >
                <MdClose />
              </button>
            </div>
            <div className="new-user-form">
              <input
                type="text"
                placeholder="Name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                autoFocus
              />
              <div className="photo-options">
                {newUserPhoto ? (
                  <img src={newUserPhoto} alt="preview" className="photo-preview" />
                ) : (
                  <div className="photo-preview-placeholder">No photo</div>
                )}
                <div className="photo-buttons">
                  <button className="btn-secondary" onClick={() => setShowCamera(true)}>
                    <MdCameraAlt /> Camera
                  </button>
                  <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
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
                className="btn-primary"
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
    </div>
  )
}

// ── Tabs Tab ──

function TabsTab({ users, onRefreshUsers }: { users: FridgeUser[]; onRefreshUsers: () => void }) {
  const [selectedUser, setSelectedUser] = useState<FridgeUser | null>(null)
  const [history, setHistory] = useState<Transaction[]>([])
  const [showPay, setShowPay] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(false)

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

  const sortedUsers = [...users].sort((a, b) => a.balance_cents - b.balance_cents)

  if (selectedUser) {
    const currentUser = users.find((u) => u.id === selectedUser.id) || selectedUser
    return (
      <div className="tab-content">
        <button
          className="btn-back"
          onClick={() => {
            setSelectedUser(null)
            setHistory([])
          }}
        >
          ← Back
        </button>
        <div className="user-detail-header">
          {currentUser.photo ? (
            <img src={currentUser.photo} alt={currentUser.name} className="user-detail-photo" />
          ) : (
            <div className="user-detail-photo-placeholder">{currentUser.name[0]}</div>
          )}
          <div>
            <h2>{currentUser.name}</h2>
            <div className={`balance ${currentUser.balance_cents < 0 ? 'negative' : 'positive'}`}>
              {formatCents(currentUser.balance_cents)}
            </div>
          </div>
        </div>

        <button className="btn-primary pay-btn" onClick={() => setShowPay(true)}>
          Record Payment
        </button>

        {showPay && (
          <div className="modal-overlay" onClick={() => setShowPay(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Record Payment</h2>
                <button className="btn-icon" onClick={() => setShowPay(false)}>
                  <MdClose />
                </button>
              </div>
              <div className="pay-form">
                <div className="pay-input-row">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    autoFocus
                  />
                  <span className="currency-sign">€</span>
                </div>
                <button className="btn-primary" onClick={handlePay} disabled={!payAmount}>
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        )}

        <h3>History</h3>
        {loadingHistory ? (
          <p className="loading-text">Loading…</p>
        ) : (
          <div className="history-list">
            {history.map((tx) => {
              const canCancel = Date.now() - new Date(tx.created_at).getTime() < CANCEL_WINDOW_MS
              return (
                <div key={tx.id} className="history-item">
                  <div className="history-info">
                    <div className="history-label">
                      {tx.type === 'purchase'
                        ? `${tx.quantity}x ${tx.item_name || 'Unknown'}`
                        : 'Payment'}
                    </div>
                    <div className="history-date">{new Date(tx.created_at).toLocaleString()}</div>
                  </div>
                  <div
                    className={`history-amount ${tx.amount_cents >= 0 ? 'positive' : 'negative'}`}
                  >
                    {formatCents(tx.amount_cents)}
                  </div>
                  {canCancel && (
                    <button className="btn-cancel-small" onClick={() => cancelTransaction(tx.id)}>
                      <MdCancel />
                    </button>
                  )}
                </div>
              )
            })}
            {history.length === 0 && <p className="empty-text">No transactions yet</p>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="tab-content">
      <h2 className="section-title">Tabs</h2>
      <div className="tabs-list">
        {sortedUsers.map((user) => (
          <button key={user.id} className="tab-list-item" onClick={() => selectUser(user)}>
            {user.photo ? (
              <img src={user.photo} alt={user.name} className="tab-user-photo" />
            ) : (
              <div className="tab-user-photo-placeholder">{user.name[0]}</div>
            )}
            <div className="tab-user-name">{user.name}</div>
            <div className={`tab-user-balance ${user.balance_cents < 0 ? 'negative' : 'positive'}`}>
              {formatCents(user.balance_cents)}
            </div>
          </button>
        ))}
        {sortedUsers.length === 0 && <p className="empty-text">No users yet</p>}
      </div>
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const cents = Math.round(parseFloat(price) * 100)
    if (!name.trim() || isNaN(cents) || cents <= 0) return
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

  const activeItems = items.filter((i) => !i.archived)
  const archivedItems = items.filter((i) => i.archived)

  return (
    <div className="tab-content">
      <h2 className="section-title">Add Catalog Item</h2>
      <form onSubmit={handleAdd} className="add-item-form">
        <input
          type="text"
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="price-input-row">
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <span className="currency-sign">€</span>
        </div>
        <div className="photo-options">
          {photo ? (
            <img src={photo} alt="preview" className="photo-preview" />
          ) : (
            <div className="photo-preview-placeholder">No photo</div>
          )}
          <div className="photo-buttons">
            <button type="button" className="btn-secondary" onClick={() => setShowCamera(true)}>
              <MdCameraAlt /> Camera
            </button>
            <button
              type="button"
              className="btn-secondary"
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
          className="btn-primary"
          disabled={submitting || !name.trim() || !price}
        >
          {submitting ? 'Adding…' : 'Add Item'}
        </button>
      </form>

      <h2 className="section-title">Catalog Items</h2>
      <div className="settings-items-list">
        {activeItems.map((item) => (
          <div key={item.id} className="settings-item">
            {item.photo ? (
              <img src={item.photo} alt={item.name} className="settings-item-photo" />
            ) : (
              <div className="settings-item-photo-placeholder">{item.name[0]}</div>
            )}
            <div className="settings-item-info">
              <div className="settings-item-name">{item.name}</div>
              <div className="settings-item-price">{formatCents(item.price_cents)}</div>
            </div>
            <button className="btn-archive" onClick={() => toggleArchive(item)} title="Archive">
              <MdArchive />
            </button>
          </div>
        ))}
        {activeItems.length === 0 && <p className="empty-text">No items yet</p>}
      </div>

      {archivedItems.length > 0 && (
        <>
          <button className="btn-text" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hide' : 'Show'} archived ({archivedItems.length})
          </button>
          {showArchived && (
            <div className="settings-items-list archived-list">
              {archivedItems.map((item) => (
                <div key={item.id} className="settings-item archived">
                  {item.photo ? (
                    <img src={item.photo} alt={item.name} className="settings-item-photo" />
                  ) : (
                    <div className="settings-item-photo-placeholder">{item.name[0]}</div>
                  )}
                  <div className="settings-item-info">
                    <div className="settings-item-name">{item.name}</div>
                    <div className="settings-item-price">{formatCents(item.price_cents)}</div>
                  </div>
                  <button
                    className="btn-archive"
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
        <style jsx global>
          {fridgeStyles}
        </style>
        <div className="fridge-loading">Loading…</div>
      </>
    )
  }

  if (!authed) {
    return (
      <>
        <Head>
          <title>Fridge Inventory</title>
        </Head>
        <style jsx global>
          {fridgeStyles}
        </style>
        <LoginScreen onLogin={handleLogin} />
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Fridge Inventory</title>
      </Head>
      <style jsx global>
        {fridgeStyles}
      </style>
      <div className="fridge-app">
        <div className="fridge-main">
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
        <nav className="bottom-nav">
          <button
            className={`nav-btn ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <MdGridView />
            <span>Catalog</span>
          </button>
          <button
            className={`nav-btn ${activeTab === 'tabs' ? 'active' : ''}`}
            onClick={() => setActiveTab('tabs')}
          >
            <MdReceiptLong />
            <span>Tabs</span>
          </button>
        </nav>
      </div>
    </>
  )
}

// ── Styles ──

const fridgeStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f0f13;
    color: #e8e8eb;
    -webkit-tap-highlight-color: transparent;
    overflow: hidden;
  }

  .fridge-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100dvh;
    font-size: 1.2rem;
    color: #888;
  }

  /* Login */
  .fridge-login {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100dvh;
    padding: 2rem;
  }
  .fridge-login form {
    background: #1a1a22;
    padding: 2.5rem;
    border-radius: 1rem;
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .fridge-login h1 {
    font-size: 1.5rem;
    text-align: center;
    margin-bottom: 0.5rem;
  }
  .fridge-login input {
    padding: 0.9rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid #333;
    background: #0f0f13;
    color: #e8e8eb;
    font-size: 1rem;
  }
  .fridge-login button {
    padding: 0.9rem;
    border-radius: 0.5rem;
    border: none;
    background: #6366f1;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
  }
  .fridge-login button:disabled { opacity: 0.5; }
  .fridge-login .error { color: #f87171; text-align: center; }

  /* App layout */
  .fridge-app {
    display: flex;
    flex-direction: column;
    height: 100dvh;
  }
  .fridge-main {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    padding-bottom: 1rem;
  }

  /* Bottom nav */
  .bottom-nav {
    display: flex;
    border-top: 1px solid #2a2a35;
    background: #1a1a22;
    flex-shrink: 0;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .nav-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 0.7rem 0;
    border: none;
    background: none;
    color: #666;
    font-size: 0.75rem;
    cursor: pointer;
    transition: color 0.15s;
  }
  .nav-btn svg { font-size: 1.5rem; }
  .nav-btn.active { color: #6366f1; }

  /* Tab content */
  .tab-content { max-width: 900px; margin: 0 auto; position: relative; }
  .section-title {
    font-size: 1.1rem;
    margin: 1rem 0 0.75rem;
    color: #ccc;
  }
  .section-title:first-child { margin-top: 0; }

  /* Items grid */
  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
  }
  .item-card {
    background: #1a1a22;
    border: 1px solid #2a2a35;
    border-radius: 0.75rem;
    padding: 0.75rem;
    text-align: center;
    cursor: pointer;
    transition: transform 0.1s, border-color 0.15s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
  }
  .item-card:active { transform: scale(0.97); }
  .item-card:hover { border-color: #6366f1; }
  .item-photo {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 0.5rem;
  }
  .item-photo-placeholder {
    width: 80px;
    height: 80px;
    border-radius: 0.5rem;
    background: #2a2a35;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 600;
    color: #666;
  }
  .item-name { font-weight: 500; font-size: 0.9rem; }
  .item-price { color: #6366f1; font-weight: 600; font-size: 0.85rem; }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1rem;
  }
  .modal {
    background: #1a1a22;
    border-radius: 1rem;
    padding: 1.5rem;
    width: 100%;
    max-width: 500px;
    max-height: 85dvh;
    overflow-y: auto;
  }
  .modal-large { max-width: 600px; }
  .catalog-header {
    position: fixed;
    top: 0px;
    right: 0px;
    z-index: 10;
  }
  .btn-gear {
    background: none;
    border: none;
    color: #555;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 2px;
    display: flex;
  }
  .btn-gear:hover { color: #888; }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  .modal-header h2 { font-size: 1.1rem; }

  /* Quantity */
  .quantity-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: #0f0f13;
    border-radius: 0.5rem;
  }
  .quantity-row label { color: #aaa; }
  .btn-qty {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid #444;
    background: none;
    color: #e8e8eb;
    font-size: 1.2rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .qty-value { font-size: 1.2rem; font-weight: 600; min-width: 2ch; text-align: center; }
  .qty-total { margin-left: auto; color: #6366f1; font-weight: 600; }

  /* Users grid */
  .users-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.75rem;
  }
  .user-card {
    background: #0f0f13;
    border: 1px solid #2a2a35;
    border-radius: 0.75rem;
    padding: 0.75rem;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
  }
  .user-card:hover { border-color: #6366f1; }
  .add-user-card { border-style: dashed; }
  .user-photo {
    width: 56px;
    height: 56px;
    object-fit: cover;
    border-radius: 50%;
  }
  .user-photo-placeholder {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #2a2a35;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    font-weight: 600;
    color: #888;
  }
  .user-card-name { font-size: 0.8rem; word-break: break-word; }

  /* New user form */
  .new-user-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .new-user-form input[type="text"] {
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid #333;
    background: #0f0f13;
    color: #e8e8eb;
    font-size: 1rem;
  }

  /* Photo options */
  .photo-options {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  .photo-preview {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 0.5rem;
  }
  .photo-preview-placeholder {
    width: 80px;
    height: 80px;
    border-radius: 0.5rem;
    background: #2a2a35;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    color: #666;
  }
  .photo-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* Camera modal */
  .camera-modal {
    max-width: 600px;
  }
  .camera-modal video {
    width: 100%;
    border-radius: 0.5rem;
    background: #000;
  }
  .camera-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
    justify-content: center;
  }

  /* Buttons */
  .btn-primary {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    background: #6366f1;
    color: white;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-primary:disabled { opacity: 0.5; cursor: default; }
  .btn-secondary {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid #444;
    background: none;
    color: #ccc;
    font-size: 0.85rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .btn-icon {
    background: none;
    border: none;
    color: #888;
    font-size: 1.4rem;
    cursor: pointer;
    display: flex;
    padding: 0.25rem;
  }
  .btn-text {
    background: none;
    border: none;
    color: #6366f1;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 0.5rem 0;
  }
  .btn-back {
    background: none;
    border: none;
    color: #6366f1;
    font-size: 0.95rem;
    cursor: pointer;
    padding: 0.25rem 0;
    margin-bottom: 0.75rem;
  }

  /* Recent purchases toast */
  .recent-purchases {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .purchase-toast {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 1rem;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 0.5rem;
    font-size: 0.85rem;
  }
  .btn-cancel {
    background: none;
    border: none;
    color: #f87171;
    cursor: pointer;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  /* Tabs list */
  .tabs-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .tab-list-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #1a1a22;
    border: 1px solid #2a2a35;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: border-color 0.15s;
    width: 100%;
    text-align: left;
    color: #e8e8eb;
  }
  .tab-list-item:hover { border-color: #6366f1; }
  .tab-user-photo {
    width: 44px;
    height: 44px;
    object-fit: cover;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .tab-user-photo-placeholder {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #2a2a35;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: #888;
    flex-shrink: 0;
  }
  .tab-user-name { flex: 1; font-weight: 500; }
  .tab-user-balance { font-weight: 600; font-size: 0.95rem; }

  /* Balance colors */
  .negative { color: #f87171; }
  .positive { color: #4ade80; }

  /* User detail */
  .user-detail-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .user-detail-photo {
    width: 64px;
    height: 64px;
    object-fit: cover;
    border-radius: 50%;
  }
  .user-detail-photo-placeholder {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #2a2a35;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 600;
    color: #888;
  }
  .user-detail-header h2 { font-size: 1.2rem; }
  .balance { font-size: 1.3rem; font-weight: 700; }
  .pay-btn { width: 100%; margin-bottom: 1.5rem; }

  /* Pay form */
  .pay-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .pay-input-row, .price-input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .currency-sign {
    font-size: 1.2rem;
    color: #888;
  }
  .pay-input-row input, .price-input-row input {
    flex: 1;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid #333;
    background: #0f0f13;
    color: #e8e8eb;
    font-size: 1rem;
  }

  /* History */
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .history-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    background: #1a1a22;
    border-radius: 0.5rem;
  }
  .history-info { flex: 1; }
  .history-label { font-size: 0.9rem; font-weight: 500; }
  .history-date { font-size: 0.75rem; color: #666; margin-top: 0.15rem; }
  .history-amount { font-weight: 600; font-size: 0.9rem; white-space: nowrap; }
  .btn-cancel-small {
    background: none;
    border: none;
    color: #f87171;
    cursor: pointer;
    font-size: 1.2rem;
    display: flex;
    padding: 0.25rem;
    flex-shrink: 0;
  }

  /* Settings items list */
  .settings-items-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .settings-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    background: #1a1a22;
    border-radius: 0.5rem;
  }
  .settings-item.archived { opacity: 0.5; }
  .settings-item-photo {
    width: 44px;
    height: 44px;
    object-fit: cover;
    border-radius: 0.5rem;
    flex-shrink: 0;
  }
  .settings-item-photo-placeholder {
    width: 44px;
    height: 44px;
    border-radius: 0.5rem;
    background: #2a2a35;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: #888;
    flex-shrink: 0;
  }
  .settings-item-info { flex: 1; }
  .settings-item-name { font-weight: 500; font-size: 0.9rem; }
  .settings-item-price { color: #888; font-size: 0.8rem; }
  .btn-archive {
    background: none;
    border: none;
    color: #888;
    font-size: 1.3rem;
    cursor: pointer;
    display: flex;
    padding: 0.25rem;
  }
  .btn-archive:hover { color: #f87171; }

  /* Add item form */
  .add-item-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: #1a1a22;
    border-radius: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .add-item-form input[type="text"] {
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid #333;
    background: #0f0f13;
    color: #e8e8eb;
    font-size: 1rem;
  }

  .loading-text, .empty-text {
    color: #666;
    text-align: center;
    padding: 2rem;
  }

  /* Archived list */
  .archived-list { margin-top: 0.5rem; }
`
