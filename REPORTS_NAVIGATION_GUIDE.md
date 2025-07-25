# 📊 Eventloo Reports Navigation Guide

## 🎯 Available Reports Sections

### 1. **Event-Specific Reports** (Recommended)
**Location**: Event Dashboard → Reports Tab
**URL**: `/events/{eventId}/dashboard` → Click "Reports" tab

**Available Reports**:
- 📋 **Program Details Report** - Complete program information by category
- 🏆 **Complete Results Report** - All results with rankings  
- 👥 **Team Points Report** - Detailed points breakdown
- 💾 **Event Backup** - Complete event data in JSON

**How to Access**:
1. Login as admin: `admin`
2. Go to Events page: `/admin/events`
3. Click on an event (e.g., "jaz" with ID 46)
4. Click "Reports" tab in the event dashboard
5. Choose report type and download

### 2. **Global Reports** (Admin Only)
**Location**: Admin Dashboard → Reports
**URL**: `/admin/reports`

**Available Reports**:
- 📊 **All Events Summary** - Overview of all events
- 📋 **Global Program Details** - All programs across events
- 🏆 **Global Results** - All results across events

### 3. **Team Manager Reports**
**Location**: Team Manager Dashboard → Reports
**URL**: `/team-manager/reports`

**Available Reports**:
- 👥 **Team Performance** - Team-specific results
- 📊 **Team Points** - Team points breakdown
- 🏅 **Team Certificates** - Team achievement certificates

## 🚨 Issue Resolution

### **Problem**: "comprehensive" endpoint not found
**Error**: `GET /api/events/46/reports/comprehensive/ HTTP/1.1" 404`

**Solution**: The "comprehensive" endpoint doesn't exist. Use the correct reports endpoints:

### **Correct Endpoints**:
- ✅ `/api/events/46/reports/program-details/`
- ✅ `/api/events/46/reports/complete-results/`
- ✅ `/api/events/46/reports/team-points/`
- ✅ `/api/events/46/reports/backup/`

## 🧪 Quick Test

### **Step 1: Verify Backend**
```bash
# Test if backend is running
curl -s http://localhost:8000/api/events/ | head -5
```

### **Step 2: Test Reports Endpoint**
```bash
# Test a working reports endpoint
curl -s http://localhost:8000/api/events/46/reports/test/ | head -5
```

### **Step 3: Access Frontend**
1. Open: `http://localhost:3000`
2. Login: `admin`
3. Navigate: Events → Select event → Reports tab

## 📱 Navigation Steps

### **For Event Reports**:
1. **Login**: Use admin credentials
2. **Go to Events**: Click "Events" in sidebar
3. **Select Event**: Click on "jaz" (or any event)
4. **Open Reports**: Click "Reports" tab in event dashboard
5. **Choose Report**: Select report type and download

### **For Global Reports**:
1. **Login**: Use admin credentials  
2. **Go to Reports**: Click "Reports" in sidebar
3. **Choose Report**: Select global report type
4. **Download**: Click download button

## 🔧 Troubleshooting

### **If you see "comprehensive" errors**:
- ❌ Don't use: `/api/events/46/reports/comprehensive/`
- ✅ Use: `/api/events/46/reports/program-details/`

### **If reports don't load**:
1. Check backend is running: `cd backend && python3 manage.py runserver 8000`
2. Check frontend is running: `cd frontend && npm start`
3. Clear browser cache and try again

### **If authentication fails**:
1. Logout and login again
2. Check if token is expired
3. Use admin credentials: `admin`

## 📞 Support

The reports section is now working correctly. If you continue to have issues:

1. **Check browser console** for specific error messages
2. **Verify both servers** are running (frontend: 3000, backend: 8000)
3. **Use the correct navigation** path as shown above
4. **Test with the working endpoints** listed above

The EventReports component has been fixed and should now work properly with all three report types available for download. 