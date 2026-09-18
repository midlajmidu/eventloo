# ⚙️ Eventloo: Backend Architecture & API Strategy Plan

## 🏫 Executive Summary (For Faculty Review)
The Eventloo backend is a robust API-driven engine built using the **Django framework** (Python 3.8+). It implements a **RESTful Service Architecture (DRF)** designed for high security, data integrity, and complex business logic processing. It follows the **Model-View-Template (MVT)** pattern, where the "Template" layer is replaced by a JSON-based "API Response" layer.

---

## 🏗️ 1. Core Architecture
- **Framework**: Django 4.2+ (Python 3.8+).
- **Service Layer**: **Django REST Framework (DRF)** for building standardized, performant APIs.
- **Authentication**: **SimpleJWT** for stateless, token-based security.
- **Serialization**: DRF Serializers convert complex Model instances (DB objects) to JSON and vice-versa, ensuring strict data validation.

---

## 📊 2. Data Modeling & Infrastructure
The backend is organized into specialized "Apps" to ensure modularity and separation of concerns.

### A. `accounts` App (The Auth Engine)
- **Custom User Model**: Extends Django's default User to include specialized roles (`admin`, `team_manager`, `student`).
- **Permissions**: Custom `BasePermission` classes ensure that only admins can delete events, while team managers can only modify their own assignments.

### B. `events` App (The Business Engine)
- **Hierarchical Modeling**: `Event -> Program -> ProgramAssignment -> ProgramResult`.
- **Relational Integrity**: Uses `ForeignKey` and `ManyToManyField` to link teams and students with strict `on_delete` behaviors.
- **Team Profiles**: Metadata management for team branding (Logos, Mottoes, Colors).

---

## 🔌 3. API Design Strategy
We utilize a **Nested Routing Strategy** using `django-rest-framework-nested` for structured resource access.

### Endpoint Structure (Examples)
- `GET /api/events/`: List all available events.
- `GET /api/events/{id}/programs/`: List programs within a specific event (Nested).
- `POST /api/programs/{id}/results/`: Record final scores for a sub-event.

### Specialized Views
- **ModelViewSets**: Provide standard CRUD (Create, Read, Update, Delete) for core entities.
- **Functional API Views**: For complex operations like PDF report generation or bulk data imports.

---

## 🧠 4. Core Business Logic (The "Brain")

### A. Intelligent Chest Numbering Algorithm
- **Logic**: Automatically assigns unique numbers based on teams.
- **Formula**: `(TeamNumber * 100) + NextAvailableSequence`.
- **Purpose**: Prevents duplicates across thousands of students and organizes them by team ranges (Team 1: 100-199, etc.).

### B. Automated Grading Engine
- **Input**: Marks from up to 3 individual judges.
- **Processing**: Real-time averaging and position calculation (1st, 2nd, 3rd) using transactional database locks to prevent race conditions.
- **Points Distribution**: Automatically awards points (e.g., 100/75/25) to the winning team's global score upon result confirmation.

### C. Automated Team Manager Credentials
- When a new team is created, the backend uses a secure random generator to create unique login credentials.
- These are stored securely and used by the team manager to access their specialized portal.

---

## 🔐 5. Security & Compliance
- **CORS Policy**: Whitelisted frontend origins to prevent unauthorized cross-origin requests.
- **JWT Security**: Access tokens (vulnerability window: 60 mins) and Refresh tokens (24 hours) with rotation support.
- **Data sanitization**: All API inputs are sanitized through DRF Serializers to prevent SQL injection and XSS.

---

## 📄 6. Reporting & Exports
- **PDF Engine**: Powered by **ReportLab** or specialized View-to-PDF drivers.
- **Bulk Upload**: Handles CSV/Excel processing for student and program registration, allowing administrators to import thousands of records in seconds.

---

**Built for Performance, Security, and Institutional Precision.**
