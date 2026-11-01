# DevFlow — MERN Project & Team Collaboration

A polished, responsive MERN starter application with a light/dark theme, JWT authentication, workspace/project/task management, dashboard analytics, and a Socket.IO-ready backend structure.

## Requirements

- Node.js 20+
- MongoDB Atlas connection string or local MongoDB
- VS Code

## Setup (Windows PowerShell)

1. Extract this ZIP.
2. Open the `DevFlow` folder in VS Code.
3. Open Terminal → New Terminal.
4. Install root and app dependencies:
   ```powershell
   npm install
   npm run install:all
   ```
5. Configure the backend:
   - Copy `server/.env.example` to `server/.env`
   - Set `MONGO_URI` and a long random `JWT_SECRET`.
6. Start both apps from the root folder:
   ```powershell
   npm run dev
   ```
7. Open http://localhost:5173

Backend runs at http://localhost:5000.

## First use

- Register an account from the Create account link.
- Sign in and create a workspace.
- Add projects and tasks from the dashboard.
- Theme switch is in the top bar.

## Run separately

```powershell
npm run dev --prefix server
npm run dev --prefix client
```

## Important

This is a runnable portfolio foundation, not a claim that every enterprise feature in the proposed 86-page product scope is already implemented. The working core includes authentication, workspace/project/task CRUD, responsive dashboard, theme persistence, API error handling and Socket.IO server setup. Chat, payments, billing, advanced analytics, invitations/email delivery, calendar/Gantt, file storage and full admin workflows are prepared as future modules and must be implemented/configured before advertising them as completed features.

## Suggested production checklist

- Use HTTPS and secure cookie settings behind a production domain.
- Add email verification, password reset, refresh-token rotation and rate limiting.
- Add RBAC checks to every protected API.
- Add automated tests and API documentation.
- Configure Cloudinary, email provider and payment provider credentials.
