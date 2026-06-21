import { useEffect, useMemo, useState } from 'react'
import {
  Link,
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { auth, db, serverTimestamp } from './firebase'
import './App.css'

const formatTimestamp = (value) => {
  if (!value?.toDate) {
    return 'just now'
  }

  return value.toDate().toLocaleString()
}

const getConversationId = (uidA, uidB) => [uidA, uidB].sort().join('_')

function AuthPage() {
  const navigate = useNavigate()
  const [isSignup, setIsSignup] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      if (isSignup) {
        const credential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password,
        )

        await updateProfile(credential.user, {
          displayName: formData.name.trim(),
        })

        await setDoc(
          doc(db, 'users', credential.user.uid),
          {
            uid: credential.user.uid,
            displayName: formData.name.trim(),
            email: formData.email,
            bio: '',
            location: '',
            createdAt: serverTimestamp(),
          },
          { merge: true },
        )
      } else {
        await signInWithEmailAndPassword(auth, formData.email, formData.password)
      }

      navigate('/feed')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-layout">
      <section className="panel auth-panel">
        <h1>Stay</h1>
        <p>Sign up to host, find, and message people during major events.</p>
        <form className="stack" onSubmit={handleSubmit}>
          {isSignup ? (
            <label>
              Name
              <input
                required
                value={formData.name}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, email: event.target.value }))
              }
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={6}
              value={formData.password}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, password: event.target.value }))
              }
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Working…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setError('')
            setIsSignup((prev) => !prev)
          }}
        >
          {isSignup ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </button>
      </section>
    </main>
  )
}

function Shell({ user, children }) {
  return (
    <div className="layout">
      <header>
        <strong>Stay</strong>
        <nav>
          <Link to="/feed">Feed</Link>
          <Link to={`/profile/${user.uid}`}>My profile</Link>
          <Link to="/messages">Messages</Link>
          <button type="button" className="text-button" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </nav>
      </header>
      {children}
    </div>
  )
}

function FeedPage({ user }) {
  const [posts, setPosts] = useState([])
  const [formData, setFormData] = useState({ title: '', details: '', location: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'posts'), (snapshot) => {
      const nextPosts = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((a, b) => {
          const left = a.createdAt?.seconds ?? 0
          const right = b.createdAt?.seconds ?? 0
          return right - left
        })
      setPosts(nextPosts)
    })

    return unsubscribe
  }, [])

  const handleCreatePost = async (event) => {
    event.preventDefault()
    setError('')

    try {
      await addDoc(collection(db, 'posts'), {
        authorUid: user.uid,
        authorName: user.displayName || user.email,
        title: formData.title.trim(),
        details: formData.details.trim(),
        location: formData.location.trim(),
        createdAt: serverTimestamp(),
      })

      setFormData({ title: '', details: '', location: '' })
    } catch (submitError) {
      setError(submitError.message)
    }
  }

  return (
    <Shell user={user}>
      <main className="columns">
        <section className="panel">
          <h2>Host a post</h2>
          <form className="stack" onSubmit={handleCreatePost}>
            <label>
              Title
              <input
                required
                value={formData.title}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </label>
            <label>
              Details
              <textarea
                required
                rows={4}
                value={formData.details}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, details: event.target.value }))
                }
              />
            </label>
            <label>
              Location
              <input
                required
                value={formData.location}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, location: event.target.value }))
                }
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit">Publish</button>
          </form>
        </section>

        <section className="panel">
          <h2>Community feed</h2>
          <ul className="list">
            {posts.map((post) => (
              <li key={post.id}>
                <h3>{post.title}</h3>
                <p>{post.details}</p>
                <small>
                  Hosted by{' '}
                  <Link to={`/profile/${post.authorUid}`}>{post.authorName || 'Unknown'}</Link> in{' '}
                  {post.location} · {formatTimestamp(post.createdAt)}
                </small>
              </li>
            ))}
            {!posts.length ? <li>No posts yet. Be the first host.</li> : null}
          </ul>
        </section>
      </main>
    </Shell>
  )
}

