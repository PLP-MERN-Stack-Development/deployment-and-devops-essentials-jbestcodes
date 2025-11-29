// JBest Chat Server - Production Ready
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

// Environment variables
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? 
  process.env.ALLOWED_ORIGINS.split(',') : 
  ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"];

// MongoDB Connection
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));
} else {
  console.log('Running without MongoDB - using in-memory storage');
}

// Message Schema (optional - for persistent storage)
const messageSchema = new mongoose.Schema({
  username: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
  room: { type: String, default: 'general' }
});

const Message = MONGODB_URI ? mongoose.model('Message', messageSchema) : null;

// Configure Socket.io with CORS
const io = socketIo(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: false
  }
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// Security headers for production
if (NODE_ENV === 'production') {
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
}

// Store active users and messages
const activeUsers = new Map();
const messages = [];

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    database: MONGODB_URI ? 'connected' : 'memory-only'
  });
});

// Basic API route
app.get('/', (req, res) => {
  res.json({
    message: 'JBest Chat Server is running!',
    status: 'online',
    users: activeUsers.size,
    totalMessages: messages.length,
    environment: NODE_ENV,
    version: '1.0.0'
  });
});

// API endpoint to get recent messages
app.get('/api/messages', async (req, res) => {
  try {
    if (Message) {
      const recentMessages = await Message.find()
        .sort({ timestamp: -1 })
        .limit(50)
        .exec();
      res.json(recentMessages.reverse());
    } else {
      res.json(messages.slice(-50));
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining
  socket.on('join', (userData) => {
    const { username } = userData;
    
    // Store user info
    activeUsers.set(socket.id, {
      id: socket.id,
      username: username,
      joinedAt: new Date().toISOString()
    });

    console.log(`${username} joined the chat`);
    
    // Notify all users about the new user
    socket.broadcast.emit('userJoined', {
      username: username,
      message: `${username} joined the chat`,
      timestamp: new Date().toISOString()
    });

    // Send current users list to the new user
    socket.emit('usersList', Array.from(activeUsers.values()));
    
    // Send recent messages to the new user
    socket.emit('messageHistory', messages.slice(-20)); // Send last 20 messages
  });

  // Handle new messages
  socket.on('sendMessage', async (messageData) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    const message = {
      id: Date.now(),
      username: user.username,
      message: messageData.message,
      timestamp: new Date().toISOString()
    };

    // Store message in memory
    messages.push(message);
    
    // Keep only last 100 messages in memory
    if (messages.length > 100) {
      messages.shift();
    }

    // Store message in MongoDB if available
    if (Message) {
      try {
        const dbMessage = new Message({
          username: message.username,
          message: message.message,
          timestamp: new Date(message.timestamp)
        });
        await dbMessage.save();
      } catch (error) {
        console.error('Error saving message to database:', error);
      }
    }

    console.log(`${user.username}: ${message.message}`);

    // Broadcast message to all users
    io.emit('newMessage', message);
  });

  // Handle typing indicators
  socket.on('typing', (isTyping) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    socket.broadcast.emit('userTyping', {
      username: user.username,
      isTyping: isTyping
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    
    if (user) {
      console.log(`${user.username} left the chat`);
      
      // Remove user from active users
      activeUsers.delete(socket.id);
      
      // Notify other users
      socket.broadcast.emit('userLeft', {
        username: user.username,
        message: `${user.username} left the chat`,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`JBest Chat Server running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Frontend should connect to http://localhost:${PORT}`);
});
