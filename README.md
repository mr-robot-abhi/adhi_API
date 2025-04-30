# ⚖️ Enhanced Legal Case Management System

A full-stack legal case management platform designed to streamline legal workflows and promote collaboration between clients and lawyers. Features include secure user authentication, detailed case tracking, document uploads, role-based dashboards, real-time chat, and more.

## 🔗 Live Demo

- Frontend (Vercel): [v0-legal-case-project](https://v0-legal-case-project-eyp3lq.vercel.app/)

> 🔐 **Sample Test Users:**
- Lawyer: `lawyer@example.com` / `password123`
- Client: `client@example.com` / `password123`

---

## 📁 Repository Links

- [Backend Repository](https://github.com/mr-robot-abhi/adhi_API)
- [Frontend Repository](https://github.com/mr-robot-abhi/adhi_UI)

---

## 🧩 Tech Stack

| Layer        | Technology               |
|--------------|--------------------------|
| Frontend     | React + Next.js (Vercel) |
| Backend      | Node.js + Express        |
| Authentication | Firebase (Email & Google) |
| Database     | MongoDB Atlas            |
| Realtime     | Firebase / WebSockets    |
| State Mgmt   | Zustand (Frontend)       |
| File Uploads | Multer                   |
| Token Mgmt   | JWT                      |

---

## 🔐 Authentication Flow

### 1. Firebase Auth
- ✅ Email + Password Signup/Login
- ✅ Google Sign-In (using Firebase Auth Provider)
- 🔄 On register/login:
  - Create user in Firebase
  - Create a corresponding user document in MongoDB (with `role`, `uid`, etc.)

### 2. Role-Based Routing
- Lawyers: Redirected to `/lawyer/dashboard`
- Clients: Redirected to `/client/dashboard`

---

## 📄 Core Features

### 🧑‍⚖️ User Authentication
- Firebase Auth Integration (Google & Email/Password)
- MongoDB user creation after Firebase auth
- Email/Phone verification (Firebase)
- Role-based access (Client / Lawyer)

### 📁 Case & Document Management
- Add cases with full court/jurisdiction details
- Upload PDF/Word documents securely
- Documents linked per case
- Role-restricted access

### 💬 Collaboration
- Real-time chat (WebSocket or Firebase Realtime DB)
- Comments & updates within cases

### 🔔 Notifications
- In-app + email alerts
- Configurable notification preferences
- Future plans: SMS / push notifications

### 🔍 Advanced Filters
- Search by case number, lawyer, court, etc.
- Sort and filter documents by tags, case

### 🔐 Security
- End-to-end encryption (data in-transit + at-rest)
- Role-based access
- Audit logs for compliance

---

## 🚀 Development Strategy

### ✅ Phase 1 – Authentication
- Firebase email/password and Google auth
- Sync Firebase users to MongoDB
- JWT generation and middleware auth
- Frontend login/logout flows

### 🔄 Phase 2 – Case & Document APIs
- Case model: Number, court, type, etc.
- File upload (Multer)
- Case <-> Document linking

### 🔄 Phase 3 – Real-Time Collaboration
- Chat integration with WebSockets or Firebase
- Case-specific comment threads

### 🔄 Phase 4 – Notifications
- In-app/email notifications via Firebase or custom service

### 🔄 Phase 5 – Search & Filtering
- Elastic filtering for cases and documents

### 🔄 Phase 6 – Deployment & CI/CD
- Frontend: Vercel
- Backend: Render / Netlify
- CI/CD with GitHub Actions
- Logs with Logtail / Papertrail

---

## 📝 Notes

- This project is under active development.
- APIs are not fully deployed yet on production.
- Use tools like VS Code + Blackbox or GitHub Copilot to fast-track backend routes.

---

## 🔧 Local Setup

### 1. Clone Repos

```bash
git clone https://github.com/mr-robot-abhi/adhi_API
git clone https://github.com/mr-robot-abhi/adhi_UI
