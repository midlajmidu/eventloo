import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Trophy, 
  Award, 
  Save, 
  Download, 
  Filter,
  Search,
  CheckCircle,
  AlertCircle,
  Medal,
  Edit,
  X
} from 'lucide-react';
import { eventProgramsAPI, markEntryAPI } from '../../services/api';

const EventMarkEntry = ({ eventId }) => {
  const [programs, setPrograms] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedProgramDetails, setSelectedProgramDetails] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [individualSaving, setIndividualSaving] = useState({});
  const [savedParticipants, setSavedParticipants] = useState({});
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [maxMarks, setMaxMarks] = useState(100);
  const [showProgramsWithResults, setShowProgramsWithResults] = useState(false);
  const [completedPrograms, setCompletedPrograms] = useState(new Set());
  const [showCompletedPrograms, setShowCompletedPrograms] = useState(false);
  
  // Edit marks state
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [editMarks, setEditMarks] = useState({});
  const [updatingMarks, setUpdatingMarks] = useState(false);

  // Helper function to safely format numbers
  const safeFormatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '-';
    }
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '-' : num.toFixed(decimals);
  };

  useEffect(() => {
    fetchPrograms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const fetchPrograms = async () => {
    try {
      // Request all programs by setting a large page size
      const response = await eventProgramsAPI.getPrograms(eventId, 'page_size=100');
      const programsData = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setPrograms(programsData);
      
      // Check which programs already have marks and mark them as completed
      const completedSet = new Set();
      for (const program of programsData) {
        try {
          const participantsResponse = await markEntryAPI.getParticipants(eventId, program.id);
          const participants = Array.isArray(participantsResponse.data) ? participantsResponse.data : (participantsResponse.data.results || []);
          
          // Check if any participant has marks
          const hasMarks = participants.some(participant => 
            participant.judge1_marks || participant.judge2_marks || participant.judge3_marks
          );
          
          if (hasMarks) {
            completedSet.add(program.id);
          }
        } catch (error) {
          console.error(`Error checking program ${program.id}:`, error);
        }
      }
      setCompletedPrograms(completedSet);
    } catch (error) {
      console.error('Error fetching programs:', error);
      setMessage('Error loading programs');
    }
  };



  const fetchParticipants = async (programId) => {
    if (!programId) return;
    
    setLoading(true);
    try {
      const response = await markEntryAPI.getParticipants(eventId, programId);
      const participantsData = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setParticipants(participantsData);
      
      // Initialize saved participants state based on existing marks
      const savedParticipantsState = {};
      participantsData.forEach(participant => {
        if (participant.judge1_marks || participant.judge2_marks || participant.judge3_marks) {
          savedParticipantsState[participant.id] = true;
        }
      });
      setSavedParticipants(savedParticipantsState);
    } catch (error) {
      console.error('Error fetching participants:', error);
      setMessage('Error loading participants');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setSelectedProgram('');
    setSelectedProgramDetails(null);
    setParticipants([]);
    
    // Reset completed programs when changing category
    setCompletedPrograms(new Set());
  };

  const handleProgramChange = (programId) => {
    setSelectedProgram(programId);
    const program = programs.find(p => p.id === parseInt(programId));
    setSelectedProgramDetails(program);
    fetchParticipants(programId);
  };

  const handleMarkChange = (participantId, field, value) => {
    const numValue = value === '' ? null : parseFloat(value);
    
    setParticipants(prev => prev.map(p => {
      if (p.id === participantId) {
        const updatedParticipant = { ...p, [field]: numValue };
        
        // Calculate total and average marks
        const judge1 = updatedParticipant.judge1_marks || 0;
        const judge2 = updatedParticipant.judge2_marks || 0;
        const judge3 = updatedParticipant.judge3_marks || 0;
        
        // Only calculate if there are any marks entered
        const hasAnyMarks = judge1 > 0 || judge2 > 0 || judge3 > 0;
        
        if (hasAnyMarks) {
          // Calculate total marks
          const totalMarks = judge1 + judge2 + judge3;
          
          // Calculate average marks
          const validMarks = [judge1, judge2, judge3].filter(mark => mark > 0);
          const averageMarks = validMarks.length > 0 ? totalMarks / validMarks.length : 0;
          
          // Convert to 100 scale
          const marksOutOf100 = maxMarks === 100 ? averageMarks : (averageMarks / maxMarks) * 100;
          
          updatedParticipant.total_marks = totalMarks;
          updatedParticipant.average_marks = averageMarks;
          updatedParticipant.marks_out_of_100 = marksOutOf100;
        } else {
          // No marks entered, set to null
          updatedParticipant.total_marks = null;
          updatedParticipant.average_marks = null;
          updatedParticipant.marks_out_of_100 = null;
        }
        
        return updatedParticipant;
      }
      return p;
    }));
  };

  // Helper function to check if participant has marks saved
  const hasMarks = (participant) => {
    // Only consider completed if it was explicitly saved in the current session
    // OR if it has all three judge marks saved in the database AND was previously saved
    const hasAllJudgeMarks = participant.judge1_marks && 
                             participant.judge2_marks && 
                             participant.judge3_marks;
    
    // Check if it was saved in the current session OR if it has all marks and was previously saved
    const hasMarksResult = savedParticipants[participant.id] === true || 
                          (hasAllJudgeMarks && participant.total_marks !== null);
    
    // Debug logging
    console.log('hasMarks check for participant:', participant.student_name, {
      id: participant.id,
      savedInSession: savedParticipants[participant.id],
      judge1: participant.judge1_marks,
      judge2: participant.judge2_marks,
      judge3: participant.judge3_marks,
      hasAllJudgeMarks: hasAllJudgeMarks,
      totalMarks: participant.total_marks,
      hasMarks: hasMarksResult
    });
    
    return hasMarksResult;
  };

  // Helper function to get participant display name
  const getParticipantDisplayName = (participant) => {
    if (participant.is_team_based && participant.team_name) {
      // For team-based programs, show the first member's name or team name
      const memberName = participant.participant?.name || participant.student_name || participant.team_name;
      return `${memberName} & Team`;
    }
    return participant.participant?.name || participant.student_name || 'Unknown';
  };

  // Helper function to get participant details
  const getParticipantDetails = (participant) => {
    if (participant.is_team_based && participant.team_name) {
      return {
        name: participant.team_name,
        memberCount: participant.team_member_count || 0,
        isTeam: true
      };
    }
    return {
      name: participant.participant?.student_id || 'N/A',
      isTeam: false
    };
  };





  const handleSaveIndividualMarks = async (participant) => {
    if (!selectedProgram) return;
    
    // Set saving state for this participant
    setIndividualSaving(prev => ({ ...prev, [participant.id]: true }));
    
    try {
      // Calculate marks for this participant
      const judge1 = participant.judge1_marks || 0;
      const judge2 = participant.judge2_marks || 0;
      const judge3 = participant.judge3_marks || 0;
      
      const hasAnyMarks = judge1 > 0 || judge2 > 0 || judge3 > 0;
      
      let totalMarks = null;
      let averageMarks = null;
      let marksOutOf100 = null;
      
      if (hasAnyMarks) {
        totalMarks = judge1 + judge2 + judge3;
        const validMarks = [judge1, judge2, judge3].filter(mark => mark > 0);
        averageMarks = validMarks.length > 0 ? totalMarks / validMarks.length : 0;
        marksOutOf100 = maxMarks === 100 ? averageMarks : (averageMarks / maxMarks) * 100;
      }
      
      const markData = {
        id: participant.id,
        judge1_marks: participant.judge1_marks || null,
        judge2_marks: participant.judge2_marks || null,
        judge3_marks: participant.judge3_marks || null,
        total_marks: totalMarks,
        average_marks: averageMarks,
        marks_out_of_100: marksOutOf100,
        comments: participant.comments || ''
      };

      // For team-based programs, include team_id
      if (participant.is_team_based && participant.team) {
        markData.team_id = participant.team;
      }

      await markEntryAPI.bulkUpdateMarks(eventId, selectedProgram, [markData]);
      
      // After saving individual marks, recalculate rankings and points for all participants
      await recalculateRankingsAndPoints();
      
      // Mark as saved permanently (don't clear after timeout)
      setSavedParticipants(prev => ({ ...prev, [participant.id]: true }));
      
      // Check if this program should be marked as completed
      if (hasAnyMarks) {
        setCompletedPrograms(prev => new Set([...prev, parseInt(selectedProgram)]));
      }
      
      setMessage(`Marks saved for ${participant.student_name}! Rankings and points updated automatically.`);
      
      // Trigger a custom event to refresh the points section if it exists
      console.log('EventMarkEntry: Dispatching pointsUpdated event with eventId:', eventId);
      window.dispatchEvent(new CustomEvent('pointsUpdated', { detail: { eventId: parseInt(eventId) } }));
      
      // Clear message after 3 seconds but keep saved indicator
      setTimeout(() => {
        setMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error saving individual marks:', error);
      setMessage(`Error saving marks for ${participant.student_name}`);
    } finally {
      // Clear saving state for this participant
      setIndividualSaving(prev => ({ ...prev, [participant.id]: false }));
    }
  };

  // Edit marks functions
  const handleStartEditMarks = (participant) => {
    setEditingParticipant(participant.id);
    setEditMarks({
      judge1_marks: participant.judge1_marks || '',
      judge2_marks: participant.judge2_marks || '',
      judge3_marks: participant.judge3_marks || ''
    });
  };

  const handleCancelEditMarks = () => {
    setEditingParticipant(null);
    setEditMarks({});
  };

  const handleEditMarkChange = (field, value) => {
    setEditMarks(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleUpdateMarks = async () => {
    if (!selectedProgram || !editingParticipant) return;
    
    setUpdatingMarks(true);
    
    try {
      // Calculate marks for this participant
      const judge1 = parseFloat(editMarks.judge1_marks) || 0;
      const judge2 = parseFloat(editMarks.judge2_marks) || 0;
      const judge3 = parseFloat(editMarks.judge3_marks) || 0;
      
      const hasAnyMarks = judge1 > 0 || judge2 > 0 || judge3 > 0;
      
      let totalMarks = null;
      let averageMarks = null;
      let marksOutOf100 = null;
      
      if (hasAnyMarks) {
        totalMarks = judge1 + judge2 + judge3;
        const validMarks = [judge1, judge2, judge3].filter(mark => mark > 0);
        averageMarks = validMarks.length > 0 ? totalMarks / validMarks.length : 0;
        marksOutOf100 = maxMarks === 100 ? averageMarks : (averageMarks / maxMarks) * 100;
      }
      
      const markData = {
        id: editingParticipant,
        judge1_marks: judge1 > 0 ? judge1 : null,
        judge2_marks: judge2 > 0 ? judge2 : null,
        judge3_marks: judge3 > 0 ? judge3 : null,
        total_marks: totalMarks,
        average_marks: averageMarks,
        marks_out_of_100: marksOutOf100,
        comments: ''
      };

      await markEntryAPI.bulkUpdateMarks(eventId, selectedProgram, [markData]);
      
      // After updating marks, recalculate rankings and points for all participants
      await recalculateRankingsAndPoints();
      
      // Update local state
      setParticipants(prev => prev.map(p => {
        if (p.id === editingParticipant) {
          return {
            ...p,
            judge1_marks: judge1 > 0 ? judge1 : null,
            judge2_marks: judge2 > 0 ? judge2 : null,
            judge3_marks: judge3 > 0 ? judge3 : null,
            total_marks: totalMarks,
            average_marks: averageMarks,
            marks_out_of_100: marksOutOf100
          };
        }
        return p;
      }));
      
      // Find participant name for message
      const participant = participants.find(p => p.id === editingParticipant);
      const participantName = participant ? participant.student_name : 'Participant';
      
      setMessage(`Marks updated for ${participantName}! Rankings and points recalculated automatically.`);
      
      // Trigger a custom event to refresh the points section if it exists
      window.dispatchEvent(new CustomEvent('pointsUpdated', { detail: { eventId: parseInt(eventId) } }));
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage('');
      }, 3000);
      
      // Exit edit mode
      handleCancelEditMarks();
      
    } catch (error) {
      console.error('Error updating marks:', error);
      setMessage('Error updating marks. Please try again.');
    } finally {
      setUpdatingMarks(false);
    }
  };

  const recalculateRankingsAndPoints = async () => {
    try {
      // Fetch updated participants data from the backend
      const response = await markEntryAPI.getParticipants(eventId, selectedProgram);
      const participantsData = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setParticipants(participantsData);
    } catch (error) {
      console.error('Error recalculating rankings:', error);
    }
  };

  const handleGeneratePDF = async () => {
    if (!selectedProgram) return;
    
    try {
      const response = await markEntryAPI.generatePDF(eventId, selectedProgram);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `results_${selectedProgramDetails?.name || selectedProgram}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setMessage('Error generating PDF');
    }
  };

  // Computed variables for filtering
  const categories = [
    { value: 'hs', label: 'HS' },
    { value: 'hss', label: 'HSS' },
            { value: 'general', label: 'General' },
  ];

  const filteredPrograms = programs.filter(program => {
    const categoryMatch = !selectedCategory || program.category === selectedCategory;
    
    // Filter based on completion status
    const isCompleted = completedPrograms.has(program.id);
    
    if (showCompletedPrograms) {
      // Show only completed programs
      return categoryMatch && isCompleted;
    } else {
      // Show only incomplete programs
      return categoryMatch && !isCompleted;
    }
  });

  const filteredParticipants = participants.filter(participant => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      participant.student_name?.toLowerCase().includes(searchLower) ||
      participant.student_id?.toLowerCase().includes(searchLower) ||
      participant.team_name?.toLowerCase().includes(searchLower)
    );
  });

  const getPositionBadge = (position) => {
    if (!position) return null;
    
    const badges = {
      1: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '🥇', text: '1st' },
      2: { color: 'bg-gray-100 text-gray-800 border-gray-300', icon: '🥈', text: '2nd' },
      3: { color: 'bg-orange-100 text-orange-800 border-orange-300', icon: '🥉', text: '3rd' }
    };
    
    const badge = badges[position] || { 
      color: 'bg-blue-100 text-blue-800 border-blue-300', 
      icon: '🏅', 
      text: `${position}th` 
    };
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
        <span>{badge.icon}</span>
        {badge.text}
      </span>
    );
  };

  const getPointsBadge = (points) => {
    if (!points) return <span className="text-gray-400">0</span>;
    
    const colors = {
      10: 'bg-green-100 text-green-800',
      6: 'bg-blue-100 text-blue-800',
      5: 'bg-yellow-100 text-yellow-800',
      3: 'bg-orange-100 text-orange-800',
      1: 'bg-purple-100 text-purple-800'
    };
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors[points] || 'bg-gray-100 text-gray-800'}`}>
        <Award className="w-3 h-3" />
        {points}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mark Entry & Results</h1>
          <p className="text-gray-600">Enter marks for judges and calculate rankings automatically</p>
        </div>
        {selectedProgram && (
          <div className="flex gap-2">
            <button
              onClick={handleGeneratePDF}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              Generate PDF
            </button>
          </div>
        )}
      </div>



      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          <div className="flex items-center gap-2">
            {message.includes('Error') ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            {message}
          </div>
        </div>
      )}

      {/* Selection Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        {/* Filter Toggle */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Program Selection</h3>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Progress:</span> {completedPrograms.size} completed, {filteredPrograms.length} remaining
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowCompletedPrograms(!showCompletedPrograms)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  showCompletedPrograms 
                    ? 'bg-green-100 text-green-800 border border-green-300' 
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }`}
              >
                {showCompletedPrograms ? 'Hide Completed' : 'Show Completed'}
              </button>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showProgramsWithResults}
                  onChange={(e) => setShowProgramsWithResults(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-600">Show programs with existing results</span>
              </label>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          {/* Program Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Trophy className="w-4 h-4 inline mr-1" />
              Program
            </label>
            <select
              value={selectedProgram}
              onChange={(e) => handleProgramChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Program</option>
              {filteredPrograms.map(program => (
                <option key={program.id} value={program.id}>
                  {program.name} {program.is_team_based ? '(Team)' : '(Individual)'}
                </option>
              ))}
            </select>
          </div>

          {/* Max Marks Setting */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Medal className="w-4 h-4 inline mr-1" />
              Max Marks per Judge
            </label>
            <input
              type="number"
              value={maxMarks}
              onChange={(e) => setMaxMarks(parseInt(e.target.value) || 100)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="1000"
            />
          </div>
        </div>

        {/* Program Details */}
        {selectedProgramDetails && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Trophy className="w-4 h-4" />
                {selectedProgramDetails.name}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {selectedProgramDetails.is_team_based ? 'Team Program' : 'Individual Program'}
              </span>
              <span className="flex items-center gap-1">
                <Medal className="w-4 h-4" />
                Points: {selectedProgramDetails.category === 'hs' || selectedProgramDetails.category === 'hss' ? '5-3-1 (Individual)' : 
                        selectedProgramDetails.is_team_based ? '10-6-3 (Team)' : '5-3-1 (Individual)'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Participants Table */}
      {selectedProgram && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Participants ({filteredParticipants.length})
              </h2>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search participants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {/* Progress Summary */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-green-700">
                  {filteredParticipants.filter(p => hasMarks(p)).length} with marks
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-blue-700">
                  {filteredParticipants.filter(p => !hasMarks(p)).length} pending
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                <span className="text-gray-600">
                  {filteredParticipants.length > 0 
                    ? Math.round((filteredParticipants.filter(p => hasMarks(p)).length / filteredParticipants.length) * 100)
                    : 0}% completed
                </span>
              </div>
            </div>
            
            {/* Info Note */}
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <strong>Note:</strong> Once marks are saved for a participant, the entry becomes read-only to prevent accidental changes. 
                  Use the "Edit" button to modify marks for participants who already have marks saved. 
                  Participants with green indicators have marks saved.
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading participants...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Participant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Judge 1
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Judge 2
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Judge 3
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Out of 100
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Points
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredParticipants.map((participant) => {
                    const participantHasMarks = hasMarks(participant);
                    return (
                      <tr key={participant.id} className={`hover:bg-gray-50 ${participantHasMarks ? 'bg-green-50' : ''}`}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 relative">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${
                              participantHasMarks ? 'bg-green-500' : 'bg-blue-500'
                            }`}>
                              {participant.chest_number || 'N/A'}
                            </div>
                            {participantHasMarks && (
                              <CheckCircle className="w-4 h-4 absolute -top-1 -right-1 text-green-600 bg-white rounded-full" />
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                              {getParticipantDisplayName(participant)}
                              {participantHasMarks && (
                                <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                                  Has Marks
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {getParticipantDetails(participant).isTeam ? (
                                <span className="text-blue-600 font-medium">
                                  Team: {getParticipantDetails(participant).name} ({getParticipantDetails(participant).memberCount} members)
                                </span>
                              ) : (
                                <>
                                  ID: {participant.student_code || 'N/A'}
                                  {participant.chest_number && (
                                    <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                      Chest #{participant.chest_number}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getParticipantDetails(participant).isTeam ? (
                          <span className="text-blue-600 font-medium">{participant.team_name || 'N/A'}</span>
                        ) : (
                          participant.team_name || 'N/A'
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="relative">
                          {editingParticipant === participant.id ? (
                            <input
                              type="number"
                              min="0"
                              max={maxMarks}
                              step="0.01"
                              value={editMarks.judge1_marks || ''}
                              onChange={(e) => handleEditMarkChange('judge1_marks', e.target.value)}
                              className="w-20 px-2 py-1 border-2 border-blue-300 bg-blue-50 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={`0-${maxMarks}`}
                            />
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max={maxMarks}
                              step="0.01"
                              value={participant.judge1_marks || ''}
                              onChange={(e) => handleMarkChange(participant.id, 'judge1_marks', e.target.value)}
                              disabled={participantHasMarks && savedParticipants[participant.id]}
                              className={`w-20 px-2 py-1 border rounded focus:outline-none focus:ring-2 ${
                                participantHasMarks && savedParticipants[participant.id]
                                  ? 'border-green-300 bg-green-50 text-green-700 cursor-not-allowed' 
                                  : 'border-gray-300 focus:ring-blue-500'
                              }`}
                              placeholder={`0-${maxMarks}`}
                            />
                          )}
                          {participantHasMarks && savedParticipants[participant.id] && editingParticipant !== participant.id && (
                            <CheckCircle className="w-4 h-4 absolute -top-1 -right-1 text-green-600 bg-white rounded-full" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="relative">
                          {editingParticipant === participant.id ? (
                            <input
                              type="number"
                              min="0"
                              max={maxMarks}
                              step="0.01"
                              value={editMarks.judge2_marks || ''}
                              onChange={(e) => handleEditMarkChange('judge2_marks', e.target.value)}
                              className="w-20 px-2 py-1 border-2 border-blue-300 bg-blue-50 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={`0-${maxMarks}`}
                            />
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max={maxMarks}
                              step="0.01"
                              value={participant.judge2_marks || ''}
                              onChange={(e) => handleMarkChange(participant.id, 'judge2_marks', e.target.value)}
                              disabled={participantHasMarks && savedParticipants[participant.id]}
                              className={`w-20 px-2 py-1 border rounded focus:outline-none focus:ring-2 ${
                                participantHasMarks && savedParticipants[participant.id]
                                  ? 'border-green-300 bg-green-50 text-green-700 cursor-not-allowed' 
                                  : 'border-gray-300 focus:ring-blue-500'
                              }`}
                              placeholder={`0-${maxMarks}`}
                            />
                          )}
                          {participantHasMarks && savedParticipants[participant.id] && editingParticipant !== participant.id && (
                            <CheckCircle className="w-4 h-4 absolute -top-1 -right-1 text-green-600 bg-white rounded-full" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="relative">
                          {editingParticipant === participant.id ? (
                            <input
                              type="number"
                              min="0"
                              max={maxMarks}
                              step="0.01"
                              value={editMarks.judge3_marks || ''}
                              onChange={(e) => handleEditMarkChange('judge3_marks', e.target.value)}
                              className="w-20 px-2 py-1 border-2 border-blue-300 bg-blue-50 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={`0-${maxMarks}`}
                            />
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max={maxMarks}
                              step="0.01"
                              value={participant.judge3_marks || ''}
                              onChange={(e) => handleMarkChange(participant.id, 'judge3_marks', e.target.value)}
                              disabled={participantHasMarks && savedParticipants[participant.id]}
                              className={`w-20 px-2 py-1 border rounded focus:outline-none focus:ring-2 ${
                                participantHasMarks && savedParticipants[participant.id]
                                  ? 'border-green-300 bg-green-50 text-green-700 cursor-not-allowed' 
                                  : 'border-gray-300 focus:ring-blue-500'
                              }`}
                              placeholder={`0-${maxMarks}`}
                            />
                          )}
                          {participantHasMarks && savedParticipants[participant.id] && editingParticipant !== participant.id && (
                            <CheckCircle className="w-4 h-4 absolute -top-1 -right-1 text-green-600 bg-white rounded-full" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">
                          {safeFormatNumber(participant.total_marks)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-bold text-blue-600">
                          {safeFormatNumber(participant.marks_out_of_100)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getPositionBadge(participant.position)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getPointsBadge(participant.points_earned)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {editingParticipant === participant.id ? (
                          // Edit mode - show save/cancel buttons
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleUpdateMarks}
                              disabled={updatingMarks}
                              className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              <Save className="w-3 h-3" />
                              {updatingMarks ? 'Updating...' : 'Update'}
                            </button>
                            <button
                              onClick={handleCancelEditMarks}
                              disabled={updatingMarks}
                              className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                            >
                              <X className="w-3 h-3" />
                              Cancel
                            </button>
                          </div>
                        ) : (
                          // Check if participant has any marks (partial or complete)
                          <div className="flex items-center gap-2">
                            {(participant.judge1_marks || participant.judge2_marks || participant.judge3_marks) ? (
                              // Has some marks - check if all judges have marked
                              (participant.judge1_marks && participant.judge2_marks && participant.judge3_marks) ? (
                                // All judges have marked - check if it's saved
                                savedParticipants[participant.id] ? (
                                  // Saved - show edit button
                                  <>
                                    <div className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded">
                                      <CheckCircle className="w-3 h-3" />
                                      All Judges Marked
                                    </div>
                                    <button
                                      onClick={() => handleStartEditMarks(participant)}
                                      className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-orange-600 text-white rounded hover:bg-orange-700 border border-orange-700 shadow-sm"
                                    >
                                      <Edit className="w-3 h-3" />
                                      Edit Marks
                                    </button>
                                  </>
                                ) : (
                                  // All judges marked but not saved - show save button
                                  <>
                                    <div className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded">
                                      <AlertCircle className="w-3 h-3" />
                                      Ready to Save
                                    </div>
                                    <button
                                      onClick={() => handleSaveIndividualMarks(participant)}
                                      disabled={individualSaving[participant.id]}
                                      className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <Save className="w-3 h-3" />
                                      {individualSaving[participant.id] ? 'Saving...' : 'Save All Marks'}
                                    </button>
                                  </>
                                )
                              ) : (
                                // Partial marks - show save button
                                <>
                                  <div className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded">
                                    <AlertCircle className="w-3 h-3" />
                                    Partial Marks
                                  </div>
                                  <button
                                    onClick={() => handleSaveIndividualMarks(participant)}
                                    disabled={individualSaving[participant.id]}
                                    className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Save className="w-3 h-3" />
                                    {individualSaving[participant.id] ? 'Saving...' : 'Save'}
                                  </button>
                                </>
                              )
                            ) : (
                              // No marks - show save button
                              <button
                                onClick={() => handleSaveIndividualMarks(participant)}
                                disabled={individualSaving[participant.id]}
                                className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded transition-colors ${
                                  savedParticipants[participant.id] 
                                    ? 'bg-green-600 text-white' 
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                <Save className="w-3 h-3" />
                                {individualSaving[participant.id] 
                                  ? 'Saving...' 
                                  : savedParticipants[participant.id] 
                                    ? 'Saved!' 
                                    : 'Save'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredParticipants.length === 0 && selectedProgram && (
            <div className="p-8 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No participants found for this program</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventMarkEntry; 