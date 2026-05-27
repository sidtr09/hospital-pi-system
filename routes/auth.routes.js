'use strict';

const express = require('express');
const router  = express.Router();

// Demo credentials — replace with a proper hashed user table before production
const DEMO_USERS = [
  { id: 1, username: 'admin',  password: 'admin123',  role: 'Administrator', name: 'Admin User' },
  { id: 2, username: 'doctor', password: 'doctor123', role: 'Doctor',        name: 'Dr. Smith' },
  { id: 3, username: 'nurse',  password: 'nurse123',  role: 'Nurse',         name: 'Nurse Patel' },
];

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = DEMO_USERS.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  req.session.userId   = user.id;
  req.session.userName = user.name;
  req.session.userRole = user.role;
  res.json({ ok: true, name: user.name, role: user.role });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not logged in' });
  res.json({ name: req.session.userName, role: req.session.userRole });
});

module.exports = router;
