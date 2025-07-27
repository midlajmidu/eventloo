from django.shortcuts import render
from django.db.models import Q, Count, Sum, Avg, Max, Min, Case, When, Value
from django.db import models
from django.utils import timezone
from django.http import HttpResponse
from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
import django_filters
from .models import Event, Team, IndividualParticipation, EventAnnouncement, Program, ProgramAssignment, ProgramResult, PointsRecord, TeamProfile, ChestNumber
from .serializers import (
    EventListSerializer, EventDetailSerializer, EventCreateUpdateSerializer,
    TeamSerializer, TeamCreateSerializer, TeamCreateUpdateSerializer, IndividualParticipationSerializer,
    EventAnnouncementSerializer, EventAnnouncementCreateSerializer,
    ProgramSerializer, ProgramAssignmentSerializer, ProgramResultSerializer,
    PointsRecordSerializer, PointsRecordCreateSerializer, TeamProfileSerializer,
    EventWithProgramsSerializer, ChestNumberSerializer, MarkEntrySerializer,
    ProgramResultSummarySerializer
)
from .permissions import IsAdminOrEventManager, IsTeamManagerOrAdmin, TeamManagerAuthentication
from accounts.models import User
import pandas as pd
import re
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from collections import defaultdict
# from .pdf_utils import build_pdf_header
from .pagination import StandardPagination, LargePagination, SmallPagination, CustomPagination
# from reportlab.lib import colors
# from reportlab.lib.pagesizes import letter, A4
# from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
# from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
# from reportlab.lib.units import inch
# from reportlab.pdfgen import canvas
import json
from datetime import datetime

User = get_user_model()

class ProgramFilter(django_filters.FilterSet):
    """Custom filter for Program model with status filtering"""
    status = django_filters.ChoiceFilter(
        choices=[
            ('upcoming', 'Upcoming'),
            ('ongoing', 'Ongoing'),
            ('finished', 'Finished'),
        ],
        method='filter_status'
    )
    
    class Meta:
        model = Program
        fields = ['category', 'is_team_based', 'is_finished', 'is_active']
    
    def filter_status(self, queryset, name, value):
        """Filter programs by status"""
        now = timezone.now()
        
        if value == 'upcoming':
            return queryset.filter(start_time__gt=now, is_finished=False)
        elif value == 'ongoing':
            return queryset.filter(start_time__lte=now, end_time__gte=now, is_finished=False)
        elif value == 'finished':
            return queryset.filter(is_finished=True)
        
        return queryset

