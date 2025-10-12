import React, { useState, useEffect } from 'react';
import { teamManagerAPI } from '../../services/api';
import { 
  Users, 
  User, 
  Award,
  Calendar,
  Mail,
  Phone,
  MapPin,
  AlertCircle,
  Search,
  Filter
} from 'lucide-react';

const TeamStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      // Get team data from localStorage
      const teamData = JSON.parse(localStorage.getItem('team_data'));
      if (!teamData) {
        setError('No team data found. Please login again.');
        return;
      }
      
      setSelectedTeam(teamData);
      
      // Fetch team students
      const response = await teamManagerAPI.getTeamStudents(teamData.id);
      
      if (response.data) {
        // Handle both paginated and non-paginated responses
        if (response.data.results) {
          // Paginated response
          setStudents(response.data.results || []);
        } else if (response.data.students) {
          // Non-paginated response
          setStudents(response.data.students || []);
        } else {
          setStudents([]);
        }
      }
    } catch (err) {
      console.error('Error fetching students:', err);
      setError('Failed to load team students');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category) => {
    switch (category?.toLowerCase()) {
      case 'hs': return 'bg-blue-100 text-blue-800';
      case 'hss': return 'bg-purple-100 text-purple-800';
      case 'primary': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getGradeColor = (grade) => {
    const gradeNum = parseInt(grade);
    if (gradeNum >= 11) return 'bg-purple-100 text-purple-800';
    if (gradeNum >= 9) return 'bg-blue-100 text-blue-800';
    if (gradeNum >= 6) return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.student_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || student.category?.toLowerCase() === filterCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading team students...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 text-lg mb-4">{error}</p>
          <button 
            onClick={fetchStudents}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Team Students</h1>
              <p className="text-gray-600 text-lg">
                Manage and view your team members
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {selectedTeam && (
                <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium text-gray-700">{selectedTeam.name}</span>
                  </div>
                </div>
              )}
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-gray-700">{students.length} Students</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search students by name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  <option value="hs">High School</option>
                  <option value="hss">Higher Secondary</option>
                  <option value="primary">Primary</option>
                </select>
                <button className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
                  <Filter className="h-5 w-5" />
                  <span>Filter</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Students Grid */}
        {filteredStudents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStudents.map((student) => (
              <div 
                key={student.id} 
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300"
              >
                {/* Student Header */}
                <div className="h-32 bg-gradient-to-r from-green-500 to-emerald-600 relative overflow-hidden">
                  <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                    <div className="text-white text-center">
                      <User className="h-8 w-8 mx-auto mb-2" />
                      <h3 className="text-lg font-semibold">{student.name}</h3>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(student.category)}`}>
                      {student.category?.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Student Content */}
                <div className="p-6">
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="h-4 w-4 mr-2" />
                      <span className="font-medium">{student.student_id}</span>
                    </div>

                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>Grade {student.grade}</span>
                      {student.section && (
                        <span className="ml-2">• Section {student.section}</span>
                      )}
                    </div>

                    {student.email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="h-4 w-4 mr-2" />
                        <span>{student.email}</span>
                      </div>
                    )}

                    {student.phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="h-4 w-4 mr-2" />
                        <span>{student.phone}</span>
                      </div>
                    )}

                    {student.address && (
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span className="truncate">{student.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Points and Stats */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Award className="h-4 w-4 mr-1" />
                          <span>Total Points: {student.total_points || 0}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Award className="h-4 w-4 mr-1" />
                          <span>Team Points: {student.team_points || 0}</span>
                        </div>
                      </div>
                      {student.chest_code && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                          {student.chest_code}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category and Grade Tags */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(student.category)}`}>
                      {student.category?.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getGradeColor(student.grade)}`}>
                      Grade {student.grade}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
              <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Students Found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || filterCategory !== 'all' 
                  ? 'Try adjusting your search criteria' 
                  : 'No students in your team yet'
                }
              </p>
              {(searchTerm || filterCategory !== 'all') && (
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setFilterCategory('all');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        {students.length > 0 && (
          <div className="mt-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <User className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{students.length}</p>
                  <p className="text-sm text-gray-600">Total Students</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <Award className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">
                    {students.reduce((sum, student) => sum + (student.total_points || 0), 0)}
                  </p>
                  <p className="text-sm text-gray-600">Total Points</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-600">
                    {new Set(students.map(s => s.category)).size}
                  </p>
                  <p className="text-sm text-gray-600">Categories</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <Calendar className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-yellow-600">
                    {new Set(students.map(s => s.grade)).size}
                  </p>
                  <p className="text-sm text-gray-600">Grades</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamStudents; 