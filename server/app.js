import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import db from './db/conn.js';
import {initializeDB} from './schema/init.js';


// Initialize tables
await initializeDB();

const app = express();

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )
`);

app.use(
  cors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  }),
);
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.send({status: 'started'});
});

// Register endpoint
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    await db.run(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, password]
    );
    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Database error' });
    }
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const {email, password} = req.body;

  try {
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      return res.status(404).json({error: 'User not found'});
    }

    if (user.password !== password) {
      return res.status(401).json({error: 'Invalid credentials'});
    }

    res
      .status(200)
      .json({
        message: 'Login successful',
        user: {id: user.id, name: user.name, email: user.email},
      });
  } catch (err) {
    res.status(500).json({error: err.message});
  }
});

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/');
//   },
//   filename: (req, file, cb) => {
//     cb(null, file.originalname);
//   },
// });
// const upload = multer({storage});

// app.post('/process-image', upload.single('photo'), (req, res) => {
//   const filePath = path.resolve('uploads', req.file.filename);

//   res.json({message: 'Image processed', filePath: filePath});

//   fs.unlinkSync(filePath);
// });

// Seed spots if empty
app.use(async (req, res, next) => {
  const spots = await db.all('SELECT * FROM spots');
  if (spots.length === 0) {
    const locations = ['A1', 'A2', 'B1', 'B2', 'C1'];
    for (const loc of locations) {
      await db.run('INSERT INTO spots (location, is_available) VALUES (?, 1)', [loc]);
    }
  }
  next();
});

// List available spots
app.get('/spots', async (req, res) => {
  try {
    const spots = await db.all('SELECT * FROM spots WHERE is_available = 1');
    res.json(spots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Book a spot
app.post('/book', async (req, res) => {
  const { user_id, spot_id } = req.body;
  try {
    // Check if spot is available
    const spot = await db.get('SELECT * FROM spots WHERE id = ? AND is_available = 1', [spot_id]);
    if (!spot) {
      return res.status(400).json({ error: 'Spot not available' });
    }
    // Mark spot as unavailable
    await db.run('UPDATE spots SET is_available = 0 WHERE id = ?', [spot_id]);
    // Create booking
    await db.run('INSERT INTO bookings (user_id, spot_id) VALUES (?, ?)', [user_id, spot_id]);
    res.json({ message: 'Spot booked successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Forgot password endpoint
app.post('/forgot-password', async (req, res) => {
  const { email, newPassword } = req.body;
  try {
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await db.run('UPDATE users SET password = ? WHERE email = ?', [newPassword, email]);
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(5001, () => {
  console.log('Server is started on port 5001');
});
