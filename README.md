# School Event Management System

A comprehensive school event management system with role-based authentication using React + Tailwind CSS frontend and Django REST Framework backend.

## 🎯 Features

### 🔐 Authentication System
- **JWT-based authentication** with access/refresh tokens
- **Role-based access control**:
  - **Admin**: Full system control
  - **Event Manager**: Limited event management access
- **Automatic token refresh**
- **Secure logout** with token cleanup

### 🎨 Modern UI/UX
- **Beautiful Tailwind CSS** styling
- **Responsive design** for all devices
- **Loading states** and **error handling**
- **Gradient backgrounds** and **smooth animations**

## 🛠️ Tech Stack

### Frontend
- **React 18** with hooks
- **React Router v6** for navigation
- **Tailwind CSS** for styling
- **Axios** for API communication

### Backend
- **Django 4.2** with REST Framework
- **JWT authentication** via `djangorestframework-simplejwt`
- **CORS headers** for cross-origin requests
- **SQLite** database (easily changeable)

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+**
- **Node.js 16+**
- **npm** or **yarn**

### 1. Clone and Setup

```bash
git clone <your-repo>
cd event
```

### 2. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Navigate to backend
cd backend

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Create superuser (admin)
python manage.py createsuperuser

# Start Django server
python manage.py runserver
```

The backend will run on `http://localhost:8000`

### 3. Frontend Setup

```bash
# Navigate to frontend (from project root)
cd frontend

# Install dependencies
npm install

# Start React development server
npm start
```

The frontend will run on `http://localhost:3000`

## 👥 Demo Credentials

### After creating your superuser, you can also create demo users:

1. **Admin User**
   - Email: `admin@school.com`
   - Password: `admin123`
   - Role: `admin`

2. **Event Manager**
   - Email: `manager@school.com`
   - Password: `manager123`
   - Role: `event_manager`

### Creating Demo Users via Django Admin

1. Go to `http://localhost:8000/admin`
2. Login with your superuser credentials
3. Click "Users" → "Add User"
4. Fill in the details and set the role

## 📚 API Endpoints

### Authentication
- `POST /api/token/` - Login (get access/refresh tokens)
- `POST /api/token/refresh/` - Refresh access token
- `GET /api/profile/` - Get current user profile
- `POST /api/logout/` - Logout

### Response Format

**Login Success:**
```json
{
  "access": "jwt-access-token",
  "refresh": "jwt-refresh-token",
  "user": {
    "id": 1,
    "email": "admin@school.com",
    "role": "admin",
    "username": "admin"
  }
}
```

## 🏗️ Project Structure

```
event/
├── backend/                    # Django Backend
│   ├── event_management/       # Django Project
│   │   ├── settings.py        # Django Settings
│   │   ├── urls.py            # Main URLs
│   │   └── wsgi.py            # WSGI Config
│   ├── accounts/               # Authentication App
│   │   ├── models.py          # User Model
│   │   ├── serializers.py     # DRF Serializers
│   │   ├── views.py           # API Views
│   │   └── urls.py            # Auth URLs
│   └── manage.py              # Django CLI
├── frontend/                   # React Frontend
│   ├── src/
│   │   ├── components/        # React Components
│   │   │   ├── Login.js       # Login Page
│   │   │   ├── AdminDashboard.js
│   │   │   ├── UserDashboard.js
│   │   │   └── ProtectedRoute.js
│   │   ├── services/          # API Services
│   │   │   └── api.js         # Axios Configuration
│   │   ├── App.js             # Main App Component
│   │   ├── index.js           # React Entry Point
│   │   └── index.css          # Tailwind CSS
│   ├── public/
│   │   └── index.html         # HTML Template
│   ├── package.json
│   └── tailwind.config.js     # Tailwind Configuration
└── requirements.txt            # Python Dependencies
```

## 🔧 Configuration

### Backend Configuration

Key settings in `backend/event_management/settings.py`:

```python
# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
}

# CORS Settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
]
```

### Frontend Configuration

API base URL in `frontend/src/services/api.js`:

```javascript
const API_BASE_URL = 'http://localhost:8000/api';
```

## 🎯 Next Steps (Phase 2)

The authentication system is ready! Next phases will include:

1. **Team Management** - Create and organize teams
2. **Event Creation** - Set up events and programs
3. **Student Management** - Add and assign students
4. **Mark Entry System** - Score events and programs
5. **Scoreboard** - Real-time team standings
6. **Reports & Certificates** - Generate documents

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Make sure Django server is running on port 8000
   - Check CORS settings in Django settings

2. **Token Issues**
   - Clear localStorage and login again
   - Check if backend is running

3. **Database Issues**
   ```bash
   cd backend
   python manage.py migrate
   ```

## 📄 License

This project is open source and available under the MIT License.

---

**Built with ❤️ for School Event Management** # eventloo