function ProfilePage({ user }) {
  const { uid } = useParams()
  const isOwnProfile = uid === user.uid
  const [profile, setProfile] = useState(null)
  const [profilePosts, setProfilePosts] = useState([])
  const [formData, setFormData] = useState({ bio: '', location: '' })

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', uid), (snapshot) => {
      const data = snapshot.data() || null
      setProfile(data)
      setFormData({ bio: data?.bio || '', location: data?.location || '' })
    })

    return unsubscribe
  }, [uid])

  useEffect(() => {
    const profilePostsQuery = query(
      collection(db, 'posts'),
      where('authorUid', '==', uid),
    )

    const unsubscribe = onSnapshot(profilePostsQuery, (snapshot) => {
      const nextPosts = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      setProfilePosts(nextPosts)
    })

    return unsubscribe
  }, [uid])

  const saveProfile = async (event) => {
    event.preventDefault()

    await setDoc(
      doc(db, 'users', uid),
      {
        uid,
        displayName: profile?.displayName || user.displayName || user.email,
        email: profile?.email || user.email,
        bio: formData.bio.trim(),
        location: formData.location.trim(),
      },
      { merge: true },
    )
  }

  return (
    <Shell user={user}>
      <main className="columns single">
        <section className="panel">
          <h2>{profile?.displayName || 'Profile'}</h2>
          <p>{profile?.email || 'No email available'}</p>
          <p>{profile?.bio || 'No bio yet.'}</p>
          <p>{profile?.location || 'No location set.'}</p>

          {isOwnProfile ? (
            <form className="stack" onSubmit={saveProfile}>
              <label>
                Bio
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, bio: event.target.value }))
                  }
                />
              </label>
              <label>
                Location
                <input
                  value={formData.location}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, location: event.target.value }))
                  }
                />
              </label>
              <button type="submit">Save profile</button>
            </form>
          ) : null}
        </section>

        <section className="panel">
          <h2>Hosting history</h2>
          <ul className="list">
            {profilePosts.map((post) => (
              <li key={post.id}>
                <h3>{post.title}</h3>
                <p>{post.details}</p>
                <small>
                  {post.location} · {formatTimestamp(post.createdAt)}
                </small>
              </li>
            ))}
            {!profilePosts.length ? <li>No hosting posts yet.</li> : null}
          </ul>
        </section>
      </main>
    </Shell>
  )
}

function MessagesPage({ user }) {
  const [users, setUsers] = useState([])
  const [selectedUid, setSelectedUid] = useState('')
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const nextUsers = snapshot.docs
        .map((entry) => ({ uid: entry.id, ...entry.data() }))
        .filter((entry) => entry.uid !== user.uid)
      setUsers(nextUsers)
    })

    return unsubscribe
  }, [user.uid])

  const activeSelectedUid =
    selectedUid && users.some((entry) => entry.uid === selectedUid)
      ? selectedUid
      : users[0]?.uid || ''

  const conversationId = useMemo(() => {
    if (!activeSelectedUid) {
      return ''
    }

    return getConversationId(user.uid, activeSelectedUid)
  }, [activeSelectedUid, user.uid])

  useEffect(() => {
    if (!conversationId) {
      return undefined
    }

    const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'))
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const nextMessages = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
      setMessages(nextMessages)
    })

    return unsubscribe
  }, [conversationId])

  const sendMessage = async (event) => {
    event.preventDefault()
    if (!conversationId || !text.trim()) {
      return
    }

    await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
      senderUid: user.uid,
      senderName: user.displayName || user.email,
      text: text.trim(),
      createdAt: serverTimestamp(),
    })

    setText('')
  }

  const selectedUser = users.find((entry) => entry.uid === activeSelectedUid)
  const visibleMessages = conversationId ? messages : []

  return (
    <Shell user={user}>
      <main className="columns">
        <section className="panel">
          <h2>People</h2>
          <ul className="list selectable">
            {users.map((entry) => (
              <li key={entry.uid}>
                <button
                  type="button"
                  className={entry.uid === activeSelectedUid ? 'selected' : ''}
                  onClick={() => setSelectedUid(entry.uid)}
                >
                  <strong>{entry.displayName || entry.email}</strong>
                  <small>{entry.location || 'No location yet'}</small>
                </button>
              </li>
            ))}
            {!users.length ? <li>No other users available yet.</li> : null}
          </ul>
        </section>

        <section className="panel">
          <h2>
            {selectedUser
              ? `Direct messages with ${selectedUser.displayName || selectedUser.email}`
              : 'Direct messages'}
          </h2>
          <ul className="list messages">
            {visibleMessages.map((message) => (
              <li key={message.id}>
                <strong>{message.senderName}</strong>
                <p>{message.text}</p>
                <small>{formatTimestamp(message.createdAt)}</small>
              </li>
            ))}
            {selectedUser && !visibleMessages.length ? <li>No messages yet. Start the chat.</li> : null}
          </ul>
          {selectedUser ? (
            <form className="message-form" onSubmit={sendMessage}>
              <input
                value={text}
                placeholder="Write a message"
                onChange={(event) => setText(event.target.value)}
              />
              <button type="submit">Send</button>
            </form>
          ) : null}
        </section>
      </main>
    </Shell>
  )
}

function ProtectedRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return children
}

function App() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)
      setIsLoading(false)

      if (nextUser) {
        await setDoc(
          doc(db, 'users', nextUser.uid),
          {
            uid: nextUser.uid,
            displayName: nextUser.displayName || nextUser.email,
            email: nextUser.email,
          },
          { merge: true },
        )
      }
    })

    return unsubscribe
  }, [])

  if (isLoading) {
    return <main className="auth-layout">Loading…</main>
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to={user ? '/feed' : '/auth'} replace />} />
        <Route path="/auth" element={user ? <Navigate to="/feed" replace /> : <AuthPage />} />
        <Route
          path="/feed"
          element={
            <ProtectedRoute user={user}>
              <FeedPage user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:uid"
          element={
            <ProtectedRoute user={user}>
              <ProfilePage user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute user={user}>
              <MessagesPage user={user} />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  )
}

export default App
