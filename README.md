# MyBank — Full UI Package

This package is a simple demo of MyBank with a backend and frontend.
**Not production-ready**. Uses a JSON file (`db.json`) for persistence.

## Files
- server.js — Express backend
- package.json — Node dependencies
- db.json — created on first run (stores users, transactions, broadcasts)
- public/embed.html — user-facing dashboard
- public/control-center.html — admin dashboard

## Admin credentials
- username: mywebhosting
- password: password123

## Run locally
1. `npm install`
2. `node server.js`
3. Open http://localhost:3000

Note: On Render, filesystem is ephemeral; for persistent storage use a DB.

