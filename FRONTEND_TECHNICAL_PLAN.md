# 💻 Eventloo: Frontend Technical Architecture Plan

## 🏫 Executive Summary (For Faculty Review)
The Eventloo frontend is engineered as a modern **Single Page Application (SPA)** using **React 18**. The architecture emphasizes **decoupled services**, **role-based security**, and **efficient state management**. It is designed to provide a seamless, high-performance experience for both administrative staff and team managers.

---

## 🏗️ 1. Core Architecture
- **Framework**: React 18 (Functional Components, Hooks).
- **Routing**: `react-router-dom` v6 for client-side navigation.
- **Styling**: **Tailwind CSS** for a utility-first, responsive design system.
- **Build Tool**: Vite/Webpack for optimized production bundling.

### Component Hierarchy
- **Layouts**: `AdminLayout` and `TeamManagerLayout` encapsulate common navigation and sidebar elements.
- **Protected Routes**: Custom `ProtectedRoute` components intercept navigation to ensure users have the required JWT and roles before rendering sensitive views.
- **Common Components**: Reusable UI elements (Modals, Toasts, Loaders, Buttons) to ensure visual consistency.

---

## 🔌 2. API Communication Layer
The system uses a **Service-Oriented Architecture (SOA)** for API interactions, centralized in `src/services/api.js`.

### Axios Infrastructure
- **Base Configuration**: A customized Axios instance with a dynamic `baseURL` and predefined headers.
- **Interceptors (The "Brain")**:
    - **Request Interceptor**: Automatically attaches the JWT `Bearer` token to every outgoing request.
    - **Response Interceptor**: Monitors for `401 Unauthorized` errors. If a session expires, it silently attempts to use a `refresh_token` to get a new `access_token` without interrupting the user.
- **Logical Services**:
    - `authAPI`: Handles login, logout, and profile retrieval.
    - `eventsAPI`: Manages the lifecycle of events and programs.
    - `teamManagerAPI`: Specialized endpoints for team-specific operations.
    - `pointsAPI`: Handles scoring and real-time leadership analytics.

---

## 🔐 3. Security & State Management
- **Token Persistence**: JWTs are stored in `localStorage` for session persistence across browser refreshes.
- **Auto-Logout**: A secure utility wipes all sensitive data (tokens, user roles, team IDs) from the browser upon logout or session termination.
- **Role-Based Rendering**: High-order components (HOCs) verify roles (Admin vs. Team Manager) before rendering specific actions or pages.

---

## 📄 4. Specialized Functional Modules
### A. Report Processing
The frontend handles complex binary data (Blobs) for report generation. When a user requests a "Calling Sheet" or "Result PDF," the frontend:
1. Sends an authenticated GET request.
2. Receives a raw PDF byte stream.
3. Dynamically creates a temporary URL to trigger a browser download.

### B. Dynamic Chest Number Search
Integrated search logic allows administrators to look up students by their unique chest numbers across the entire event database, facilitating quick on-field verification.

### C. Multi-Judge Mark Entry
A specialized UI component that allows for synchronous entry of scores from Judge 1, 2, and 3, providing immediate total/average feedback to the administrator before submission.

---

## 🎨 5. UI/UX Design Philosophy
- **Responsive Layouts**: Designed to be fully functional on tablets and laptops for on-field use during events.
- **Loading UX**: Skeleton screens and loading spinners ensure the system feels fast even during complex data fetching.
- **Premium Aesthetics**: Curated color palettes and smooth transitions elevate the professional feel of the institutional software.

---

**Designed for Scalability, Security, and Ease of Use.**
