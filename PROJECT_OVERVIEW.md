# 🏆 Eventloo: School Event Management System

## 🌟 Overview
**Eventloo** is a comprehensive, modern, and high-performance management system designed specifically for educational institutions to organize and execute large-scale events, cultural fests, and sports meets. Built with a robust **Django REST Framework** backend and a sleek **React + Tailwind CSS** frontend, Eventloo transforms complex event logistics into a streamlined, automated experience.

---

## 🚀 Key Modules & Features

### 🔐 1. Advanced Authentication & Access Control
- **JWT-Based Security**: Secure communication using JSON Web Tokens with auto-refresh capabilities.
- **Multi-Role Ecosystem**:
    - **Super Admin**: Full oversight of events, teams, students, and scoring.
    - **Team Manager**: Specialized access to manage team assignments and student participations.
    - **Event Manager**: Operational access for specific event-related tasks.
- **Automated Team Credentials**: Generates unique login credentials (username/password) for every team created, facilitating decentralized management.

### 📅 2. Event & Program Orchestration
- **Flexible Event Schemas**: Support for Competitions, Cultural, Sports, Academic fests, and more.
- **Micro-Event Management**: Create "Programs" within events with specific categories (High School, Higher Secondary, General).
- **Venue & Timing**: Detailed scheduling with venue tracking and conflict-aware timing.
- **Stage vs. Off-Stage**: Built-in support for different program types for better stage management.

### 👥 3. Team & Student Management
- **Intelligent Team Numbering**: Automated sequential team numbering system.
- **Dynamic Program Assignments**: Assign students to programs as individuals or as part of a team effort.
- **Automated Chest Numbers**: An intelligent algorithm that generates chest numbers based on team affiliation and program category (e.g., Team 1 uses 100-199 range).
- **Team Profiles**: Custom branding for teams including logos, mottoes, and color codes.

### 📊 4. Competition Grading & Scoring
- **Professional Result Entry**: Support for up to **3 independent judges** per program.
- **Automated Math Engine**: Real-time calculation of total marks and average scores.
- **Ranking System**: Automatic position calculation (1st, 2nd, 3rd) based on scores.
- **Point Distribution**: Intelligent points logic (Winner: 100, Runner-up: 75, Participation: 25) that updates team standings instantly upon result publication.

### 📈 5. Monitoring & Analytics
- **Admin Dashboards**: High-level statistics on total events, teams, and students.
- **Top Performers**: Dedicated views to track leading teams and individual stars.
- **Event Insights**: Real-time participation counts and program completion tracking.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, React Router v6, Tailwind CSS |
| **Backend** | Django 4.2+, Django REST Framework (DRF) |
| **Authentication** | SimpleJWT (Access/Refresh Tokens) |
| **Database** | SQLite (Development), PostgreSQL/SQL Server (Production) |
| **API** | RESTful API with Axios integration |
| **Styling** | Modern Vanilla CSS + Utility-first Tailwind |

---

## 🏗️ Project Architecture

```text
eventloo/
├── backend/                    # Django Core
│   ├── event_management/       # Project Settings & URLs
│   ├── accounts/               # User, Role & Auth Logic
│   └── events/                 # Core Engine (Events, Teams, Marks, Points)
├── frontend/                   # React Workspace
│   ├── src/
│   │   ├── components/         # Modular UI (Admin, TeamManager, Dashboard)
│   │   ├── services/           # API Integration (Axios)
│   │   ├── utils/              # Calculation & String Helpers
│   │   └── index.css           # Global Design Tokens
│   └── tailwind.config.js      # Custom Theme Configuration
└── docs/                       # Guides & Documentation
```

---

## 🔥 Unique Selling Points

1. **Decentralized Management**: Empower Team Managers to handle their own student assignments without Admin intervention.
2. **Result Integrity**: Multi-judge mark entry minimizes bias and automates the leaderboard.
3. **Professional Aesthetics**: A "premium-feel" UI designed for high-stakes competition environments.
4. **Data Accuracy**: Hard-coded chest number logic ensures no duplicates across the entire event lifecycle.

---

**Built with precision for the next generation of campus events.** 🎓✨
