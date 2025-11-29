import { useState, useEffect } from 'react'
import io from 'socket.io-client'
import { ClerkProvider, SignedIn, SignedOut, useUser, SignInButton, UserButton, SignIn, SignUp } from '@clerk/clerk-react'

// Import Clerk Publishable Key from environment variables
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

// Chat Component (protected by authentication)
function ChatApp() {
  const { user, isLoaded } = useUser() // Get user from Clerk
  const [socket, setSocket] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [hasJoined, setHasJoined] = useState(false)

  // Get username from Clerk user data
  const username = user?.username || user?.firstName || user?.lastName || user?.emailAddresses?.[0]?.emailAddress || 'Anonymous'
  useEffect(() => {
    if (!isLoaded || !user) return

    console.log('Starting Socket.io connection for user:', username)
    // Create socket connection
    const testSocket = io(socketUrl, {
      transports: ['polling'], // Use only polling for simplicity
      timeout: 3000,
      autoConnect: true,
      forceNew: true
    })
    setSocket(testSocket)

    // Simple connection test
    testSocket.on('connect', () => {
      console.log('SUCCESS! Socket.io connected:', testSocket.id)
      setIsConnected(true)
    })

    testSocket.on('connect_error', (error) => {
      console.error('Connection failed:', error.type, error.description)
      setIsConnected(false)
      // Try to reconnect manually
      setTimeout(() => {
        console.log('Starting manual reconnect...')
        testSocket.connect()
      }, 2000)
    })

    testSocket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason)
      setIsConnected(false)
    })

    // Server connection confirmation
    testSocket.on('connect_confirmed', (data) => {
      // No need to redeclare username, use top-level
    })

    // Chat events - Match server events
    testSocket.on('newMessage', (messageData) => {
      setMessages(prev => [...prev, {
        id: messageData.id,
        sender: messageData.username,
        message: messageData.message,
        timestamp: messageData.timestamp,
        isSystem: false
      }])
    })

    testSocket.on('messageHistory', (history) => {
      setMessages(history.map(msg => ({
        id: msg.id,
        sender: msg.username,
        message: msg.message,
        timestamp: msg.timestamp,
        isSystem: false
      })))
    })

    testSocket.on('userJoined', (data) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'System',
        message: data.message,
        timestamp: data.timestamp,
        isSystem: true
      }])
    })

    testSocket.on('userLeft', (data) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'System', 
        message: data.message,
        timestamp: data.timestamp,
        isSystem: true
      }])
    })

    testSocket.on('usersList', (users) => {
      setOnlineUsers(users.map(user => user.username))
    })

      return () => testSocket.close();
    }, [isLoaded, user, username]);

  const joinChat = (e) => {
    if (e) e.preventDefault()
    if (username && socket && isConnected) {
      socket.emit('join', { username: username })
      setHasJoined(true)
    }
  }

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (inputMessage.trim() && socket && username) {
      const messageData = {
        sender: username,
        message: inputMessage.trim(),
        timestamp: new Date().toLocaleTimeString()
      }
      socket.emit('sendMessage', messageData)
      setInputMessage('')
    }
  }

  // If not joined yet, show join form (simplified for authenticated users)
  if (!hasJoined) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '15px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          minWidth: '350px',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <UserButton afterSignOutUrl="/" />
          </div>
          <h2 style={{ margin: '0 0 1rem 0', color: '#2d3748' }}>💬 Welcome to JBest Chat</h2>
          <p style={{ margin: '0 0 1.5rem 0', color: '#718096' }}>
            Hello, {username}!
          </p>
          <p style={{ margin: '0 0 1.5rem 0', color: '#718096' }}>
            Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </p>
          {!isConnected && (
            <div style={{ color: '#e53e3e', marginBottom: '1rem', fontWeight: 'bold' }}>
              Unable to connect to chat server.<br />
              Please check your backend server and VITE_SOCKET_URL.
            </div>
          )}
          <button
            onClick={joinChat}
            disabled={!isConnected}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: isConnected ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e2e8f0',
              color: isConnected ? 'white' : '#a0aec0',
              border: 'none',
              borderRadius: '8px',
              cursor: isConnected ? 'pointer' : 'not-allowed',
              fontSize: '1rem',
              fontWeight: '500'
            }}
          >
            {isConnected ? 'Join Chat Room' : 'Connecting...'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      padding: '1rem',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderRadius: '10px 10px 0 0',
        padding: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div>
          <h2 style={{ margin: 0, color: '#2d3748' }}>💬 JBest Chat</h2>
          <p style={{ margin: '0.5rem 0 0 0', color: '#718096', fontSize: '0.9rem' }}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'} • {onlineUsers.length} online
          </p>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <p style={{ margin: 0, color: '#4a5568', fontWeight: '500' }}>Welcome, {username}!</p>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* Chat Messages */}
      <div style={{
        background: 'white',
        height: '400px',
        overflowY: 'auto',
        padding: '1rem',
        border: '1px solid #e2e8f0'
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#718096', marginTop: '2rem' }}>
            <p>💬 Welcome to the chat! Start typing to send messages.</p>
            <p>👥 Online users: {onlineUsers.join(', ')}</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id || Date.now() + Math.random()} style={{
              background: msg.isSystem ? '#f0f8ff' : '#f7fafc',
              padding: '0.75rem',
              marginBottom: '0.5rem',
              borderRadius: '8px',
              border: `1px solid ${msg.isSystem ? '#bee3f8' : '#e2e8f0'}`
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '0.25rem',
                fontSize: '0.8rem',
                color: msg.isSystem ? '#2b6cb0' : '#4a5568'
              }}>
                <strong>{msg.sender}</strong>
                <span>{msg.timestamp}</span>
              </div>
          <div style={{ 
            color: msg.isSystem ? '#2b6cb0' : '#2d3748',
            fontStyle: msg.isSystem ? 'italic' : 'normal'
          }}>
            {msg.message}
          </div>
            </div>
          ))
        )}
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} style={{
        background: 'white',
        borderRadius: '0 0 10px 10px',
        padding: '1rem',
        display: 'flex',
        gap: '0.5rem',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
      }}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={!isConnected}
          style={{
            flex: 1,
            padding: '0.75rem',
            border: '2px solid #e2e8f0',
            borderRadius: '25px',
            outline: 'none',
            fontSize: '1rem',
            opacity: isConnected ? 1 : 0.5
          }}
        />
        <button
          type="submit"
          disabled={!inputMessage.trim() || !isConnected}
          style={{
            padding: '0.75rem 1.5rem',
            background: (inputMessage.trim() && isConnected) ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e2e8f0',
            color: (inputMessage.trim() && isConnected) ? 'white' : '#a0aec0',
            border: 'none',
            borderRadius: '25px',
            cursor: (inputMessage.trim() && isConnected) ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
            fontWeight: '500'
          }}
        >
          Send 📤
        </button>
      </form>
    </div>
  )
}

