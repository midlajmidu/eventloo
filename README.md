# 🏆 Eventloo — Next-Gen School & Campus Event Management System

<div align="center">

![Eventloo Banner](frontend/public/eventloo-loop-logo.svg)

**A high-performance, multi-tenant platform designed for educational institutions to organize, manage, score, and celebrate large-scale arts fests, cultural competitions, and sports meets.**

[![Django](https://img.shields.io/badge/Django-5.2-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Django REST Framework](https://img.shields.io/badge/DRF-3.18-red?style=for-the-badge)](https://www.django-rest-framework.org/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

</div>

---

## 📖 Table of Contents

- [🌟 Overview](#-overview)
- [✨ Key Features](#-key-features)
  - [🏢 Multi-Tenant School Ecosystem](#-multi-tenant-school-ecosystem)
  - [🔐 Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
  - [📅 Program Orchestration & Stages](#-program-orchestration--stages)
  - [👥 Smart Chest Numbers & Sub-Teams](#-smart-chest-numbers--sub-teams)
  - [⚖️ Multi-Judge Scoring & Points Engine](#-multi-judge-scoring--points-engine)
  - [📄 Automated PDF Document Suite](#-automated-pdf-document-suite)
  - [🛡️ Enterprise Security](#-enterprise-security)
- [🛠️ Tech Stack](#️-tech-stack)
- [📁 Project Structure](#-project-structure)
- [🚀 Quick Start & How to Run](#-quick-start--how-to-run)
  - [Prerequisites](#prerequisites)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Backend Setup (Django)](#2-backend-setup-django)
  - [3. Frontend Setup (React + Vite)](#3-frontend-setup-react--vite)
- [🌐 Port Map & Application URLs](#-port-map--application-urls)
- [⚙️ Environment Configuration](#️-environment-configuration)
  - [Backend (.env)](#backend-env)
  - [Frontend (.env)](#frontend-env)
- [💻 Management Commands Reference](#-management-commands-reference)
- [🧪 Running Tests & Quality Checks](#-running-tests--quality-checks)
- [🚀 Production Deployment](#-production-deployment)
- [📄 License](#-license)

---

## 🌟 Overview

**Eventloo** transforms complex campus event logistics into an automated, streamlined experience. From high-stakes cultural fests and inter-school competitions to multi-day sports meets, Eventloo coordinates registration, stage allocation, multi-judge score entry, real-time leaderboard calculations, and instant generation of professional PDF calling sheets, valuation sheets, and certificates.

---

## ✨ Key Features

### 🏢 Multi-Tenant School Ecosystem
- **Isolated Tenant Data**: Every school operates in an isolated environment with dedicated student rosters, teams, events, custom logos, and branding.
- **Resource Quotas**: Enforce tier limits on max active events, programs, and students per institution.
- **School Settings**: Custom grading criteria, rules, category configurations, and point distributions.

### 🔐 Role-Based Access Control (RBAC)
- **Platform Super Admin**: Multi-school oversight, institution provisioning, quota management, and global audit telemetry.
- **School Admin**: Full management over events, programs, stages, teams, students, and scoring for their school.
- **Team Manager**: Decentralized team portals where managers assign students to individual and group events without administrative bottlenecks.
- **Judges / Event Managers**: Dedicated, tamper-resistant score entry sheets.
- **Public & Live Scoreboards**: Real-time broadcast displays for students and attendees.

### 📅 Program Orchestration & Stages
- **On-Stage & Off-Stage Management**: Schedule programs across multiple physical or virtual stages.
- **Category Support**: Partition events by categories (Sub-Junior, Junior, Senior, General, Mix-Group).
- **Time Conflict Detection**: Track program duration, start/end schedules, and avoid venue overlaps.

### 👥 Smart Chest Numbers & Sub-Teams
- **Automated Chest Number Assignment**: Algorithmic generation preventing collisions across team and individual brackets.
- **Sub-Team Logic**: Handle multiple entries per team for group programs (e.g., Team A1, Team A2) with automatic leader designation.
- **Auto-Generated Team Credentials**: Automatically generate secure login credentials for each team upon creation.

### ⚖️ Multi-Judge Scoring & Points Engine
- **Multi-Judge Panel Support**: Independent mark entry for up to **3 judges** per program with tamper-resistant code-letter anonymization.
- **Real-Time Mathematical Aggregation**: Instant computation of average scores, rankings, and point distribution (1st, 2nd, 3rd places and participation points).
- **Grading Scale Integration**: Configurable grade thresholds (e.g., A, B, C) with supplementary points automatically awarded to team totals.

### 📄 Automated PDF Document Suite
- **Custom Certificate Generator**: Overlay recipient names, events, and ranks onto school-branded certificate backgrounds via ReportLab / WeasyPrint.
- **Stage Calling Sheets**: Official running order documents with participant rosters and chest numbers.
- **Valuation Sheets**: Standardized evaluation templates ready for judge mark tabulation.
- **Green Room & Results Sheets**: Backstage staging sheets and publishable final result rosters.

### 🛡️ Enterprise Security
- **Multi-Factor Authentication (MFA / TOTP)**: Built-in TOTP support for administrative tiers.
- **Hardened Cookies & JWT**: Secure HttpOnly cookie auth with token rotation and blacklist enforcement.
- **Strict Content Security Policy (CSP)**: Defense-in-depth CSP headers on both API and frontend build targets.
- **Upload Guards**: Strict MIME type, magic-byte inspection, and quota verification for images and documents.
- **Granular Rate Throttling**: Custom throttles on authentication, exports, and file uploads.

---

## 🛠️ Tech Stack

| Domain | Technology | Description |
| :--- | :--- | :--- |
| **Backend Core** | Django 5.2 | High-performance Python web framework |
| **API Layer** | Django REST Framework (DRF) 3.18 | RESTful JSON API endpoints |
| **Auth** | SimpleJWT + Session/Cookie Auth | Secure JWT with token rotation & MFA |
| **Frontend Framework** | React 18.2 | Component-driven user interface |
| **Build Tool** | Vite 8.2 | Ultra-fast build tool and dev server |
| **Styling** | Tailwind CSS 3.3 | Responsive, utility-first design system |
| **Icons & Charts** | Lucide React + Recharts | Modern UI icons and analytics charts |
| **PDF Generation** | ReportLab 4.5 & Pillow | Vector-accurate certificate and sheet generation |
| **Database** | SQLite (Dev) / PostgreSQL (Prod) | Relational storage with `dj-database-url` |
| **Caching** | Redis (Prod) / LocMemCache (Dev) | Fast throttling and session cache |

---

## 📁 Project Structure

```text
eventloo/
├── backend/                             # Django REST API Backend
│   ├── accounts/                        # User auth, RBAC, multi-tenancy, MFA & quotas
│   │   ├── management/commands/         # CLI commands (super admin seeding, MFA reset)
│   │   ├── migrations/                  # Database migrations
│   │   ├── models.py                    # School, User, StudentCategory, SchoolSettings
│   │   ├── serializers.py               # Authentication & User serializers
│   │   └── views.py                     # Auth & School API endpoints
│   ├── events/                          # Core Events & Scoring Engine
│   │   ├── certificate_service.py       # PDF certificate generation engine
│   │   ├── services.py                  # Sheet generation (Calling, Valuation, Results)
│   │   ├── models.py                    # Event, Program, Assignment, Result, PointsRecord
│   │   └── serializers.py               # Serializers for event models
│   ├── event_management/                # Project Configuration
│   │   ├── settings.py                  # Django settings (Security, CORS, DB, JWT)
│   │   ├── urls.py                      # Root URL router
│   │   └── wsgi.py                      # WSGI configuration
│   ├── env.example                      # Backend environment template
│   ├── manage.py                        # Django CLI entry point
│   └── requirements.txt                 # Python dependencies
├── frontend/                            # React 18 + Vite Frontend
│   ├── public/                          # Static assets, icons, logos, favicons
│   ├── src/
│   │   ├── components/
│   │   │   ├── Admin/                   # School Admin pages (Events, Teams, Students, Points)
│   │   │   ├── SuperAdmin/              # Platform Super Admin portal
│   │   │   ├── TeamManager/             # Team portal (Assignments, Roster, Points)
│   │   │   ├── Event/                   # Event-specific tools (Mark Entry, Sheets, Certificates)
│   │   │   ├── Layout/                  # Navigation bars, sidebars, responsive layouts
│   │   │   └── common/                  # Reusable UI widgets, logos, pagination
│   │   ├── services/
│   │   │   └── api.jsx                  # Axios client, interceptors & token refresh
│   │   ├── utils/
│   │   │   └── apiUtils.jsx             # API helpers & URL resolvers
│   │   ├── App.jsx                      # Main application routing
│   │   ├── index.css                    # Tailwind CSS directives & custom design tokens
│   │   └── index.jsx                    # React DOM entry point
│   ├── index.html                       # Single Page Application HTML root
│   ├── package.json                     # Frontend dependencies & npm scripts
│   ├── tailwind.config.js               # Tailwind styling theme
│   ├── vercel.json                      # Vercel deployment configuration & CSP
│   └── vite.config.mjs                  # Vite dev server (port 3002) & reverse proxy
├── .github/workflows/                   # GitHub Actions CI/CD pipelines
│   └── production-checks.yml            # CI test suite, migration check, security audit
├── start.sh                             # Production startup script (Render/Gunicorn)
└── README.md                            # Comprehensive project guide
```

---

## 🚀 Quick Start & How to Run

Follow these instructions to get the complete Eventloo stack up and running on your local machine.

### Prerequisites

Ensure you have the following installed:
- **Python 3.10+** (Python 3.11 recommended)
- **Node.js 18+** (Node.js 20 or 22 LTS recommended)
- **npm** (comes with Node.js)
- **Git**

---

### 1. Clone Repository

```bash
git clone git@github.com:midlajmidu/eventloo.git
cd eventloo
```

---

### 2. Backend Setup (Django)

1. **Create and activate a Python virtual environment:**

   ```bash
   # On macOS / Linux:
   python3 -m venv venv
   source venv/bin/activate

   # On Windows:
   python -m venv venv
   venv\Scripts\activate
   ```

2. **Install dependencies:**

   ```bash
   pip install -r backend/requirements.txt
   ```

3. **Configure environment variables:**

   Create a `.env` file in the `backend/` directory:

   ```bash
   cp backend/env.example backend/.env
   ```

   For local development, your `backend/.env` can simply be:

   ```env
   DEBUG=True
   SECRET_KEY=eventloo-local-development-secret-key-replace-in-prod
   JWT_SIGNING_KEY=eventloo-local-jwt-signing-key-replace-in-prod
   ALLOWED_HOSTS=127.0.0.1,localhost
   CORS_ALLOWED_ORIGINS=http://localhost:3002,http://localhost:3000,http://127.0.0.1:3002
   CSRF_TRUSTED_ORIGINS=http://localhost:3002,http://localhost:3000,http://127.0.0.1:3002
   ```

4. **Run database migrations:**

   ```bash
   cd backend
   python manage.py migrate
   ```

5. **Seed the Platform Super Admin:**

   Run the seeding command with your chosen password:

   ```bash
   SUPER_ADMIN_PASSWORD='YourStrongPassword123!' python manage.py seed_super_admin --email superadmin@eventloo.com
   ```

6. **Start the Django backend server:**

   > 💡 **Important:** The Vite frontend proxies to backend port **`8002`** by default. Start Django on port `8002`:

   ```bash
   python manage.py runserver 8002
   ```

   The backend API is now running at: `http://localhost:8002/api/`

---

### 3. Frontend Setup (React + Vite)

1. **Open a new terminal window** and navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. **Install npm dependencies:**

   ```bash
   npm install
   ```

3. **Start the Vite development server:**

   ```bash
   npm run dev
   ```

   The frontend will start instantly at: **`http://localhost:3002`**

---

## 🌐 Port Map & Application URLs

| Service / Portal | URL | Purpose |
| :--- | :--- | :--- |
| **Frontend Web App** | `http://localhost:3002` | Main user interface |
| **Super Admin Portal** | `http://localhost:3002/super-admin/login` | Platform administrator login |
| **School Admin & Team Login** | `http://localhost:3002/login` | School admin, team manager, judge login |
| **Backend REST API** | `http://localhost:8002/api/` | DRF endpoints |
| **Backend Admin (Django)** | `http://localhost:8002/admin/` | Standard Django admin (staff accounts) |

---

## ⚙️ Environment Configuration

### Backend (`backend/.env`)

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `DEBUG` | `False` | Toggle debug mode (`True` for local dev) |
| `SECRET_KEY` | *Required in Prod* | Django cryptographic signing key |
| `JWT_SIGNING_KEY` | *Required in Prod* | Key used for SimpleJWT token signing |
| `DATABASE_URL` | *SQLite fallback* | PostgreSQL connection URI (e.g., Supabase / RDS) |
| `DATABASE_SSL_REQUIRE` | `False` in dev | Enforce SSL for database connections |
| `REDIS_URL` | *LocMemCache in dev* | Redis cache URI for rate-limiting across workers |
| `ALLOWED_HOSTS` | `127.0.0.1,localhost` | Allowed HTTP Host headers |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3002` | Allowed frontend origins |
| `CSRF_TRUSTED_ORIGINS` | `http://localhost:3002` | Allowed CSRF origins |
| `AWS_STORAGE_BUCKET_NAME` | *(Empty in dev)* | AWS S3 bucket for private media storage |

### Frontend (`frontend/.env`)

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:8002` | Backend API base URL for development |

---

## 💻 Management Commands Reference

All commands are executed from the `backend/` directory:

- **Seed Super Admin:**
  ```bash
  SUPER_ADMIN_PASSWORD='YourPassword123' python manage.py seed_super_admin --email superadmin@eventloo.com
  ```
- **Create School Administrator:**
  ```bash
  ADMIN_PASSWORD='YourPassword123' python manage.py create_admin_user --email admin@school.com --school-code school-code
  ```
- **Reset Super Admin Password:**
  ```bash
  SUPER_ADMIN_PASSWORD='NewPassword123' python manage.py reset_super_admin_password --email superadmin@eventloo.com
  ```
- **Reset Super Admin MFA:**
  ```bash
  python manage.py reset_super_admin_mfa --email superadmin@eventloo.com
  ```
- **Recalculate Event Points:**
  ```bash
  python manage.py recalculate_points --event-id <EVENT_ID>
  ```
- **Regenerate Team Credentials:**
  ```bash
  python manage.py regenerate_team_credentials --event-id <EVENT_ID>
  ```

---

## 🧪 Running Tests & Quality Checks

### Backend Test Suite
The backend contains a test suite covering authentication, multi-tenancy isolation, permissions, scoring logic, and certificate exports:

```bash
cd backend
python manage.py test --verbosity 1
```

### Deployment Verification
Check for production security settings and pending migrations:

```bash
cd backend
python manage.py check --deploy
python manage.py makemigrations --check --dry-run
```

### Frontend Build & Audit
Verify production bundle creation and check for dependency vulnerabilities:

```bash
cd frontend
npm run build
npm audit
```

### GitHub Actions CI
The project includes automated CI (`.github/workflows/production-checks.yml`) running on every push and pull request:
- PostgreSQL 16 & Redis 7 integration testing
- Django migration check and deployment readiness
- Backend security audit (`pip-audit`)
- Secret leak scanning (`gitleaks`)
- Frontend dependency verification (`npm audit`) and production Vite build

---

## 🚀 Production Deployment

### Backend (e.g., Render / Fly.io / AWS ECS)
- Entry point configured via `start.sh` or `Procfile`.
- Run migrations: `python manage.py migrate --noinput`
- Collect static assets: `python manage.py collectstatic --noinput --clear`
- Run using Gunicorn:
  ```bash
  exec gunicorn event_management.wsgi:application \
      --bind 0.0.0.0:$PORT \
      --workers 2 \
      --threads 4 \
      --timeout 60
  ```

### Frontend (e.g., Vercel / Netlify / Cloudflare Pages)
- Framework Preset: **Vite**
- Build Command: `npm run build`
- Output Directory: `build`
- Pre-configured with security headers and rewrites in `frontend/vercel.json`.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Built with precision and care for the next generation of campus events.** 🎓✨

</div>