class EventViewSet(viewsets.ModelViewSet):
    """ViewSet for Event management"""
    queryset = Event.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['event_type', 'status', 'is_team_based']
    search_fields = ['title', 'description', 'venue']
    ordering_fields = ['start_date', 'created_at', 'title']
    ordering = ['-start_date']
    pagination_class = StandardPagination
    
    def get_serializer_class(self):
        if self.action == 'list':
            return EventListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return EventCreateUpdateSerializer
        elif self.action == 'retrieve':
            return EventWithProgramsSerializer
        return EventDetailSerializer
    
    def get_permissions(self):
        """Set permissions based on action"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAdminOrEventManager]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def perform_create(self, serializer):
        """Set the creator when creating an event"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def register(self, request, pk=None):
        """Register for an event (individual or team-based)"""
        event = self.get_object()
        user = request.user
        
        # Check if registration is open
        if not event.is_registration_open:
            return Response(
                {'error': 'Registration is not open for this event'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if already registered
        if event.is_team_based:
            # Check if user is already in a team that has assignments in this event
            if Team.objects.filter(
                members=user,
                program_assignments__program__event=event
            ).exists():
                return Response(
                    {'error': 'You are already registered for this event'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Check individual registration
            if IndividualParticipation.objects.filter(event=event, participant=user).exists():
                return Response(
                    {'error': 'You are already registered for this event'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check max participants
            if event.current_participants >= event.max_participants:
                return Response(
                    {'error': 'Event is full'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Register individual
            participation = IndividualParticipation.objects.create(
                event=event,
                participant=user
            )
            serializer = IndividualParticipationSerializer(participation)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(
            {'error': 'Team-based events require team registration'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=True, methods=['delete'])
    def unregister(self, request, pk=None):
        """Unregister from an event"""
        event = self.get_object()
        user = request.user
        
        if event.is_team_based:
            # Remove from team - find teams that have assignments in this event
            teams = Team.objects.filter(
                Q(program_assignments__program__event=event) & Q(members=user)
            ).distinct()
            if teams.exists():
                team = teams.first()
                team.members.remove(user)
                return Response(status=status.HTTP_204_NO_CONTENT)
        else:
            # Remove individual participation
            try:
                participation = IndividualParticipation.objects.get(
                    event=event, participant=user
                )
                participation.delete()
                return Response(status=status.HTTP_204_NO_CONTENT)
            except IndividualParticipation.DoesNotExist:
                pass
        
        return Response(
            {'error': 'You are not registered for this event'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=True, methods=['get'])
    def participants(self, request, pk=None):
        """Get event participants"""
        event = self.get_object()
        
        if event.is_team_based:
            teams = Team.objects.filter(program_assignments__program__event=event).distinct().prefetch_related('members')
            serializer = TeamSerializer(teams, many=True)
            return self.get_paginated_response(serializer.data)
        else:
            participants = IndividualParticipation.objects.filter(event=event).select_related('participant')
            serializer = IndividualParticipationSerializer(participants, many=True)
            return self.get_paginated_response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def announcements(self, request, pk=None):
        """Get event announcements"""
        event = self.get_object()
        announcements = EventAnnouncement.objects.filter(event=event).select_related('created_by')
        serializer = EventAnnouncementSerializer(announcements, many=True)
        return self.get_paginated_response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrEventManager])
    def create_announcement(self, request, pk=None):
        """Create an announcement for the event"""
        event = self.get_object()
        serializer = EventAnnouncementCreateSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save(event=event, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """Get event statistics"""
        event = self.get_object()
        
        stats = {
            'total_participants': event.current_participants,
            'registration_progress': (event.current_participants / event.max_participants) * 100,
            'status': event.status,
            'days_until_start': (event.start_date - timezone.now().date()).days,
            'is_registration_open': event.is_registration_open,
        }
        
        if event.is_team_based:
            stats.update({
                'total_teams': event.current_teams,
                'team_progress': (event.current_teams / (event.max_teams or 1)) * 100,
            })
        
        return Response(stats)

    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        """Get comprehensive analytics for an event"""
        event = self.get_object()
        
        # Basic statistics
        programs = event.programs.filter(is_active=True)
        total_programs = programs.count()
        programs_with_results = programs.filter(results__isnull=False).distinct().count()
        
        # Participation statistics
        total_assignments = ProgramAssignment.objects.filter(program__event=event).count()
        unique_participants = ProgramAssignment.objects.filter(
            program__event=event
        ).values('student').distinct().count()
        
        # Team statistics
        participating_teams = Team.objects.filter(
            program_assignments__program__event=event
        ).distinct().count()
        
        # Category breakdown
        category_stats = {}
        for category, _ in Program.CATEGORY_CHOICES:
            category_programs = programs.filter(category=category)
            category_stats[category] = {
                'programs': category_programs.count(),
                'participants': ProgramAssignment.objects.filter(
                    program__in=category_programs
                ).count(),
                'teams': Team.objects.filter(
                    program_assignments__program__in=category_programs
                ).distinct().count()
            }
        
        # Performance metrics
        results = ProgramResult.objects.filter(program__event=event)
        avg_score = results.aggregate(avg=Avg('marks'))['avg'] or 0
        highest_score = results.aggregate(max=models.Max('marks'))['max'] or 0
        total_winners = results.filter(position__lte=3).count()
        
        # Team rankings for this event
        team_points = {}
        for result in results.filter(team__isnull=False):
            team_id = result.team.id
            if team_id not in team_points:
                team_points[team_id] = {
                    'team': result.team,
                    'total_points': 0,
                    'programs_participated': set(),
                    'programs_won': 0
                }
            team_points[team_id]['total_points'] += result.points_earned
            team_points[team_id]['programs_participated'].add(result.program.id)
            if result.position == 1:
                team_points[team_id]['programs_won'] += 1
        
        # Convert to list and sort
        team_rankings = []
        for team_data in team_points.values():
            team_rankings.append({
                'id': team_data['team'].id,
                'name': team_data['team'].name,
                'total_points': team_data['total_points'],
                'programs_participated': len(team_data['programs_participated']),
                'programs_won': team_data['programs_won'],
                'win_rate': (team_data['programs_won'] / len(team_data['programs_participated']) * 100) if team_data['programs_participated'] else 0
            })
        team_rankings.sort(key=lambda x: x['total_points'], reverse=True)
        
        return Response({
            'total_programs': total_programs,
            'completed_programs': programs_with_results,
            'programs_with_results': programs_with_results,
            'total_participants': unique_participants,
            'total_teams': participating_teams,
            'participation_rate': (unique_participants / User.objects.filter(role='student').count() * 100) if User.objects.filter(role='student').count() > 0 else 0,
            'avg_programs_per_student': (total_assignments / unique_participants) if unique_participants > 0 else 0,
            'category_stats': category_stats,
            'avg_score': round(avg_score, 2),
            'highest_score': highest_score,
            'total_winners': total_winners,
            'team_rankings': team_rankings[:10],  # Top 10 teams
            'close_competitions': results.filter(
                position__lte=3
            ).values('program').annotate(
                score_diff=models.Max('marks') - models.Min('marks')
            ).filter(score_diff__lte=5).count()
        })

    @action(detail=True, methods=['get'])
    def points_teams(self, request, pk=None):
        """Get team points for this specific event (show all teams that participated, even with 0 points)"""
        event = self.get_object()
        
        # Get all teams that have participated in this event through program assignments
        teams_in_event = Team.objects.filter(
            program_assignments__program__event=event  # Teams with assignments in this event
        ).distinct()

        # Get points and stats for teams with results
        team_results = ProgramResult.objects.filter(
            program__event=event,
            team__isnull=False
        ).values('team').annotate(
            total_points=Sum('points_earned'),
            programs_participated=Count('program', distinct=True),
            programs_won=Count('id', filter=Q(position=1))
        )
        team_results_dict = {tr['team']: tr for tr in team_results}
        
        team_data = []
        for team in teams_in_event:
            result = team_results_dict.get(team.id)
            total_points = result['total_points'] if result else 0
            programs_participated = result['programs_participated'] if result else 0
            programs_won = result['programs_won'] if result else 0
            
            # Get recent achievements
            recent_achievements = ProgramResult.objects.filter(
                program__event=event,
                team=team,
                position__lte=3
            ).select_related('program').order_by('-updated_at')[:3]
            
            team_data.append({
                'team_id': team.id,
                'team_name': team.name,
                'total_points': total_points or 0,
                'programs_participated': programs_participated,
                'programs_won': programs_won,
                'recent_achievements': [{
                    'program_name': achievement.program.name,
                    'position': achievement.position,
                    'points': achievement.points_earned
                } for achievement in recent_achievements]
            })
        
        # Sort by total_points descending
        team_data.sort(key=lambda x: x['total_points'], reverse=True)
        
        # Apply pagination properly
        paginator = StandardPagination()
        page = paginator.paginate_queryset(team_data, request)
        if page is not None:
            return paginator.get_paginated_response(page)
        return Response(team_data)

    @action(detail=True, methods=['get'])
    def points_students(self, request, pk=None):
        """Get individual student points for this specific event"""
        event = self.get_object()
        
        # Get all students that participated in this event (excluding general category programs)
        student_results = ProgramResult.objects.filter(
            program__event=event,
            program__category__in=['hs', 'hss'],  # Exclude general category
            participant__isnull=False
        ).values('participant').annotate(
            total_points=Sum('points_earned'),
            programs_participated=Count('program', distinct=True),
            programs_won=Count('id', filter=Q(position=1))
        ).order_by('-total_points')
        
        student_data = []
        for result in student_results:
            from accounts.models import User
            student = User.objects.get(id=result['participant'])
            
            # Get recent achievements (excluding general category programs)
            recent_achievements = ProgramResult.objects.filter(
                program__event=event,
                program__category__in=['hs', 'hss'],  # Exclude general category
                participant=student,
                position__lte=3
            ).select_related('program').order_by('-updated_at')[:3]
            
            student_data.append({
                'student_id': student.id,
                'student_name': student.get_full_name(),
                'student_code': student.student_id,
                'total_points': result['total_points'] or 0,
                'programs_participated': result['programs_participated'],
                'programs_won': result['programs_won'],
                'recent_achievements': [{
                    'program_name': achievement.program.name,
                    'position': achievement.position,
                    'points': achievement.points_earned
                } for achievement in recent_achievements]
            })
        
        return Response({
            'count': len(student_data),
            'next': None,
            'previous': None,
            'results': student_data
        })
    
    @action(detail=True, methods=['post'])
    def bulk_upload_programs(self, request, pk=None):
        """AI-powered bulk upload programs via Excel file"""
        event = self.get_object()
        
        if 'file' not in request.FILES:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        if not file.name.endswith(('.xlsx', '.xls')):
            return Response({'error': 'Please upload an Excel file (.xlsx or .xls)'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Read Excel file
            try:
                df = pd.read_excel(file, engine='openpyxl' if file.name.endswith('.xlsx') else 'xlrd')
            except Exception as e:
                return Response({'error': f'Error reading Excel file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
            
            # AI-powered column detection and data validation
            results = self._process_program_excel_with_ai(df, event)
            
            if results['errors']:
                return Response({
                    'error': 'Data validation failed',
                    'details': results['errors'],
                    'suggestions': results['suggestions']
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Process successful program creations
            created_programs = []
            skipped = []
            
            for program_data in results['valid_programs']:
                try:
                    # Check if program already exists
                    existing_program = Program.objects.filter(
                        event=event,
                        name=program_data['name']
                    ).first()
                    
                    if existing_program:
                        skipped.append({
                            'name': program_data['name'],
                            'reason': 'Program already exists with this name'
                        })
                        continue
                    
                    # Create new program (only required fields)
                    program = Program.objects.create(
                        event=event,
                        name=program_data['name'],
                        category=program_data.get('category', 'open'),
                        max_participants=program_data.get('max_participants'),
                        program_type=program_data.get('program_type', 'stage'),
                        is_active=True
                    )
                    created_programs.append(program)
                    
                except Exception as e:
                    skipped.append({
                        'name': program_data.get('name', 'Unknown'),
                        'reason': f'Error creating program: {str(e)}'
                    })
            
            serializer = ProgramSerializer(created_programs, many=True)
            return Response({
                'success': True,
                'message': f'Successfully processed {len(created_programs)} programs',
                'programs': serializer.data,
                'skipped': skipped,
                'summary': {
                    'total_processed': len(results['valid_programs']),
                    'successful_creations': len(created_programs),
                    'skipped_creations': len(skipped),
                    'event_name': event.title
                },
                'note': 'max_participants values represent the maximum participants per team, not total participants across all teams'
            })
            
        except Exception as e:
            return Response({'error': f'Unexpected error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _process_program_excel_with_ai(self, df, event):
        """AI-powered Excel processing for program data"""
        results = {
            'valid_programs': [],
            'errors': [],
            'suggestions': []
        }
        
        # Detect columns using AI
        column_mapping = self._detect_program_columns(df.columns.tolist())
        
        # Validate required columns
        if 'name' not in column_mapping:
            results['errors'].append('Could not detect "Program Name" column. Please ensure your Excel file has a column with program names.')
            results['suggestions'].append('Add a column with header "Program Name" or "Name"')
            return results
        
        # Process each row
        for index, row in df.iterrows():
            try:
                # Extract required fields
                name = str(row[column_mapping['name']]).strip()
                
                # Skip empty rows
                if pd.isna(name) or name == '' or name.lower() == 'nan':
                    continue
                
                # Build program data (only required fields)
                program_data = {
                    'name': name,
                    'event': event.id
                }
                # Only allow category, program_type, max_participants
                for field in ['category', 'program_type', 'max_participants']:
                    if column_mapping.get(field):
                        value = str(row[column_mapping[field]]).strip()
                        if value and value.lower() != 'nan':
                            if field == 'max_participants':
                                try:
                                    program_data[field] = int(float(value))
                                except:
                                    pass
                            else:
                                program_data[field] = value
                # Validate program_type
                if 'program_type' not in program_data or program_data['program_type'] not in ['stage', 'off_stage']:
                    results['errors'].append(f'Row {index + 2}: Program type ("Type") is required and must be either "stage" or "off_stage".')
                    continue
                # Handle category mapping
                if column_mapping.get('category'):
                    category = str(row[column_mapping['category']]).strip().lower()
                    if category in ['hs', 'high school', 'high_school']:
                        program_data['category'] = 'hs'
                    elif category in ['hss', 'higher secondary', 'higher_secondary']:
                        program_data['category'] = 'hss'
                    elif category in ['general', 'open', 'open category']:  # Support both for backward compatibility
                        results['errors'].append(f'Row {index + 2}: General category programs cannot be uploaded via bulk upload. Please create them manually.')
                        continue
                # Validate max_participants
                if 'max_participants' not in program_data or not program_data.get('max_participants') or program_data['max_participants'] <= 0:
                    results['errors'].append(f'Row {index + 2}: Program must have a positive "Max Participants" value')
                    continue
                results['valid_programs'].append(program_data)
            except Exception as e:
                results['errors'].append(f'Row {index + 2}: Error processing data: {str(e)}')
        return results
    
    def _detect_program_columns(self, columns):
        """AI-powered column detection for program data"""
        column_mapping = {}
        
        # Define patterns for different fields - updated for new structure
        patterns = {
            'name': [r'name', r'title', r'program.*name', r'event.*name'],
            'category': [r'category', r'class', r'level', r'grade'],
            'venue': [r'venue', r'location', r'place', r'hall', r'room'],
            'max_participants': [r'max.*participants', r'capacity', r'limit', r'max.*people'],
            'is_team_based': [r'team.*based', r'team', r'group', r'is.*team'],
            'team_size_min': [r'min.*team', r'team.*min', r'minimum.*size', r'min.*size'],
            'team_size_max': [r'max.*team', r'team.*max', r'maximum.*size', r'max.*size'],
            'program_type': [r'program.*type', r'type', r'program.*stage', r'stage']
        }
        
        for field, field_patterns in patterns.items():
            for column in columns:
                for pattern in field_patterns:
                    if re.search(pattern, column, re.IGNORECASE):
                        column_mapping[field] = column
                        break
                if field in column_mapping:
                    break
        
        return column_mapping

    @action(detail=True, methods=['get'])
    def download_program_template(self, request, pk=None):
        """Download Excel template for bulk program upload"""
        try:
            event = self.get_object()
            
            # Create workbook and worksheet
            wb = Workbook()
            ws = wb.active
            ws.title = "Programs Template"
            
            # Add headers
            ws.append(["Name", "Category", "Type", "Max Participants"])
            # Add example row
            ws.append(["English Elocution", "hs", "stage", "20"])
            ws.append(["Quiz", "hss", "off_stage", "30"])
            ws.append(["Debate", "hs", "stage", "15"])
            
            # Set column widths
            for col in ws.columns:
                max_length = 0
                column = col[0].column_letter # Get the column name
                for cell in col:
                    try: # Necessary to avoid error on empty cells
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = (max_length + 2)
                ws.column_dimensions[column].width = adjusted_width
            
            # Save to BytesIO
            from io import BytesIO
            output = BytesIO()
            wb.save(output)
            output.seek(0)
            
            response = HttpResponse(
                output,
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = f'attachment; filename="bulk_upload_template_{event.title.replace(" ", "_")}.xlsx"'
            return response
            
        except Exception as e:
            return Response({'error': f'Error generating template: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def search_by_chest_number(self, request, pk=None):
        """Search student by chest number in this event"""
        event = self.get_object()
        chest_number = request.query_params.get('chest_number')
        
        if not chest_number:
            return Response(
                {'error': 'chest_number parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            chest_number = int(chest_number)
        except ValueError:
            return Response(
                {'error': 'chest_number must be a valid integer'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            chest_record = ChestNumber.objects.get(
                event=event,
                chest_number=chest_number
            )
            
            # Get student's program assignments for this event
            assignments = ProgramAssignment.objects.filter(
                program__event=event,
                student=chest_record.student
            ).select_related('program', 'team')
            
            # Get student's results for this event
            results = ProgramResult.objects.filter(
                program__event=event,
                participant=chest_record.student
            ).select_related('program')
            
            # Prepare response data
            student_data = {
                'chest_number': chest_record.chest_number,
                'student': {
                    'id': chest_record.student.id,
                    'name': chest_record.student.get_full_name(),
                    'student_id': chest_record.student.student_id,
                    'email': chest_record.student.email,
                    'category': chest_record.student.category,
                    'grade': chest_record.student.grade,
                    'section': chest_record.student.section,
                },
                'team': {
                    'id': chest_record.team.id,
                    'name': chest_record.team.name,
                },
                'programs': [
                    {
                        'id': assignment.program.id,
                        'name': assignment.program.name,
                        'category': assignment.program.category,
                        'start_time': assignment.program.start_time,
                        'venue': assignment.program.venue,
                        'status': assignment.program.status,
                        'assigned_at': assignment.assigned_at,
                    }
                    for assignment in assignments
                ],
                'results': [
                    {
                        'program_id': result.program.id,
                        'program_name': result.program.name,
                        'marks': result.marks,
                        'position': result.position,
                        'points_earned': result.points_earned,
                        'comments': result.comments,
                    }
                    for result in results
                ],
                'assigned_at': chest_record.assigned_at,
            }
            
            return Response(student_data)
            
        except ChestNumber.DoesNotExist:
            return Response(
                {'error': f'No student found with chest number {chest_number} in this event'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['get'])
    def chest_numbers(self, request, pk=None):
        """Get all chest numbers for this event"""
        event = self.get_object()
        chest_numbers = ChestNumber.objects.filter(event=event).select_related('student', 'team')
        serializer = ChestNumberSerializer(chest_numbers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def category_top_performers(self, request, pk=None):
        """Get the highest point scorer in each category and program type, plus overall champion"""
        try:
            event = Event.objects.get(pk=pk)
        except Event.DoesNotExist:
            return Response({'error': 'Event not found'}, status=404)
        
        # Get all individual programs for this event (excluding general category)
        individual_programs = event.programs.filter(is_team_based=False, is_active=True).exclude(category='general')
        
        # Prepare structure
        category_performers = {}
        all_participant_points = {}
        program_types = [('stage', 'Stage'), ('off_stage', 'Off Stage')]
        
        for category, category_name in Program.CATEGORY_CHOICES:
            category_performers[category] = {}
            for prog_type, prog_type_label in program_types:
                # Filter programs by category and program_type
                category_programs = individual_programs.filter(category=category, program_type=prog_type)
                if category_programs.exists():
                    all_results = ProgramResult.objects.filter(
                        program__in=category_programs,
                        position__lte=3,
                        position__gt=0
                    ).select_related('participant', 'team', 'program')
                    participant_points = {}
                    for result in all_results:
                        participant_id = result.participant.id
                        position_points = {1: 5, 2: 3, 3: 1}
                        points = position_points.get(result.position, 0)
                        if participant_id not in participant_points:
                            participant_points[participant_id] = {
                                'total_points': 0,
                                'participant': result.participant,
                                'team': result.team,
                                'achievements': []
                            }
                        participant_points[participant_id]['total_points'] += points
                        participant_points[participant_id]['achievements'].append({
                            'program_name': result.program.name,
                            'position': result.position,
                            'points': points,
                            'average_marks': result.average_marks
                        })
                        # For overall champion
                        if participant_id not in all_participant_points:
                            all_participant_points[participant_id] = {
                                'total_points': 0,
                                'participant': result.participant,
                                'team': result.team,
                                'achievements': []
                            }
                        all_participant_points[participant_id]['total_points'] += points
                        all_participant_points[participant_id]['achievements'].append({
                            'program_name': result.program.name,
                            'position': result.position,
                            'points': points,
                            'average_marks': result.average_marks
                        })
                    if participant_points:
                        top_participant_id = max(participant_points.keys(), key=lambda x: participant_points[x]['total_points'])
                        top_data = participant_points[top_participant_id]
                        chest_number = self.get_chest_number_for_participant(top_data['participant'], event)
                        performer_data = {
                            'student_id': top_data['participant'].id,
                            'student_name': top_data['participant'].get_full_name(),
                            'team_name': top_data['team'].name if top_data['team'] else None,
                            'chest_number': chest_number,
                            'total_points': top_data['total_points'],
                            'achievements': top_data['achievements']
                        }
                        category_performers[category][prog_type] = {
                            'category_name': category_name,
                            'program_type': prog_type_label,
                            'top_performer': performer_data
                        }
        # Overall champion (across all categories and program types)
        overall_champion = None
        if all_participant_points:
            top_participant_id = max(all_participant_points.keys(), key=lambda x: all_participant_points[x]['total_points'])
            top_data = all_participant_points[top_participant_id]
            chest_number = self.get_chest_number_for_participant(top_data['participant'], event)
            overall_champion = {
                'student_id': top_data['participant'].id,
                'student_name': top_data['participant'].get_full_name(),
                'team_name': top_data['team'].name if top_data['team'] else None,
                'chest_number': chest_number,
                'total_points': top_data['total_points'],
                'achievements': top_data['achievements']
            }
        response = {
            'category_champions': category_performers,
            'overall_champion': overall_champion
        }
        return Response(response)
    
    def get_chest_number_for_participant(self, participant, event):
        """Helper method to get chest number for a participant in an event"""
        try:
            from events.models import ProgramAssignment
            assignment = ProgramAssignment.objects.filter(
                student=participant,
                program__event=event
            ).first()
            return assignment.chest_number if assignment else None
        except:
            return None

    @action(detail=True, methods=['get'])
    def programs_with_results(self, request, pk=None):
        """Return only programs for this event that have results entered (average_marks not null)"""
        event = self.get_object()
        category = request.query_params.get('category')
        # Get all programs for this event
        programs = event.programs.filter(is_active=True)
        if category:
            programs = programs.filter(category=category)
        # Only include programs with at least one result with average_marks not null
        programs_with_results = programs.filter(results__average_marks__isnull=False).distinct()
        serializer = ProgramSerializer(programs_with_results, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def admin_programs(self, request, pk=None):
        """Get programs with assignments for admin assignment section"""
        event = self.get_object()
        programs = Program.objects.filter(event=event)
        
        program_data = []
        for program in programs:
            # Get all assignments for this program
            assignments = ProgramAssignment.objects.filter(program=program).select_related('student', 'team')
            
            assigned_students = []
            for assignment in assignments:
                assigned_students.append({
                    'id': assignment.id,
                    'name': assignment.student.get_full_name(),
                    'student_id': assignment.student.student_id,
                    'team_id': assignment.team.id if assignment.team else None,
                    'team_name': assignment.team.name if assignment.team else None,
                    'assigned_at': assignment.assigned_at
                })
            
            program_data.append({
                'id': program.id,
                'name': program.name,
                'description': program.description,
                'category': program.category,
                'program_type': 'Individual' if not program.is_team_based else 'Team',
                'is_team_based': program.is_team_based,
                'team_size_min': program.team_size_min,
                'team_size_max': program.team_size_max,
                'max_participants': program.max_participants,
                'assigned_students': assigned_students,
                'start_time': program.start_time,
                'end_time': program.end_time,
                'venue': program.venue,
                'is_active': program.is_active,
                'is_finished': program.is_finished
            })
        
        return Response(program_data)

class TeamViewSet(viewsets.ModelViewSet):
    """ViewSet for Team management"""
    serializer_class = TeamSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['name', 'description']
    pagination_class = SmallPagination
    
    def get_queryset(self):
        """Filter teams based on user permissions and query parameters"""
        user = self.request.user
        
        # Base queryset based on user permissions
        if user.role in ['admin', 'event_manager']:
            queryset = Team.objects.all().prefetch_related('members')
        else:
            # Users can only see teams they're part of
            queryset = Team.objects.filter(
                Q(members=user)
            ).prefetch_related('members')
        
        # Apply search filter
        search_param = self.request.query_params.get('search')
        if search_param:
            queryset = queryset.filter(
                Q(name__icontains=search_param) | Q(description__icontains=search_param)
            )
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TeamCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return TeamCreateUpdateSerializer
        return TeamSerializer
    
    def create(self, request, *args, **kwargs):
        """Create a team (optionally linked to an event)"""
        serializer = self.get_serializer(data=request.data)
        
        if serializer.is_valid():
            team = serializer.save()
            
            # Optionally link to event if provided
            event_id = request.data.get('event_id')
            if event_id:
                try:
                    from events.models import Event
                    event = Event.objects.get(id=event_id)
                    team.event = event
                    team.save()
                except Event.DoesNotExist:
                    pass  # Continue without linking if event doesn't exist
            
            return Response(
                TeamSerializer(team).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def add_member(self, request, pk=None):
        """Add a member to the team"""
        team = self.get_object()
        user = request.user
        
        # Only admins and event managers can add members
        if user.role not in ['admin', 'event_manager']:
            return Response(
                {'error': 'Only admins and event managers can add members'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        email = request.data.get('email')
        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            new_member = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if user is already in a team for this event
        if Team.objects.filter(
            Q(event=team.event) & Q(members=new_member)
        ).exists():
            return Response(
                {'error': 'User is already in a team for this event'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check team size limit
        if team.event and team.event.team_size_max and team.member_count >= team.event.team_size_max:
            return Response(
                {'error': 'Team is full'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        team.members.add(new_member)
        serializer = TeamSerializer(team)
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete', 'post'])
    def remove_member(self, request, pk=None):
        """Remove a member from the team"""
        team = self.get_object()
        user = request.user
        
        member_id = request.data.get('member_id')
        if not member_id:
            return Response(
                {'error': 'Member ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check permissions - only admins, event managers, or the member themselves can remove
        if user.role not in ['admin', 'event_manager'] and str(user.id) != member_id:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            member = User.objects.get(id=member_id)
            team.members.remove(member)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except User.DoesNotExist:
            return Response(
                {'error': 'Member not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['get'], permission_classes=[IsAdminOrEventManager])
    def credentials(self, request, pk=None):
        """Get team login credentials (admin only)"""
        team = self.get_object()
        
        # Generate credentials if not exist
        if not team.team_username or not team.team_password:
            team.generate_team_credentials()
            team.save()
        
        return Response({
            'team_id': team.team_number,
            'team_name': team.name,
            'username': team.team_username,
            'password': team.team_password,
            'created_at': team.created_at
        })
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrEventManager])
    def regenerate_credentials(self, request, pk=None):
        """Regenerate team login credentials (admin only)"""
        team = self.get_object()
        
        # Generate new credentials
        username, password = team.generate_team_credentials()
        team.save()
        
        return Response({
            'team_id': team.team_number,
            'team_name': team.name,
            'username': username,
            'password': password,
            'message': 'Credentials regenerated successfully'
        })
    
    @action(detail=True, methods=['get'], permission_classes=[IsAdminOrEventManager])
    def deletion_preview(self, request, pk=None):
        """Preview what will be deleted when this team is removed"""
        team = self.get_object()
        
        # Get summary of related data
        related_data = team.get_related_data_summary()
        
        return Response({
            'team_id': team.id,
            'team_name': team.name,
            'warning': 'This action will permanently delete the team and all related data.',
            'related_data': related_data,
            'total_records': sum(related_data.values()),
            'message': f'Deleting this team will remove {sum(related_data.values())} related records including program assignments, results, chest numbers, and points records.'
        })
    
    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrEventManager])
    def reset_numbering(self, request):
        """Reset team numbering to start from 1 for all teams"""
        try:
            from events.models import Team
            Team.reset_team_numbering()
            
            # Get updated team list
            teams = Team.objects.all().order_by('created_at')
            team_data = [{
                'id': team.id,
                'name': team.name,
                'team_number': team.team_number
            } for team in teams]
            
            return Response({
                'message': f'Successfully reset team numbering for {teams.count()} teams.',
                'teams': team_data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': f'Failed to reset team numbering: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAdminOrEventManager])
    def next_number(self, request):
        """Get the next available team number"""
        try:
            from events.models import Team
            next_number = Team.get_next_team_number()
            
            return Response({
                'next_team_number': next_number
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': f'Failed to get next team number: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'], url_path='events/(?P<event_id>[0-9]+)/details')
    def events(self, request, pk=None, event_id=None):
        """Get team's detailed event performance breakdown"""
        team = self.get_object()
        
        if not event_id:
            return Response({'error': 'event_id is required'}, status=400)
        
        try:
            from events.models import Event, ProgramResult, ProgramAssignment
            event = Event.objects.get(id=event_id)
            
            # Get team's performance in this event
            results = ProgramResult.objects.filter(
                program__event=event,
                team=team
            ).select_related('program', 'participant')
            
            # Calculate totals
            total_points = sum(result.points_earned for result in results)
            programs_participated = results.values('program').distinct().count()
            programs_won = results.filter(position=1).count()
            
            # Get detailed program results with student breakdown
            program_results = []
            for result in results:
                # Get all team members who participated in this program
                program_assignments = ProgramAssignment.objects.filter(
                    program=result.program,
                    team=team
                ).select_related('student')
                
                team_members = []
                for assignment in program_assignments:
                    # Check if this student has a result for this program
                    student_result = ProgramResult.objects.filter(
                        program=result.program,
                        participant=assignment.student,
                        team=team
                    ).first()
                    
                    team_members.append({
                        'student_id': assignment.student.id,
                        'student_name': assignment.student.get_full_name(),
                        'student_code': assignment.student.student_id,
                        'chest_number': assignment.chest_number,
                        'has_result': student_result is not None,
                        'position': student_result.position if student_result else None,
                        'points_earned': student_result.points_earned if student_result else 0,
                        'total_marks': float(student_result.total_marks) if student_result and student_result.total_marks else None,
                        'average_marks': float(student_result.average_marks) if student_result and student_result.average_marks else None,
                        'judge1_marks': float(student_result.judge1_marks) if student_result and student_result.judge1_marks else None,
                        'judge2_marks': float(student_result.judge2_marks) if student_result and student_result.judge2_marks else None,
                        'judge3_marks': float(student_result.judge3_marks) if student_result and student_result.judge3_marks else None,
                    })
                
                program_results.append({
                    'program_id': result.program.id,
                    'program_name': result.program.name,
                    'category': result.program.category,
                    'program_type': 'Team' if result.program.is_team_based else 'Individual',
                    'venue': result.program.venue,
                    'start_time': result.program.start_time.isoformat() if result.program.start_time else None,
                    'end_time': result.program.end_time.isoformat() if result.program.end_time else None,
                    'team_position': result.position,
                    'team_points_earned': result.points_earned,
                    'team_total_marks': float(result.total_marks) if result.total_marks else None,
                    'team_average_marks': float(result.average_marks) if result.average_marks else None,
                    'team_members': team_members,
                    'total_team_members': len(team_members),
                    'members_with_results': len([m for m in team_members if m['has_result']])
                })
            
            # Get team members who didn't participate in any programs
            all_team_assignments = ProgramAssignment.objects.filter(
                program__event=event,
                team=team
            ).values('student').distinct()
            
            participating_students = set()
            for result in results:
                participating_students.add(result.participant.id)
            
            # Get team member details
            from accounts.models import User
            team_member_details = []
            for member in team.members.all():
                member_data = {
                    'student_id': member.id,
                    'student_name': member.get_full_name(),
                    'student_code': member.student_id,
                    'category': member.get_category_display() if member.category else 'N/A',
                    'participated_in_event': member.id in participating_students,
                    'total_points_earned': sum(
                        r.points_earned for r in results if r.participant_id == member.id
                    ),
                    'programs_participated': results.filter(participant=member).values('program').distinct().count(),
                    'best_position': results.filter(participant=member).aggregate(
                        best=models.Min('position')
                    )['best']
                }
                team_member_details.append(member_data)
            
            return Response({
                'team_id': team.id,
                'team_name': team.name,
                'event_id': event.id,
                'event_title': event.title,
                'total_points': total_points,
                'programs_participated': programs_participated,
                'programs_won': programs_won,
                'win_rate': (programs_won / programs_participated * 100) if programs_participated > 0 else 0,
                'program_results': program_results,
                'team_members': team_member_details,
                'total_team_members': len(team_member_details),
                'participating_members': len([m for m in team_member_details if m['participated_in_event']])
            })
            
        except Event.DoesNotExist:
            return Response({'error': 'Event not found'}, status=404)

    @action(detail=True, methods=['get'])
    def comprehensive_details(self, request, pk=None):
        """Get comprehensive team details including all events, programs, and students"""
        team = self.get_object()
        
        try:
            from events.models import Event, ProgramResult, ProgramAssignment, Program
            from accounts.models import User
            
            # Get all events this team has participated in
            team_events = Event.objects.filter(
                Q(programs__assignments__team=team)  # Teams with program assignments
            ).distinct()
            
            # Get all program assignments for this team
            all_assignments = ProgramAssignment.objects.filter(
                team=team
            ).select_related('program', 'program__event', 'student')
            
            # Get all results for this team
            all_results = ProgramResult.objects.filter(
                team=team
            ).select_related('program', 'program__event', 'participant')
            
            # Calculate overall team statistics
            total_points = sum(result.points_earned for result in all_results)
            events_participated = team_events.count()
            programs_participated = all_assignments.values('program').distinct().count()
            programs_won = all_results.filter(position=1).count()
            
            # Build comprehensive event breakdown
            event_breakdown = []
            for event in team_events:
                event_assignments = all_assignments.filter(program__event=event)
                event_results = all_results.filter(program__event=event)
                
                event_points = sum(result.points_earned for result in event_results)
                event_programs = event_assignments.values('program').distinct().count()
                event_wins = event_results.filter(position=1).count()
                
                # Get programs for this event
                event_programs_data = []
                for assignment in event_assignments:
                    program = assignment.program
                    program_results = event_results.filter(program=program)
                    
                    # Get students assigned to this program
                    program_students = []
                    for student_assignment in event_assignments.filter(program=program):
                        student = student_assignment.student
                        student_result = program_results.filter(participant=student).first()
                        
                        program_students.append({
                            'student_id': student.id,
                            'student_name': student.get_full_name(),
                            'student_code': student.student_id,
                            'category': student.get_category_display() if student.category else 'N/A',
                            'grade': student.grade,
                            'section': student.section,
                            'chest_number': student_assignment.chest_number,
                            'has_result': student_result is not None,
                            'position': student_result.position if student_result else None,
                            'points_earned': student_result.points_earned if student_result else 0,
                            'total_marks': float(student_result.total_marks) if student_result and student_result.total_marks else None,
                            'average_marks': float(student_result.average_marks) if student_result and student_result.average_marks else None,
                            'judge1_marks': float(student_result.judge1_marks) if student_result and student_result.judge1_marks else None,
                            'judge2_marks': float(student_result.judge2_marks) if student_result and student_result.judge2_marks else None,
                            'judge3_marks': float(student_result.judge3_marks) if student_result and student_result.judge3_marks else None,
                        })
                    
                    # Get team result for this program
                    team_result = program_results.filter(team=team).first()
                    
                    event_programs_data.append({
                        'program_id': program.id,
                        'program_name': program.name,
                        'category': program.category,
                        'program_type': 'Team' if program.is_team_based else 'Individual',
                        'venue': program.venue,
                        'start_time': program.start_time.isoformat() if program.start_time else None,
                        'end_time': program.end_time.isoformat() if program.end_time else None,
                        'team_position': team_result.position if team_result else None,
                        'team_points_earned': team_result.points_earned if team_result else 0,
                        'team_total_marks': float(team_result.total_marks) if team_result and team_result.total_marks else None,
                        'team_average_marks': float(team_result.average_marks) if team_result and team_result.average_marks else None,
                        'students': program_students,
                        'total_students': len(program_students),
                        'students_with_results': len([s for s in program_students if s['has_result']])
                    })
                
                # Calculate total points for all teams in this event
                total_event_points = ProgramResult.objects.filter(
                    program__event=event,
                    team__isnull=False
                ).aggregate(total=Sum('points_earned'))['total'] or 0
                
                event_breakdown.append({
                    'event_id': event.id,
                    'event_name': event.title,
                    'event_type': event.event_type,
                    'event_status': event.status,
                    'total_points': event_points,
                    'total_event_points': total_event_points,
                    'programs_participated': event_programs,
                    'programs_won': event_wins,
                    'win_rate': (event_wins / event_programs * 100) if event_programs > 0 else 0,
                    'programs': event_programs_data
                })
            
            # Get team member details
            team_members = []
            for member in team.members.all():
                member_assignments = all_assignments.filter(student=member)
                member_results = all_results.filter(participant=member)
                
                member_data = {
                    'student_id': member.id,
                    'student_name': member.get_full_name(),
                    'student_code': member.student_id,
                    'category': member.get_category_display() if member.category else 'N/A',
                    'grade': member.grade,
                    'section': member.section,
                    'total_points_earned': sum(r.points_earned for r in member_results),
                    'events_participated': member_assignments.values('program__event').distinct().count(),
                    'programs_participated': member_assignments.values('program').distinct().count(),
                    'best_position': member_results.aggregate(best=Min('position'))['best'],
                    'programs_assigned': [
                        {
                            'program_name': assignment.program.name,
                            'event_name': assignment.program.event.title,
                            'chest_number': assignment.chest_number,
                            'has_result': member_results.filter(program=assignment.program).exists()
                        }
                        for assignment in member_assignments
                    ]
                }
                team_members.append(member_data)
            
            return Response({
                'team_id': team.id,
                'team_name': team.name,
                'description': team.description,
                'total_points': total_points,
                'events_participated': events_participated,
                'programs_participated': programs_participated,
                'programs_won': programs_won,
                'win_rate': (programs_won / programs_participated * 100) if programs_participated > 0 else 0,
                'total_members': len(team_members),
                'event_breakdown': event_breakdown,
                'team_members': team_members
            })
            
        except Exception as e:
            return Response({'error': f'Error fetching team details: {str(e)}'}, status=500)

class EventAnnouncementViewSet(viewsets.ModelViewSet):
    """ViewSet for Event Announcements"""
    serializer_class = EventAnnouncementSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['event', 'is_important']
    ordering = ['-created_at']
    pagination_class = SmallPagination
    
    def get_queryset(self):
        return EventAnnouncement.objects.all().select_related('event', 'created_by')
    
    def get_permissions(self):
        """Set permissions based on action"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAdminOrEventManager]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def perform_create(self, serializer):
        """Set the creator when creating an announcement"""
        serializer.save(created_by=self.request.user)

class ProgramViewSet(viewsets.ModelViewSet):
    serializer_class = ProgramSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ProgramFilter
    search_fields = ['name', 'description', 'venue']
    ordering_fields = ['start_time', 'end_time', 'created_at', 'name']
    ordering = ['start_time']
    pagination_class = CustomPagination
    
    def get_permissions(self):
        """Set permissions based on action"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAdminOrEventManager]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def get_queryset(self):
        """Filter programs based on query parameters"""
        queryset = Program.objects.all()
        
        # Filter by event if nested route
        event_pk = self.kwargs.get('event_pk')
        if event_pk:
            queryset = queryset.filter(event_id=event_pk)
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        """Override list to include category counts"""
        response = super().list(request, *args, **kwargs)
        
        # Get category counts for the current event
        event_pk = self.kwargs.get('event_pk')
        if event_pk:
            category_counts = Program.objects.filter(event_id=event_pk).values('category').annotate(
                count=Count('id')
            ).order_by('category')
            
            counts = {
                'hs': 0,
                'hss': 0,
                'general': 0,
                'total': 0
            }
            
            for category_data in category_counts:
                category = category_data['category']
                count = category_data['count']
                if category in counts:
                    counts[category] = count
                counts['total'] += count
            
            response.data['category_counts'] = counts
        
        return response
    
    def perform_create(self, serializer):
        """Set the event when creating a program"""
        event_id = self.request.data.get('event') or self.kwargs.get('event_pk')
        if event_id:
            event = Event.objects.get(id=event_id)
            serializer.save(event=event)
        else:
            serializer.save()
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrEventManager])
    def mark_finished(self, request, pk=None, event_pk=None):
        """Mark a program as finished"""
        program = self.get_object()
        program.is_finished = True
        program.save()
        
        return Response({
            'message': f'Program "{program.name}" marked as finished',
            'program': ProgramSerializer(program).data
        })
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrEventManager])
    def mark_unfinished(self, request, pk=None):
        """Mark a program as not finished"""
        program = self.get_object()
        program.is_finished = False
        program.save()
        
        return Response({
            'message': f'Program "{program.name}" marked as not finished',
            'program': ProgramSerializer(program).data
        })
    
    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """Get programs grouped by category"""
        categories = Program.objects.values('category').annotate(
            count=Count('id'),
            category_display=models.Case(
                models.When(category='hs', then=models.Value('High School')),
                models.When(category='hss', then=models.Value('Higher Secondary School')),
                models.When(category='general', then=models.Value('General')),
                default=models.Value('Unknown'),
                output_field=models.CharField()
            )
        ).order_by('category')
        
        result = {}
        for category in categories:
            cat_programs = Program.objects.filter(category=category['category']).order_by('start_time')
            result[category['category']] = {
                'display_name': category['category_display'],
                'count': category['count'],
                'programs': ProgramSerializer(cat_programs, many=True).data
            }
        
        return Response(result)
    
    @action(detail=False, methods=['get'])
    def by_time_status(self, request):
        """Get programs grouped by time status (upcoming, ongoing, finished)"""
        now = timezone.now()
        
        upcoming = Program.objects.filter(start_time__gt=now, is_finished=False).order_by('start_time')
        ongoing = Program.objects.filter(start_time__lte=now, end_time__gte=now, is_finished=False).order_by('start_time')
        finished = Program.objects.filter(is_finished=True).order_by('-end_time')
        
        return Response({
            'upcoming': {
                'count': upcoming.count(),
                'programs': ProgramSerializer(upcoming, many=True).data
            },
            'ongoing': {
                'count': ongoing.count(),
                'programs': ProgramSerializer(ongoing, many=True).data
            },
            'finished': {
                'count': finished.count(),
                'programs': ProgramSerializer(finished, many=True).data
            }
        })
    
    @action(detail=False, methods=['get'])
    def category_counts(self, request):
        """Get category counts for programs in the current event"""
        # Get the event from the URL parameters
        event_pk = self.kwargs.get('event_pk')
        
        if not event_pk:
            return Response({'error': 'Event ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get category counts for the specific event
        category_counts = Program.objects.filter(event_id=event_pk).values('category').annotate(
            count=Count('id')
        ).order_by('category')
        
        # Initialize counts
        counts = {
            'hs': 0,
            'hss': 0,
            'general': 0,
            'total': 0
        }
        
        # Fill in the actual counts
        for category_data in category_counts:
            category = category_data['category']
            count = category_data['count']
            if category in counts:
                counts[category] = count
            counts['total'] += count
        
        return Response(counts)

class ProgramAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = ProgramAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = LargePagination
    
    def get_queryset(self):
        program_id = self.kwargs.get('program_pk')
        return ProgramAssignment.objects.filter(program_id=program_id)
    
    def perform_create(self, serializer):
        program_id = self.kwargs.get('program_pk')
        program = Program.objects.get(id=program_id)
        serializer.save(program=program, assigned_by=self.request.user)
    
    @action(detail=False, methods=['post'])
    def bulk_assign(self, request, event_pk=None, program_pk=None):
        """Assign multiple students to a program"""
        try:
            program = Program.objects.get(id=program_pk)
        except Program.DoesNotExist:
            return Response({
                'error': 'Program not found'
            }, status=status.HTTP_404_NOT_FOUND)
            
        student_ids = request.data.get('student_ids', [])
        return self.bulk_assign_internal(request, program, student_ids)
    
    def bulk_assign_internal(self, request, program, student_ids):
        """Internal method for bulk assignment logic"""
        if not student_ids:
            return Response({
                'error': 'No students provided for assignment'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get team_id from request if provided
        team_id = request.data.get('team_id')
        specified_team = None
        if team_id:
            try:
                specified_team = Team.objects.get(id=team_id)
            except Team.DoesNotExist:
                return Response({
                    'error': f'Team with ID {team_id} not found'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # For team-based programs, validate team assignment requirements
        if program.is_team_based:
            # Group students by team
            team_assignments = {}
            for student_id in student_ids:
                try:
                    student = User.objects.get(id=student_id, role='student')
                    
                    # If a specific team is specified, use that team
                    if specified_team:
                        team = specified_team
                    else:
                        team = student.team_memberships.first()
                    
                    if not team:
                        return Response({
                            'error': f'Student {student.get_full_name()} is not assigned to any team. Team-based programs require all participants to be team members.'
                        }, status=status.HTTP_400_BAD_REQUEST)
                    
                    if team.id not in team_assignments:
                        team_assignments[team.id] = {'team': team, 'students': []}
                    team_assignments[team.id]['students'].append(student)
                except User.DoesNotExist:
                    continue
            
            # Validate team size requirements
            for team_id, team_data in team_assignments.items():
                team = team_data['team']
                students = team_data['students']
                
                # Check if all team members are being assigned (for team-based programs)
                if program.team_size and len(students) != program.team_size:
                    return Response({
                        'error': f'Team "{team.name}" must have exactly {program.team_size} members for this program. Currently assigning: {len(students)}'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                if program.team_size_max and len(students) > program.team_size_max:
                    return Response({
                        'error': f'Team "{team.name}" cannot have more than {program.team_size_max} members for this program. Currently assigning: {len(students)}'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Check if team already has assignments for this program
                existing_assignments = ProgramAssignment.objects.filter(program=program, team=team)
                if existing_assignments.exists():
                    return Response({
                        'error': f'Team "{team.name}" is already assigned to this program. Remove existing assignments first.'
                    }, status=status.HTTP_400_BAD_REQUEST)
        
        # For individual programs, validate participant limits
        else:
            # Validation: Check if program has participant limit per team
            if program.max_participants:
                # Get total number of teams
                total_teams = Team.objects.count()
                if total_teams > 0:
                    # Divide max_participants equally among teams
                    per_team_limit = program.max_participants // total_teams
                else:
                    per_team_limit = program.max_participants
                
                # Group students by team and check limits
                team_assignments = {}
                for student_id in student_ids:
                    try:
                        student = User.objects.get(id=student_id, role='student')
                        # Try to find student's team (teams are no longer linked to events)
                        team = None
                        try:
                            # Check if student is a member of any team
                            team = Team.objects.get(members=student)
                        except Team.DoesNotExist:
                            pass
                        
                        if team:
                            if team.id not in team_assignments:
                                team_assignments[team.id] = {'team': team, 'students': []}
                            team_assignments[team.id]['students'].append(student)
                    except User.DoesNotExist:
                        continue
                
                # Check each team's limit
                for team_id, team_data in team_assignments.items():
                    team = team_data['team']
                    current_team_assignments = ProgramAssignment.objects.filter(program=program, team=team).count()
                    new_assignments_for_team = len(team_data['students'])
                    
                    if current_team_assignments + new_assignments_for_team > per_team_limit:
                        return Response({
                            'error': f'Team "{team.name}" would exceed the maximum limit of {per_team_limit} participants per team (out of {program.max_participants} total across {total_teams} teams). Current: {current_team_assignments}, Trying to add: {new_assignments_for_team}, Limit: {per_team_limit}'
                        }, status=status.HTTP_400_BAD_REQUEST)
        
        assignments = []
        errors = []
        
        for student_id in student_ids:
            try:
                student = User.objects.get(id=student_id, role='student')
                
                # Validation: Check category compatibility
                if program.category != 'open' and student.category != program.category:
                    category_names = {
                        'hs': 'High School',
                        'hss': 'Higher Secondary School',
                        'open': 'Open Category'
                    }
                    errors.append(f'Student {student.get_full_name()} ({student.student_id}) is {category_names.get(student.category, student.category)} but program is for {category_names.get(program.category, program.category)} category')
                    continue
                
                # Check if already assigned
                if ProgramAssignment.objects.filter(program=program, student=student).exists():
                    errors.append(f'Student {student.get_full_name()} ({student.student_id}) is already assigned to this program')
                    continue
                
                # Determine which team to assign
                team = None
                if specified_team:
                    # Use the specified team
                    team = specified_team
                else:
                    # Try to find student's team (teams are no longer linked to events)
                    try:
                        # Check if student is a member of any team
                        team = Team.objects.get(members=student)
                    except Team.DoesNotExist:
                        pass
                
                assignment = ProgramAssignment.objects.create(
                    program=program,
                    student=student,
                    team=team,
                    assigned_by=request.user
                )
                assignments.append(assignment)
                
            except User.DoesNotExist:
                errors.append(f'Student with ID {student_id} not found')
                continue
        
        response_data = {
            'message': f'Successfully assigned {len(assignments)} students',
            'assignments': self.get_serializer(assignments, many=True).data
        }
        
        if errors:
            response_data['errors'] = errors
            response_data['message'] = f'Assigned {len(assignments)} students with {len(errors)} errors'
        
        return Response(response_data, status=status.HTTP_200_OK if assignments else status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def bulk_upload(self, request, program_pk=None):
        """AI-powered bulk upload students to a program with Excel support"""
        if 'file' not in request.FILES:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        if not file.name.endswith(('.xlsx', '.xls')):
            return Response({'error': 'Please upload an Excel file (.xlsx or .xls)'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            program = Program.objects.get(id=program_pk)
            
            # Read Excel file
            try:
                df = pd.read_excel(file, engine='openpyxl' if file.name.endswith('.xlsx') else 'xlrd')
            except Exception as e:
                return Response({'error': f'Error reading Excel file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
            
            # AI-powered column detection and data validation
            results = self._process_excel_with_ai(df, program)
            
            if results['errors']:
                return Response({
                    'error': 'Data validation failed',
                    'details': results['errors'],
                    'suggestions': results['suggestions']
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Process successful assignments
            assignments = []
            skipped = []
            
            for student_data in results['valid_students']:
                try:
                    student = student_data['student']
                    
                    # Check if already assigned
                    if ProgramAssignment.objects.filter(program=program, student=student).exists():
                        skipped.append({
                            'student_id': student.student_id,
                            'name': student.get_full_name(),
                            'reason': 'Already assigned to this program'
                        })
                        continue
                    
                    # Find student's team (teams are no longer linked to events)
                    team = None
                    try:
                        team = Team.objects.get(members=student)
                    except Team.DoesNotExist:
                        pass
                    
                    assignment = ProgramAssignment.objects.create(
                        program=program,
                        student=student,
                        team=team,
                        assigned_by=request.user
                    )
                    assignments.append(assignment)
                    
                except Exception as e:
                    skipped.append({
                        'student_id': student_data.get('student_id', 'Unknown'),
                        'name': student_data.get('name', 'Unknown'),
                        'reason': f'Error creating assignment: {str(e)}'
                    })
            
            serializer = self.get_serializer(assignments, many=True)
            return Response({
                'success': True,
                'message': f'Successfully processed {len(assignments)} assignments',
                'assignments': serializer.data,
                'skipped': skipped,
                'summary': {
                    'total_processed': len(results['valid_students']),
                    'successful_assignments': len(assignments),
                    'skipped_assignments': len(skipped),
                    'program_name': program.name,
                    'event_name': program.event.title if program.event else 'No Event'
                }
            })
            
        except Program.DoesNotExist:
            return Response({'error': 'Program not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': f'Unexpected error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _process_excel_with_ai(self, df, program):
        """AI-powered processing of Excel data with smart column detection and validation"""
        results = {
            'valid_students': [],
            'errors': [],
            'suggestions': []
        }
        
        # Clean column names
        df.columns = df.columns.str.strip().str.lower()
        
        # AI-powered column mapping
        column_mapping = self._detect_columns(df.columns.tolist())
        
        if not column_mapping['student_id']:
            results['errors'].append('Could not find student ID column. Expected columns: student_id, id, student_number, or similar.')
            results['suggestions'].append('Please ensure your Excel file has a column for student IDs named: "student_id", "id", "student_number", or "roll_number"')
            return results
        
        # Process each row
        for index, row in df.iterrows():
            try:
                # Extract student identifier
                student_identifier = str(row[column_mapping['student_id']]).strip()
                if pd.isna(student_identifier) or student_identifier == '' or student_identifier.lower() == 'nan':
                    continue
                
                # Smart student matching with AI
                student = self._find_student_with_ai(student_identifier, row, column_mapping)
                
                if student:
                    # Validate student category against program requirements
                    if self._validate_student_for_program(student, program):
                        results['valid_students'].append({
                            'student': student,
                            'student_id': student.student_id,
                            'name': student.get_full_name(),
                            'category': student.category,
                            'row_number': index + 2  # Excel row number (1-indexed + header)
                        })
                    else:
                        results['errors'].append(f'Row {index + 2}: Student {student.student_id} ({student.get_full_name()}) does not meet program category requirements')
                else:
                    results['errors'].append(f'Row {index + 2}: Could not find student with identifier "{student_identifier}"')
                    
            except Exception as e:
                results['errors'].append(f'Row {index + 2}: Error processing data - {str(e)}')
        
        # Add suggestions for common issues
        if len(results['valid_students']) == 0 and len(results['errors']) > 0:
            results['suggestions'].extend([
                'Check if student IDs in the Excel file match exactly with those in the system',
                'Ensure there are no extra spaces or special characters in student IDs',
                'Verify that students exist in the system and have the correct category',
                'Download the template file for the correct format'
            ])
        
        return results
    
    def _detect_columns(self, columns):
        """AI-powered column detection using pattern matching"""
        mapping = {
            'student_id': None,
            'name': None,
            'category': None,
            'grade': None,
            'section': None
        }
        
        # Pattern matching for different column names
        patterns = {
            'student_id': [r'student.?id', r'^id$', r'student.?number', r'roll.?number', r'admission.?number'],
            'name': [r'name', r'student.?name', r'full.?name'],
            'category': [r'category', r'class', r'level'],
            'grade': [r'grade', r'class', r'std'],
            'section': [r'section', r'division', r'div']
        }
        
        for col in columns:
            col_clean = col.lower().strip()
            for field, pattern_list in patterns.items():
                if not mapping[field]:  # Only set if not already found
                    for pattern in pattern_list:
                        if re.search(pattern, col_clean):
                            mapping[field] = col
                            break
                if field in mapping:
                    break
        
        return mapping
    
    def _find_student_with_ai(self, identifier, row, column_mapping):
        """Smart student matching using multiple strategies"""
        # Strategy 1: Direct student_id match
        try:
            return User.objects.get(student_id=identifier, role='student')
        except User.DoesNotExist:
            pass
        
        # Strategy 2: Try with common prefixes/suffixes removed
        clean_identifier = re.sub(r'^(st|student|roll)', '', identifier.lower()).strip()
        clean_identifier = re.sub(r'[^\w]', '', clean_identifier)  # Remove special chars
        
        try:
            students = User.objects.filter(role='student')
            for student in students:
                clean_student_id = re.sub(r'[^\w]', '', student.student_id.lower())
                if clean_student_id == clean_identifier:
                    return student
        except:
            pass
        
        # Strategy 3: Fuzzy matching by name if name column exists
        if column_mapping['name']:
            try:
                name = str(row[column_mapping['name']]).strip()
                if name and name.lower() != 'nan':
                    # Try exact name match
                    name_parts = name.split()
                    if len(name_parts) >= 2:
                        first_name = name_parts[0]
                        last_name = ' '.join(name_parts[1:])
                        try:
                            return User.objects.get(
                                first_name__iexact=first_name,
                                last_name__iexact=last_name,
                                role='student'
                            )
                        except User.DoesNotExist:
                            pass
            except:
                pass
        
        return None
    
    def _validate_student_for_program(self, student, program):
        """Validate if student meets program requirements"""
        # Check category requirements
        if program.category != 'general':
            if student.category != program.category:
                return False
        
        # Additional validations can be added here
        # e.g., grade requirements, team requirements, etc.
        
        return True
    
    @action(detail=False, methods=['get'])
    def download_template(self, request, program_pk=None):
        """Generate and download Excel template for bulk upload"""
        try:
            program = Program.objects.get(id=program_pk)
            
            # Create template data
            template_data = {
                'student_id': ['HS2025001', 'HSS2025002', 'HS2025003'],
                'name': ['John Doe', 'Jane Smith', 'Bob Johnson'],
                'category': ['hs', 'hss', 'hs'],
                'grade': [9, 11, 10],
                'section': ['A', 'B', 'A']
            }
            
            # Create DataFrame
            df = pd.DataFrame(template_data)
            
            # Create Excel file in memory
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='Students', index=False)
                
                # Add instructions sheet
                instructions = pd.DataFrame({
                    'Instructions': [
                        '1. Fill in the student details in the "Students" sheet',
                        '2. student_id: Must match exactly with system records',
                        '3. name: Full name of the student (optional, used for verification)',
                        '4. category: hs (High School) or hss (Higher Secondary)',
                        '5. grade: Student grade/class number',
                        '6. section: Student section/division',
                        '7. Save the file and upload it back to the system',
                        '',
                        f'Program: {program.name}',
                        f'Event: {program.event.title if program.event else "No Event"}',
                        f'Category Requirement: {program.get_category_display()}',
                        f'Type: {program.get_type_display()}',
                        f'Team Based: {"Yes" if program.is_team_based else "No"}'
                    ]
                })
                instructions.to_excel(writer, sheet_name='Instructions', index=False)
            
            output.seek(0)
            
            # Create response
            response = HttpResponse(
                output.getvalue(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = f'attachment; filename="bulk_upload_template_{program.name.replace(" ", "_")}.xlsx"'
            
            return response
            
        except Program.DoesNotExist:
            return Response({'error': 'Program not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': f'Error generating template: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def assign_all_category(self, request, event_pk=None, program_pk=None):
        """Assign all students in a specific category to a program"""
        try:
            program = Program.objects.get(id=program_pk)
        except Program.DoesNotExist:
            return Response({
                'error': 'Program not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        category = request.data.get('category')
        if not category:
            return Response({
                'error': 'Category is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get all students in the specified category
        students = User.objects.filter(role='student', category=category)
        
        if not students.exists():
            return Response({
                'error': f'No students found in {category} category'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get student IDs
        student_ids = list(students.values_list('id', flat=True))
        
        # Use the existing bulk_assign logic
        return self.bulk_assign_internal(request, program, student_ids)
    
    def bulk_assign_internal(self, request, program, student_ids):
        """Internal method for bulk assignment logic"""
        if not student_ids:
            return Response({
                'error': 'No students provided for assignment'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get team_id from request if provided
        team_id = request.data.get('team_id')
        specified_team = None
        if team_id:
            try:
                specified_team = Team.objects.get(id=team_id)
            except Team.DoesNotExist:
                return Response({
                    'error': f'Team with ID {team_id} not found'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # For team-based programs, validate team assignment requirements
        if program.is_team_based:
            # Group students by team
            team_assignments = {}
            for student_id in student_ids:
                try:
                    student = User.objects.get(id=student_id, role='student')
                    
                    # If a specific team is specified, use that team
                    if specified_team:
                        team = specified_team
                    else:
                        team = student.team_memberships.first()
                    
                    if not team:
                        return Response({
                            'error': f'Student {student.get_full_name()} is not assigned to any team. Team-based programs require all participants to be team members.'
                        }, status=status.HTTP_400_BAD_REQUEST)
                    
                    if team.id not in team_assignments:
                        team_assignments[team.id] = {'team': team, 'students': []}
                    team_assignments[team.id]['students'].append(student)
                except User.DoesNotExist:
                    continue
            
            # Validate team size requirements
            for team_id, team_data in team_assignments.items():
                team = team_data['team']
                students = team_data['students']
                
                # Check if all team members are being assigned (for team-based programs)
                if program.team_size and len(students) != program.team_size:
                    return Response({
                        'error': f'Team "{team.name}" must have exactly {program.team_size} members for this program. Currently assigning: {len(students)}'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                if program.team_size_max and len(students) > program.team_size_max:
                    return Response({
                        'error': f'Team "{team.name}" cannot have more than {program.team_size_max} members for this program. Currently assigning: {len(students)}'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Check if team already has assignments for this program
                existing_assignments = ProgramAssignment.objects.filter(program=program, team=team)
                if existing_assignments.exists():
                    return Response({
                        'error': f'Team "{team.name}" is already assigned to this program. Remove existing assignments first.'
                    }, status=status.HTTP_400_BAD_REQUEST)
        
        # For individual programs, validate participant limits
        else:
            # Validation: Check if program has participant limit per team
            if program.max_participants:
                # Get total number of teams
                total_teams = Team.objects.count()
                if total_teams > 0:
                    # Divide max_participants equally among teams
                    per_team_limit = program.max_participants // total_teams
                else:
                    per_team_limit = program.max_participants
                
                # Group students by team and check limits
                team_assignments = {}
                for student_id in student_ids:
                    try:
                        student = User.objects.get(id=student_id, role='student')
                        # Try to find student's team (teams are no longer linked to events)
                        team = None
                        try:
                            # Check if student is a member of any team
                            team = Team.objects.get(members=student)
                        except Team.DoesNotExist:
                            pass
                        
                        if team:
                            if team.id not in team_assignments:
                                team_assignments[team.id] = {'team': team, 'students': []}
                            team_assignments[team.id]['students'].append(student)
                    except User.DoesNotExist:
                        continue
                
                # Check each team's limit
                for team_id, team_data in team_assignments.items():
                    team = team_data['team']
                    current_team_assignments = ProgramAssignment.objects.filter(program=program, team=team).count()
                    new_assignments_for_team = len(team_data['students'])
                    
                    if current_team_assignments + new_assignments_for_team > per_team_limit:
                        return Response({
                            'error': f'Team "{team.name}" would exceed the maximum limit of {per_team_limit} participants per team (out of {program.max_participants} total across {total_teams} teams). Current: {current_team_assignments}, Trying to add: {new_assignments_for_team}, Limit: {per_team_limit}'
                        }, status=status.HTTP_400_BAD_REQUEST)
        
        assignments = []
        errors = []
        
        for student_id in student_ids:
            try:
                student = User.objects.get(id=student_id, role='student')
                
                # Validation: Check category compatibility
                if program.category != 'open' and student.category != program.category:
                    category_names = {
                        'hs': 'High School',
                        'hss': 'Higher Secondary School',
                        'open': 'Open Category'
                    }
                    errors.append(f'Student {student.get_full_name()} ({student.student_id}) is {category_names.get(student.category, student.category)} but program is for {category_names.get(program.category, program.category)} category')
                    continue
                
                # Check if already assigned
                if ProgramAssignment.objects.filter(program=program, student=student).exists():
                    errors.append(f'Student {student.get_full_name()} ({student.student_id}) is already assigned to this program')
                    continue
                
                # Determine which team to assign
                team = None
                if specified_team:
                    # Use the specified team
                    team = specified_team
                else:
                    # Try to find student's team (teams are no longer linked to events)
                    try:
                        # Check if student is a member of any team
                        team = Team.objects.get(members=student)
                    except Team.DoesNotExist:
                        pass
                
                assignment = ProgramAssignment.objects.create(
                    program=program,
                    student=student,
                    team=team,
                    assigned_by=request.user
                )
                assignments.append(assignment)
                
            except User.DoesNotExist:
                errors.append(f'Student with ID {student_id} not found')
                continue
        
        response_data = {
            'message': f'Successfully assigned {len(assignments)} students',
            'assignments': self.get_serializer(assignments, many=True).data
        }
        
        if errors:
            response_data['errors'] = errors
            response_data['message'] = f'Assigned {len(assignments)} students with {len(errors)} errors'
        
        return Response(response_data, status=status.HTTP_200_OK if assignments else status.HTTP_400_BAD_REQUEST)

class ProgramResultViewSet(viewsets.ModelViewSet):
    """ViewSet for managing program results and marks"""
    serializer_class = ProgramResultSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = SmallPagination
    
    def get_queryset(self):
        program_id = self.kwargs.get('program_pk')
        if program_id:
            return ProgramResult.objects.filter(program_id=program_id)
        return ProgramResult.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'mark_entry':
            return MarkEntrySerializer
        elif self.action == 'results_summary':
            return ProgramResultSummarySerializer
        return ProgramResultSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'mark_entry', 'bulk_mark_entry']:
            return [IsAdminOrEventManager()]
        return [IsAuthenticated()]
    
    @action(detail=False, methods=['get'])
    def mark_entry(self, request, event_pk=None, program_pk=None):
        """Get participants for mark entry with their current marks"""
        try:
            program = Program.objects.get(id=program_pk, event_id=event_pk)
        except Program.DoesNotExist:
            return Response(
                {'error': 'Program not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get all assignments for this program
        assignments = ProgramAssignment.objects.filter(program=program)
        
        # For team-based programs, group by team and show one entry per team
        if program.is_team_based:
            team_results = {}
            
            for assignment in assignments:
                team = assignment.team
                if not team:
                    continue
                
                if team.id not in team_results:
                    # Get the first student from the team as the representative
                    first_student = assignment.student
                    
                    # Try to get existing result for this team, or create new one
                    # First try to find an existing result with this team
                    existing_result = ProgramResult.objects.filter(
                        program=program,
                        team=team
                    ).first()
                    
                    if existing_result:
                        result = existing_result
                        created = False
                        # Update participant if needed
                        if result.participant != first_student:
                            result.participant = first_student
                            result.save()
                    else:
                        # Create new result
                        result = ProgramResult.objects.create(
                            program=program,
                            team=team,
                            participant=first_student
                        )
                        created = True
                    
                    team_results[team.id] = {
                        'result': result,
                        'team': team,
                        'representative_student': first_student,
                        'all_team_members': []
                    }
                
                # Add all team members to the list
                team_results[team.id]['all_team_members'].append(assignment.student)
            
            # Convert to list format for serializer
            results = []
            for team_data in team_results.values():
                result = team_data['result']
                team = team_data['team']
                representative = team_data['representative_student']
                all_members = team_data['all_team_members']
                
                # Create a special result object for team-based programs
                team_result = ProgramResult(
                    id=result.id,
                    program=result.program,
                    participant=representative,
                    team=team,
                    judge1_marks=result.judge1_marks,
                    judge2_marks=result.judge2_marks,
                    judge3_marks=result.judge3_marks,
                    total_marks=result.total_marks,
                    average_marks=result.average_marks,
                    position=result.position,
                    points_earned=result.points_earned,
                    comments=result.comments,
                    entered_by=result.entered_by,
                    entered_at=result.entered_at,
                    updated_at=result.updated_at,
                    result_number=result.result_number
                )
                
                # Add team information to the result object
                team_result.team_name = team.name
                team_result.team_member_count = len(all_members)
                team_result.all_team_members = all_members
                team_result.is_team_based = True
                
                results.append(team_result)
        
        # For individual programs, show each student separately
        else:
            results = []
            for assignment in assignments:
                # Get the student's team for this event
                student_team = assignment.team or assignment.student.team_memberships.filter(event=program.event).first()
                
                # Try to get existing result, or create new one
                # First try to find an existing result with this participant
                existing_result = ProgramResult.objects.filter(
                    program=program,
                    participant=assignment.student
                ).first()
                
                if existing_result:
                    result = existing_result
                    created = False
                    # Update team if needed
                    if result.team != student_team:
                        result.team = student_team
                        result.save()
                else:
                    # Create new result
                    result = ProgramResult.objects.create(
                        program=program,
                        participant=assignment.student,
                        team=student_team
                    )
                    created = True
                
                results.append(result)
        
        serializer = MarkEntrySerializer(results, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def bulk_mark_entry(self, request, event_pk=None, program_pk=None):
        """Bulk update marks for multiple participants"""
        try:
            program = Program.objects.get(id=program_pk, event_id=event_pk)
        except Program.DoesNotExist:
            return Response(
                {'error': 'Program not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        marks_data = request.data.get('marks', [])
        updated_results = []
        
        for mark_data in marks_data:
            try:
                # For team-based programs, find result by team
                if program.is_team_based and 'team_id' in mark_data:
                    result = ProgramResult.objects.get(
                        program=program,
                        team_id=mark_data['team_id']
                    )
                else:
                    # For individual programs or fallback
                    result = ProgramResult.objects.get(
                        id=mark_data['id'],
                        program=program
                    )
                
                # Update marks
                if 'judge1_marks' in mark_data:
                    result.judge1_marks = mark_data['judge1_marks']
                if 'judge2_marks' in mark_data:
                    result.judge2_marks = mark_data['judge2_marks']
                if 'judge3_marks' in mark_data:
                    result.judge3_marks = mark_data['judge3_marks']
                if 'total_marks' in mark_data:
                    result.total_marks = mark_data['total_marks']
                if 'average_marks' in mark_data:
                    result.average_marks = mark_data['average_marks']
                if 'position' in mark_data:
                    result.position = mark_data['position']
                if 'points_earned' in mark_data:
                    result.points_earned = mark_data['points_earned']
                if 'comments' in mark_data:
                    result.comments = mark_data['comments']
                
                result.save()  # This will trigger points distribution via the save() method
                updated_results.append(result)
                
            except ProgramResult.DoesNotExist:
                continue
        
        # Trigger points distribution for all updated results
        for result in updated_results:
            if result.points_earned > 0:
                result.distribute_points_to_team_and_members()
        
        serializer = MarkEntrySerializer(updated_results, many=True)
        return Response({
            'message': f'Updated marks for {len(updated_results)} participants. Points distributed to teams and members.',
            'results': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def results_summary(self, request, event_pk=None, program_pk=None):
        """Get results summary for a program"""
        try:
            program = Program.objects.get(id=program_pk, event_id=event_pk)
        except Program.DoesNotExist:
            return Response(
                {'error': 'Program not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # For team-based programs, group results by team
        if program.is_team_based:
            # Get unique team results
            team_results = ProgramResult.objects.filter(
                program=program,
                team__isnull=False
            ).exclude(
                average_marks__isnull=True
            ).order_by('result_number', 'position', '-average_marks')
            
            # Add team information to each result
            for result in team_results:
                if result.team:
                    result.participant_name = f"{result.participant.get_full_name()} & Team"
                    result.team_name = result.team.name
                    result.is_team_based = True
        else:
            # For individual programs, show individual results
            team_results = ProgramResult.objects.filter(
                program=program
            ).exclude(
                average_marks__isnull=True
            ).order_by('result_number', 'position', '-average_marks')
            
            # Add individual information
            for result in team_results:
                result.participant_name = result.participant.get_full_name()
                result.is_team_based = False
        
        serializer = ProgramResultSummarySerializer(team_results, many=True)
        return Response({
            'program': ProgramSerializer(program).data,
            'results': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def results_pdf(self, request, event_pk=None, program_pk=None):
        """Generate PDF report of program results"""
        try:
            program = Program.objects.get(id=program_pk, event_id=event_pk)
        except Program.DoesNotExist:
            return Response(
                {'error': 'Program not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get results ordered by result_number
        results = ProgramResult.objects.filter(
            program=program
        ).exclude(
            average_marks__isnull=True
        ).order_by('result_number', 'position', '-average_marks')
        
        # Generate PDF
        from django.http import HttpResponse
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.units import inch
        from io import BytesIO
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            spaceAfter=30,
            alignment=1  # Center alignment
        )
        
        # Content
        story = []
        from accounts.models import SchoolSettings
        from .pdf_utils import build_custom_pdf_template
        
        school_settings = SchoolSettings.get_settings()
        template = build_custom_pdf_template(school_settings)
        
        # Add header using custom template with program name prominently displayed
        story.extend(template.create_header(
            event_title=program.event.title, 
            extra_title=f'{program.name.upper()} - RESULTS'
        ))

        # Add program info row (Program Name | Category | Type)
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.platypus import Paragraph, Table, TableStyle, Spacer
        from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
        from reportlab.lib import colors
        left_style = ParagraphStyle(
            'LeftAlign',
            parent=styles['Normal'],
            fontSize=12,
            spaceAfter=5,
            alignment=TA_LEFT,
            textColor=colors.black,
            fontName='Helvetica-Bold'
        )
        center_style = ParagraphStyle(
            'CenterAlign',
            parent=styles['Normal'],
            fontSize=12,
            spaceAfter=5,
            alignment=TA_CENTER,
            textColor=colors.black,
            fontName='Helvetica-Bold'
        )
        right_style = ParagraphStyle(
            'RightAlign',
            parent=styles['Normal'],
            fontSize=12,
            spaceAfter=5,
            alignment=TA_RIGHT,
            textColor=colors.black,
            fontName='Helvetica-Bold'
        )
        program_type = "Team" if program.is_team_based else "Individual"
        program_info_row = [
            Paragraph(f"<b>{program.name.upper()}</b>", left_style),
            Paragraph(f"<b>{program.get_category_display().upper()}</b>", center_style),
            Paragraph(f"<b>{program_type}</b>", right_style)
        ]
        program_info_table = Table([program_info_row], colWidths=[2.5*inch, 2.5*inch, 2.5*inch])
        program_info_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            # Enhanced styling
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8F9FA')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2C3E50')),
            ('BOX', (0, 0), (-1, -1), 1.5, colors.HexColor('#3498DB')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#BDC3C7')),
        ]))
        story.append(program_info_table)
        story.append(Spacer(1, 20))  # Gap before the results table
        
        # Add result number as title at the top
        if results.exists():
            # Get the first result number to display as title
            first_result = results.first()
            result_number = first_result.result_number if first_result.result_number else "N/A"
            
            result_title_style = ParagraphStyle(
                'ResultTitle',
                parent=styles['Heading1'],
                fontSize=16,
                spaceAfter=15,
                alignment=TA_CENTER,
                textColor=colors.black,
                fontName='Helvetica-Bold'
            )
            story.append(Paragraph(f"Result No: {result_number}", result_title_style))
            story.append(Spacer(1, 10))
        
        # Results table using custom template - simplified columns
        if program.category == 'open':
            headers = ['Participant Name', 'Team', 'Points']
        else:
            headers = ['Chest No.', 'Participant Name', 'Team', 'Points']
        data = []
        
        # For individual programs (HS/HSS), show each student separately
        if not program.is_team_based:
            for result in results:
                participant_name = result.participant.get_full_name()
                team_name = result.team.name if result.team else 'Individual'
                points = result.points_earned
                
                # For general category, don't show chest number
                if program.category == 'open':
                    data.append([
                        participant_name,
                        team_name,
                        str(points)
                    ])
                else:
                    # For HS/HSS programs, show chest number
                    chest_number = "N/A"
                    try:
                        chest_num = ChestNumber.objects.get(
                            event=program.event,
                            student=result.participant
                        )
                        chest_number = str(chest_num.chest_number)
                    except ChestNumber.DoesNotExist:
                        pass
                    
                    data.append([
                        chest_number,
                        participant_name,
                        team_name,
                        str(points)
                    ])
        else:
            # For team-based programs, group by team and show main name with team indicator
            team_groups = {}
            for result in results:
                team_name = result.team.name if result.team else 'Individual'
                if team_name not in team_groups:
                    team_groups[team_name] = []
                team_groups[team_name].append(result)
            
            for team_name, team_results in team_groups.items():
                # Show main name with team indicator
                main_result = team_results[0]
                main_name = main_result.participant.get_full_name()
                if len(team_results) > 1:
                    participant_name = f"{main_name} and team"
                else:
                    participant_name = main_name
                
                # Sum points for all team members
                total_points = sum(r.points_earned for r in team_results)
                
                # For general category, don't show chest number
                if program.category == 'open':
                    data.append([
                        participant_name,
                        team_name,
                        str(total_points)
                    ])
                else:
                    # For HS/HSS programs, show chest number
                    chest_number = "N/A"
                    try:
                        chest_num = ChestNumber.objects.get(
                            event=program.event,
                            student=main_result.participant
                        )
                        chest_number = str(chest_num.chest_number)
                    except ChestNumber.DoesNotExist:
                        pass
                    
                    data.append([
                        chest_number,
                        participant_name,
                        team_name,
                        str(total_points)
                    ])
        
        # Use custom template for table with adjusted column widths
        if program.category == 'open':
            col_widths = [3.5*inch, 1.5*inch, 1.0*inch]
        else:
            col_widths = [1.0*inch, 2.5*inch, 1.5*inch, 1.0*inch]
        
        # Create table with green header (same as calling and valuation sheets)
        if data:
            table = Table([headers] + data, colWidths=col_widths)
            table.setStyle(TableStyle([
                # Header styling (green background, white text - same as calling and valuation sheets)
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#27AE60')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 15),
                ('TOPPADDING', (0, 0), (-1, 0), 15),
                
                # Data row styling
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 11),
                ('GRID', (0, 0), (-1, -1), 1.5, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 12),
                ('RIGHTPADDING', (0, 0), (-1, -1), 12),
                ('TOPPADDING', (0, 1), (-1, -1), 12),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 12),
                
                # Alternating row colors (white and light gray)
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
                
                # Border styling
                ('BOX', (0, 0), (-1, -1), 2, colors.black),
                ('LINEBELOW', (0, 0), (-1, 0), 2, colors.black),
            ]))
            story.append(table)
        else:
            story.append(Paragraph("No results available for this program.", styles['Normal']))
        doc.build(story)
        
        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="results_{program.name.replace(" ", "_")}.pdf"'
        return response

# Additional utility views for PDF generation and reports
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def generate_calling_sheet(request, program_id):
    """Generate calling sheet PDF for a program"""
    try:
        program = Program.objects.get(id=program_id)
        assignments = ProgramAssignment.objects.filter(program=program).select_related('student', 'team')
        
        # Here you would implement PDF generation
        # For now, return a simple response
        participants = []
        for assignment in assignments:
            participants.append({
                'name': assignment.student.get_full_name(),
                'identifier': assignment.student.student_id,
                'team_name': assignment.team.name if assignment.team else None,
                'category_display': assignment.student.get_category_display()
            })
        
        return Response({
            'program': program.name,
            'participants': participants,
            'message': 'PDF generation would happen here'
        })
        
    except Program.DoesNotExist:
        return Response({'error': 'Program not found'}, status=404)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def generate_formatted_calling_sheet(request, program_id):
    """Generate formatted calling sheet PDF with school logo and proper layout"""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from io import BytesIO
        from accounts.models import SchoolSettings
        from .pdf_utils import build_custom_pdf_template
        from datetime import datetime
        import traceback
        
        program = Program.objects.get(id=program_id)
        assignments = ProgramAssignment.objects.filter(program=program).select_related('student', 'team').order_by('chest_number', 'student__first_name')
        school_settings = SchoolSettings.get_settings()
        template = build_custom_pdf_template(school_settings)
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=A4, 
            rightMargin=80, 
            leftMargin=80, 
            topMargin=50, 
            bottomMargin=50
        )
        elements = []
        elements.extend(template.create_header(event_title=program.event.title, extra_title=f'Calling Sheet - {program.name}'))
        styles = getSampleStyleSheet()
        details_style = ParagraphStyle(
            'Details',
            parent=styles['Normal'],
            fontSize=10,
            spaceAfter=3,
            alignment=TA_LEFT,
            textColor=colors.black
        )
        program_type = "Team" if program.is_team_based else "Individual"
        
        # Create styles for program info
        left_style = ParagraphStyle(
            'LeftAlign',
            parent=styles['Normal'],
            fontSize=12,
            spaceAfter=5,
            alignment=TA_LEFT,
            textColor=colors.black,
            fontName='Helvetica-Bold'
        )
        
        center_style = ParagraphStyle(
            'CenterAlign',
            parent=styles['Normal'],
            fontSize=12,
            spaceAfter=5,
            alignment=TA_CENTER,
            textColor=colors.black,
            fontName='Helvetica-Bold'
        )
        
        right_style = ParagraphStyle(
            'RightAlign',
            parent=styles['Normal'],
            fontSize=12,
            spaceAfter=5,
            alignment=TA_RIGHT,
            textColor=colors.black,
            fontName='Helvetica-Bold'
        )
        
        # Create a table with three columns but no borders
        program_info_row = [
            Paragraph(f"<b>{program.name.upper()}</b>", left_style),
            Paragraph(f"<b>{program.get_category_display().upper()}</b>", center_style),
            Paragraph(f"<b>{program_type}</b>", right_style)
        ]
        program_info_table = Table([program_info_row], colWidths=[2.5*inch, 2.5*inch, 2.5*inch])
        program_info_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            # Enhanced styling
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8F9FA')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2C3E50')),
            ('BOX', (0, 0), (-1, -1), 1.5, colors.HexColor('#3498DB')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#BDC3C7')),
        ]))
        elements.append(program_info_table)
        elements.append(Spacer(1, 20))  # Increased gap before the participant list table
        
        if assignments.exists():
            # Single table with all information
            if program.category == 'open':
                table_data = [['Participant Name', 'Team Name', 'Code Letter']]
            else:
                table_data = [['Chest No.', 'Participant Name', 'Team Name', 'Code Letter']]
            
            # For all programs, group by team and show only main name with "and team" suffix
            team_groups = {}
            for assignment in assignments:
                team_name = assignment.team.name if assignment.team else 'Individual'
                if team_name not in team_groups:
                    team_groups[team_name] = []
                team_groups[team_name].append(assignment)
            
            for team_name, team_assignments in team_groups.items():
                # For individual programs (HS/HSS), show each student separately
                if not program.is_team_based:
                    for assignment in team_assignments:
                        participant_name = assignment.student.get_full_name()
                        
                        # For general category, don't show chest number
                        if program.category == 'open':
                            table_data.append([participant_name, team_name, ''])
                        else:
                            # For HS/HSS programs, show chest number
                            chest_no = assignment.chest_number
                            if not chest_no:
                                try:
                                    chest_record = ChestNumber.objects.get(event=program.event, student=assignment.student)
                                    chest_no = chest_record.chest_number
                                except ChestNumber.DoesNotExist:
                                    chest_no = ''
                            chest_no_display = str(chest_no) if chest_no else 'N/A'
                            table_data.append([chest_no_display, participant_name, team_name, ''])
                else:
                    # For team-based programs, show main name with team indicator
                    main_assignment = team_assignments[0]
                    main_name = main_assignment.student.get_full_name()
                    if len(team_assignments) > 1:
                        participant_name = f"{main_name} and team"
                    else:
                        participant_name = main_name
                    
                    # For general category, don't show chest number
                    if program.category == 'open':
                        table_data.append([participant_name, team_name, ''])
                    else:
                        # For HS/HSS programs, show chest number
                        chest_no = main_assignment.chest_number
                        if not chest_no:
                            try:
                                chest_record = ChestNumber.objects.get(event=program.event, student=main_assignment.student)
                                chest_no = chest_record.chest_number
                            except ChestNumber.DoesNotExist:
                                chest_no = ''
                        chest_no_display = str(chest_no) if chest_no else 'N/A'
                        table_data.append([chest_no_display, participant_name, team_name, ''])
            
            if program.category == 'open':
                table = Table(table_data, colWidths=[2.6*inch, 1.2*inch, 1.2*inch])
            else:
                table = Table(table_data, colWidths=[0.8*inch, 1.8*inch, 1.2*inch, 1.2*inch])
            table.setStyle(TableStyle([
                # Header styling (green background, white text - same as valuation sheet)
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#27AE60')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 15),
                ('TOPPADDING', (0, 0), (-1, 0), 15),
                
                # Data row styling
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 11),
                ('GRID', (0, 0), (-1, -1), 1.5, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 12),
                ('RIGHTPADDING', (0, 0), (-1, -1), 12),
                ('TOPPADDING', (0, 1), (-1, -1), 12),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 12),
                
                # Alternating row colors (white and light gray)
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
                
                # Border styling
                ('BOX', (0, 0), (-1, -1), 2, colors.black),
                ('LINEBELOW', (0, 0), (-1, 0), 2, colors.black),
            ]))
            elements.append(table)
        else:
            elements.append(Paragraph("No participants assigned to this program.", styles['Normal']))
        doc.build(elements)
        pdf_data = buffer.getvalue()
        buffer.close()
        response = HttpResponse(pdf_data, content_type='application/pdf')
        filename = f"{program.name.replace(' ', '_')}_formatted_calling_sheet.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
    except Program.DoesNotExist:
        return Response({'error': 'Program not found'}, status=404)
    except Exception as e:
        print(f"Error generating calling sheet: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return Response({'error': f'Error generating calling sheet: {str(e)}'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_program_participants(request, program_id):
    """Get participants for calling sheet"""
    try:
        program = Program.objects.get(id=program_id)
        assignments = ProgramAssignment.objects.filter(program=program).select_related('student', 'team')
        
        participants = []
        for assignment in assignments:
            # Get category display name
            category_display = dict(User.CATEGORY_CHOICES).get(assignment.student.category, 'Unknown')
            
            participants.append({
                'id': assignment.id,
                'name': assignment.student.get_full_name(),
                'identifier': assignment.student.student_id,
                'team_name': assignment.team.name if assignment.team else None,
                'category_display': category_display,
                'chest_number': assignment.chest_number
            })
        
        return Response({'results': participants})
        
    except Program.DoesNotExist:
        return Response({'error': 'Program not found'}, status=404)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def generate_formatted_evaluation_sheet(request, program_id):
    """Generate formatted evaluation/valuation sheet PDF with school logo and proper layout"""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from io import BytesIO
        from accounts.models import SchoolSettings
        from .pdf_utils import build_custom_pdf_template
        from datetime import datetime
        import traceback
        
        program = Program.objects.get(id=program_id)
        assignments = ProgramAssignment.objects.filter(program=program).select_related('student', 'team').order_by('chest_number', 'student__first_name')
        school_settings = SchoolSettings.get_settings()
        template = build_custom_pdf_template(school_settings)
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=A4, 
            rightMargin=80, 
            leftMargin=80, 
            topMargin=50, 
            bottomMargin=50
        )
        elements = []
        elements.extend(template.create_header(event_title=program.event.title, extra_title=f'Valuation Sheet - {program.name}'))
        styles = getSampleStyleSheet()
        details_style = ParagraphStyle(
            'Details',
            parent=styles['Normal'],
            fontSize=10,
            spaceAfter=3,
            alignment=TA_LEFT,
            textColor=colors.black
        )
        valuation_title_style = ParagraphStyle(
            'ValuationTitle',
            parent=styles['Heading1'],
            fontSize=18,
            spaceAfter=20,
            alignment=TA_CENTER,
            textColor=colors.black,
            fontName='Helvetica-Bold'
        )
        stage_style = ParagraphStyle(
            'Stage',
            parent=styles['Normal'],
            fontSize=12,
            spaceAfter=20,
            alignment=TA_RIGHT,
            textColor=colors.black,
            fontName='Helvetica-Bold'
        )
        elements.append(Paragraph("Valuation Sheet", valuation_title_style))
        elements.append(Paragraph("Stage No: _______", stage_style))
        program_type = "Team" if program.is_team_based else "Individual"
        
        # Create a centered style for program info
        program_info_style = ParagraphStyle(
            'ProgramInfo',
            parent=styles['Normal'],
            fontSize=12,
            spaceAfter=5,
            alignment=TA_CENTER,
            textColor=colors.black,
            fontName='Helvetica-Bold'
        )
        
        elements.append(Paragraph(f"<b>{program.name.upper()}</b>", program_info_style))
        elements.append(Paragraph(f"<b>{program.get_category_display().upper()}</b>", program_info_style))
        elements.append(Paragraph(f"<b>{program_type}</b>", program_info_style))
        elements.append(Spacer(1, 15))
        if assignments.exists():
            if program.category == 'open':
                table_data = [['Participant Name', 'Judge 1', 'Judge 2', 'Judge 3', 'Remarks']]
            else:
                table_data = [['Chest No.', 'Judge 1', 'Judge 2', 'Judge 3', 'Remarks']]
            
            # For all programs, group by team and show only main name with "and team" suffix
            team_groups = {}
            for assignment in assignments:
                team_name = assignment.team.name if assignment.team else 'Individual'
                if team_name not in team_groups:
                    team_groups[team_name] = []
                team_groups[team_name].append(assignment)
            
            for team_name, team_assignments in team_groups.items():
                # For individual programs (HS/HSS), show each student separately
                if not program.is_team_based:
                    for assignment in team_assignments:
                        participant_name = assignment.student.get_full_name()
                        
                        # For general category, don't show chest number
                        if program.category == 'open':
                            table_data.append([participant_name, '', '', '', ''])
                        else:
                            # For HS/HSS programs, show chest number
                            chest_no = assignment.chest_number
                            if not chest_no:
                                try:
                                    chest_record = ChestNumber.objects.get(event=program.event, student=assignment.student)
                                    chest_no = chest_record.chest_number
                                except ChestNumber.DoesNotExist:
                                    chest_no = ''
                            chest_no_display = str(chest_no) if chest_no else 'N/A'
                            table_data.append([chest_no_display, '', '', '', ''])
                else:
                    # For team-based programs, show main name with team indicator
                    main_assignment = team_assignments[0]
                    main_name = main_assignment.student.get_full_name()
                    if len(team_assignments) > 1:
                        participant_name = f"{main_name} and team"
                    else:
                        participant_name = main_name
                    
                    # For general category, don't show chest number
                    if program.category == 'open':
                        table_data.append([participant_name, '', '', '', ''])
                    else:
                        # For HS/HSS programs, show chest number
                        chest_no = main_assignment.chest_number
                        if not chest_no:
                            try:
                                chest_record = ChestNumber.objects.get(event=program.event, student=main_assignment.student)
                                chest_no = chest_record.chest_number
                            except ChestNumber.DoesNotExist:
                                chest_no = ''
                        chest_no_display = str(chest_no) if chest_no else 'N/A'
                        table_data.append([chest_no_display, '', '', '', ''])
            if program.category == 'open':
                table = Table(table_data, colWidths=[2.3*inch, 1.5*inch, 1.5*inch, 1.5*inch, 2*inch])
            else:
                table = Table(table_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch, 2*inch])
            table.setStyle(TableStyle([
                # Header styling
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#27AE60')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 15),
                ('TOPPADDING', (0, 0), (-1, 0), 15),
                
                # Data row styling
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 11),
                ('GRID', (0, 0), (-1, -1), 1.5, colors.HexColor('#34495E')),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 12),
                ('RIGHTPADDING', (0, 0), (-1, -1), 12),
                ('TOPPADDING', (0, 1), (-1, -1), 12),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 12),
                
                # Alternating row colors
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#FEF9E7'), colors.white]),
                
                # Border styling
                ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#2C3E50')),
                ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#2C3E50')),
                
                # Judge columns highlighting
                ('BACKGROUND', (1, 1), (3, -1), colors.HexColor('#F8F9FA')),
            ]))
            elements.append(table)
        else:
            elements.append(Paragraph("No participants assigned to this program.", styles['Normal']))
        doc.build(elements)
        pdf_data = buffer.getvalue()
        buffer.close()
        response = HttpResponse(pdf_data, content_type='application/pdf')
        filename = f"{program.name.replace(' ', '_')}_evaluation_sheet.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
    except Program.DoesNotExist:
        return Response({'error': 'Program not found'}, status=404)
    except Exception as e:
        print(f"Error generating evaluation sheet: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return Response({'error': f'Error generating evaluation sheet: {str(e)}'}, status=500)

class TeamManagerViewSet(viewsets.ViewSet):
    """ViewSet for Team Manager specific functionality"""
    permission_classes = []  # Temporarily disable permissions for testing
    authentication_classes = []  # Temporarily disable authentication for testing
    pagination_class = CustomPagination
    
    @action(detail=False, methods=['get'])
    def my_teams(self, request):
        """Get teams managed by the current team manager"""
        if request.user.role != 'team_manager':
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        teams = Team.objects.filter(team_manager=request.user).select_related('event').prefetch_related('members')
        
        # Calculate global points for each team
        from events.models import ProgramResult
        from django.db.models import Sum
        
        teams_with_global_points = []
        for team in teams:
            # Calculate percentage-based global points
            team_results = ProgramResult.objects.filter(
                team=team,
                points_earned__gt=0
            ).select_related('program__event')
            
            total_global_percentage = 0
            events_participated = 0
            
            if team_results.exists():
                # Group by event
                event_breakdown = {}
                for result in team_results:
                    event_name = result.program.event.title
                    if event_name not in event_breakdown:
                        event_breakdown[event_name] = {
                            'team_points': 0,
                            'total_event_points': 0
                        }
                    event_breakdown[event_name]['team_points'] += result.points_earned
                
                # Calculate total event points for each event
                for event_name in event_breakdown:
                    total_event_points = ProgramResult.objects.filter(
                        program__event__title=event_name,
                        points_earned__gt=0
                    ).aggregate(total=Sum('points_earned'))['total'] or 0
                    
                    # Calculate percentage for this event
                    if total_event_points > 0:
                        event_percentage = (event_breakdown[event_name]['team_points'] / total_event_points) * 100
                        total_global_percentage += event_percentage
                        events_participated += 1
            
            # Create team data with global points
            team_data = {
                'id': team.id,
                'name': team.name,
                'team_id': team.team_id,
                'member_count': team.member_count,
                'points_earned': team.points_earned,  # Keep original points for backward compatibility
                'global_points': round(total_global_percentage, 2),  # Add global points
                'events_participated': events_participated,
                'event': team.event.title if team.event else None,
                'created_at': team.created_at,
                'updated_at': team.updated_at
            }
            teams_with_global_points.append(team_data)
        
        # Apply pagination
        page = self.paginate_queryset(teams_with_global_points)
        if page is not None:
            return self.get_paginated_response(page)
        
        # Fallback if pagination is not configured
        return Response(teams_with_global_points)
    
    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        """Get students for a specific team"""
        try:
            team = Team.objects.get(id=pk)
            # Temporarily disable authentication check for testing
            # if request.user.role != 'admin' and team.team_manager != request.user:
            #     return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            
            students = team.members.filter(role='student')
            
            # Apply pagination
            page = self.paginate_queryset(students)
            if page is not None:
                student_data = []
                for student in page:
                    student_data.append({
                        'id': student.id,
                        'name': student.get_full_name(),
                        'student_id': student.student_id,
                        'email': student.email,
                        'category': student.category,
                        'grade': student.grade,
                        'section': student.section
                    })
                
                print(f"DEBUG: Found {len(student_data)} students for team {pk}")
                return self.get_paginated_response(student_data)
            
            # Fallback if pagination is not configured
            student_data = []
            for student in students:
                student_data.append({
                    'id': student.id,
                    'name': student.get_full_name(),
                    'student_id': student.student_id,
                    'email': student.email,
                    'category': student.category,
                    'grade': student.grade,
                    'section': student.section
                })
            
            print(f"DEBUG: Found {len(student_data)} students for team {pk}")
            return Response({'students': student_data})
        except Team.DoesNotExist:
            return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'])
    def events(self, request, pk=None):
        """Get events for a specific team"""
        try:
            # Simple test - just return all events without complex logic
            events = Event.objects.all().order_by('-start_date')
            
            print(f"DEBUG: Found {events.count()} events for team {pk}")
            
            # Simplify the response - just return basic event info
            event_data = []
            for event in events:
                event_data.append({
                    'id': event.id,
                    'title': event.title,
                    'description': event.description,
                    'event_type': event.event_type,
                    'status': event.status,
                    'team_points': 0,  # Simplified
                    'total_programs': event.programs.count(),
                    'programs_assigned': 0,  # Simplified
                    'start_date': event.start_date,
                    'end_date': event.end_date,
                    'venue': event.venue
                })
            
            print(f"DEBUG: Returning {len(event_data)} events")
            return Response({'events': event_data})
        except Exception as e:
            print(f"DEBUG: Error in events endpoint: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'], url_path='events/(?P<event_id>[0-9]+)/programs')
    def event_programs(self, request, pk=None, event_id=None):
        """Get programs for a specific event and team"""
        try:
            team = Team.objects.get(id=pk)
            event = Event.objects.get(id=event_id)
            
            # Check if user has access to this team (allow public access for testing)
            # if request.user.role != 'admin' and team.team_manager != request.user:
            #     return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            
            # Teams are no longer linked to events, so all teams can participate in all events
            # No need to check team participation
            
            # Get programs for this event
            programs = Program.objects.filter(event=event)
            
            # Apply pagination
            page = self.paginate_queryset(programs)
            if page is not None:
                program_data = []
                
                for program in page:
                    # Get assigned students for this program and team
                    assignments = ProgramAssignment.objects.filter(
                        program=program,
                        team=team
                    ).select_related('student')
                    
                    assigned_students = []
                    for assignment in assignments:
                        student_data = {
                            'id': assignment.id,
                            'name': assignment.student.get_full_name(),
                            'student_id': assignment.student.student_id
                        }
                        assigned_students.append(student_data)
                    
                    # Calculate available slots per team
                    max_participants = program.max_participants or 100  # Default high value
                    
                    # Get total number of teams
                    total_teams = Team.objects.count()
                    if total_teams > 0:
                        # Divide max_participants equally among teams
                        per_team_limit = max_participants // total_teams
                    else:
                        per_team_limit = max_participants
                    
                    team_assignments_count = ProgramAssignment.objects.filter(program=program, team=team).count()
                    available_slots = max(0, per_team_limit - team_assignments_count)
                    
                    print(f"DEBUG: Program {program.id} - Team {team.id} - Max: {max_participants}, Assigned: {team_assignments_count}, Available: {available_slots}")
                    
                    program_data.append({
                        'id': program.id,
                        'name': program.name,
                        'description': program.description,
                        'category': program.category,
                        'program_type': 'Individual' if not program.is_team_based else 'Team',
                        'is_team_based': program.is_team_based,
                        'team_size_min': program.team_size_min,
                        'team_size_max': program.team_size_max,
                        'max_participants': max_participants,
                        'per_team_limit': per_team_limit,
                        'total_teams': total_teams,
                        'assigned_count': team_assignments_count,
                        'available_slots': available_slots,
                        'assigned_students': assigned_students,
                        'start_time': program.start_time,
                        'end_time': program.end_time,
                        'venue': program.venue,
                        'is_active': program.is_active,
                        'is_finished': program.is_finished
                    })
                
                # Get team members for assignment dropdown
                team_members = team.members.filter(role='student')
                member_data = []
                for member in team_members:
                    member_data.append({
                        'id': member.id,
                        'name': member.get_full_name(),
                        'student_id': member.student_id,
                        'category': member.category
                    })
                
                return self.get_paginated_response({
                    'event': {
                        'id': event.id,
                        'title': event.title,
                        'description': event.description
                    },
                    'programs': program_data,
                    'team_members': member_data
                })
            
            # Fallback if pagination is not configured
            program_data = []
            
            for program in programs:
                # Get assigned students for this program and team
                assignments = ProgramAssignment.objects.filter(
                    program=program,
                    team=team
                ).select_related('student')
                
                assigned_students = []
                for assignment in assignments:
                    student_data = {
                        'id': assignment.id,
                        'name': assignment.student.get_full_name(),
                        'student_id': assignment.student.student_id
                    }
                    assigned_students.append(student_data)
                
                # Calculate available slots per team
                max_participants = program.max_participants or 100  # Default high value
                
                # Get total number of teams
                total_teams = Team.objects.count()
                if total_teams > 0:
                    # Divide max_participants equally among teams
                    per_team_limit = max_participants // total_teams
                else:
                    per_team_limit = max_participants
                
                team_assignments_count = ProgramAssignment.objects.filter(program=program, team=team).count()
                available_slots = max(0, per_team_limit - team_assignments_count)
                
                print(f"DEBUG: Program {program.id} - Team {team.id} - Max: {max_participants}, Assigned: {team_assignments_count}, Available: {available_slots}")
                
                program_data.append({
                    'id': program.id,
                    'name': program.name,
                    'description': program.description,
                    'category': program.category,
                    'program_type': 'Individual' if not program.is_team_based else 'Team',
                    'is_team_based': program.is_team_based,
                    'team_size_min': program.team_size_min,
                    'team_size_max': program.team_size_max,
                    'max_participants': max_participants,
                    'per_team_limit': per_team_limit,
                    'total_teams': total_teams,
                    'assigned_count': team_assignments_count,
                    'available_slots': available_slots,
                    'assigned_students': assigned_students,
                    'start_time': program.start_time,
                    'end_time': program.end_time,
                    'venue': program.venue,
                    'is_active': program.is_active,
                    'is_finished': program.is_finished
                })
            
            # Get team members for assignment dropdown
            team_members = team.members.filter(role='student')
            member_data = []
            for member in team_members:
                member_data.append({
                    'id': member.id,
                    'name': member.get_full_name(),
                    'student_id': member.student_id,
                    'category': member.category
                })
            
            print(f"DEBUG: Team {team.id} has {len(member_data)} members for assignment")
            print(f"DEBUG: Member data: {member_data}")
            
            return Response({
                'event': {
                    'id': event.id,
                    'title': event.title,
                    'description': event.description
                },
                'programs': program_data,
                'team_members': member_data
            })
        except Team.DoesNotExist:
            return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)
        except Event.DoesNotExist:
            return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['post'], url_path='events/(?P<event_id>[0-9]+)/programs/(?P<program_id>[0-9]+)/assign')
    def assign_student_to_program(self, request, pk=None, event_id=None, program_id=None):
        """Assign students to a program"""
        try:
            team = Team.objects.get(id=pk)
            event = Event.objects.get(id=event_id)
            program = Program.objects.get(id=program_id)
            student_ids = request.data.get('student_ids', [])
            
            print(f"DEBUG: Team {team.id} trying to assign students {student_ids} to program {program.id}")
            print(f"DEBUG: Program is_team_based: {program.is_team_based}")
            print(f"DEBUG: Program team_size_min: {program.team_size_min}, team_size_max: {program.team_size_max}")
            
            if not student_ids:
                return Response({'error': 'Student IDs are required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if user has access to this team
            if request.user.role != 'admin' and team.team_manager != request.user:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            
            # Teams are no longer linked to events, so all teams can participate in all events
            # Check if program belongs to this event
            if program.event != event:
                return Response({'error': 'Program does not belong to this event'}, status=status.HTTP_400_BAD_REQUEST)
            
            # For team-based programs, validate team assignment requirements
            if program.is_team_based:
                # Get all students and validate they belong to the team
                students = []
                for student_id in student_ids:
                    try:
                        student = User.objects.get(id=student_id, role='student')
                        if not team.members.filter(id=student.id).exists():
                            return Response({'error': f'Student {student.get_full_name()} is not a member of this team'}, status=status.HTTP_400_BAD_REQUEST)
                        students.append(student)
                    except User.DoesNotExist:
                        return Response({'error': f'Student with ID {student_id} not found'}, status=status.HTTP_404_NOT_FOUND)
                
                # Validate team size requirements
                if program.team_size_min and len(students) < program.team_size_min:
                    return Response({
                        'error': f'Team must have at least {program.team_size_min} members for this program. Currently assigning: {len(students)}'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                if program.team_size_max and len(students) > program.team_size_max:
                    return Response({
                        'error': f'Team cannot have more than {program.team_size_max} members for this program. Currently assigning: {len(students)}'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Check if team already has assignments for this program
                existing_assignments = ProgramAssignment.objects.filter(program=program, team=team)
                if existing_assignments.exists():
                    return Response({
                        'error': 'Team is already assigned to this program. Remove existing assignments first.'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # For individual programs, handle single student assignment
            else:
                if len(student_ids) != 1:
                    return Response({'error': 'Individual programs can only assign one student at a time'}, status=status.HTTP_400_BAD_REQUEST)
                
                student_id = student_ids[0]
                try:
                    student = User.objects.get(id=student_id, role='student')
                except User.DoesNotExist:
                    return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
                
                # Check if student is a member of this team
                if not team.members.filter(id=student.id).exists():
                    return Response({'error': 'Student is not a member of this team'}, status=status.HTTP_400_BAD_REQUEST)
                
                # Check if student is already assigned to this program
                if ProgramAssignment.objects.filter(program=program, student=student).exists():
                    return Response({'error': 'Student is already assigned to this program'}, status=status.HTTP_400_BAD_REQUEST)
                
                students = [student]
                
                # Check program capacity per team using the new logic
                if program.max_participants:
                    # Get total number of teams
                    total_teams = Team.objects.count()
                    if total_teams > 0:
                        # Divide max_participants equally among teams
                        per_team_limit = program.max_participants // total_teams
                    else:
                        per_team_limit = program.max_participants
                    
                    team_assignments_count = ProgramAssignment.objects.filter(program=program, team=team).count()
                    print(f"DEBUG: Team {team.id} has {team_assignments_count} assignments for program {program.id}")
                    print(f"DEBUG: Total max participants: {program.max_participants}, Total teams: {total_teams}, Per team limit: {per_team_limit}")
                    
                    if team_assignments_count >= per_team_limit:
                        error_msg = f'Your team has reached the maximum limit of {per_team_limit} participants for this program (out of {program.max_participants} total across {total_teams} teams)'
                        print(f"DEBUG: {error_msg}")
                        return Response({
                            'error': error_msg
                        }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create assignments for all students
            assignments = []
            for student in students:
                assignment = ProgramAssignment.objects.create(
                    program=program,
                    student=student,
                    team=team,
                    assigned_by=request.user
                )
                assignments.append(assignment)
            
            print(f"DEBUG: Successfully assigned {len(assignments)} students to program {program.id}")
            
            return Response({
                'success': True,
                'message': f'Successfully assigned {len(assignments)} students to {program.name}',
                'assignment_ids': [assignment.id for assignment in assignments]
            })
        except Team.DoesNotExist:
            return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)
        except Event.DoesNotExist:
            return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)
        except Program.DoesNotExist:
            return Response({'error': 'Program not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['delete'], url_path='assignments/(?P<assignment_id>[0-9]+)/remove')
    def remove_assignment_by_id(self, request, pk=None, assignment_id=None):
        """Remove a program assignment by assignment ID"""
        try:
            team = Team.objects.get(id=pk)
            
            # Check if user has access to this team
            if request.user.role != 'admin' and team.team_manager != request.user:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get the assignment
            try:
                assignment = ProgramAssignment.objects.get(id=assignment_id, team=team)
            except ProgramAssignment.DoesNotExist:
                return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Delete the assignment
            assignment.delete()
            
            return Response({
                'success': True,
                'message': 'Assignment removed successfully'
            })
        except Team.DoesNotExist:
            return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'], url_path='profile')
    def team_profile(self, request, pk=None):
        """Get team profile information"""
        try:
            team = Team.objects.get(id=pk)
            
            # Check if user has access to this team
            if request.user.role != 'admin' and team.team_manager != request.user:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get team statistics
            total_assignments = ProgramAssignment.objects.filter(team=team).count()
            total_points = PointsRecord.objects.filter(team=team).aggregate(total=models.Sum('points'))['total'] or 0
            # Teams are no longer linked to events, so count events through program assignments
            events_participated = Event.objects.filter(
                programs__assignments__team=team
            ).distinct().count()
            
            profile_data = {
                'team_id': team.id,
                'team_name': team.name,
                'description': team.description,
                'member_count': team.member_count,
                'total_assignments': total_assignments,
                'total_points': total_points,
                'events_participated': events_participated,
                'team_number': team.team_number,
                'created_at': team.created_at
            }
            
            return Response(profile_data)
        except Team.DoesNotExist:
            return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['get'])
    def available_programs(self, request):
        """Get available programs for team manager's teams"""
        # Temporarily disable role check for testing
        # if request.user.role != 'team_manager':
        #     return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Teams are no longer linked to events, so get all events and their programs
        # Get all programs from all events
        programs = Program.objects.all().select_related('event')
        
        # Debug: Print the count and some sample programs
        print(f"DEBUG: Total programs in database: {programs.count()}")
        sample_programs = list(programs.values('id', 'name', 'event__title')[:5])
        print(f"DEBUG: Sample programs: {sample_programs}")
        
        # Apply pagination
        page = self.paginate_queryset(programs)
        if page is not None:
            serializer = ProgramSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        # Fallback if pagination is not configured
        serializer = ProgramSerializer(programs, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def assign_to_program(self, request):
        """Assign team members to a program"""
        if request.user.role != 'team_manager':
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        program_id = request.data.get('program_id')
        student_ids = request.data.get('student_ids', [])
        
        if not program_id:
            return Response({'error': 'Program ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not student_ids:
            return Response({'error': 'At least one student must be selected'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            program = Program.objects.get(id=program_id)
        except Program.DoesNotExist:
            return Response({'error': 'Program not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get managed teams
        managed_teams = Team.objects.filter(team_manager=request.user)
        
        # Validate that all students belong to the team manager's teams
        team_members = User.objects.filter(
            Q(team_memberships__in=managed_teams)
        ).distinct()
        
        students_to_assign = User.objects.filter(id__in=student_ids, role='student')
        unauthorized_students = students_to_assign.exclude(id__in=team_members.values_list('id', flat=True))
        
        if unauthorized_students.exists():
            return Response({
                'error': 'You can only assign students from your managed teams',
                'unauthorized_students': [s.get_full_name() for s in unauthorized_students]
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Create assignments
        assignments = []
        skipped = []
        
        for student in students_to_assign:
            # Check if already assigned
            if ProgramAssignment.objects.filter(program=program, student=student).exists():
                skipped.append({
                    'student_id': student.student_id,
                    'name': student.get_full_name(),
                    'reason': 'Already assigned to this program'
                })
                continue
            
            # Find student's team
            team = None
            for managed_team in managed_teams:
                if managed_team.members.filter(id=student.id).exists():
                    team = managed_team
                    break
            
            if not team:
                skipped.append({
                    'student_id': student.student_id,
                    'name': student.get_full_name(),
                    'reason': 'Student not found in any of your teams'
                })
                continue
            
            # Check program capacity per team
            if program.max_participants:
                team_assignments_count = ProgramAssignment.objects.filter(program=program, team=team).count()
                if team_assignments_count >= program.max_participants:
                    skipped.append({
                        'student_id': student.student_id,
                        'name': student.get_full_name(),
                        'reason': f'Team {team.name} has reached the maximum limit of {program.max_participants} participants for this program'
                    })
                    continue
            
            # Create assignment
            assignment = ProgramAssignment.objects.create(
                program=program,
                student=student,
                team=team,
                assigned_by=request.user
            )
            
            assignments.append({
                'id': assignment.id,
                'student_name': student.get_full_name(),
                'team_name': team.name,
                'program_name': program.name
            })
        
        return self.get_paginated_response({
            'success': True,
            'message': f'Successfully assigned {len(assignments)} students to {program.name}',
            'assignments': assignments,
            'skipped': skipped
        })
    
    @action(detail=False, methods=['get'])
    def team_assignments(self, request):
        """Get all assignments for team manager's teams"""
        if request.user.role != 'team_manager':
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get all teams managed by this team manager
        managed_teams = Team.objects.filter(team_manager=request.user)
        
        # Get all assignments for these teams
        assignments = ProgramAssignment.objects.filter(
            team__in=managed_teams
        ).select_related('program', 'student', 'team', 'program__event')
        
        # Apply pagination
        page = self.paginate_queryset(assignments)
        if page is not None:
            assignment_data = []
            for assignment in page:
                assignment_data.append({
                    'id': assignment.id,
                    'program_id': assignment.program.id,
                    'program_name': assignment.program.name,
                    'event_name': assignment.program.event.title,
                    'student_id': assignment.student.id,
                    'student_name': assignment.student.get_full_name(),
                    'student_code': assignment.student.student_id,
                    'team_id': assignment.team.id,
                    'team_name': assignment.team.name,
                    'chest_number': assignment.chest_number,
                    'assigned_at': assignment.assigned_at,
                    'program_category': assignment.program.category,
                    'program_is_team_based': assignment.program.is_team_based,
                    'program_max_participants': assignment.program.max_participants
                })
            
            return self.get_paginated_response({
                'assignments': assignment_data,
                'total_assignments': assignments.count()
            })
        
        # Fallback if pagination is not configured
        assignment_data = []
        for assignment in assignments:
            assignment_data.append({
                'id': assignment.id,
                'program_id': assignment.program.id,
                'program_name': assignment.program.name,
                'event_name': assignment.program.event.title,
                'student_id': assignment.student.id,
                'student_name': assignment.student.get_full_name(),
                'student_code': assignment.student.student_id,
                'team_id': assignment.team.id,
                'team_name': assignment.team.name,
                'chest_number': assignment.chest_number,
                'assigned_at': assignment.assigned_at,
                'program_category': assignment.program.category,
                'program_is_team_based': assignment.program.is_team_based,
                'program_max_participants': assignment.program.max_participants
            })
        
        return Response({
            'assignments': assignment_data,
            'total_assignments': len(assignment_data)
        })
    
    @action(detail=False, methods=['delete'])
    def remove_assignment(self, request):
        """Remove a program assignment"""
        if request.user.role != 'team_manager':
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        assignment_id = request.data.get('assignment_id')
        if not assignment_id:
            return Response({'error': 'Assignment ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            assignment = ProgramAssignment.objects.get(id=assignment_id)
        except ProgramAssignment.DoesNotExist:
            return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if team manager has permission
        if assignment.team.team_manager != request.user:
            return Response({'error': 'You do not have permission to remove this assignment'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        assignment.delete()
        return Response({'message': 'Assignment removed successfully'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def leaderboard(self, request):
        """Get global points leaderboard for team manager's teams"""
        if request.user.role != 'team_manager':
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get teams managed by this team manager
        managed_teams = Team.objects.filter(team_manager=request.user)
        
        # Calculate global points for each team
        from events.models import ProgramResult
        from django.db.models import Sum
        
        teams_with_global_points = []
        for team in managed_teams:
            # Calculate percentage-based global points
            team_results = ProgramResult.objects.filter(
                team=team,
                points_earned__gt=0
            ).select_related('program__event')
            
            total_global_percentage = 0
            events_participated = 0
            
            if team_results.exists():
                # Group by event
                event_breakdown = {}
                for result in team_results:
                    event_name = result.program.event.title
                    if event_name not in event_breakdown:
                        event_breakdown[event_name] = {
                            'team_points': 0,
                            'total_event_points': 0
                        }
                    event_breakdown[event_name]['team_points'] += result.points_earned
                
                # Calculate total event points for each event
                for event_name in event_breakdown:
                    total_event_points = ProgramResult.objects.filter(
                        program__event__title=event_name,
                        points_earned__gt=0
                    ).aggregate(total=Sum('points_earned'))['total'] or 0
                    
                    # Calculate percentage for this event
                    if total_event_points > 0:
                        event_percentage = (event_breakdown[event_name]['team_points'] / total_event_points) * 100
                        total_global_percentage += event_percentage
                        events_participated += 1
            
            teams_with_global_points.append({
                'id': team.id,
                'name': team.name,
                'points': round(total_global_percentage, 2),  # Global points
                'members': team.member_count,
                'events_participated': events_participated
            })
        
        # Sort by global points (descending)
        teams_with_global_points.sort(key=lambda x: x['points'], reverse=True)
        
        return Response({
            'teams': teams_with_global_points,
            'students': []  # Empty for now, can be extended later
        })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def generate_team_list_pdf(request, event_id, team_id):
    """Generate team list PDF organized by category and grade with participant details"""
    try:
        event = Event.objects.get(id=event_id)
        team = Team.objects.get(id=team_id)
        
        # Get team assignments for this event
        assignments = ProgramAssignment.objects.filter(
            team=team,
            program__event=event
        ).select_related('program', 'student').order_by('program__category', 'program__start_time')
        
        # Generate PDF using custom template
        from django.http import HttpResponse
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import inch
        from reportlab.platypus import Table, TableStyle
        from io import BytesIO
        from accounts.models import SchoolSettings
        from .pdf_utils import build_custom_pdf_template
        from collections import defaultdict
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=A4, 
            rightMargin=50, 
            leftMargin=50, 
            topMargin=50, 
            bottomMargin=50
        )
        
        # Get school settings and create template
        school_settings = SchoolSettings.get_settings()
        template = build_custom_pdf_template(school_settings)
        
        # Build PDF content
        story = []
        
        # Add header
        story.extend(template.create_header(
            event_title=event.title,
            extra_title=f'Team: {team.name}'
        ))
        
        # Add team information
        team_info = [
            ['Team Name', team.name],
            ['Team Manager', team.team_manager.get_full_name() if team.team_manager else 'N/A'],
            ['Total Members', str(team.members.count())],
            ['Event', event.title],
            ['Event Date', event.start_date.strftime('%d/%m/%Y') if event.start_date else 'N/A']
        ]
        story.extend(template.create_data_table(
            headers=['Information', 'Details'],
            data=team_info,
            title='Team Information'
        ))
        
        # Group assignments by category and grade
        if assignments.exists():
            # Define grade ordering for each category
            grade_order = {
                'hs': ['8', '9', '10'],
                'hss': ['Plus One Commerce', 'Plus One Science', 'Plus Two Commerce', 'Plus Two Science'],
                'open': []  # Will be sorted alphabetically
            }
            
            # Group assignments by category and grade
            category_grade_assignments = defaultdict(lambda: defaultdict(list))
            for assignment in assignments:
                category = assignment.program.category
                grade = assignment.student.grade or 'Unknown'
                category_grade_assignments[category][grade].append(assignment)
            
            # Create styles
            styles = getSampleStyleSheet()
            category_style = ParagraphStyle(
                'Category',
                parent=styles['Heading2'],
                fontSize=14,
                spaceAfter=10,
                spaceBefore=20,
                textColor=colors.darkblue,
                fontName='Helvetica-Bold'
            )
            
            grade_style = ParagraphStyle(
                'Grade',
                parent=styles['Heading3'],
                fontSize=12,
                spaceAfter=8,
                spaceBefore=15,
                textColor=colors.darkgreen,
                fontName='Helvetica-Bold'
            )
            
            # Process each category
            for category in ['hs', 'hss', 'open']:
                if category not in category_grade_assignments:
                    continue
                
                # Category heading
                category_display = {
                    'hs': 'HIGH SCHOOL',
                    'hss': 'HSS',
                    'open': 'GENERAL'
                }.get(category, category.upper())
                
                story.append(Paragraph(category_display, category_style))
                
                # Get grades for this category and sort them
                grades = list(category_grade_assignments[category].keys())
                if category in grade_order:
                    # Sort according to predefined order, put unknown grades at the end
                    grades.sort(key=lambda x: (
                        grade_order[category].index(x) if x in grade_order[category] else 999,
                        x
                    ))
                else:
                    # Sort alphabetically for other categories
                    grades.sort()
                
                # Process each grade
                for grade in grades:
                    grade_assignments = category_grade_assignments[category][grade]
                    
                    # Grade heading
                    story.append(Paragraph(f"Class: {grade}", grade_style))
                    
                    # Group students by their assignments
                    student_programs = defaultdict(list)
                    for assignment in grade_assignments:
                        student_programs[assignment.student].append(assignment)
                    
                    # Create table for this grade
                    headers = ['Chest No.', 'Participant Name', 'Program Name', 'Team Name']
                    data = []
                    
                    # Process students with multiple programs first, then single programs
                    multi_program_students = []
                    single_program_students = []
                    
                    for student, student_assignments in student_programs.items():
                        if len(student_assignments) > 1:
                            multi_program_students.append((student, student_assignments))
                        else:
                            single_program_students.append((student, student_assignments))
                    
                    # Sort by student name
                    multi_program_students.sort(key=lambda x: x[0].get_full_name())
                    single_program_students.sort(key=lambda x: x[0].get_full_name())
                    
                    # Add multi-program students first
                    for student, student_assignments in multi_program_students:
                        # Get chest number
                        chest_number = student_assignments[0].chest_number
                        if not chest_number:
                            try:
                                from .models import ChestNumber
                                chest_record = ChestNumber.objects.get(event=event, student=student)
                                chest_number = chest_record.chest_number
                            except:
                                chest_number = 'N/A'
                        
                        # Create row with all programs
                        program_names = [assignment.program.name for assignment in student_assignments]
                        program_names_str = ', '.join(program_names)
                        
                        data.append([
                            str(chest_number) if chest_number else 'N/A',
                            student.get_full_name(),
                            program_names_str,
                            team.name
                        ])
                    
                    # Add single-program students
                    for student, student_assignments in single_program_students:
                        assignment = student_assignments[0]
                        
                        # Get chest number
                        chest_number = assignment.chest_number
                        if not chest_number:
                            try:
                                from .models import ChestNumber
                                chest_record = ChestNumber.objects.get(event=event, student=student)
                                chest_number = chest_record.chest_number
                            except:
                                chest_number = 'N/A'
                        
                        data.append([
                            str(chest_number) if chest_number else 'N/A',
                            student.get_full_name(),
                            assignment.program.name,
                            team.name
                        ])
                    
                    # Create table using custom template
                    if data:
                        col_widths = [1*inch, 2*inch, 2.5*inch, 1.5*inch]
                        story.extend(template.create_data_table(
                            headers=headers,
                            data=data,
                            col_widths=col_widths
                        ))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="team_list_{team.name.replace(" ", "_")}.pdf"'
        return response
        
    except (Event.DoesNotExist, Team.DoesNotExist):
        return Response({'error': 'Event or Team not found'}, status=404)
    except Exception as e:
        return Response({'error': f'Error generating PDF: {str(e)}'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def generate_custom_template_demo(request):
    """Demo endpoint showing the full capabilities of the custom PDF template system"""
    try:
        from django.http import HttpResponse
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate
        from reportlab.lib.units import inch
        from io import BytesIO
        from accounts.models import SchoolSettings
        from .pdf_utils import build_custom_pdf_template
        
        # Setup
        school_settings = SchoolSettings.get_settings()
        template = build_custom_pdf_template(school_settings)
        
        # Create PDF buffer
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=A4, 
            rightMargin=50, 
            leftMargin=50, 
            topMargin=50, 
            bottomMargin=50
        )
        
        # Build content
        story = []
        
        # Add header with multiple titles
        story.extend(template.create_header(
            event_title="Custom Template Demo",
            extra_title="Showcasing All Features"
        ))
        
        # Add information table
        info_data = [
            ['Feature', 'Status'],
            ['Consistent Styling', '✅ Active'],
            ['School Branding', '✅ Active'],
            ['Professional Layout', '✅ Active'],
            ['Easy Customization', '✅ Active'],
            ['Backward Compatibility', '✅ Active']
        ]
        story.extend(template.create_data_table(
            headers=['Component', 'Status'],
            data=info_data,
            title='System Features'
        ))
        
        # Add sample data table
        sample_headers = ['Position', 'Participant', 'Team', 'Score', 'Category']
        sample_data = [
            ['1st', 'John Doe', 'Team Alpha', '95', 'High School'],
            ['2nd', 'Jane Smith', 'Team Beta', '92', 'HSS'],
            ['3rd', 'Bob Johnson', 'Team Gamma', '89', 'Open'],
            ['4th', 'Alice Brown', 'Team Delta', '87', 'High School'],
            ['5th', 'Charlie Wilson', 'Team Echo', '85', 'HSS']
        ]
        story.extend(template.create_data_table(
            headers=sample_headers,
            data=sample_data,
            title='Sample Results Table'
        ))
        
        # Add another table with custom column widths
        custom_headers = ['Program', 'Time', 'Venue', 'Participants']
        custom_data = [
            ['Debate Competition', '09:00 - 11:00', 'Main Hall', '24'],
            ['Poetry Recitation', '11:30 - 13:00', 'Auditorium', '18'],
            ['Quiz Competition', '14:00 - 16:00', 'Library', '30'],
            ['Drama Performance', '16:30 - 18:00', 'Stage', '12']
        ]
        col_widths = [2*inch, 1.5*inch, 2*inch, 1*inch]
        story.extend(template.create_data_table(
            headers=custom_headers,
            data=custom_data,
            title='Program Schedule',
            col_widths=col_widths
        ))
        
        # Generate PDF
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="custom_template_demo.pdf"'
        return response
        
    except Exception as e:
        return Response({'error': f'Error generating demo PDF: {str(e)}'}, status=500)

@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def test_report_generation(request, event_id):
    """Test endpoint to debug report generation"""
    try:
        event = Event.objects.get(id=event_id)
        programs = Program.objects.filter(event=event).count()
        teams = Team.objects.filter(program_assignments__program__event=event).distinct().count()
        results = ProgramResult.objects.filter(program__event=event).count()
        
        return Response({
            'success': True,
            'event': {
                'id': event.id,
                'title': event.title,
                'event_type': event.event_type
            },
            'counts': {
                'programs': programs,
                'teams': teams,
                'results': results
            },
            'message': 'Report generation test successful'
        })
        
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)
    except Exception as e:
        return Response({'error': f'Test failed: {str(e)}'}, status=500)

@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def generate_program_details_report(request, event_id):
    """Generate complete program details report with participants and teams as PDF"""
    try:
        event = Event.objects.get(id=event_id)
        programs = Program.objects.filter(event=event).order_by('category', 'name')
        
        if not programs.exists():
            return Response({'error': 'No programs found for this event'}, status=404)
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.objects.first()
        
        # Create PDF using custom template
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=30, rightMargin=30)
        story = []
        styles = getSampleStyleSheet()
        
        # Add custom header with logo
        from .pdf_utils import build_pdf_header
        story.extend(build_pdf_header(school_settings, f"Eventloo - Complete Programs Report", f"Event: {event.title}"))
        
        # Add generation date
        story.append(Paragraph(f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Group programs by category
        categories = {}
        for program in programs:
            if program.category not in categories:
                categories[program.category] = []
            categories[program.category].append(program)
        
        for category, category_programs in categories.items():
            # Category header
            story.append(Paragraph(f"Category: {category.upper()}", styles['Heading3']))
            story.append(Spacer(1, 10))
            
            for program in category_programs:
                # Program header
                story.append(Paragraph(f"Program: {program.name}", styles['Heading4']))
                story.append(Spacer(1, 5))
                
                # Program details table
                program_data = [
                    ['Category', program.category.upper()],
                    ['Venue', program.venue or 'N/A'],
                    ['Start Time', program.start_time.strftime('%I:%M %p') if program.start_time else 'N/A'],
                    ['End Time', program.end_time.strftime('%I:%M %p') if program.end_time else 'N/A'],
                    ['Max Participants', str(program.max_participants) if program.max_participants else 'Unlimited'],
                    ['Description', program.description or 'N/A']
                ]
                
                program_table = Table(program_data, colWidths=[2*inch, 4*inch])
                program_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ]))
                story.append(program_table)
                story.append(Spacer(1, 10))
                
                # Get participants for this program
                assignments = ProgramAssignment.objects.filter(program=program).select_related('student', 'team')
                
                if assignments.exists():
                    # Participants table
                    story.append(Paragraph("Participants:", styles['Heading5']))
                    story.append(Spacer(1, 5))
                    
                    participants_data = [['Student Name', 'Team', 'Student ID', 'Grade']]
                    for assignment in assignments:
                        student = assignment.student
                        team = assignment.team
                        participants_data.append([
                            student.display_name,
                            team.name if team else 'N/A',
                            student.student_id if hasattr(student, 'student_id') and student.student_id else 'N/A',
                            student.grade if hasattr(student, 'grade') and student.grade else 'N/A'
                        ])
                    
                    participants_table = Table(participants_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1*inch])
                    participants_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, -1), 9),
                        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                        ('GRID', (0, 0), (-1, -1), 1, colors.black)
                    ]))
                    story.append(participants_table)
                else:
                    story.append(Paragraph("No participants assigned yet.", styles['Normal']))
                
                story.append(Spacer(1, 15))
                story.append(Paragraph("=" * 80, styles['Normal']))
                story.append(Spacer(1, 10))
        
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Eventloo_Complete_Programs_{event.title}_{datetime.now().strftime("%Y%m%d")}.pdf"'
        return response
        
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)
    except Exception as e:
        import traceback
        return Response({'error': f'PDF generation failed: {str(e)}', 'traceback': traceback.format_exc()}, status=500)

@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def generate_all_events_report(request):
    """Generate comprehensive report of all events"""
    try:
        events = Event.objects.all().order_by('-start_date')
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.objects.first()
        
        # Create PDF using custom template
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        story = []
        styles = getSampleStyleSheet()
        
        # Add custom header with logo
        from .pdf_utils import build_pdf_header
        story.extend(build_pdf_header(school_settings, f"Eventloo - All Events Summary Report"))
        
        # Add generation date
        story.append(Paragraph(f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Events summary table
        data = [['Event Title', 'Category', 'Start Date', 'End Date', 'Programs', 'Teams', 'Status']]
        for event in events:
            program_count = Program.objects.filter(event=event).count()
            team_count = Team.objects.filter(program_assignments__program__event=event).distinct().count()
            status = "Active" if event.status == 'active' else "Inactive"
            
            data.append([
                event.title,
                event.event_type,
                event.start_date.strftime('%Y-%m-%d'),
                event.end_date.strftime('%Y-%m-%d'),
                str(program_count),
                str(team_count),
                status
            ])
        
        table = Table(data, colWidths=[2*inch, 1*inch, 1*inch, 1*inch, 0.8*inch, 0.8*inch, 0.8*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(table)
        
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Eventloo_All_Events_Report_{datetime.now().strftime("%Y%m%d")}.pdf"'
        return response
        
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def generate_complete_results_report(request, event_id):
    """Generate complete results report with only 1st, 2nd, 3rd places and participant names"""
    try:
        event = Event.objects.get(id=event_id)
        results = ProgramResult.objects.filter(
            program__event=event,
            position__in=[1, 2, 3]  # Only 1st, 2nd, 3rd places
        ).order_by('program__category', 'program__name', 'position')
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.objects.first()
        
        # Create PDF using custom template
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=30, rightMargin=30)
        story = []
        styles = getSampleStyleSheet()
        
        # Add custom header with logo
        from .pdf_utils import build_pdf_header
        story.extend(build_pdf_header(school_settings, f"Eventloo - Winners Report (1st, 2nd, 3rd Places)", f"Event: {event.title}"))
        
        # Add generation date
        story.append(Paragraph(f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Group results by category and program
        categories = {}
        for result in results:
            category = result.program.category
            program_name = result.program.name
            
            if category not in categories:
                categories[category] = {}
            if program_name not in categories[category]:
                categories[category][program_name] = []
            
            categories[category][program_name].append(result)
        
        for category, programs in categories.items():
            story.append(Paragraph(f"Category: {category.upper()}", styles['Heading3']))
            story.append(Spacer(1, 10))
            
            for program_name, program_results in programs.items():
                story.append(Paragraph(f"Program: {program_name}", styles['Heading4']))
                story.append(Spacer(1, 5))
                
                # Results table for this program
                data = [['Rank', 'Participant Name', 'Team Name', 'Points', 'Remarks']]
                for result in sorted(program_results, key=lambda x: x.position):
                    # Get participant name
                    participant_name = "N/A"
                    if result.participant:
                        # Use the display_name property which prioritizes name, then email, then username
                        participant_name = result.participant.display_name
                    elif result.team:
                        participant_name = f"Team: {result.team.name}"
                    
                    # Get team name
                    team_name = result.team.name if result.team else 'N/A'
                    
                    data.append([
                        f"{result.position}",
                        participant_name,
                        team_name,
                        str(result.points_earned) if result.points_earned else '0',
                        result.comments or 'N/A'
                    ])
                
                table = Table(data, colWidths=[0.8*inch, 2*inch, 1.5*inch, 1*inch, 1.7*inch])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                story.append(table)
                story.append(Spacer(1, 15))
                story.append(Paragraph("=" * 80, styles['Normal']))
                story.append(Spacer(1, 10))
        
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Eventloo_Winners_Report_{event.title}_{datetime.now().strftime("%Y%m%d")}.pdf"'
        return response
        
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)
    except Exception as e:
        import traceback
        return Response({'error': f'PDF generation failed: {str(e)}', 'traceback': traceback.format_exc()}, status=500)

@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def generate_first_place_report(request, event_id):
    """Generate report with only 1st place winners"""
    try:
        event = Event.objects.get(id=event_id)
        results = ProgramResult.objects.filter(
            program__event=event,
            position=1  # Only 1st place
        ).order_by('program__category', 'program__name')
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.objects.first()
        
        # Create PDF using custom template
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=30, rightMargin=30)
        story = []
        styles = getSampleStyleSheet()
        
        # Add custom header with logo
        from .pdf_utils import build_pdf_header
        story.extend(build_pdf_header(school_settings, f"Eventloo - 1st Place Winners Report", f"Event: {event.title}"))
        
        # Add generation date
        story.append(Paragraph(f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Group results by category and program
        categories = {}
        for result in results:
            category = result.program.category
            program_name = result.program.name
            
            if category not in categories:
                categories[category] = {}
            if program_name not in categories[category]:
                categories[category][program_name] = []
            
            categories[category][program_name].append(result)
        
        for category, programs in categories.items():
            story.append(Paragraph(f"Category: {category.upper()}", styles['Heading3']))
            story.append(Spacer(1, 10))
            
            for program_name, program_results in programs.items():
                story.append(Paragraph(f"Program: {program_name}", styles['Heading4']))
                story.append(Spacer(1, 5))
                
                # Results table for this program
                data = [['🥇 1st Place', 'Participant Name', 'Team Name', 'Points', 'Remarks']]
                for result in program_results:
                    # Get participant name
                    participant_name = "N/A"
                    if result.participant:
                        participant_name = result.participant.display_name
                    elif result.team:
                        participant_name = f"Team: {result.team.name}"
                    
                    # Get team name
                    team_name = result.team.name if result.team else 'N/A'
                    
                    data.append([
                        "🥇 1st Place",
                        participant_name,
                        team_name,
                        str(result.points_earned) if result.points_earned else '0',
                        result.comments or 'N/A'
                    ])
                
                table = Table(data, colWidths=[1.2*inch, 2*inch, 1.5*inch, 1*inch, 1.5*inch])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                story.append(table)
                story.append(Spacer(1, 15))
                story.append(Paragraph("=" * 80, styles['Normal']))
                story.append(Spacer(1, 10))
        
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Eventloo_1st_Place_Winners_{event.title}_{datetime.now().strftime("%Y%m%d")}.pdf"'
        return response
        
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)
    except Exception as e:
        import traceback
        return Response({'error': f'PDF generation failed: {str(e)}', 'traceback': traceback.format_exc()}, status=500)

@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def generate_second_place_report(request, event_id):
    """Generate report with only 2nd place winners"""
    try:
        event = Event.objects.get(id=event_id)
        results = ProgramResult.objects.filter(
            program__event=event,
            position=2  # Only 2nd place
        ).order_by('program__category', 'program__name')
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.objects.first()
        
        # Create PDF using custom template
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=30, rightMargin=30)
        story = []
        styles = getSampleStyleSheet()
        
        # Add custom header with logo
        from .pdf_utils import build_pdf_header
        story.extend(build_pdf_header(school_settings, f"Eventloo - 2nd Place Winners Report", f"Event: {event.title}"))
        
        # Add generation date
        story.append(Paragraph(f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Group results by category and program
        categories = {}
        for result in results:
            category = result.program.category
            program_name = result.program.name
            
            if category not in categories:
                categories[category] = {}
            if program_name not in categories[category]:
                categories[category][program_name] = []
            
            categories[category][program_name].append(result)
        
        for category, programs in categories.items():
            story.append(Paragraph(f"Category: {category.upper()}", styles['Heading3']))
            story.append(Spacer(1, 10))
            
            for program_name, program_results in programs.items():
                story.append(Paragraph(f"Program: {program_name}", styles['Heading4']))
                story.append(Spacer(1, 5))
                
                # Results table for this program
                data = [['🥈 2nd Place', 'Participant Name', 'Team Name', 'Points', 'Remarks']]
                for result in program_results:
                    # Get participant name
                    participant_name = "N/A"
                    if result.participant:
                        participant_name = result.participant.display_name
                    elif result.team:
                        participant_name = f"Team: {result.team.name}"
                    
                    # Get team name
                    team_name = result.team.name if result.team else 'N/A'
                    
                    data.append([
                        "🥈 2nd Place",
                        participant_name,
                        team_name,
                        str(result.points_earned) if result.points_earned else '0',
                        result.comments or 'N/A'
                    ])
                
                table = Table(data, colWidths=[1.2*inch, 2*inch, 1.5*inch, 1*inch, 1.5*inch])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                story.append(table)
                story.append(Spacer(1, 15))
                story.append(Paragraph("=" * 80, styles['Normal']))
                story.append(Spacer(1, 10))
        
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Eventloo_2nd_Place_Winners_{event.title}_{datetime.now().strftime("%Y%m%d")}.pdf"'
        return response
        
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)
    except Exception as e:
        import traceback
        return Response({'error': f'PDF generation failed: {str(e)}', 'traceback': traceback.format_exc()}, status=500)

@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def generate_third_place_report(request, event_id):
    """Generate report with only 3rd place winners"""
    try:
        event = Event.objects.get(id=event_id)
        results = ProgramResult.objects.filter(
            program__event=event,
            position=3  # Only 3rd place
        ).order_by('program__category', 'program__name')
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.objects.first()
        
        # Create PDF using custom template
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=30, rightMargin=30)
        story = []
        styles = getSampleStyleSheet()
        
        # Add custom header with logo
        from .pdf_utils import build_pdf_header
        story.extend(build_pdf_header(school_settings, f"Eventloo - 3rd Place Winners Report", f"Event: {event.title}"))
        
        # Add generation date
        story.append(Paragraph(f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Group results by category and program
        categories = {}
        for result in results:
            category = result.program.category
            program_name = result.program.name
            
            if category not in categories:
                categories[category] = {}
            if program_name not in categories[category]:
                categories[category][program_name] = []
            
            categories[category][program_name].append(result)
        
        for category, programs in categories.items():
            story.append(Paragraph(f"Category: {category.upper()}", styles['Heading3']))
            story.append(Spacer(1, 10))
            
            for program_name, program_results in programs.items():
                story.append(Paragraph(f"Program: {program_name}", styles['Heading4']))
                story.append(Spacer(1, 5))
                
                # Results table for this program
                data = [['🥉 3rd Place', 'Participant Name', 'Team Name', 'Points', 'Remarks']]
                for result in program_results:
                    # Get participant name
                    participant_name = "N/A"
                    if result.participant:
                        participant_name = result.participant.display_name
                    elif result.team:
                        participant_name = f"Team: {result.team.name}"
                    
                    # Get team name
                    team_name = result.team.name if result.team else 'N/A'
                    
                    data.append([
                        "🥉 3rd Place",
                        participant_name,
                        team_name,
                        str(result.points_earned) if result.points_earned else '0',
                        result.comments or 'N/A'
                    ])
                
                table = Table(data, colWidths=[1.2*inch, 2*inch, 1.5*inch, 1*inch, 1.5*inch])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                story.append(table)
                story.append(Spacer(1, 15))
                story.append(Paragraph("=" * 80, styles['Normal']))
                story.append(Spacer(1, 10))
        
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Eventloo_3rd_Place_Winners_{event.title}_{datetime.now().strftime("%Y%m%d")}.pdf"'
        return response
        
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)
    except Exception as e:
        import traceback
        return Response({'error': f'PDF generation failed: {str(e)}', 'traceback': traceback.format_exc()}, status=500)

@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def generate_participants_team_report(request, event_id):
    """Generate participants team report showing team-wise participants and their program participation"""
    try:
        event = Event.objects.get(id=event_id)
        teams = Team.objects.filter(program_assignments__program__event=event).distinct().prefetch_related('members')
        programs = Program.objects.filter(event=event).order_by('category', 'name')
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.objects.first()
        
        # Create PDF using custom template
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        story = []
        styles = getSampleStyleSheet()
        
        # Add custom header with logo
        from .pdf_utils import build_pdf_header
        story.extend(build_pdf_header(school_settings, f"Eventloo - Participants Team Report", f"Event: {event.title}"))
        
        # Add generation date
        story.append(Paragraph(f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Event summary
        story.append(Paragraph("Event Summary", styles['Heading3']))
        story.append(Spacer(1, 10))
        
        summary_data = [
            ['Total Teams', str(teams.count())],
            ['Total Programs', str(programs.count())],
            ['Event Type', event.event_type],
            ['Venue', event.venue or 'N/A'],
            ['Start Date', event.start_date.strftime('%B %d, %Y') if event.start_date else 'N/A'],
            ['End Date', event.end_date.strftime('%B %d, %Y') if event.end_date else 'N/A']
        ]
        
        summary_table = Table(summary_data, colWidths=[2*inch, 3*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightblue),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('BACKGROUND', (1, 0), (1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 20))
        
        # Team-wise participants and their programs
        for team in teams:
            story.append(Paragraph(f"Team: {team.name}", styles['Heading4']))
            story.append(Spacer(1, 10))
            
            # Get team members
            team_members = team.members.all()
            if team_members.exists():
                # Team members table
                story.append(Paragraph("Team Members:", styles['Heading5']))
                story.append(Spacer(1, 5))
                
                members_data = [['Student Name', 'Student ID', 'Grade', 'Section']]
                for member in team_members:
                    # Use proper name fields instead of display_name
                    student_name = member.get_full_name() if hasattr(member, 'get_full_name') else f"{member.first_name} {member.last_name}".strip()
                    if not student_name or student_name.strip() == '':
                        student_name = member.name or f"Student {member.student_id}" if member.student_id else "Unknown Student"
                    
                    members_data.append([
                        student_name,
                        member.student_id if hasattr(member, 'student_id') and member.student_id else 'N/A',
                        member.grade if hasattr(member, 'grade') and member.grade else 'N/A',
                        member.section if hasattr(member, 'section') and member.section else 'N/A'
                    ])
                
                members_table = Table(members_data, colWidths=[2*inch, 1.5*inch, 1*inch, 1*inch])
                members_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.lightgreen),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                story.append(members_table)
                story.append(Spacer(1, 15))
                
                # Program participation for each member
                story.append(Paragraph("Program Participation:", styles['Heading5']))
                story.append(Spacer(1, 5))
                
                participation_data = [['Student Name', 'Program Name', 'Category', 'Venue', 'Time']]
                
                for member in team_members:
                    # Get programs this member is assigned to
                    member_assignments = ProgramAssignment.objects.filter(
                        student=member,
                        program__event=event
                    ).select_related('program')
                    
                    # Use proper name fields instead of display_name
                    student_name = member.get_full_name() if hasattr(member, 'get_full_name') else f"{member.first_name} {member.last_name}".strip()
                    if not student_name or student_name.strip() == '':
                        student_name = member.name or f"Student {member.student_id}" if member.student_id else "Unknown Student"
                    
                    if member_assignments.exists():
                        for assignment in member_assignments:
                            program = assignment.program
                            participation_data.append([
                                student_name,
                                program.name,
                                program.category,
                                program.venue or 'N/A',
                                f"{program.start_time.strftime('%I:%M %p') if program.start_time else 'N/A'} - {program.end_time.strftime('%I:%M %p') if program.end_time else 'N/A'}"
                            ])
                    else:
                        participation_data.append([
                            student_name,
                            'No programs assigned',
                            'N/A',
                            'N/A',
                            'N/A'
                        ])
                
                participation_table = Table(participation_data, colWidths=[1.5*inch, 1.5*inch, 1*inch, 1*inch, 1.5*inch])
                participation_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.lightyellow),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                story.append(participation_table)
            else:
                story.append(Paragraph("No members assigned to this team.", styles['Normal']))
            
            story.append(Spacer(1, 20))
        
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Eventloo_Participants_Team_{event.title}_{datetime.now().strftime("%Y%m%d")}.pdf"'
        return response
        
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def generate_event_backup(request, event_id):
    """Generate complete event backup data"""
    try:
        event = Event.objects.get(id=event_id)
        
        # Gather all event data
        programs = Program.objects.filter(event=event).prefetch_related('assignments', 'results')
        teams = Team.objects.filter(program_assignments__program__event=event).distinct().prefetch_related('members', 'program_assignments')
        results = ProgramResult.objects.filter(program__event=event).select_related('team', 'program')
        points_data = PointsRecord.objects.filter(program__event=event).select_related('team', 'program')
        
        # Create comprehensive backup data
        backup_data = {
            'event': {
                'id': event.id,
                'title': event.title,
                'description': event.description,
                'venue': event.venue,
                'start_date': event.start_date.isoformat() if event.start_date else None,
                'end_date': event.end_date.isoformat() if event.end_date else None,
                'event_type': event.event_type,
                'status': event.status,
                'is_team_based': event.is_team_based,
                'max_participants': event.max_participants,
                'current_participants': event.current_participants,
                'created_at': event.created_at.isoformat(),
                'updated_at': event.updated_at.isoformat(),
            },
            'programs': list(programs.values()),
            'teams': list(teams.values()),
            'results': list(results.values()),
            'points_data': list(points_data.values()),
            'backup_generated': datetime.now().isoformat(),
            'total_programs': programs.count(),
            'total_teams': teams.count(),
            'total_results': results.count(),
            'total_points_records': points_data.count(),
        }
        
        # Return JSON response
        response = HttpResponse(
            json.dumps(backup_data, indent=2, default=str),
            content_type='application/json'
        )
        response['Content-Disposition'] = f'attachment; filename="Eventloo_Backup_{event.title}_{datetime.now().strftime("%Y%m%d")}.json"'
        return response
        
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

# Temporarily disable all executable generation functions due to f-string syntax issues
@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def generate_program_details_executable(request, event_id):
    """Generate executable file for program details report"""
    return Response({'message': 'This function is temporarily disabled for maintenance'}, status=503)

@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def generate_complete_results_executable(request, event_id):
    """Generate executable file for complete results report"""
    return Response({'message': 'This function is temporarily disabled for maintenance'}, status=503)

@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def generate_participants_team_executable(request, event_id):
    """Generate executable file for participants team report"""
    return Response({'message': 'This function is temporarily disabled for maintenance'}, status=503)

@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def test_events_list(request):
    """Test endpoint to list events without authentication"""
    try:
        events = Event.objects.all()[:5]  # Get first 5 events
        event_list = []
        for event in events:
            event_list.append({
                'id': event.id,
                'title': event.title,
                'start_date': event.start_date.strftime('%Y-%m-%d'),
                'programs_count': event.programs.count()
            })
        return Response({'events': event_list})
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def test_pdf_generation(request, event_id):
    """Test PDF generation without authentication"""
    try:
        event = Event.objects.get(id=event_id)
        programs = Program.objects.filter(event=event).order_by('category', 'name')
        
        if not programs.exists():
            return Response({'error': 'No programs found for this event'}, status=404)
        
        # Create a simple PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        story = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=1
        )
        story.append(Paragraph(f"Eventloo - Test PDF Generation", title_style))
        story.append(Paragraph(f"Event: {event.title}", styles['Heading2']))
        story.append(Paragraph(f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Simple table
        data = [['Program Name', 'Category', 'Type']]
        for program in programs[:5]:  # Limit to first 5 programs
            data.append([
                program.name or 'N/A',
                program.category or 'N/A',
                program.program_type or 'N/A'
            ])
        
        table = Table(data, colWidths=[2*inch, 1.5*inch, 1.5*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(table)
        
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="test_pdf_{event.title}_{datetime.now().strftime("%Y%m%d")}.pdf"'
        return response
        
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)
    except Exception as e:
        import traceback
        return Response({'error': f'PDF generation failed: {str(e)}', 'traceback': traceback.format_exc()}, status=500)

@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def generate_all_results_report(request, event_id):
    """Generate report with all results (all positions)"""
    try:
        event = Event.objects.get(id=event_id)
        results = ProgramResult.objects.filter(
            program__event=event,
            position__isnull=False  # All results with positions
        ).order_by('program__category', 'program__name', 'position')
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.objects.first()
        
        # Create PDF using custom template
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=30, rightMargin=30)
        story = []
        styles = getSampleStyleSheet()
        
        # Add custom header with logo
        from .pdf_utils import build_pdf_header
        story.extend(build_pdf_header(school_settings, f"Eventloo - All Results Report", f"Event: {event.title}"))
        
        # Add generation date
        story.append(Paragraph(f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Group results by category and program
        categories = {}
        for result in results:
            category = result.program.category
            program_name = result.program.name
            
            if category not in categories:
                categories[category] = {}
            if program_name not in categories[category]:
                categories[category][program_name] = []
            
            categories[category][program_name].append(result)
        
        for category, programs in categories.items():
            story.append(Paragraph(f"Category: {category.upper()}", styles['Heading3']))
            story.append(Spacer(1, 10))
            
            for program_name, program_results in programs.items():
                story.append(Paragraph(f"Program: {program_name}", styles['Heading4']))
                story.append(Spacer(1, 5))
                
                # Results table for this program
                data = [['Position', 'Participant Name', 'Team Name', 'Points', 'Remarks']]
                for result in sorted(program_results, key=lambda x: x.position):
                    # Get participant name
                    participant_name = "N/A"
                    if result.participant:
                        participant_name = result.participant.display_name
                    elif result.team:
                        participant_name = f"Team: {result.team.name}"
                    
                    # Get team name
                    team_name = result.team.name if result.team else 'N/A'
                    
                    # Get position with emoji
                    position_display = f"{result.position}"
                    if result.position == 1:
                        position_display = "🥇 1st"
                    elif result.position == 2:
                        position_display = "🥈 2nd"
                    elif result.position == 3:
                        position_display = "🥉 3rd"
                    elif result.position == 4:
                        position_display = "4th"
                    elif result.position == 5:
                        position_display = "5th"
                    else:
                        position_display = f"{result.position}th"
                    
                    data.append([
                        position_display,
                        participant_name,
                        team_name,
                        str(result.points_earned) if result.points_earned else '0',
                        result.comments or 'N/A'
                    ])
                
                table = Table(data, colWidths=[1*inch, 2*inch, 1.5*inch, 1*inch, 1.5*inch])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                story.append(table)
                story.append(Spacer(1, 15))
                story.append(Paragraph("=" * 80, styles['Normal']))
                story.append(Spacer(1, 10))
        
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Eventloo_All_Results_{event.title}_{datetime.now().strftime("%Y%m%d")}.pdf"'
        return response
        
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)
    except Exception as e:
        import traceback
        return Response({'error': f'PDF generation failed: {str(e)}', 'traceback': traceback.format_exc()}, status=500)