// Main App component with Clerk Provider
function App() {
  if (!clerkPubKey) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '15px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          textAlign: 'center',
          minWidth: '400px'
        }}>
          <h2 style={{ margin: '0 0 1rem 0', color: '#e53e3e' }}>⚠️ Configuration Error</h2>
          <p style={{ margin: '0 0 1.5rem 0', color: '#718096' }}>
            Please set your VITE_CLERK_PUBLISHABLE_KEY in the .env.local file
          </p>
          <p style={{ fontSize: '0.9rem', color: '#4a5568' }}>
            1. Create a Clerk account at <a href="https://dashboard.clerk.com/" target="_blank" rel="noopener noreferrer">dashboard.clerk.com</a><br/>
            2. Get your publishable key<br/>
            3. Add it to client/.env.local
          </p>
        </div>
      </div>
    )
  }

  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <div style={{ minHeight: '100vh' }}>
        <SignedOut>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Arial, sans-serif'
          }}>
            <div style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '15px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              textAlign: 'center',
              minWidth: '300px'
            }}>
              <h1 style={{ margin: '0 0 1rem 0', color: '#2d3748' }}>💬 JBest Chat</h1>
              <p style={{ margin: '0 0 2rem 0', color: '#718096' }}>
                Professional Communication Platform
              </p>
              <SignInButton mode="modal">
                <button style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500'
                }}>
                  Sign In to Chat
                </button>
              </SignInButton>
            </div>
          </div>
        </SignedOut>
        
        <SignedIn>
          <ChatApp />
        </SignedIn>
      </div>
    </ClerkProvider>
  )
}

export default App
