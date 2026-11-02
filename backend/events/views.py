import logging
from django.shortcuts import render
from django.db.models import Q, Count, Sum, Avg, Max, Min, Case, When, Value
from django.db import models, transaction
from django.utils import timezone
from django.http import HttpResponse
from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
import django_filters
from .models import Event, EventStage, Team, IndividualParticipation, EventAnnouncement, Program, ProgramAssignment, ProgramResult, PointsRecord, TeamProfile, ChestNumber, CertificateTemplate
from .serializers import (
    EventListSerializer, EventDetailSerializer, EventCreateUpdateSerializer,
    TeamSerializer, TeamCreateSerializer, TeamCreateUpdateSerializer, IndividualParticipationSerializer,
    EventAnnouncementSerializer, EventAnnouncementCreateSerializer,
    ProgramSerializer, ProgramAssignmentSerializer, ProgramResultSerializer,
    PointsRecordSerializer, PointsRecordCreateSerializer, TeamProfileSerializer,
    EventWithProgramsSerializer, ChestNumberSerializer, MarkEntrySerializer,
    ProgramResultSummarySerializer, EventStageSerializer
)
from .permissions import IsAdminOrEventManager, IsSchoolAdmin, IsTeamManagerOrAdmin, TeamManagerAuthentication
from accounts.authentication import SchoolJWTAuthentication
from accounts.security_audit import audit_security_event
from accounts.models import User
from accounts.quotas import lock_and_enforce_quota
import pandas as pd
from accounts.upload_security import (
    sanitize_spreadsheet_dataframe,
    validate_excel_upload,
    validate_excel_shape,
)
from accounts.throttles import ExportRateThrottle, UploadRateThrottle
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
import csv
from datetime import datetime, timedelta
from html import escape
from django.utils.text import slugify
from django.core.exceptions import ValidationError as DjangoValidationError

# Set up logging
logger = logging.getLogger(__name__)

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

    def get_queryset(self):
        return Event.objects.filter(school_id=getattr(self.request.user, 'school_id', None))
    
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
        if self.action in [
            'create', 'update', 'partial_update', 'destroy',
            'toggle_program_publish', 'publish_all_results',
            'bulk_upload_programs', 'create_announcement',
            'chest_numbers', 'search_by_chest_number',
        ]:
            permission_classes = [IsAdminOrEventManager]
        else:
            permission_classes = [IsAdminOrEventManager]
        return [permission() for permission in permission_classes]
    
    @transaction.atomic
    def perform_create(self, serializer):
        """Set the creator when creating an event"""
        school = lock_and_enforce_quota(self.request.user.school_id, 'events')
        serializer.save(created_by=self.request.user, school=school)

    def perform_update(self, serializer):
        """Save an event and recalculate only when scoring policy changed."""
        scoring_fields = {
            'num_judges', 'max_mark_per_judge', 'converted_total_mark',
            'enable_grading_system', 'grading_rules',
            'std_ind_first', 'std_ind_second', 'std_ind_third',
            'std_group_first', 'std_group_second', 'std_group_third',
            'mix_ind_first', 'mix_ind_second', 'mix_ind_third',
            'mix_group_first', 'mix_group_second', 'mix_group_third',
            'participation_points',
            'count_general_individual_points_for_students',
        }
        should_reconcile = bool(scoring_fields.intersection(serializer.validated_data))
        event = serializer.save()
        if should_reconcile:
            from .services import reconcile_event_official_points
            reconcile_event_official_points(event)

    @action(detail=True, methods=['get'], url_path='schedule-export', throttle_classes=[ExportRateThrottle])
    def schedule_export(self, request, pk=None):
        """Export this tenant's program schedule as CSV or a print-ready PDF."""
        event = self.get_object()
        export_format = request.query_params.get('export_format', 'pdf').lower()
        programs = list(
            event.programs.select_related('stage').prefetch_related('assignments')
            .order_by('start_time', 'stage__number', 'name')
        )
        filename = slugify(event.title) or f'event-{event.pk}'

        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv; charset=utf-8')
            response['Content-Disposition'] = f'attachment; filename="{filename}-schedule.csv"'
            response.write('\ufeff')
            writer = csv.writer(response)
            writer.writerow([
                'Program', 'Category', 'Mode', 'Entries', 'Entry Type',
                'Minutes Per Entry', 'Total Minutes', 'Stage', 'Start', 'End', 'Status',
            ])
            for program in programs:
                writer.writerow([
                    program.name, program.category,
                    'Group' if program.is_team_based else 'Individual',
                    program.schedule_entry_count,
                    'Groups' if program.is_team_based else 'Participants',
                    program.duration_minutes_per_entry, program.scheduled_duration_minutes,
                    program.stage.display_name if program.stage else program.venue,
                    timezone.localtime(program.start_time).strftime('%Y-%m-%d %H:%M') if program.start_time else '',
                    timezone.localtime(program.end_time).strftime('%Y-%m-%d %H:%M') if program.end_time else '',
                    'Scheduled' if program.start_time else 'Unscheduled',
                ])
            return response

        if export_format != 'pdf':
            return Response({'export_format': 'Use export_format=pdf or export_format=csv.'}, status=status.HTTP_400_BAD_REQUEST)

        from reportlab.lib import colors
        from reportlab.lib.enums import TA_LEFT, TA_RIGHT
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

        scheduled = [program for program in programs if program.start_time]
        buffer = BytesIO()
        document = SimpleDocTemplate(
            buffer, pagesize=landscape(A4), leftMargin=14 * mm, rightMargin=14 * mm,
            topMargin=12 * mm, bottomMargin=12 * mm,
        )
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'ScheduleTitle', parent=styles['Title'], fontName='Helvetica-Bold',
            fontSize=22, leading=25, alignment=TA_LEFT, spaceAfter=3 * mm,
        )
        meta_style = ParagraphStyle(
            'ScheduleMeta', parent=styles['Normal'], fontSize=8.5, leading=11,
            textColor=colors.HexColor('#475569'),
        )
        header = Table([[
            Paragraph(
                f'<font size="10"><b>{escape(event.school.name.upper())}</b></font><br/>'
                f'<font size="22"><b>PROGRAM SCHEDULE</b></font>', title_style,
            ),
            Paragraph(
                f'<b>{escape(event.title)}</b><br/>'
                f'{event.start_date.strftime("%d %b %Y")} – {event.end_date.strftime("%d %b %Y")}<br/>'
                f'Printed {timezone.localtime().strftime("%d/%m/%Y %I:%M %p")}',
                ParagraphStyle('SchedulePrint', parent=meta_style, alignment=TA_RIGHT),
            ),
        ]], colWidths=[190 * mm, 70 * mm])
        header.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LINEBELOW', (0, 0), (-1, -1), 0.8, colors.HexColor('#CBD5E1')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5 * mm),
        ]))
        story = [header, Spacer(1, 6 * mm)]

        if not scheduled:
            story.append(Paragraph('No programs have been scheduled yet.', styles['Heading3']))
        else:
            grouped = defaultdict(lambda: defaultdict(list))
            for program in scheduled:
                local_start = timezone.localtime(program.start_time)
                stage_name = program.stage.display_name if program.stage else (program.venue or 'Unassigned stage')
                grouped[local_start.date()][stage_name].append(program)

            body_style = ParagraphStyle('ScheduleBody', parent=styles['Normal'], fontSize=8.5, leading=10)
            for schedule_date, stage_groups in sorted(grouped.items()):
                date_table = Table([[schedule_date.strftime('%d %B %Y · %A').upper()]], colWidths=[260 * mm])
                date_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#312E81')),
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
                    ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 7),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
                ]))
                story.extend([date_table, Spacer(1, 3 * mm)])
                for stage_name, stage_programs in sorted(stage_groups.items()):
                    rows = [[
                        Paragraph(f'<b>{escape(stage_name.upper())}</b>', body_style),
                        Paragraph('<b>PROGRAM</b>', body_style),
                        Paragraph('<b>TYPE / CATEGORY</b>', body_style),
                        Paragraph('<b>ENTRIES</b>', body_style),
                        Paragraph('<b>DURATION</b>', body_style),
                    ]]
                    for program in sorted(stage_programs, key=lambda item: item.start_time):
                        start = timezone.localtime(program.start_time)
                        end = timezone.localtime(program.end_time) if program.end_time else None
                        rows.append([
                            f'{start.strftime("%I:%M %p")} – {end.strftime("%I:%M %p") if end else "—"}',
                            Paragraph(f'<b>{escape(program.name)}</b>', body_style),
                            f'{"Group" if program.is_team_based else "Individual"} · {program.category.upper()}',
                            f'{program.schedule_entry_count} {"groups" if program.is_team_based else "participants"}',
                            f'{program.duration_minutes_per_entry}m each · {program.scheduled_duration_minutes}m total',
                        ])
                    table = Table(rows, colWidths=[43 * mm, 76 * mm, 52 * mm, 39 * mm, 50 * mm], repeatRows=1)
                    table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#EEF2FF')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#312E81')),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
                        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#CBD5E1')),
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ('TOPPADDING', (0, 0), (-1, -1), 6),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ]))
                    story.extend([table, Spacer(1, 4 * mm)])

        document.build(story)
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}-schedule.pdf"'
        return response
    
    def list(self, request, *args, **kwargs):
        """Override list method to add error handling and logging"""
        try:
            logger.info(f"EventViewSet.list called by user {request.user.id if request.user.is_authenticated else 'anonymous'}")
            
            # Get the queryset
            queryset = self.filter_queryset(self.get_queryset())
            logger.info(f"Filtered queryset contains {queryset.count()} events")
            
            # Apply pagination
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                logger.info(f"Successfully serialized {len(serializer.data)} events")
                return self.get_paginated_response(serializer.data)
            
            # If no pagination, serialize all
            serializer = self.get_serializer(queryset, many=True)
            logger.info(f"Successfully serialized {len(serializer.data)} events without pagination")
            return Response(serializer.data)
            
        except Exception as e:
            logger.error("Failed to retrieve events", exc_info=True)
            return Response(
                {
                    'error': 'Failed to retrieve events',
                    'type': 'serialization_error',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def register(self, request, pk=None):
        """Legacy self-registration is intentionally unavailable."""
        return Response(
            {'error': 'Use program assignments to register participants for an event.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

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
        """Legacy self-unregistration is intentionally unavailable."""
        return Response(
            {'error': 'Remove the participant\'s program assignment instead.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

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
            'registration_progress': (
                event.current_participants / event.max_participants * 100
                if event.max_participants else 0
            ),
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
        
        # Category breakdown dynamically resolved from DB
        from accounts.models import StudentCategory
        category_stats = {}
        for cat in StudentCategory.objects.filter(school=request.user.school):
            category = cat.code
            category_programs = programs.filter(category=category)
            category_stats[category] = {
                'name': cat.name,
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
            'participation_rate': (unique_participants / User.objects.filter(role='student', school=request.user.school).count() * 100) if User.objects.filter(role='student', school=request.user.school).count() > 0 else 0,
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
        """Get team points for this specific event (only published programs count by default)"""
        event = self.get_object()
        include_unpublished = request.query_params.get('include_unpublished', '').lower() == 'true'
        if include_unpublished and request.user.role not in ('admin', 'event_manager'):
            return Response({'error': 'Unpublished results are restricted.'}, status=403)
        
        # Get all teams in event or all active teams
        teams_in_event = Team.objects.filter(
            program_assignments__program__event=event
        ).distinct()
        if not teams_in_event.exists():
            teams_in_event = Team.objects.filter(school=request.user.school)

        # Filter team results based on publish state - ONLY published programs by default!
        result_filter = Q(program__event=event, team__isnull=False, entry_status='submitted')
        if not include_unpublished:
            result_filter &= Q(program__is_published=True)

        team_results = ProgramResult.objects.filter(
            result_filter
        ).values('team').annotate(
            total_points=Sum('points_earned'),
            programs_participated=Count('program', distinct=True),
            first_places=Count('id', filter=Q(position=1)),
            second_places=Count('id', filter=Q(position=2)),
            third_places=Count('id', filter=Q(position=3)),
            programs_won=Count('id', filter=Q(position=1))
        )
        team_results_dict = {tr['team']: tr for tr in team_results}
        
        team_data = []
        for team in teams_in_event:
            result = team_results_dict.get(team.id)
            total_points = result['total_points'] if result else 0
            programs_participated = result['programs_participated'] if result else 0
            first_places = result['first_places'] if result else 0
            second_places = result['second_places'] if result else 0
            third_places = result['third_places'] if result else 0
            programs_won = result['programs_won'] if result else 0
            
            # Get program breakdown for this team
            prog_filter = Q(program__event=event, team=team, entry_status='submitted')
            if not include_unpublished:
                prog_filter &= Q(program__is_published=True)
                
            program_results = ProgramResult.objects.filter(
                prog_filter
            ).select_related('program', 'participant').order_by('-points_earned', 'position')
            
            prog_breakdown = []
            for pr in program_results:
                prog_breakdown.append({
                    'program_id': pr.program.id,
                    'program_name': pr.program.name,
                    'category': pr.program.category,
                    'is_team_based': pr.program.is_team_based,
                    'position': pr.position,
                    'grade': pr.grade,
                    'points_earned': pr.points_earned,
                    'participant_name': pr.participant.display_name if pr.participant else ''
                })

            team_data.append({
                'team_id': team.id,
                'team_name': team.name,
                'total_points': total_points or 0,
                'programs_participated': programs_participated,
                'first_places': first_places,
                'second_places': second_places,
                'third_places': third_places,
                'programs_won': programs_won,
                'program_results': prog_breakdown
            })
        
        # Sort by total_points descending
        team_data.sort(key=lambda x: x['total_points'], reverse=True)
        return Response(team_data)

    @action(detail=True, methods=['get'])
    def points_students(self, request, pk=None):
        """Get individual student points for this specific event"""
        event = self.get_object()

        from .services import program_points_count_for_student
        eligible_program_ids = [
            program.id for program in event.programs.filter(
                is_published=True, is_team_based=False,
            ) if program_points_count_for_student(program)
        ]

        student_results = ProgramResult.objects.filter(
            program__event=event,
            program_id__in=eligible_program_ids,
            entry_status='submitted',
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
            
            # Get recent achievements from all individual categories.
            recent_achievements = ProgramResult.objects.filter(
                program__event=event,
                program_id__in=eligible_program_ids,
                entry_status='submitted',
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
    
    @action(detail=True, methods=['post'], throttle_classes=[UploadRateThrottle])
    def bulk_upload_programs(self, request, pk=None):
        """AI-powered bulk upload programs via Excel file"""
        event = self.get_object()
        
        if 'file' not in request.FILES:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        try:
            validate_excel_upload(file)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Read Excel file
            try:
                if file.name.endswith('.xlsx'):
                    # For .xlsx files, try openpyxl with fallback
                    try:
                        df = pd.read_excel(file, engine='openpyxl')
                    except Exception as openpyxl_error:
                        error_msg = str(openpyxl_error).lower()
                        if 'openpyxl' in error_msg and ('version' in error_msg or '3.1.0' in error_msg):
                            # Try with a different approach - read as binary first
                            try:
                                import io
                                file_content = file.read()
                                file.seek(0)  # Reset file pointer
                                df = pd.read_excel(io.BytesIO(file_content), engine='openpyxl')
                            except Exception:
                                logger.exception('Program spreadsheet fallback parsing failed')
                                return Response({
                                    'error': 'The Excel file could not be read.',
                                    'suggestions': [
                                        'Download a fresh template and copy your data into it.',
                                        'Save the workbook as .xlsx and try again.',
                                    ]
                                }, status=status.HTTP_400_BAD_REQUEST)
                        else:
                            raise openpyxl_error
                elif file.name.lower().endswith('.xls'):
                    try:
                        df = pd.read_excel(file, engine='openpyxl')
                    except Exception:
                        file.seek(0)
                        df = pd.read_excel(file, engine='xlrd')
                elif file.name.lower().endswith('.csv'):
                    try:
                        df = pd.read_csv(file, encoding='utf-8')
                    except UnicodeDecodeError:
                        file.seek(0)
                        df = pd.read_csv(file, encoding='latin-1')
                else:
                    return Response({'error': 'Please upload a spreadsheet file (.xlsx, .xls, or .csv)'}, status=status.HTTP_400_BAD_REQUEST)
            except Exception:
                logger.exception('Program spreadsheet parsing failed')
                return Response({'error': 'The spreadsheet could not be read.'}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                validate_excel_shape(df)
            except ValueError as exc:
                return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            # AI-powered column detection and data validation
            results = self._process_program_excel_with_ai(df, event)
            
            if results['errors']:
                return Response({
                    'error': 'Data validation failed',
                    'details': results['errors'],
                    'suggestions': results['suggestions']
                }, status=status.HTTP_400_BAD_REQUEST)
            
            created_programs = []
            skipped = []
            serializers_to_save = []
            for program_data in results['valid_programs']:
                if Program.objects.filter(event=event, name__iexact=program_data['name']).exists():
                    skipped.append({
                        'name': program_data['name'],
                        'reason': 'Program already exists with this name',
                    })
                    continue
                candidate = ProgramSerializer(
                    data=program_data, context={'request': request}
                )
                if not candidate.is_valid():
                    return Response({
                        'error': 'Data validation failed',
                        'details': [f"{program_data['name']}: {candidate.errors}"],
                    }, status=status.HTTP_400_BAD_REQUEST)
                serializers_to_save.append(candidate)

            with transaction.atomic():
                for candidate in serializers_to_save:
                    created_programs.append(candidate.save(event=event, is_active=True))
            
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
            logger.exception('Program bulk upload failed')
            return Response({'error': 'Unable to process the workbook.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _process_program_excel_with_ai(self, df, event):
        """AI-powered Excel processing for program data"""
        results = {
            'valid_programs': [],
            'errors': [],
            'suggestions': []
        }
        
        # Detect columns using AI
        column_mapping = self._detect_program_columns(df.columns.tolist())
        
        required_columns = {
            'name', 'category', 'program_type', 'is_team_based',
            'duration_minutes_per_entry',
        }
        missing_columns = sorted(required_columns.difference(column_mapping))
        if missing_columns:
            results['errors'].append(
                f'Missing required columns: {", ".join(missing_columns)}.'
            )
            results['suggestions'].append(
                'Use the downloaded template with Name, Category, Type, Mode and Duration Minutes columns.'
            )
            return results
        
        # Process each row
        for index, row in df.iterrows():
            try:
                # Extract required fields
                name = str(row[column_mapping['name']]).strip()
                
                # Skip empty rows
                if pd.isna(name) or name == '' or name.lower() == 'nan':
                    continue
                
                program_data = {'name': name}

                raw_type = str(row[column_mapping['program_type']]).strip().lower()
                type_aliases = {
                    'stage': 'stage', 'onstage': 'stage', 'on_stage': 'stage',
                    'offstage': 'off_stage', 'off stage': 'off_stage',
                    'off_stage': 'off_stage',
                }
                program_data['program_type'] = type_aliases.get(raw_type, raw_type)

                raw_category = str(row[column_mapping['category']]).strip()
                category = StudentCategory.objects.filter(
                    school=event.school, is_active=True,
                ).filter(Q(code__iexact=raw_category) | Q(name__iexact=raw_category)).first()
                if category:
                    program_data['category'] = category.code
                elif raw_category.casefold() in ('general', 'open', 'gen', 'gn'):
                    program_data['category'] = 'general'
                else:
                    results['errors'].append(
                        f'Row {index + 2}: Category "{raw_category}" is not an active category for this school.'
                    )
                    continue

                raw_team = str(row[column_mapping['is_team_based']]).strip().casefold()
                if raw_team in ('yes', 'true', '1', 'group', 'team'):
                    program_data['is_team_based'] = True
                elif raw_team in ('no', 'false', '0', 'individual', 'single'):
                    program_data['is_team_based'] = False
                else:
                    results['errors'].append(
                        f'Row {index + 2}: Mode must be Individual or Group.'
                    )
                    continue

                numeric_fields = (
                    'max_participants', 'team_size', 'max_teams_per_school',
                    'max_participants_per_team', 'duration_minutes_per_entry',
                    'num_judges',
                )
                invalid_number = False
                for field in numeric_fields:
                    column = column_mapping.get(field)
                    if not column or pd.isna(row[column]):
                        continue
                    try:
                        value = int(float(row[column]))
                        if value <= 0:
                            raise ValueError
                        program_data[field] = value
                    except (TypeError, ValueError):
                        results['errors'].append(
                            f'Row {index + 2}: {field} must be a positive whole number.'
                        )
                        invalid_number = True
                if invalid_number:
                    continue
                if 'num_judges' in program_data and (program_data['num_judges'] < 1 or program_data['num_judges'] > 4):
                    results['errors'].append(f'Row {index + 2}: Number of judges must be between 1 and 4.')
                    continue
                # Validate program_type
                if 'program_type' not in program_data or program_data['program_type'] not in ['stage', 'off_stage']:
                    results['errors'].append(f'Row {index + 2}: Program type ("Type") is required and must be either "stage" or "off_stage".')
                    continue
                if program_data['is_team_based']:
                    if not program_data.get('team_size'):
                        results['errors'].append(
                            f'Row {index + 2}: Group programs require Team Size.'
                        )
                        continue
                    program_data.setdefault('max_teams_per_school', 1)
                    program_data['max_participants'] = None
                elif not program_data.get('max_participants'):
                    results['errors'].append(
                        f'Row {index + 2}: Individual programs require Max Participants.'
                    )
                    continue
                results['valid_programs'].append(program_data)
            except Exception:
                logger.exception('Program spreadsheet row processing failed', extra={'row': index + 2})
                results['errors'].append(f'Row {index + 2}: This row could not be processed.')
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
            'is_team_based': [r'^mode$', r'team.*based', r'^team$', r'^group$', r'is.*team'],
            'team_size': [r'^team.*size$', r'^group.*size$', r'^members.*per.*team$'],
            'max_teams_per_school': [r'max.*sub.*team', r'max.*teams.*school'],
            'max_participants_per_team': [r'max.*participants.*team', r'team.*capacity'],
            'duration_minutes_per_entry': [
                r'duration.*minute', r'minutes.*entry', r'time.*entry', r'^duration$',
            ],
            'program_type': [r'program.*type', r'type', r'program.*stage', r'stage'],
            'num_judges': [r'num.*judge', r'judge.*count', r'^judges$', r'no.*of.*judges']
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
            ws.append([
                "Name", "Category", "Type", "Mode", "Max Participants",
                "Team Size", "Max Sub-Teams", "Team Capacity", "Duration Minutes",
                "Judges (Optional)"
            ])
            # Add example row
            ws.append(["English Elocution", "hs", "stage", "Individual", 2, "", "", "", 5, ""])
            ws.append(["Quiz", "general", "off_stage", "Group", "", 4, 2, 8, 10, 3])
            
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
            logger.exception('Program template generation failed')
            return Response({'error': 'Unable to generate the template.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def search_by_chest_number(self, request, pk=None):
        """Search student by chest number in this event"""
        from .services import program_points_count_for_student

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
                participant=chest_record.student,
                program__is_published=True,
                entry_status='submitted',
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
                    'id': chest_record.team.id if chest_record.team else None,
                    'name': chest_record.team.name if chest_record.team else 'Individual',
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
                        'points_earned': (
                            result.points_earned
                            if program_points_count_for_student(result.program)
                            else 0
                        ),
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
        """Get participants who are assigned to at least one program in this event and have a chest number"""
        event = self.get_object()

        # Chest numbers are created transactionally at assignment time. This GET
        # endpoint is deliberately read-only and exposes assigned participants only.
        assigned_student_ids = ProgramAssignment.objects.filter(
            program__event=event,
            student__isnull=False,
        ).values_list('student_id', flat=True).distinct()
        chest_numbers = ChestNumber.objects.filter(
            event=event,
            student_id__in=assigned_student_ids,
            chest_number__isnull=False,
        ).select_related('student', 'team')

        serializer = ChestNumberSerializer(chest_numbers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def category_top_performers(self, request, pk=None):
        """Get the highest point scorer in each category and program type, plus overall champion"""
        try:
            event = self.get_object()
        except Event.DoesNotExist:
            return Response({'error': 'Event not found'}, status=404)
        
        from accounts.models import StudentCategory
        active_cats = list(StudentCategory.objects.filter(
            is_active=True, school_id=request.user.school_id
        ))
        mixing_codes = [c.code for c in active_cats if c.is_mixing]

        # Get all individual programs for this event (excluding general/mixing category)
        individual_programs = event.programs.filter(
            is_team_based=False,
            is_active=True,
            is_published=True,
        ).exclude(category__in=mixing_codes)
        
        # Prepare structure
        category_performers = {}
        all_participant_points = {}
        program_types = [('stage', 'Stage'), ('off_stage', 'Off Stage')]
        
        for cat_obj in active_cats:
            category = cat_obj.code
            category_name = cat_obj.name
            category_performers[category] = {}
            for prog_type, prog_type_label in program_types:
                # Filter programs by category and program_type
                category_programs = individual_programs.filter(category=category, program_type=prog_type)
                if category_programs.exists():
                    all_results = ProgramResult.objects.filter(
                        program__in=category_programs,
                        entry_status='submitted',
                        position__lte=3,
                        position__gt=0
                    ).select_related('participant', 'team', 'program')
                    participant_points = {}
                    for result in all_results:
                        participant_id = result.participant.id
                        points = result.points_earned
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
    
    @action(detail=True, methods=['get', 'post'])
    def top_scorers(self, request, pk=None):
        """Get list of student top scorers for an event with toggle filters"""
        try:
            event = self.get_object()
        except Event.DoesNotExist:
            return Response({'error': 'Event not found'}, status=404)

        include_team_based_str = str(request.query_params.get('include_team_based', request.data.get('include_team_based', 'false'))).lower()
        include_general_str = str(request.query_params.get('include_general_category', request.data.get('include_general_category', 'false'))).lower()
        include_unpublished_str = str(request.query_params.get('include_unpublished', request.data.get('include_unpublished', 'false'))).lower()

        include_team_based = include_team_based_str == 'true'
        include_general = include_general_str == 'true'
        include_unpublished = include_unpublished_str == 'true'
        if include_unpublished and request.user.role not in ('admin', 'event_manager'):
            return Response({'error': 'Unpublished results are restricted.'}, status=403)

        selected_category = request.query_params.get('category', request.data.get('category', 'all'))
        selected_team_id = request.query_params.get('team_id', request.data.get('team_id', 'all'))

        from accounts.models import StudentCategory
        active_cats = list(StudentCategory.objects.filter(
            is_active=True, school_id=request.user.school_id
        ))
        mixing_codes = [c.code for c in active_cats if c.is_mixing]

        prog_filter = Q(event=event, is_active=True)
        if not include_unpublished:
            prog_filter &= Q(is_published=True)

        if not include_team_based:
            if include_general:
                general_codes = set(mixing_codes) | {'general', 'gen', 'gn', 'open'}
                prog_filter &= (
                    Q(is_team_based=False)
                    | Q(category__in=general_codes)
                )
            else:
                prog_filter &= Q(is_team_based=False)

        if not include_general:
            if mixing_codes:
                prog_filter &= ~Q(category__in=mixing_codes)
            prog_filter &= ~Q(category__iexact='general')
            prog_filter &= ~Q(category__iexact='gen')
            prog_filter &= ~Q(category__iexact='gn')
            prog_filter &= ~Q(category__iexact='open')

        if selected_category and selected_category != 'all':
            prog_filter &= Q(category=selected_category)

        from .services import program_points_count_for_student
        matching_programs = [
            program for program in Program.objects.filter(prog_filter).select_related('event')
            if program_points_count_for_student(program)
        ]

        result_filter = Q(
            program__in=matching_programs,
            entry_status='submitted',
            position__isnull=False,
            position__gt=0
        )
        if selected_team_id and selected_team_id != 'all':
            try:
                result_filter &= Q(team_id=int(selected_team_id))
            except (ValueError, TypeError):
                pass

        results = ProgramResult.objects.filter(result_filter).select_related(
            'participant', 'team', 'program'
        )

        scorers = {}

        def _add_result(student_obj, team_obj, res_obj):
            if not student_obj:
                return
            sid = student_obj.id
            if sid not in scorers:
                cat_code = getattr(student_obj, 'category', 'general')
                cat_obj = next((c for c in active_cats if c.code == cat_code), None)
                cat_display = cat_obj.name if cat_obj else (str(cat_code).upper() if cat_code else 'General')
                
                fn = student_obj.get_full_name().strip() if hasattr(student_obj, 'get_full_name') and callable(getattr(student_obj, 'get_full_name')) else ""
                dn = getattr(student_obj, 'display_name', '').strip()
                comb = f"{getattr(student_obj, 'first_name', '') or ''} {getattr(student_obj, 'last_name', '') or ''}".strip()
                name_str = fn or dn or comb or getattr(student_obj, 'username', 'Student')

                final_team = team_obj or getattr(student_obj, 'team', None)

                scorers[sid] = {
                    'student_id': sid,
                    'name': name_str,
                    'team_name': final_team.name if final_team else 'No Team',
                    'team_id': final_team.id if final_team else None,
                    'category': cat_code,
                    'category_display': cat_display,
                    'offstage_points': 0,
                    'stage_points': 0,
                    'total_points': 0,
                    'achievements': []
                }

            pts = res_obj.points_earned or 0
            p_type = getattr(res_obj.program, 'program_type', 'stage') or 'stage'
            p_type_norm = str(p_type).lower().replace(' ', '_').replace('-', '_')

            if p_type_norm in ('off_stage', 'offstage'):
                scorers[sid]['offstage_points'] += pts
            else:
                scorers[sid]['stage_points'] += pts

            scorers[sid]['total_points'] += pts
            scorers[sid]['achievements'].append({
                'program_name': res_obj.program.name,
                'position': res_obj.position,
                'points': pts,
                'program_type': p_type
            })

        for r in results:
            if r.program.is_team_based and r.team:
                assignments = ProgramAssignment.objects.filter(
                    program=r.program,
                    team=r.team,
                    sub_team_number=r.sub_team_number or 1
                ).select_related('student')
                for a in assignments:
                    if a.student:
                        _add_result(a.student, a.team or r.team, r)
            elif r.participant:
                _add_result(r.participant, r.team, r)

        scorers_list = list(scorers.values())
        scorers_list.sort(key=lambda s: (s['total_points'], s['stage_points'], s['offstage_points']), reverse=True)

        if scorers_list:
            top_total_pts = scorers_list[0]['total_points']

            for s in scorers_list:
                s['badges'] = []
                if top_total_pts > 0 and s['total_points'] == top_total_pts:
                    s['badges'].append({'title': 'Top Scorer', 'color': 'bg-red-600 text-white'})

        return Response({
            'status': 'success',
            'scorers': scorers_list,
            'total_scorers': len(scorers_list)
        })

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

    @action(detail=True, methods=['post'])
    def toggle_program_publish(self, request, pk=None):
        """Toggle publish status for a program's result"""
        event = self.get_object()
        program_id = request.data.get('program_id')
        is_published = request.data.get('is_published')
        
        try:
            program = event.programs.get(id=program_id)
            if is_published is None:
                target_state = not program.is_published
            elif isinstance(is_published, bool):
                target_state = is_published
            elif str(is_published).strip().lower() in ('true', '1', 'yes'):
                target_state = True
            elif str(is_published).strip().lower() in ('false', '0', 'no'):
                target_state = False
            else:
                return Response({'error': 'is_published must be true or false.'}, status=400)
            if target_state:
                if event.status not in ('published', 'ongoing', 'completed'):
                    return Response({
                        'error': 'Results cannot be published while the event is draft or cancelled.'
                    }, status=400)
                from .services import program_results_complete
                if not program_results_complete(program):
                    return Response({
                        'error': f'Cannot publish results for "{program.name}": Mark entry has not been submitted.'
                    }, status=status.HTTP_400_BAD_REQUEST)
            program.is_published = target_state
            program.save()
            from .services import recalculate_program_results
            recalculate_program_results(program)
            audit_security_event(
                request, 'program_results_publish_state', 'success',
                school_id=event.school_id, target=program.id,
            )
            return Response({
                'status': 'success',
                'program_id': program.id,
                'is_published': program.is_published
            })
        except Program.DoesNotExist:
            return Response({'error': 'Program not found'}, status=404)

    @action(detail=True, methods=['post'])
    def publish_all_results(self, request, pk=None):
        """Publish all submitted results for an event"""
        event = self.get_object()
        from .services import program_results_complete, recalculate_program_results
        if event.status not in ('published', 'ongoing', 'completed'):
            return Response({
                'error': 'Results cannot be published while the event is draft or cancelled.'
            }, status=400)
        published = []
        skipped = []
        for program in event.programs.filter(is_active=True):
            if not program_results_complete(program):
                skipped.append(program.id)
                continue
            program.is_published = True
            program.save(update_fields=['is_published', 'updated_at'])
            recalculate_program_results(program)
            published.append(program.id)
        audit_security_event(
            request, 'event_results_publish_all', 'success',
            school_id=event.school_id, target=event.id,
        )
        return Response({
            'status': 'success',
            'published_count': len(published),
            'published_program_ids': published,
            'skipped_incomplete_program_ids': skipped,
        })
    
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

    def get_permissions(self):
        if self.action in [
            'create', 'update', 'partial_update', 'destroy', 'add_member', 'remove_member',
            'credentials', 'regenerate_credentials', 'reset_numbering',
        ]:
            return [IsSchoolAdmin()]
        return [IsAdminOrEventManager()]
    
    def get_queryset(self):
        """Filter teams based on user permissions and query parameters"""
        user = self.request.user
        
        # Base queryset based on user permissions
        if user.role in ['admin', 'event_manager']:
            queryset = Team.objects.filter(school_id=user.school_id).prefetch_related('members')
        else:
            # Users can only see teams they're part of
            queryset = Team.objects.filter(
                Q(members=user), school_id=user.school_id
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
            team = serializer.save(school=request.user.school)
            
            # Optionally link to event if provided
            event_id = request.data.get('event_id')
            if event_id:
                try:
                    from events.models import Event
                    event = Event.objects.get(id=event_id, school=request.user.school)
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
            new_member = User.objects.get(email=email, school=request.user.school, role='student')
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Team membership is school-wide. A participant can belong to only one
        # team, which keeps event chest-number ownership deterministic.
        if Team.objects.filter(
            school=team.school,
            members=new_member,
        ).exclude(pk=team.pk).exists():
            return Response(
                {'error': 'User is already assigned to another team'},
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
            member = User.objects.get(id=member_id, school=request.user.school, role='student')
            team.members.remove(member)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except User.DoesNotExist:
            return Response(
                {'error': 'Member not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['get', 'post', 'put'], permission_classes=[IsSchoolAdmin])
    def credentials(self, request, pk=None):
        """Get or set team leader login credentials (admin only)"""
        team = self.get_object()
        
        if request.method in ['POST', 'PUT']:
            username = request.data.get('username') or request.data.get('team_username')
            password = request.data.get('password') or request.data.get('team_password')
            
            if not username and not password:
                return Response(
                    {'error': 'Provide a username or password to update credentials.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if username:
                username = username.strip()
                if len(username) < 3:
                    return Response(
                        {'error': 'Username must be at least 3 characters long.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if Team.objects.filter(
                    school_id=team.school_id, team_username=username
                ).exclude(pk=team.pk).exists():
                    return Response(
                        {'error': f'The username "{username}" is already in use by another team in this school.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                team.team_username = username
            
            if password:
                password = password.strip()
                if len(password) < 6:
                    return Response(
                        {'error': 'Password must be at least 6 characters long.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                from django.contrib.auth.hashers import make_password
                team.team_password = make_password(password)
                team._plain_team_password = password
            
            team.save()
            audit_security_event(
                request, 'team_credentials_update', 'success',
                school_id=team.school_id, target=team.id,
            )
            return Response({
                'team_id': team.team_number,
                'team_name': team.name,
                'username': team.team_username,
                'password': password if password else None,
                'message': 'Team leader credentials updated successfully.',
                'created_at': team.created_at
            })
        
        # GET request
        if not team.team_username or not team.team_password:
            team.generate_team_credentials()
            team.save()
        
        return Response({
            'team_id': team.team_number,
            'team_name': team.name,
            'username': team.team_username,
            'password': getattr(team, '_plain_team_password', None),
            'message': 'Team leader login credentials retrieved.',
            'created_at': team.created_at
        })
    
    @action(detail=True, methods=['post'], permission_classes=[IsSchoolAdmin])
    def regenerate_credentials(self, request, pk=None):
        """Regenerate team login credentials (admin only)"""
        team = self.get_object()
        
        # Generate new credentials
        username, password = team.generate_team_credentials()
        team.save()
        audit_security_event(
            request, 'team_credentials_regenerate', 'success',
            school_id=team.school_id, target=team.id,
        )
        
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
            from django.core.exceptions import ValidationError as DjangoValidationError
            from events.models import Team
            Team.reset_team_numbering(request.user.school)
            
            # Get updated team list
            teams = Team.objects.filter(school=request.user.school).order_by('created_at')
            team_data = [{
                'id': team.id,
                'name': team.name,
                'team_number': team.team_number
            } for team in teams]
            
            return Response({
                'message': f'Successfully reset team numbering for {teams.count()} teams.',
                'teams': team_data
            }, status=status.HTTP_200_OK)
        except DjangoValidationError as exc:
            return Response({
                'error': exc.messages[0],
            }, status=status.HTTP_409_CONFLICT)
        except Exception as e:
            logger.exception('Team numbering reset failed')
            return Response({
                'error': 'Failed to reset team numbering.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAdminOrEventManager])
    def next_number(self, request):
        """Get the next available team number"""
        try:
            from events.models import Team
            max_number = Team.objects.filter(school=request.user.school).aggregate(
                max_number=Max('team_number')
            )['max_number']
            next_number = (max_number or 0) + 1
            
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
        from .services import program_points_count_for_student

        team = self.get_object()
        
        if not event_id:
            return Response({'error': 'event_id is required'}, status=400)
        
        try:
            from events.models import Event, ProgramResult, ProgramAssignment
            event = Event.objects.get(id=event_id, school_id=request.user.school_id)
            
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
                        'points_earned': (
                            student_result.points_earned
                            if student_result and program_points_count_for_student(student_result.program)
                            else 0
                        ),
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
                    'category': str(member.category).upper() if member.category else 'N/A',
                    'participated_in_event': member.id in participating_students,
                    'total_points_earned': sum(
                        r.points_earned for r in results
                        if r.participant_id == member.id and program_points_count_for_student(r.program)
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
        from .services import program_points_count_for_student

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
                            'category': str(student.category).upper() if student.category else 'N/A',
                            'grade': student.grade,
                            'section': student.section,
                            'chest_number': student_assignment.chest_number,
                            'has_result': student_result is not None,
                            'position': student_result.position if student_result else None,
                            'points_earned': (
                                student_result.points_earned
                                if student_result and program_points_count_for_student(student_result.program)
                                else 0
                            ),
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
                    'category': str(member.category).upper() if member.category else 'N/A',
                    'grade': member.grade,
                    'section': member.section,
                    'total_points_earned': sum(
                        r.points_earned for r in member_results
                        if program_points_count_for_student(r.program)
                    ),
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
            logger.exception('Team detail lookup failed')
            return Response({'error': 'Unable to load team details.'}, status=500)

class EventAnnouncementViewSet(viewsets.ModelViewSet):
    """ViewSet for Event Announcements"""
    serializer_class = EventAnnouncementSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['event', 'is_important']
    ordering = ['-created_at']
    pagination_class = SmallPagination
    
    def get_queryset(self):
        return EventAnnouncement.objects.filter(
            event__school_id=self.request.user.school_id
        ).select_related('event', 'created_by')
    
    def get_permissions(self):
        """Set permissions based on action"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAdminOrEventManager]
        else:
            permission_classes = [IsAdminOrEventManager]
        return [permission() for permission in permission_classes]
    
    def perform_create(self, serializer):
        """Set the creator when creating an announcement"""
        event = serializer.validated_data['event']
        if event.school_id != self.request.user.school_id:
            raise ValidationError('This event does not belong to your school.')
        serializer.save(created_by=self.request.user)

class EventStageViewSet(viewsets.ModelViewSet):
    serializer_class = EventStageSerializer
    permission_classes = [IsAdminOrEventManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'number']
    ordering_fields = ['number', 'name', 'capacity', 'created_at']
    ordering = ['number', 'name']
    pagination_class = LargePagination

    def get_queryset(self):
        return EventStage.objects.filter(
            event_id=self.kwargs.get('event_pk'),
            event__school_id=self.request.user.school_id,
        ).select_related('event')

    def perform_create(self, serializer):
        event = Event.objects.filter(
            pk=self.kwargs.get('event_pk'), school_id=self.request.user.school_id
        ).first()
        if not event:
            raise ValidationError({'event': 'Event not found.'})
        serializer.save(event=event)

    @transaction.atomic
    def perform_update(self, serializer):
        stage = self.get_object()
        updated = serializer.save()
        # Program venue remains a printable snapshot used by existing PDFs,
        # so keep it synchronized when a stage is renamed.
        updated.programs.update(venue=updated.display_name)


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
        if self.action in [
            'create', 'update', 'partial_update', 'destroy',
            'mark_finished', 'mark_unfinished', 'schedule',
        ]:
            permission_classes = [IsAdminOrEventManager]
        else:
            permission_classes = [IsAdminOrEventManager]
        return [permission() for permission in permission_classes]
    
    def get_queryset(self):
        """Filter programs based on query parameters"""
        queryset = Program.objects.filter(event__school_id=self.request.user.school_id)
        
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
            category_counts = Program.objects.filter(
                event_id=event_pk, event__school_id=request.user.school_id,
            ).values('category').annotate(
                count=Count('id')
            ).order_by('category')
            
            from accounts.models import StudentCategory
            counts = {c.code: 0 for c in StudentCategory.objects.filter(school_id=request.user.school_id)}
            counts['total'] = 0
            
            for category_data in category_counts:
                category = category_data['category']
                count = category_data['count']
                counts[category] = count
                counts['total'] += count
            
            response.data['category_counts'] = counts
        
        return response
    
    def perform_create(self, serializer):
        """Set the event when creating a program"""
        event_id = self.request.data.get('event') or self.kwargs.get('event_pk')
        if event_id:
            event = Event.objects.get(id=event_id, school_id=self.request.user.school_id)
            serializer.save(event=event)
        else:
            raise ValidationError('Event is required.')

    def perform_update(self, serializer):
        program = self.get_object()
        previous_grading_points = dict(program.grading_points or {})
        updated_program = serializer.save()
        if previous_grading_points != (updated_program.grading_points or {}):
            from .services import recalculate_program_results
            recalculate_program_results(updated_program)

    @action(detail=True, methods=['patch'], permission_classes=[IsAdminOrEventManager])
    def schedule(self, request, pk=None, event_pk=None):
        """Assign or clear a stage/time and report any same-stage overlaps."""
        program = self.get_object()
        allowed = {'stage_id', 'start_time', 'end_time', 'duration_minutes_per_entry'}
        payload = {key: value for key, value in request.data.items() if key in allowed}
        serializer = self.get_serializer(program, data=payload, partial=True)
        serializer.is_valid(raise_exception=True)
        program = serializer.save()

        conflicts = []
        if program.stage_id and program.start_time and program.end_time:
            possible = Program.objects.filter(
                event=program.event, stage_id=program.stage_id, start_time__isnull=False,
            ).exclude(pk=program.pk).select_related('stage')
            for other in possible:
                other_end = other.end_time or (
                    other.start_time + timedelta(minutes=other.scheduled_duration_minutes)
                )
                if other.start_time < program.end_time and other_end > program.start_time:
                    conflicts.append({
                        'id': other.id, 'name': other.name,
                        'start_time': other.start_time, 'end_time': other_end,
                    })

        return Response({'program': self.get_serializer(program).data, 'conflicts': conflicts})
    
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
    def mark_unfinished(self, request, pk=None, event_pk=None, *args, **kwargs):
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
        school_programs = Program.objects.filter(event__school_id=request.user.school_id)
        categories = school_programs.values('category').annotate(
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
            cat_programs = school_programs.filter(category=category['category']).order_by('start_time')
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
        
        school_programs = Program.objects.filter(event__school_id=request.user.school_id)
        upcoming = school_programs.filter(start_time__gt=now, is_finished=False).order_by('start_time')
        ongoing = school_programs.filter(start_time__lte=now, end_time__gte=now, is_finished=False).order_by('start_time')
        finished = school_programs.filter(is_finished=True).order_by('-end_time')
        
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
        category_counts = Program.objects.filter(
            event_id=event_pk, event__school_id=request.user.school_id
        ).values('category').annotate(
            count=Count('id')
        ).order_by('category')
        
        # Initialize counts
        from accounts.models import StudentCategory
        counts = {c.code: 0 for c in StudentCategory.objects.filter(school=self.request.user.school)}
        counts['total'] = 0
        
        # Fill in the actual counts
        for category_data in category_counts:
            category = category_data['category']
            count = category_data['count']
            counts[category] = count
            counts['total'] += count
        
        return Response(counts)

class ProgramAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = ProgramAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = LargePagination

    def get_permissions(self):
        if self.action in (
            'create', 'update', 'partial_update', 'destroy', 'bulk_assign',
            'bulk_upload', 'assign_all_category', 'download_template',
        ):
            return [IsAdminOrEventManager()]
        return [IsAdminOrEventManager()]
    
    def get_queryset(self):
        program_id = self.kwargs.get('program_pk')
        return ProgramAssignment.objects.filter(
            program_id=program_id, program__event__school_id=self.request.user.school_id
        )
    
    def perform_create(self, serializer):
        program_id = self.kwargs.get('program_pk')
        program = Program.objects.select_related('event').get(
            id=program_id, event__school_id=self.request.user.school_id
        )
        from .services import assign_students
        assignment = assign_students(
            user=self.request.user,
            team=serializer.validated_data.get('team'),
            program=program,
            student_ids=[serializer.validated_data['student'].id],
            sub_team_number=serializer.validated_data.get('sub_team_number', 1),
        )[0]
        serializer.instance = assignment

    def update(self, request, *args, **kwargs):
        return Response(
            {'error': 'Assignments are immutable. Remove the entry and assign it again.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        assignment = self.get_object()
        from django.core.exceptions import ValidationError as DjangoValidationError
        from .services import remove_assignment_group
        try:
            remove_assignment_group(user=request.user, assignment=assignment)
        except DjangoValidationError as exc:
            return Response({'error': exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=False, methods=['post'])
    def bulk_assign(self, request, event_pk=None, program_pk=None):
        """Assign multiple students to a program"""
        try:
            program = Program.objects.get(id=program_pk, event__school_id=request.user.school_id)
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

        from django.core.exceptions import ValidationError as DjangoValidationError
        from django.db import transaction
        from .services import assign_students

        requested_team_id = request.data.get('team_id')
        requested_subteam = request.data.get('sub_team_number', 1)
        requested_leader = request.data.get('leader_id')
        try:
            with transaction.atomic():
                created = []
                if program.is_team_based:
                    if requested_team_id:
                        team = Team.objects.get(id=requested_team_id, school_id=request.user.school_id)
                        groups = [(team, student_ids)]
                    else:
                        groups_by_team = defaultdict(list)
                        for student in User.objects.filter(
                            id__in=student_ids, role='student', school_id=request.user.school_id
                        ):
                            team = student.team_memberships.filter(school_id=request.user.school_id).first()
                            if not team:
                                raise DjangoValidationError(
                                    f'{student.display_name} is not assigned to a team.'
                                )
                            groups_by_team[team].append(student.id)
                        groups = list(groups_by_team.items())
                    for team, ids in groups:
                        created.extend(assign_students(
                            user=request.user,
                            team=team,
                            program=program,
                            student_ids=ids,
                            sub_team_number=requested_subteam,
                            leader_id=requested_leader,
                        ))
                else:
                    for student in User.objects.filter(
                        id__in=student_ids, role='student', school_id=request.user.school_id
                    ):
                        team = Team.objects.filter(members=student, school_id=request.user.school_id).first()
                        if requested_team_id:
                            team = Team.objects.get(id=requested_team_id, school_id=request.user.school_id)
                        created.extend(assign_students(
                            user=request.user,
                            team=team,
                            program=program,
                            student_ids=[student.id],
                        ))
                if len({int(value) for value in student_ids}) != len(created):
                    raise DjangoValidationError('One or more selected participants do not exist.')
            return Response({
                'message': f'Successfully assigned {len(created)} participants.',
                'assignments': self.get_serializer(created, many=True).data,
            }, status=status.HTTP_200_OK)
        except Team.DoesNotExist:
            return Response({'error': 'The selected team does not exist.'}, status=status.HTTP_400_BAD_REQUEST)
        except DjangoValidationError as exc:
            message = exc.messages[0] if getattr(exc, 'messages', None) else str(exc)
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)
        
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
                            'error': f'Team "{team.name}" would exceed the maximum limit of {per_team_limit} participants per team for this program. Current: {current_team_assignments}, Trying to add: {new_assignments_for_team}, Limit: {per_team_limit}'
                        }, status=status.HTTP_400_BAD_REQUEST)
        
        assignments = []
        errors = []
        
        for student_id in student_ids:
            try:
                student = User.objects.get(id=student_id, role='student')
                
                # Validation: Check category compatibility dynamically
                from accounts.models import StudentCategory
                try:
                    program_cat = StudentCategory.objects.get(code=program.category)
                    is_compatible = True
                    if program_cat.is_mixing:
                        allowed_cats = list(program_cat.mixed_categories.values_list('code', flat=True))
                        if allowed_cats and student.category not in allowed_cats:
                            is_compatible = False
                    else:
                        if student.category != program.category:
                            is_compatible = False
                except StudentCategory.DoesNotExist:
                    is_compatible = (program.category == 'open' or student.category == program.category)

                if not is_compatible:
                    errors.append(f'Student {student.get_full_name()} ({student.student_id}) category "{student.category}" is not compatible with program category "{program.category}"')
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
    
    @action(detail=False, methods=['post'], throttle_classes=[UploadRateThrottle])
    def bulk_upload(self, request, program_pk=None):
        """AI-powered bulk upload students to a program with Excel support"""
        if 'file' not in request.FILES:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        try:
            validate_excel_upload(file)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            program = Program.objects.get(
                id=program_pk, event__school_id=request.user.school_id
            )
            
            # Read Excel / CSV file
            try:
                fname = file.name.lower()
                if fname.endswith('.csv'):
                    try:
                        df = pd.read_csv(file, encoding='utf-8')
                    except UnicodeDecodeError:
                        file.seek(0)
                        df = pd.read_csv(file, encoding='latin-1')
                else:
                    df = pd.read_excel(file, engine='openpyxl' if fname.endswith('.xlsx') else 'xlrd')
            except Exception:
                logger.exception('Assignment spreadsheet parsing failed')
                return Response({'error': 'The spreadsheet could not be read.'}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                validate_excel_shape(df)
            except ValueError as exc:
                return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            # AI-powered column detection and data validation
            results = self._process_excel_with_ai(df, program)
            
            if results['errors']:
                return Response({
                    'error': 'Data validation failed',
                    'details': results['errors'],
                    'suggestions': results['suggestions']
                }, status=status.HTTP_400_BAD_REQUEST)

            return self.bulk_assign_internal(
                request,
                program,
                [item['student'].id for item in results['valid_students']],
            )
            
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
            logger.exception('Assignment bulk upload failed')
            return Response({'error': 'Unable to process the workbook.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
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
                    
            except Exception:
                logger.exception('Assignment spreadsheet row processing failed', extra={'row': index + 2})
                results['errors'].append(f'Row {index + 2}: This row could not be processed.')
        
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
            return User.objects.get(
                student_id=identifier, role='student', school_id=self.request.user.school_id
            )
        except User.DoesNotExist:
            pass
        
        # Strategy 2: Try with common prefixes/suffixes removed
        clean_identifier = re.sub(r'^(st|student|roll)', '', identifier.lower()).strip()
        clean_identifier = re.sub(r'[^\w]', '', clean_identifier)  # Remove special chars
        
        try:
            students = User.objects.filter(role='student', school=self.request.user.school)
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
                                role='student',
                                school_id=self.request.user.school_id,
                            )
                        except User.DoesNotExist:
                            pass
            except:
                pass
        
        return None
    
    def _validate_student_for_program(self, student, program):
        """Validate if student meets program requirements"""
        # Check category requirements
        from accounts.models import StudentCategory
        try:
            program_cat = StudentCategory.objects.get(
                code=program.category, school=program.event.school
            )
            if program_cat.is_mixing:
                allowed_cats = list(program_cat.mixed_categories.values_list('code', flat=True))
                if allowed_cats and student.category not in allowed_cats:
                    return False
            else:
                if student.category != program.category:
                    return False
        except StudentCategory.DoesNotExist:
            if program.category != 'general' and student.category != program.category:
                return False
        
        return True
    
    @action(detail=False, methods=['get'])
    def download_template(self, request, program_pk=None):
        """Generate and download Excel template for bulk upload"""
        try:
            program = Program.objects.get(
                id=program_pk, event__school_id=request.user.school_id
            )
            
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
                sanitize_spreadsheet_dataframe(df).to_excel(writer, sheet_name='Students', index=False)
                
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
                        f'Category Requirement: {str(program.category).upper()}',
                        f'Type: {program.get_type_display()}',
                        f'Team Based: {"Yes" if program.is_team_based else "No"}'
                    ]
                })
                sanitize_spreadsheet_dataframe(instructions).to_excel(writer, sheet_name='Instructions', index=False)
            
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
            logger.exception('Assignment template generation failed')
            return Response({'error': 'Unable to generate the template.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def assign_all_category(self, request, event_pk=None, program_pk=None):
        """Assign all students in a specific category to a program"""
        try:
            program = Program.objects.get(
                id=program_pk, event__school_id=request.user.school_id
            )
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
        students = User.objects.filter(
            role='student', category=category, school_id=request.user.school_id
        )
        
        if not students.exists():
            return Response({
                'error': f'No students found in {category} category'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get student IDs
        student_ids = list(students.values_list('id', flat=True))
        
        # Use the existing bulk_assign logic
        return self.bulk_assign_internal(request, program, student_ids)
    
    def _legacy_bulk_assign_internal_disabled(self, request, program, student_ids):
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
                            'error': f'Team "{team.name}" would exceed the maximum limit of {per_team_limit} participants per team for this program. Current: {current_team_assignments}, Trying to add: {new_assignments_for_team}, Limit: {per_team_limit}'
                        }, status=status.HTTP_400_BAD_REQUEST)
        
        assignments = []
        errors = []
        
        for student_id in student_ids:
            try:
                student = User.objects.get(id=student_id, role='student')
                
                # Validation: Check category compatibility dynamically
                from accounts.models import StudentCategory
                try:
                    program_cat = StudentCategory.objects.get(code=program.category)
                    is_compatible = True
                    if program_cat.is_mixing:
                        allowed_cats = list(program_cat.mixed_categories.values_list('code', flat=True))
                        if allowed_cats and student.category not in allowed_cats:
                            is_compatible = False
                    else:
                        if student.category != program.category:
                            is_compatible = False
                except StudentCategory.DoesNotExist:
                    is_compatible = (program.category == 'open' or student.category == program.category)

                if not is_compatible:
                    errors.append(f'Student {student.get_full_name()} ({student.student_id}) category "{student.category}" is not compatible with program category "{program.category}"')
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
    permission_classes = [IsAdminOrEventManager]
    pagination_class = SmallPagination
    
    def get_queryset(self):
        program_id = self.kwargs.get('program_pk')
        if program_id:
            return ProgramResult.objects.filter(
                program_id=program_id, program__event__school_id=self.request.user.school_id
            )
        return ProgramResult.objects.filter(program__event__school_id=self.request.user.school_id)
    
    def get_serializer_class(self):
        if self.action == 'mark_entry':
            return MarkEntrySerializer
        elif self.action == 'results_summary':
            return ProgramResultSummarySerializer
        return ProgramResultSerializer
    
    def get_permissions(self):
        if self.action in [
            'create', 'update', 'partial_update', 'destroy', 'mark_entry',
            'bulk_mark_entry', 'results_summary', 'results_pdf',
        ]:
            return [IsAdminOrEventManager()]
        return [IsAdminOrEventManager()]

    def perform_create(self, serializer):
        program = Program.objects.get(
            id=self.kwargs.get('program_pk'),
            event__school_id=self.request.user.school_id,
        )
        participant = serializer.validated_data.get('participant')
        team = serializer.validated_data.get('team')
        if participant and participant.school_id != self.request.user.school_id:
            raise ValidationError('This participant does not belong to your school.')
        if team and team.school_id != self.request.user.school_id:
            raise ValidationError('This team does not belong to your school.')
        serializer.save(program=program, entered_by=self.request.user)

    def create(self, request, *args, **kwargs):
        return Response(
            {'error': 'Result rows are created automatically from program assignments.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def update(self, request, *args, **kwargs):
        return Response(
            {'error': 'Use the mark-entry endpoint to update competition results.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {'error': 'Remove the related assignment instead of deleting its result.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )
    
    @action(detail=False, methods=['get'])
    def mark_entry(self, request, event_pk=None, program_pk=None):
        """Get participants for mark entry with their current marks"""
        try:
            program = Program.objects.get(
                id=program_pk, event_id=event_pk, event__school_id=request.user.school_id
            )
        except Program.DoesNotExist:
            return Response(
                {'error': 'Program not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get all assignments for this program
        assignments = ProgramAssignment.objects.filter(program=program)
        
        # For team-based programs, group by (team, sub_team_number) so each sub-team is a distinct participant entry!
        if program.is_team_based:
            team_results = {}
            
            for assignment in assignments:
                team = assignment.team
                if not team:
                    continue
                
                sub_team_num = getattr(assignment, 'sub_team_number', 1) or 1
                group_key = (team.id, sub_team_num)
                
                if group_key not in team_results:
                    # Find designated leader for this sub-team, otherwise use current student as representative
                    leader_assg = ProgramAssignment.objects.filter(
                        program=program,
                        team=team,
                        sub_team_number=sub_team_num,
                        is_leader=True
                    ).first()
                    rep_student = leader_assg.student if leader_assg else assignment.student
                    
                    # Try to find existing result for this (program, team, sub_team_number)
                    existing_result = ProgramResult.objects.filter(
                        program=program,
                        team=team,
                        sub_team_number=sub_team_num
                    ).first()
                    
                    if existing_result:
                        result = existing_result
                        if result.participant != rep_student:
                            result.participant = rep_student
                    else:
                        continue
                    
                    team_results[group_key] = {
                        'result': result,
                        'team': team,
                        'sub_team_number': sub_team_num,
                        'representative_student': rep_student,
                        'all_team_members': []
                    }
                
                team_results[group_key]['all_team_members'].append(assignment.student)
            
            # Convert to list format for serializer
            results = []
            for team_data in team_results.values():
                result = team_data['result']
                team = team_data['team']
                sub_team_num = team_data['sub_team_number']
                representative = team_data['representative_student']
                all_members = team_data['all_team_members']
                
                total_sub_teams = ProgramAssignment.objects.filter(
                    program=program, team=team
                ).values('sub_team_number').distinct().count()
                
                sub_label = f" (Sub-Team {sub_team_num})" if total_sub_teams > 1 or sub_team_num > 1 else ""
                
                result.team_name_override = f"{team.name}{sub_label}"
                result.team_member_count = len(all_members)
                result.all_team_members = all_members
                result.is_team_based = True
                results.append(result)
        
        # For individual programs, show each student separately
        else:
            results = []
            for assignment in assignments:
                # Get the student's team for this event
                student_team = assignment.team or assignment.student.team_memberships.first()
                
                # Try to get existing result, or create new one
                # First try to find an existing result with this participant
                existing_result = ProgramResult.objects.filter(
                    program=program,
                    participant=assignment.student
                ).first()
                
                if existing_result:
                    result = existing_result
                    if result.team != student_team:
                        result.team = student_team
                else:
                    continue
                
                results.append(result)
        
        serializer = MarkEntrySerializer(results, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def bulk_mark_entry(self, request, event_pk=None, program_pk=None):
        """Bulk update marks for multiple participants"""
        try:
            program = Program.objects.get(
                id=program_pk, event_id=event_pk,
                event__school_id=request.user.school_id,
            )
        except Program.DoesNotExist:
            return Response(
                {'error': 'Program not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        marks_data = request.data.get('marks', [])
        entry_status = request.data.get('entry_status', 'submitted')
        if entry_status not in ('draft', 'submitted'):
            return Response({'error': 'Invalid mark-entry status.'}, status=status.HTTP_400_BAD_REQUEST)
        if program.is_published and entry_status == 'draft':
            return Response({
                'error': 'Published results cannot be changed back to draft. Submit the edited marks to keep the published result consistent.',
            }, status=status.HTTP_400_BAD_REQUEST)
        if program.is_published and request.data.get('confirm_published_edit') is not True:
            return Response({
                'error': 'These results are already published. Confirm that you want to edit the marks.',
                'requires_confirmation': True,
            }, status=status.HTTP_409_CONFLICT)
        if not isinstance(marks_data, list) or not marks_data:
            return Response({'error': 'At least one mark row is required.'}, status=status.HTTP_400_BAD_REQUEST)

        active_judge_count = program.effective_num_judges
        active_judge_keys = [f'judge{i}_marks' for i in range(1, active_judge_count + 1)]

        def row_has_marks(row_dict):
            return any(
                row_dict.get(k) is not None and str(row_dict.get(k, '')).strip() != ''
                for k in active_judge_keys
            )

        attending_rows = [row for row in marks_data if row_has_marks(row)]

        if entry_status == 'submitted':
            if not attending_rows:
                return Response({
                    'error': 'At least one participant must have marks entered before submitting.'
                }, status=status.HTTP_400_BAD_REQUEST)

            code_letters = [str(row.get('code_letter', '')).strip().upper() for row in attending_rows]
            if any(not code for code in code_letters):
                return Response({'error': 'A code letter is required for every attending participant with submitted marks.'}, status=status.HTTP_400_BAD_REQUEST)
            if len(set(code_letters)) != len(code_letters):
                return Response({'error': 'Code letters must be unique among attending participants.'}, status=status.HTTP_400_BAD_REQUEST)

        updated_results = []
        from django.core.exceptions import ValidationError as DjangoValidationError
        from django.db import transaction
        from .services import recalculate_program_results

        try:
            with transaction.atomic():
                for mark_data in marks_data:
                    # Look up result by ID first, or fallback to team_id & sub_team_number
                    if 'id' in mark_data and mark_data['id']:
                        result = ProgramResult.objects.select_for_update().get(
                            id=mark_data['id'],
                            program=program
                        )
                    elif program.is_team_based and 'team_id' in mark_data:
                        result = ProgramResult.objects.select_for_update().get(
                            program=program,
                            team_id=mark_data['team_id'],
                            sub_team_number=mark_data.get('sub_team_number', 1) or 1,
                        )
                    else:
                        raise DjangoValidationError('Every mark row must identify a valid result.')

                    is_attending = row_has_marks(mark_data)
                    row_entry_status = 'submitted' if (entry_status == 'submitted' and is_attending) else 'draft'

                    for field in ('code_letter', 'judge1_marks', 'judge2_marks', 'judge3_marks', 'judge4_marks', 'comments'):
                        if field in mark_data:
                            value = mark_data[field]
                            if field == 'code_letter':
                                value = str(value or '').strip().upper() if is_attending else ''
                            if not is_attending and field.startswith('judge'):
                                value = None
                            setattr(result, field, value)

                    if not is_attending:
                        result.raw_total_marks = None
                        result.total_marks = None
                        result.average_marks = None
                        result.position = None
                        result.points_earned = 0
                        result.grade = ''
                        result.grade_extra_points = 0

                    result.entry_status = row_entry_status
                    result.save()
                    updated_results.append(result)

                if len(updated_results) != len(marks_data):
                    raise DjangoValidationError('One or more result rows could not be updated.')
                if entry_status == 'submitted':
                    submitted_codes = [
                        str(code or '').strip().upper()
                        for code in ProgramResult.objects.filter(
                            program=program, entry_status='submitted'
                        ).values_list('code_letter', flat=True)
                    ]
                    if any(not code for code in submitted_codes):
                        raise DjangoValidationError('Every submitted result must have a code letter.')
                    if len(set(submitted_codes)) != len(submitted_codes):
                        raise DjangoValidationError('Code letters must be unique within the program.')
                recalculate_program_results(program)
        except ProgramResult.DoesNotExist:
            return Response({'error': 'One or more result rows no longer exist.'}, status=status.HTTP_400_BAD_REQUEST)
        except DjangoValidationError as exc:
            if hasattr(exc, 'message_dict'):
                detail = exc.message_dict
            else:
                detail = exc.messages[0] if getattr(exc, 'messages', None) else str(exc)
            return Response({'error': detail}, status=status.HTTP_400_BAD_REQUEST)

        updated_results = list(ProgramResult.objects.filter(id__in=[r.id for r in updated_results]))
        audit_security_event(
            request, 'program_marks_update', 'success',
            school_id=program.event.school_id, target=program.id,
        )
        
        serializer = MarkEntrySerializer(updated_results, many=True)
        return Response({
            'message': f'{entry_status.title()} marks for {len(updated_results)} entries.',
            'results': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def results_summary(self, request, event_pk=None, program_pk=None):
        """Get results summary for a program"""
        try:
            program = Program.objects.get(
                id=program_pk, event_id=event_pk,
                event__school_id=request.user.school_id,
            )
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
                team__isnull=False,
                entry_status='submitted',
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
                program=program,
                entry_status='submitted',
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
    
    @action(detail=False, methods=['get'], throttle_classes=[ExportRateThrottle])
    def results_pdf(self, request, event_pk=None, program_pk=None):
        """Generate PDF report of program results"""
        try:
            program = Program.objects.get(
                id=program_pk, event_id=event_pk,
                event__school_id=request.user.school_id,
            )
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
        
        school_settings = SchoolSettings.get_settings(program.event.school)
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
            Paragraph(f"<b>{str(program.category).upper()}</b>", center_style),
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
        headers = ['Chest No.', 'Participant Name', 'Team', 'Points']
        data = []
        
        # For individual programs (HS/HSS), show each student separately
        if not program.is_team_based:
            for result in results:
                participant_name = result.participant.get_full_name()
                team_name = result.team.name if result.team else 'Individual'
                points = result.points_earned
                
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
            # A team may enter multiple sub-teams; every sub-team is a separate result row.
            team_groups = {}
            for result in results:
                team_name = result.team.name if result.team else 'Individual'
                group_key = (result.team_id, result.sub_team_number or 1)
                if group_key not in team_groups:
                    team_groups[group_key] = {'team_name': team_name, 'results': []}
                team_groups[group_key]['results'].append(result)
            
            for group_data in team_groups.values():
                team_name = group_data['team_name']
                team_results = group_data['results']
                main_result = team_results[0]
                member_assignments = ProgramAssignment.objects.filter(
                    program=program,
                    team_id=main_result.team_id,
                    sub_team_number=main_result.sub_team_number or 1,
                ).select_related('student').order_by('-is_leader', 'student__first_name')
                grouped_entry = get_grouped_assignments_for_report(
                    program,
                    member_assignments,
                    program.event,
                )
                grouped_entry = grouped_entry[0] if grouped_entry else None
                participant_name = (
                    grouped_entry['participant_names']
                    if grouped_entry else main_result.participant.get_full_name()
                )
                total_points = main_result.points_earned
                chest_number = grouped_entry['chest_no'] if grouped_entry else "N/A"

                data.append([
                    chest_number or "N/A",
                    participant_name,
                    team_name,
                    str(total_points)
                ])
        
        # Use custom template for table with adjusted column widths
        col_widths = [1.2*inch, 3.4*inch, 1.5*inch, 1.0*inch]
        
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
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
def generate_calling_sheet(request, program_id):
    """Generate calling sheet PDF for a program"""
    try:
        program = Program.objects.get(id=program_id, event__school_id=request.user.school_id)
        assignments = ProgramAssignment.objects.filter(program=program).select_related('student', 'team')
        
        # Here you would implement PDF generation
        # For now, return a simple response
        participants = []
        for assignment in assignments:
            participants.append({
                'name': assignment.student.get_full_name(),
                'identifier': assignment.student.student_id,
                'gender': assignment.student.gender,
                'team_name': assignment.team.name if assignment.team else None,
                'category_display': str(assignment.student.category or 'N/A').upper()
            })
        
        return Response({
            'program': program.name,
            'participants': participants,
            'message': 'PDF generation would happen here'
        })
        
    except Program.DoesNotExist:
        return Response({'error': 'Program not found'}, status=404)

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
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
        
        program = Program.objects.get(id=program_id, event__school_id=request.user.school_id)
        assignments = ProgramAssignment.objects.filter(program=program).select_related('student', 'team').order_by('chest_number', 'student__first_name')
        
        school_settings = SchoolSettings.get_settings(program.event.school)
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
        
        # FIXED: Handle template creation properly
        if template is not None:
            # Use the template header if available
            elements.extend(template.create_header(event_title=program.event.title, extra_title=f'Calling Sheet - {program.name}'))
        else:
            # FALLBACK: Create a simple header without template
            logger.warning('Calling-sheet template was unavailable; using fallback header')
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'TitleStyle',
                parent=styles['Heading1'],
                fontSize=16,
                spaceAfter=20,
                alignment=TA_CENTER,
                textColor=colors.black,
                fontName='Helvetica-Bold'
            )
            
            # Simple header without template
            header_text = f"{program.event.title}<br/>Calling Sheet - {program.name}"
            header_paragraph = Paragraph(header_text, title_style)
            elements.append(header_paragraph)
            elements.append(Spacer(1, 20))
        
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
            Paragraph(f"<b>{str(program.category).upper()}</b>", center_style),
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
            table_data = [['Chest No.', 'Participant Name', 'Gender', 'Team Name', 'Code Letter']]
            
            # For all programs, group by team and show only main name with "and team" suffix
            team_groups = {}
            for assignment in assignments:
                team_name = assignment.team.name if assignment.team else 'Individual'
                group_key = (
                    assignment.team_id,
                    assignment.sub_team_number or 1,
                ) if program.is_team_based else (team_name, assignment.id)
                if group_key not in team_groups:
                    team_groups[group_key] = {'team_name': team_name, 'assignments': []}
                team_groups[group_key]['assignments'].append(assignment)
            
            for group_data in team_groups.values():
                team_name = group_data['team_name']
                team_assignments = group_data['assignments']
                # For individual programs (HS/HSS), show each student separately
                if not program.is_team_based:
                    for assignment in team_assignments:
                        participant_name = assignment.student.get_full_name()
                        
                        chest_no = assignment.chest_number
                        if not chest_no:
                            try:
                                chest_record = ChestNumber.objects.get(event=program.event, student=assignment.student)
                                chest_no = chest_record.chest_number
                            except ChestNumber.DoesNotExist:
                                chest_no = ''
                        chest_no_display = str(chest_no) if chest_no else 'N/A'
                        gender = assignment.student.get_gender_display() if assignment.student.gender else 'Not set'
                        table_data.append([chest_no_display, participant_name, gender, team_name, ''])
                else:
                    grouped_entry = get_grouped_assignments_for_report(
                        program,
                        ProgramAssignment.objects.filter(
                            id__in=[assignment.id for assignment in team_assignments]
                        ),
                        program.event,
                    )[0]
                    participant_name = grouped_entry['participant_names']
                    chest_no_display = grouped_entry['chest_no'] or 'N/A'
                    table_data.append([chest_no_display, participant_name, grouped_entry['gender'], team_name, ''])
            
            table = Table(table_data, colWidths=[0.9*inch, 2.3*inch, 0.9*inch, 1.3*inch, 1.0*inch])
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
        logger.exception('Calling sheet PDF generation failed')
        return Response({'error': 'Unable to generate the calling sheet.'}, status=500)
@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
def get_program_participants(request, program_id):
    """Get participants for calling sheet"""
    try:
        program = Program.objects.get(id=program_id, event__school_id=request.user.school_id)
        assignments = ProgramAssignment.objects.filter(program=program).select_related('student', 'team')
        
        # Build dynamic category lookup map
        from accounts.models import StudentCategory
        cat_map = {c.code: c.name for c in StudentCategory.objects.filter(school=program.event.school)}
        
        participants = []
        if program.is_team_based:
            # Group by (team_id, sub_team_number)
            grouped = {}
            for assignment in assignments:
                sub_num = getattr(assignment, 'sub_team_number', 1) or 1
                team_id = assignment.team_id
                key = (team_id, sub_num)
                if key not in grouped:
                    grouped[key] = []
                grouped[key].append(assignment)

            for (team_id, sub_num), a_list in grouped.items():
                leader = next((a for a in a_list if a.is_leader), a_list[0] if a_list else None)
                ordered = sorted(
                    a_list,
                    key=lambda a: (
                        not bool(getattr(a, 'is_leader', False)),
                        (a.student.get_full_name() if a.student else '').lower()
                    )
                )
                chest_numbers = [str(a.chest_number) for a in ordered if a.chest_number]
                member_names_with_chests = [
                    f"{a.student.get_full_name()} ({a.chest_number})" if a.chest_number else a.student.get_full_name()
                    for a in ordered if a.student
                ]
                
                # Check if this team has multiple sub-teams
                team_obj = leader.team if leader else None
                total_sub_teams = len({a.sub_team_number or 1 for a in assignments if a.team_id == team_id})
                team_display = team_obj.name if team_obj else 'Unassigned'
                if total_sub_teams > 1 or sub_num > 1:
                    team_display = f"{team_display} (Sub-Team {sub_num})"

                leader_cat = leader.student.category if leader and leader.student else program.category
                cat_display = cat_map.get(leader_cat, leader_cat or program.category or 'Unknown')

                distinct_genders = list(dict.fromkeys(a.student.get_gender_display() for a in ordered if a.student and a.student.gender))

                participants.append({
                    'id': f"group_{team_id}_{sub_num}",
                    'name': ", ".join(member_names_with_chests),
                    'identifier': f"Sub-Team {sub_num} ({len(ordered)} members)",
                    'gender': ", ".join(distinct_genders) if distinct_genders else 'Mixed',
                    'team_name': team_display,
                    'category_display': cat_display,
                    'chest_number': ", ".join(chest_numbers) if chest_numbers else None,
                    'team_id': team_id,
                    'sub_team_number': sub_num,
                    'is_leader': True,
                    'is_group': True,
                    'team_member_count': len(ordered),
                    'members': [
                        {
                            'id': a.id,
                            'name': a.student.get_full_name() if a.student else 'Unknown',
                            'chest_number': a.chest_number,
                            'is_leader': a.is_leader,
                            'identifier': a.student.student_id if a.student else '',
                            'gender': a.student.gender if a.student else '',
                        }
                        for a in ordered
                    ]
                })
        else:
            for assignment in assignments:
                # Get category display name dynamically
                category_display = cat_map.get(assignment.student.category, assignment.student.category or 'Unknown')
                
                participants.append({
                    'id': assignment.id,
                    'name': assignment.student.get_full_name(),
                    'identifier': assignment.student.student_id,
                    'gender': assignment.student.gender,
                    'team_name': assignment.team.name if assignment.team else None,
                    'category_display': category_display,
                    'chest_number': assignment.chest_number,
                    'team_id': assignment.team_id,
                    'sub_team_number': assignment.sub_team_number or 1,
                    'is_leader': assignment.is_leader,
                    'is_group': False,
                    'team_member_count': 1,
                    'members': [
                        {
                            'id': assignment.id,
                            'name': assignment.student.get_full_name(),
                            'chest_number': assignment.chest_number,
                            'is_leader': False,
                            'identifier': assignment.student.student_id,
                            'gender': assignment.student.gender,
                        }
                    ]
                })
        
        return Response({
            'results': participants,
            'is_team_based': program.is_team_based,
            'total_count': len(participants),
        })
        
    except Program.DoesNotExist:
        return Response({'error': 'Program not found'}, status=404)

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
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
        
        program = Program.objects.get(id=program_id, event__school_id=request.user.school_id)
        assignments = ProgramAssignment.objects.filter(program=program).select_related('student', 'team').order_by('chest_number', 'student__first_name')
        school_settings = SchoolSettings.get_settings(program.event.school)
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
        elements.append(Paragraph(f"<b>{str(program.category).upper()}</b>", program_info_style))
        elements.append(Paragraph(f"<b>{program_type}</b>", program_info_style))
        elements.append(Spacer(1, 15))
        if assignments.exists():
            table_data = [['Chest No.', 'Judge 1', 'Judge 2', 'Judge 3', 'Remarks']]
            
            # For all programs, group by team and show only main name with "and team" suffix
            team_groups = {}
            for assignment in assignments:
                team_name = assignment.team.name if assignment.team else 'Individual'
                group_key = (
                    assignment.team_id,
                    assignment.sub_team_number or 1,
                ) if program.is_team_based else (team_name, assignment.id)
                if group_key not in team_groups:
                    team_groups[group_key] = {'team_name': team_name, 'assignments': []}
                team_groups[group_key]['assignments'].append(assignment)
            
            for group_data in team_groups.values():
                team_name = group_data['team_name']
                team_assignments = group_data['assignments']
                # For individual programs (HS/HSS), show each student separately
                if not program.is_team_based:
                    for assignment in team_assignments:
                        participant_name = assignment.student.get_full_name()
                        
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
                    grouped_entry = get_grouped_assignments_for_report(
                        program,
                        ProgramAssignment.objects.filter(
                            id__in=[assignment.id for assignment in team_assignments]
                        ),
                        program.event,
                    )[0]
                    chest_no_display = grouped_entry['chest_no'] or 'N/A'
                    table_data.append([chest_no_display, '', '', '', ''])
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
        logger.exception('Evaluation sheet PDF generation failed')
        return Response({'error': 'Unable to generate the evaluation sheet.'}, status=500)

class TeamManagerViewSet(viewsets.GenericViewSet):
    """ViewSet for Team Manager specific functionality"""
    permission_classes = [IsTeamManagerOrAdmin]
    authentication_classes = [TeamManagerAuthentication, SchoolJWTAuthentication]
    pagination_class = CustomPagination

    def _managed_teams(self):
        """Resolve teams for either a scoped team token or a legacy manager user."""
        if getattr(self.request.user, 'team_id', None):
            return Team.objects.filter(
                id=self.request.user.team_id,
                school_id=self.request.user.school_id,
            )
        return Team.objects.filter(
            team_manager=self.request.user,
            school_id=self.request.user.school_id,
        )
    
    @action(detail=False, methods=['get'])
    def my_teams(self, request):
        """Get teams managed by the current team manager"""
        if request.user.role != 'team_manager':
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        teams = self._managed_teams().prefetch_related('members')
        
        from .services import calculate_global_points_for_school
        scores = calculate_global_points_for_school(request.user.school)
        scores_by_team = {item['id']: item for item in scores['teams']}
        teams_with_global_points = []
        for team in teams:
            score = scores_by_team.get(team.id, {})
            
            # Create team data with global points
            team_data = {
                'id': team.id,
                'name': team.name,
                'team_id': team.id,
                'member_count': team.member_count,
                'points_earned': team.points_earned,  # Keep original points for backward compatibility
                'global_points': score.get('global_points', 0),
                'events_participated': score.get('events_participated', 0),
                'event_breakdown': score.get('event_breakdown', []),
                'event': None,
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
            team = Team.objects.get(id=pk, school_id=request.user.school_id)
            
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
                        'gender': student.gender or '—',
                        'category': student.category,
                        'grade': student.grade,
                        'section': student.section,
                        'chest_code': student.chest_code,
                        'total_points': student.total_points,
                        'phone_number': student.phone_number,
                        'address': student.address,
                    })
                
                return self.get_paginated_response(student_data)
            
            # Fallback if pagination is not configured
            student_data = []
            for student in students:
                student_data.append({
                    'id': student.id,
                    'name': student.get_full_name(),
                    'student_id': student.student_id,
                    'email': student.email,
                    'gender': student.gender or '—',
                    'category': student.category,
                    'grade': student.grade,
                    'section': student.section,
                    'chest_code': student.chest_code,
                    'total_points': student.total_points,
                    'phone_number': student.phone_number,
                    'address': student.address,
                })
            
            return Response({'students': student_data})
        except Team.DoesNotExist:
            return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            from django.core.exceptions import ValidationError as DjangoValidationError
            if isinstance(exc, DjangoValidationError):
                return Response({'error': exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
            raise
    
    @action(detail=True, methods=['get'])
    def events(self, request, pk=None):
        """Get events for a specific team"""
        try:
            Team.objects.get(id=pk, school_id=request.user.school_id)
            events = Event.objects.filter(school_id=request.user.school_id).order_by('-start_date')
            
            # Simplify the response - just return basic event info
            event_data = []
            for event in events:
                assigned_programs = ProgramAssignment.objects.filter(
                    team_id=pk, program__event=event
                ).values('program_id').distinct().count()
                team_points = ProgramResult.objects.filter(
                    team_id=pk,
                    program__event=event,
                    program__is_published=True,
                    entry_status='submitted',
                ).aggregate(total=Sum('points_earned'))['total'] or 0
                event_data.append({
                    'id': event.id,
                    'title': event.title,
                    'description': event.description,
                    'event_type': event.event_type,
                    'status': event.status,
                    'team_points': team_points,
                    'total_programs': event.programs.filter(is_active=True).count(),
                    'programs_assigned': assigned_programs,
                    'start_date': event.start_date,
                    'end_date': event.end_date,
                    'venue': event.venue,
                    'registration_deadline': event.registration_deadline,
                    'registration_open': (
                        event.status in ('published', 'ongoing')
                        and (
                            not event.registration_deadline
                            or timezone.now() <= event.registration_deadline
                        )
                    ),
                })
            
            return Response({'events': event_data})
        except Exception as e:
            logger.exception('Team-manager event list failed')
            return Response({'error': 'Unable to load events.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'], url_path='events/(?P<event_id>[0-9]+)/programs')
    def event_programs(self, request, pk=None, event_id=None):
        """Get programs for a specific event and team"""
        try:
            team = Team.objects.get(id=pk, school_id=request.user.school_id)
            event = Event.objects.get(id=event_id, school_id=request.user.school_id)

            programs = Program.objects.filter(event=event, is_active=True).order_by('category', 'name')
            program_data = []
            for program in programs:
                assignments = ProgramAssignment.objects.filter(
                    program=program, team=team
                ).select_related('student').order_by('sub_team_number', '-is_leader', 'student__first_name')
                assigned_students = [{
                    'id': assignment.student_id,
                    'assignment_id': assignment.id,
                    'name': assignment.student.get_full_name(),
                    'student_id': assignment.student.student_id,
                    'category': assignment.student.category or 'general',
                    'grade': assignment.student.grade,
                    'chest_number': assignment.chest_number,
                    'sub_team_number': assignment.sub_team_number or 1,
                    'is_leader': assignment.is_leader,
                } for assignment in assignments]
                assigned_count = len(assigned_students)
                if program.is_team_based:
                    per_team_limit = (program.team_size or 0) * (program.max_teams_per_school or 1)
                else:
                    per_team_limit = program.max_participants
                available_slots = None if per_team_limit is None else max(0, per_team_limit - assigned_count)
                program_data.append({
                    'id': program.id,
                    'name': program.name,
                    'description': program.description,
                    'category': program.category,
                    'program_type': program.program_type,
                    'is_team_based': program.is_team_based,
                    'team_size': program.team_size,
                    'max_teams_per_school': program.max_teams_per_school or 1,
                    'max_participants': program.max_participants,
                    'max_participants_per_team': program.max_participants_per_team,
                    'per_team_limit': per_team_limit,
                    'assigned_count': assigned_count,
                    'available_slots': available_slots,
                    'assigned_students': assigned_students,
                    'start_time': program.start_time,
                    'end_time': program.end_time,
                    'venue': program.venue,
                    'is_active': program.is_active,
                    'is_finished': program.is_finished,
                })

            from .services import program_is_general_or_mixed
            team_students = team.members.filter(role='student')
            assignments = ProgramAssignment.objects.filter(
                program__event=event,
                student__in=team_students
            ).select_related('program')

            assignments_by_student = {}
            for a in assignments:
                s_id = a.student_id
                if s_id not in assignments_by_student:
                    assignments_by_student[s_id] = {'total_count': 0, 'single_count': 0, 'group_count': 0}
                assignments_by_student[s_id]['total_count'] += 1
                if not program_is_general_or_mixed(a.program):
                    if a.program.is_team_based:
                        assignments_by_student[s_id]['group_count'] += 1
                    else:
                        assignments_by_student[s_id]['single_count'] += 1


            member_data = [{
                'id': member.id,
                'name': member.get_full_name(),
                'student_id': member.student_id,
                'category': member.category or 'general',
                'grade': member.grade,
                'section': member.section,
                'gender': member.gender,
                'single_count': assignments_by_student.get(member.id, {}).get('single_count', 0),
                'group_count': assignments_by_student.get(member.id, {}).get('group_count', 0),
                'total_count': assignments_by_student.get(member.id, {}).get('total_count', 0),
            } for member in team_students.order_by('first_name', 'last_name')]

            return Response({
                'event': {
                    'id': event.id,
                    'title': event.title,
                    'description': event.description,
                    'status': event.status,
                    'start_date': event.start_date,
                    'end_date': event.end_date,
                    'start_time': event.start_time,
                    'end_time': event.end_time,
                    'venue': event.venue,
                    'registration_deadline': event.registration_deadline,
                    'max_programs_per_student': event.max_programs_per_student,
                    'max_single_programs_per_student': event.max_single_programs_per_student,
                    'max_group_programs_per_student': event.max_group_programs_per_student,
                    'registration_open': (
                        event.status in ('published', 'ongoing')
                        and (
                            not event.registration_deadline
                            or timezone.now() <= event.registration_deadline
                        )
                    ),
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
            team = Team.objects.get(id=pk, school_id=request.user.school_id)
            event = Event.objects.get(id=event_id, school_id=request.user.school_id)
            program = Program.objects.get(
                id=program_id, event=event, event__school_id=request.user.school_id
            )
            student_ids = request.data.get('student_ids', [])
            if request.data.get('student_id') is not None:
                student_ids = list(student_ids) + [request.data.get('student_id')]

            from django.core.exceptions import ValidationError as DjangoValidationError
            from .services import assign_students
            try:
                assignments = assign_students(
                    user=request.user,
                    team=team,
                    program=program,
                    student_ids=student_ids,
                    sub_team_number=request.data.get('sub_team_number', 1),
                    leader_id=request.data.get('leader_id'),
                    allow_partial_group=(len(student_ids) == 1),
                )
                return Response({
                    'success': True,
                    'message': f'Successfully assigned {len(assignments)} participants.',
                    'assignment_ids': [assignment.id for assignment in assignments],
                }, status=status.HTTP_201_CREATED)
            except DjangoValidationError as exc:
                return Response({'error': exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Team.DoesNotExist:
            return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)
        except Event.DoesNotExist:
            return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)
        except Program.DoesNotExist:
            return Response({'error': 'Program not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(
        detail=True,
        methods=['post'],
        url_path='events/(?P<event_id>[0-9]+)/programs/(?P<program_id>[0-9]+)/set-leader',
    )
    def set_leader(self, request, pk=None, event_id=None, program_id=None):
        """Set the single representative/leader for one assigned sub-team."""
        try:
            team = Team.objects.get(id=pk, school_id=request.user.school_id)
            event = Event.objects.get(id=event_id, school_id=request.user.school_id)
            program = Program.objects.get(
                id=program_id, event=event, event__school_id=request.user.school_id,
                is_team_based=True,
            )
            student_id = request.data.get('student_id')
            if not student_id:
                return Response({'error': 'Student ID is required.'}, status=400)
            from .services import set_subteam_leader
            set_subteam_leader(
                user=request.user,
                team=team,
                program=program,
                student_id=student_id,
                sub_team_number=request.data.get('sub_team_number', 1),
            )
            return Response({'message': 'Sub-team leader updated successfully.'})
        except (Team.DoesNotExist, Event.DoesNotExist, Program.DoesNotExist):
            return Response({'error': 'Team, event or program not found.'}, status=404)
        except Exception as exc:
            from django.core.exceptions import ValidationError as DjangoValidationError
            if isinstance(exc, DjangoValidationError):
                return Response({'error': exc.messages[0]}, status=400)
            raise

    @action(
        detail=True,
        methods=['delete'],
        url_path='events/(?P<event_id>[0-9]+)/programs/(?P<program_id>[0-9]+)/students/(?P<student_id>[0-9]+)/remove',
    )
    def remove_student_from_program(
        self, request, pk=None, event_id=None, program_id=None, student_id=None
    ):
        """Remove an individual entry or the student's complete group sub-team."""
        try:
            team = Team.objects.get(id=pk, school_id=request.user.school_id)
            assignment = ProgramAssignment.objects.select_related('program__event').get(
                team=team,
                student_id=student_id,
                program_id=program_id,
                program__event_id=event_id,
                program__event__school_id=request.user.school_id,
            )
            from .services import remove_assignment_group
            remove_assignment_group(user=request.user, assignment=assignment)
            return Response({'message': 'Assignment removed successfully.'})
        except (Team.DoesNotExist, ProgramAssignment.DoesNotExist):
            return Response({'error': 'Assignment not found.'}, status=404)
        except Exception as exc:
            from django.core.exceptions import ValidationError as DjangoValidationError
            if isinstance(exc, DjangoValidationError):
                return Response({'error': exc.messages[0]}, status=400)
            raise
    
    @action(detail=True, methods=['delete'], url_path='assignments/(?P<assignment_id>[0-9]+)/remove')
    def remove_assignment_by_id(self, request, pk=None, assignment_id=None):
        """Remove a program assignment by assignment ID"""
        try:
            team = Team.objects.get(id=pk, school_id=request.user.school_id)
            
            # Get the assignment
            try:
                assignment = ProgramAssignment.objects.get(id=assignment_id, team=team)
            except ProgramAssignment.DoesNotExist:
                return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)
            
            from .services import remove_assignment_group
            remove_assignment_group(user=request.user, assignment=assignment)
            
            return Response({
                'success': True,
                'message': 'Assignment removed successfully'
            })
        except Team.DoesNotExist:
            return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            from django.core.exceptions import ValidationError as DjangoValidationError
            if isinstance(exc, DjangoValidationError):
                return Response({'error': exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
            raise
    
    @action(detail=True, methods=['get'], url_path='profile')
    def team_profile(self, request, pk=None):
        """Get team profile information"""
        try:
            team = Team.objects.get(id=pk, school_id=request.user.school_id)
            
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
        # Teams are no longer linked to events, so get all events and their programs
        # Get all programs from all events
        programs = Program.objects.filter(
            event__school_id=request.user.school_id,
            event__status__in=['published', 'ongoing'],
            is_active=True,
        ).select_related('event')
        
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
            program = Program.objects.get(
                id=program_id, event__school_id=request.user.school_id
            )
        except Program.DoesNotExist:
            return Response({'error': 'Program not found'}, status=status.HTTP_404_NOT_FOUND)

        from django.core.exceptions import ValidationError as DjangoValidationError
        from django.db import transaction
        from .services import assign_students
        try:
            team = (
                Team.objects.get(id=request.user.team_id, school_id=request.user.school_id)
                if getattr(request.user, 'team_id', None)
                else Team.objects.get(team_manager=request.user, school_id=request.user.school_id)
            )
            with transaction.atomic():
                assignments = []
                if program.is_team_based:
                    assignments = assign_students(
                        user=request.user,
                        team=team,
                        program=program,
                        student_ids=student_ids,
                        sub_team_number=request.data.get('sub_team_number', 1),
                        leader_id=request.data.get('leader_id'),
                    )
                else:
                    for student_id in student_ids:
                        assignments.extend(assign_students(
                            user=request.user,
                            team=team,
                            program=program,
                            student_ids=[student_id],
                        ))
            return Response({
                'message': f'Successfully assigned {len(assignments)} participants.',
                'assignment_ids': [assignment.id for assignment in assignments],
            }, status=status.HTTP_201_CREATED)
        except (Team.DoesNotExist, Team.MultipleObjectsReturned):
            return Response({'error': 'A single scoped team could not be resolved.'}, status=status.HTTP_400_BAD_REQUEST)
        except DjangoValidationError as exc:
            return Response({'error': exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def team_assignments(self, request):
        """Get all assignments for team manager's teams"""
        if request.user.role != 'team_manager':
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        managed_teams = self._managed_teams()
        
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
        
        token_team_id = getattr(request.user, 'team_id', None)
        if token_team_id and assignment.team_id != token_team_id:
            return Response({'error': 'You do not have permission to remove this assignment'}, 
                          status=status.HTTP_403_FORBIDDEN)

        from django.core.exceptions import ValidationError as DjangoValidationError
        from .services import remove_assignment_group
        try:
            remove_assignment_group(user=request.user, assignment=assignment)
            return Response({'message': 'Assignment group removed successfully'}, status=status.HTTP_200_OK)
        except DjangoValidationError as exc:
            return Response({'error': exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def leaderboard(self, request):
        """Get global points and event-wise leaderboard for team manager portal"""
        if request.user.role != 'team_manager':
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        managed_ids = set(self._managed_teams().values_list('id', flat=True))
        from .services import calculate_global_points_for_school
        scores = calculate_global_points_for_school(request.user.school)

        # Ranked teams across school
        teams_with_global_points = []
        for item in sorted(scores['teams'], key=lambda x: x['global_points'], reverse=True):
            raw_pts = sum(eb.get('event_points', 0) for eb in item.get('event_breakdown', []))
            teams_with_global_points.append({
                'id': item['id'],
                'name': item['name'],
                'points': item['global_points'],
                'global_points': item['global_points'],
                'total_raw_points': raw_pts,
                'members': item['members'],
                'events_participated': item['events_participated'],
                'event_breakdown': item['event_breakdown'],
                'is_managed': item['id'] in managed_ids,
            })
        for idx, t in enumerate(teams_with_global_points, 1):
            t['rank'] = idx

        # Ranked students across school
        students_with_global_points = []
        for item in sorted(scores['students'], key=lambda x: x['global_points'], reverse=True):
            raw_pts = sum(eb.get('event_points', 0) for eb in item.get('event_breakdown', []))
            students_with_global_points.append({
                'id': item['id'],
                'name': item['name'],
                'student_id': item['student_id'],
                'points': item['global_points'],
                'global_points': item['global_points'],
                'total_raw_points': raw_pts,
                'category': item['category'],
                'events_participated': item['events_participated'],
                'event_breakdown': item['event_breakdown'],
            })
        for idx, s in enumerate(students_with_global_points, 1):
            s['rank'] = idx

        # Event-wise compilation
        events_dict = {}
        for team in scores['teams']:
            for eb in team.get('event_breakdown', []):
                eid = eb['event_id']
                if eid not in events_dict:
                    events_dict[eid] = {
                        'id': eid,
                        'name': eb['event_name'],
                        'total_points': eb['total_event_points'],
                        'teams': [],
                        'students': [],
                    }
                events_dict[eid]['teams'].append({
                    'id': team['id'],
                    'name': team['name'],
                    'event_points': eb['event_points'],
                    'percentage': eb['percentage'],
                    'is_managed': team['id'] in managed_ids,
                })

        for student in scores['students']:
            for eb in student.get('event_breakdown', []):
                eid = eb['event_id']
                if eid in events_dict:
                    events_dict[eid]['students'].append({
                        'id': student['id'],
                        'name': student['name'],
                        'student_id': student['student_id'],
                        'category': student['category'],
                        'event_points': eb['event_points'],
                        'percentage': eb['percentage'],
                    })

        events_list = []
        for eid, edata in events_dict.items():
            edata['teams'].sort(key=lambda x: x['event_points'], reverse=True)
            for r, t in enumerate(edata['teams'], 1):
                t['rank'] = r
            edata['students'].sort(key=lambda x: x['event_points'], reverse=True)
            for r, s in enumerate(edata['students'], 1):
                s['rank'] = r
            events_list.append(edata)

        return Response({
            'teams': teams_with_global_points,
            'students': students_with_global_points,
            'events': events_list,
        })

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
def generate_team_list_pdf(request, event_id, team_id):
    """Generate team list PDF organized by category and grade with participant details"""
    try:
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        team = Team.objects.get(id=team_id, school_id=request.user.school_id)
        
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
        school_settings = SchoolSettings.get_settings(event.school)
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
        logger.exception('Team-list PDF generation failed')
        return Response({'error': 'Unable to generate the PDF.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
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
        school_settings = SchoolSettings.get_settings(request.user.school)
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
        logger.exception('Template demo PDF generation failed')
        return Response({'error': 'Unable to generate the PDF.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
def test_report_generation(request, event_id):
    """Test endpoint to debug report generation"""
    try:
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
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
        logger.exception('PDF test failed')
        return Response({'error': 'Unable to generate the PDF.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
def generate_program_details_report(request, event_id):
    """Generate complete program details report with participants and teams as PDF"""
    try:
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        programs = Program.objects.filter(event=event).order_by('category', 'name')
        
        if not programs.exists():
            return Response({'error': 'No programs found for this event'}, status=404)
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.get_settings(event.school)
        
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
        logger.exception('PDF generation failed')
        return Response({'error': 'PDF generation failed.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
def generate_all_events_report(request):
    """Generate comprehensive report of all events"""
    try:
        events = Event.objects.filter(school=request.user.school).order_by('-start_date')
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.get_settings(request.user.school)
        
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
        logger.exception('All-events report generation failed')
        return Response({'error': 'Unable to generate the report.'}, status=500)

def result_participant_display(result):
    if not result.program.is_team_based:
        return result.participant.display_name if result.participant else 'N/A'
    assignments = ProgramAssignment.objects.filter(
        program=result.program,
        team=result.team,
        sub_team_number=result.sub_team_number or 1,
    ).select_related('student').order_by('-is_leader', 'student__first_name', 'student__last_name')
    names = []
    for assignment in assignments:
        name = assignment.student.display_name
        names.append(
            f'{name} ({assignment.chest_number})'
            if assignment.chest_number else name
        )
    return ', '.join(names) or (result.participant.display_name if result.participant else 'N/A')


@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
def generate_complete_results_report(request, event_id):
    """Generate complete results report with only 1st, 2nd, 3rd places and participant names"""
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        results = ProgramResult.objects.filter(
            program__event=event,
            program__is_published=True,
            entry_status='submitted',
            position__in=[1, 2, 3]  # Only 1st, 2nd, 3rd places
        ).order_by('program__category', 'program__name', 'position')
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.get_settings(event.school)
        
        # Create PDF using custom template
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=34,
            bottomMargin=34,
        )
        story = []
        styles = getSampleStyleSheet()
        result_meta_style = ParagraphStyle(
            'ResultMeta',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#64748B'),
        )
        category_style = ParagraphStyle(
            'ResultCategory',
            parent=styles['Heading3'],
            fontName='Helvetica-Bold',
            fontSize=12,
            leading=15,
            textColor=colors.HexColor('#312E81'),
            backColor=colors.HexColor('#EEF2FF'),
            borderColor=colors.HexColor('#C7D2FE'),
            borderWidth=0.5,
            borderPadding=(7, 9, 7, 9),
            spaceBefore=8,
            spaceAfter=8,
        )
        program_style = ParagraphStyle(
            'ResultProgram',
            parent=styles['Heading4'],
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=14,
            textColor=colors.HexColor('#0F172A'),
            spaceBefore=4,
            spaceAfter=6,
        )
        result_cell_style = ParagraphStyle(
            'ResultCell',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor('#1E293B'),
        )
        result_cell_center = ParagraphStyle(
            'ResultCellCenter',
            parent=result_cell_style,
            alignment=TA_CENTER,
        )
        
        # Add custom header with logo
        from .pdf_utils import build_pdf_header
        story.extend(build_pdf_header(school_settings, f"Eventloo - Winners Report (1st, 2nd, 3rd Places)", f"Event: {event.title}"))
        
        # Add generation date
        story.append(Paragraph(f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", result_meta_style))
        story.append(Spacer(1, 14))
        
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
        
        for category_index, (category, programs) in enumerate(categories.items()):
            if category_index:
                story.append(PageBreak())
            story.append(Paragraph(f"Category: {escape(str(category).upper())}", category_style))
            
            for program_name, program_results in programs.items():
                program_heading = Paragraph(f"Program: {escape(str(program_name))}", program_style)
                
                # Results table for this program
                data = [['Rank', 'Participant Name', 'Team Name', 'Points', 'Remarks']]
                for result in sorted(program_results, key=lambda x: x.position):
                    participant_name = result_participant_display(result)
                    
                    # Get team name
                    team_name = result.team.name if result.team else 'N/A'
                    
                    data.append([
                        Paragraph(escape(str(result.position)), result_cell_center),
                        Paragraph(escape(str(participant_name)), result_cell_style),
                        Paragraph(escape(str(team_name)), result_cell_style),
                        Paragraph(escape(str(result.points_earned if result.points_earned is not None else 0)), result_cell_center),
                        Paragraph(escape(str(result.comments or 'N/A')), result_cell_style),
                    ])
                
                table = Table(
                    data,
                    colWidths=[0.8*inch, 2*inch, 1.5*inch, 1*inch, 1.7*inch],
                    repeatRows=1,
                )
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 0), (-1, -1), 7),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
                    ('LEFTPADDING', (0, 0), (-1, -1), 7),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 7),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
                    ('GRID', (0, 0), (-1, -1), 0.55, colors.HexColor('#CBD5E1')),
                    ('BOX', (0, 0), (-1, -1), 0.9, colors.HexColor('#94A3B8')),
                ]))
                story.append(KeepTogether([program_heading, table, Spacer(1, 14)]))
        
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Eventloo_Winners_Report_{event.title}_{datetime.now().strftime("%Y%m%d")}.pdf"'
        return response
        
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)
    except Exception as e:
        import traceback
        logger.exception('PDF generation failed')
        return Response({'error': 'PDF generation failed.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
def generate_first_place_report(request, event_id):
    """Generate report with only 1st place winners"""
    try:
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        results = ProgramResult.objects.filter(
            program__event=event,
            program__is_published=True,
            entry_status='submitted',
            position=1  # Only 1st place
        ).order_by('program__category', 'program__name')
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.get_settings(event.school)
        
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
                    participant_name = result_participant_display(result)
                    
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
        logger.exception('PDF generation failed')
        return Response({'error': 'PDF generation failed.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
def generate_second_place_report(request, event_id):
    """Generate report with only 2nd place winners"""
    try:
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        results = ProgramResult.objects.filter(
            program__event=event,
            program__is_published=True,
            entry_status='submitted',
            position=2  # Only 2nd place
        ).order_by('program__category', 'program__name')
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.get_settings(event.school)
        
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
                    participant_name = result_participant_display(result)
                    
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
        logger.exception('PDF generation failed')
        return Response({'error': 'PDF generation failed.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
def generate_third_place_report(request, event_id):
    """Generate report with only 3rd place winners"""
    try:
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        results = ProgramResult.objects.filter(
            program__event=event,
            program__is_published=True,
            entry_status='submitted',
            position=3  # Only 3rd place
        ).order_by('program__category', 'program__name')
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.get_settings(event.school)
        
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
                    participant_name = result_participant_display(result)
                    
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
        logger.exception('PDF generation failed')
        return Response({'error': 'PDF generation failed.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
def generate_participants_team_report(request, event_id):
    """Generate participants team report showing team-wise participants and their program participation"""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        teams = Team.objects.filter(program_assignments__program__event=event).distinct().prefetch_related('members')
        programs = Program.objects.filter(event=event).order_by('category', 'name')
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.get_settings(event.school)
        
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
                
                members_data = [['Student Name', 'Student ID', 'Gender', 'Grade', 'Section']]
                for member in team_members:
                    # Use proper name fields instead of display_name
                    student_name = member.get_full_name() if hasattr(member, 'get_full_name') else f"{member.first_name} {member.last_name}".strip()
                    if not student_name or student_name.strip() == '':
                        student_name = member.name or f"Student {member.student_id}" if member.student_id else "Unknown Student"
                    
                    members_data.append([
                        student_name,
                        member.student_id if hasattr(member, 'student_id') and member.student_id else 'N/A',
                        member.get_gender_display() if member.gender else 'Not set',
                        member.grade if hasattr(member, 'grade') and member.grade else 'N/A',
                        member.section if hasattr(member, 'section') and member.section else 'N/A'
                    ])
                
                members_table = Table(members_data, colWidths=[1.7*inch, 1.3*inch, 1*inch, 0.9*inch, 0.9*inch])
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
                
                participation_data = [['Student Name', 'Gender', 'Program Name', 'Category', 'Venue', 'Time']]
                
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
                                member.get_gender_display() if member.gender else 'Not set',
                                program.name,
                                program.category,
                                program.venue or 'N/A',
                                f"{program.start_time.strftime('%I:%M %p') if program.start_time else 'N/A'} - {program.end_time.strftime('%I:%M %p') if program.end_time else 'N/A'}"
                            ])
                    else:
                        participation_data.append([
                            student_name,
                            member.get_gender_display() if member.gender else 'Not set',
                            'No programs assigned',
                            'N/A',
                            'N/A',
                            'N/A'
                        ])
                
                participation_table = Table(participation_data, colWidths=[1.35*inch, 0.75*inch, 1.35*inch, 0.85*inch, 0.85*inch, 1.25*inch])
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
        logger.exception('Participants-by-team report generation failed')
        return Response({'error': 'Unable to generate the report.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
def generate_event_backup(request, event_id):
    """Generate complete event backup data"""
    try:
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        
        # Gather all event data
        programs = Program.objects.filter(event=event).prefetch_related('assignments', 'results')
        teams = Team.objects.filter(program_assignments__program__event=event).distinct().prefetch_related('members', 'program_assignments')
        results = ProgramResult.objects.filter(program__event=event).select_related('team', 'program')
        points_data = PointsRecord.objects.filter(event=event).select_related('team', 'student', 'source_result')
        
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
        logger.exception('Event backup generation failed')
        return Response({'error': 'Unable to generate the backup.'}, status=500)

# Temporarily disable all executable generation functions due to f-string syntax issues
@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
def generate_program_details_executable(request, event_id):
    """Generate executable file for program details report"""
    return Response({'message': 'This function is temporarily disabled for maintenance'}, status=503)

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
def generate_complete_results_executable(request, event_id):
    """Generate executable file for complete results report"""
    return Response({'message': 'This function is temporarily disabled for maintenance'}, status=503)

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
def generate_participants_team_executable(request, event_id):
    """Generate executable file for participants team report"""
    return Response({'message': 'This function is temporarily disabled for maintenance'}, status=503)

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
def test_events_list(request):
    """Test endpoint to list events without authentication"""
    try:
        events = Event.objects.filter(school=request.user.school)[:5]
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
        logger.exception('Event list diagnostic failed')
        return Response({'error': 'Unable to load events.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
def test_pdf_generation(request, event_id):
    """Test PDF generation without authentication"""
    try:
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
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
        logger.exception('PDF generation failed')
        return Response({'error': 'PDF generation failed.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
def generate_all_results_report(request, event_id):
    """Generate report with all results (all positions)"""
    try:
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        results = ProgramResult.objects.filter(
            program__event=event,
            program__is_published=True,
            entry_status='submitted',
            position__isnull=False  # All results with positions
        ).order_by('program__category', 'program__name', 'position')
        
        # Get school settings for custom template
        from accounts.models import SchoolSettings
        school_settings = SchoolSettings.get_settings(event.school)
        
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
                    participant_name = result_participant_display(result)
                    
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

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.http import HttpResponse, JsonResponse

def get_grouped_assignments_for_report(program, assignments, event):
    """
    Helper function for PDF exports (Green Room Sheet, Call List, etc.).
    For group/team-based programs:
      Groups participants by (team_id, sub_team_number).
      Chest No: Shows all member chest numbers in the same row.
      Participant Names: Combined as 'Member One (1001), Member Two (1002)'.
    For individual programs:
      1 row per participant.
    """
    if not assignments.exists():
        return []

    def resolve_name(a):
        st = a.student
        if st:
            fn = st.get_full_name().strip() if hasattr(st, 'get_full_name') and callable(getattr(st, 'get_full_name')) else ""
            dn = getattr(st, 'display_name', '').strip()
            comb = f"{getattr(st, 'first_name', '') or ''} {getattr(st, 'last_name', '') or ''}".strip()
            un = getattr(st, 'username', '').strip()
            return fn or dn or comb or un
        elif a.team:
            return a.team.name
        return ""

    def resolve_chest_no(a):
        c_no = a.chest_number
        if not c_no and a.student:
            try:
                from events.models import ChestNumber
                cn_obj = ChestNumber.objects.get(event=event, student=a.student)
                c_no = cn_obj.chest_number
            except Exception:
                c_no = getattr(a.student, 'chest_number', '')
        return str(c_no) if c_no else ""

    def resolve_gender(a):
        if not a.student or not a.student.gender:
            return "Not set"
        return a.student.get_gender_display()

    is_team = program.is_team_based if program else False
    if is_team:
        grouped = {}
        for a in assignments:
            sub_num = getattr(a, 'sub_team_number', 1) or 1
            key = (a.team_id, sub_num)
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(a)

        entries = []
        for key, a_list in grouped.items():
            leader = None
            for a in a_list:
                if getattr(a, 'is_leader', False):
                    leader = a
                    break
            if not leader and a_list:
                leader = a_list[0]

            ordered_assignments = sorted(
                a_list,
                key=lambda assignment: (
                    not bool(getattr(assignment, 'is_leader', False)),
                    resolve_name(assignment).lower(),
                ),
            )
            name_parts = []
            chest_parts = []
            gender_parts = []
            for a in ordered_assignments:
                nm = resolve_name(a)
                if not nm:
                    continue
                member_chest = resolve_chest_no(a)
                name_parts.append(f"{nm} ({member_chest})" if member_chest else nm)
                if member_chest:
                    chest_parts.append(member_chest)
                gender_parts.append(resolve_gender(a))

            combined_names = ", ".join(name_parts)
            chest_display = ", ".join(chest_parts)
            team_name = leader.team.name if (leader and leader.team) else ""

            entries.append({
                'chest_no': chest_display,
                'participant_names': combined_names,
                'team_name': team_name,
                'gender': ', '.join(gender_parts),
                'is_group': True,
                'assignments': a_list,
                'program': program
            })
        return entries
    else:
        entries = []
        for a in assignments:
            chest_display = resolve_chest_no(a)
            nm = resolve_name(a)
            if getattr(a, 'is_leader', False) and nm:
                nm += " (Leader)"
            team_name = a.team.name if a.team else ""

            entries.append({
                'chest_no': chest_display,
                'participant_names': nm,
                'team_name': team_name,
                'gender': resolve_gender(a),
                'is_group': False,
                'assignments': [a],
                'program': a.program if hasattr(a, 'program') else program
            })
        return entries


@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
def generate_green_room_sign_sheet(request, event_id):
    """
    Generate Green Room Sign Sheet PDF:
    - Top Left: Event Title
    - Top Right: Date & Time
    - Header: PROGRAM NAME | Individual/Group | CATEGORY
    - Table: Chest No | Participant (Leader + Members in 1 row for group) | Code Letter | Participant Signature
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, HRFlowable
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from io import BytesIO
        from datetime import datetime
        from .models import Event, Program, ProgramAssignment, ChestNumber

        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        
        # Query params for filtering
        only_with_participants = request.query_params.get('only_with_participants', '').lower() == 'true'
        layout = request.query_params.get('layout', 'single') # 'single' or 'continuous'
        category = request.query_params.get('category', 'all')
        program_id = request.query_params.get('program_id', 'all')

        programs = Program.objects.filter(event=event)
        if category != 'all':
            programs = programs.filter(category=category)
        if program_id != 'all':
            try:
                programs = programs.filter(id=int(program_id))
            except (TypeError, ValueError):
                programs = programs.none()

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=34,
            bottomMargin=34
        )

        elements = []
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'GreenRoomTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=25,
            textColor=colors.HexColor('#0F172A'),
            spaceAfter=8
        )

        event_name_style = ParagraphStyle(
            'EventNameStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            alignment=TA_LEFT,
            textColor=colors.HexColor('#312E81')
        )

        datetime_style = ParagraphStyle(
            'DateTimeStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            alignment=TA_RIGHT,
            textColor=colors.HexColor('#64748B')
        )

        prog_name_style = ParagraphStyle(
            'ProgNameStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            alignment=TA_LEFT,
            textColor=colors.HexColor('#0F172A')
        )

        prog_type_style = ParagraphStyle(
            'ProgTypeStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#475569')
        )

        prog_cat_style = ParagraphStyle(
            'ProgCatStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            alignment=TA_RIGHT,
            textColor=colors.HexColor('#312E81')
        )

        table_header_style = ParagraphStyle(
            'TableHeaderStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            alignment=TA_LEFT,
            textColor=colors.white
        )

        table_header_center = ParagraphStyle(
            'TableHeaderCenter',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            alignment=TA_CENTER,
            textColor=colors.white
        )

        table_body_style = ParagraphStyle(
            'TableBodyStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            alignment=TA_LEFT,
            textColor=colors.HexColor('#1E293B')
        )

        table_body_center = ParagraphStyle(
            'TableBodyCenter',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#1E293B')
        )

        current_dt_str = datetime.now().strftime("%d/%m/%Y %I:%M %p")
        program_count = 0

        for program in programs:
            assignments = ProgramAssignment.objects.filter(program=program).select_related('student', 'team').order_by('chest_number', 'student__first_name')
            
            if only_with_participants and not assignments.exists():
                continue

            program_count += 1
            if program_count > 1 and layout == 'single':
                elements.append(PageBreak())

            # Top Header Row: Event Name (Left) | Date & Time (Right)
            top_header_table = Table(
                [[Paragraph(escape(event.title), event_name_style), Paragraph(current_dt_str, datetime_style)]],
                colWidths=[4.0 * inch, 3.2 * inch]
            )
            top_header_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ('LINEBELOW', (0,0), (-1,-1), 0.7, colors.HexColor('#CBD5E1')),
            ]))
            elements.append(top_header_table)
            elements.append(Spacer(1, 4))

            # Main Title
            elements.append(Paragraph("Green Room Sign Sheet", title_style))
            
            # Black divider line
            elements.append(HRFlowable(width="100%", thickness=1.2, color=colors.HexColor('#4F46E5'), spaceBefore=4, spaceAfter=10))

            # Program Sub-Header: PROGRAM NAME (Left) | Individual/Group (Center) | CATEGORY NAME (Right)
            prog_type = "Group" if program.is_team_based else "Individual"
            cat_display = program.get_category_display().upper() if hasattr(program, 'get_category_display') and callable(getattr(program, 'get_category_display', None)) else program.category.upper()

            sub_header_table = Table(
                [[
                    Paragraph(f"<b>{escape(program.name.upper())}</b>", prog_name_style),
                    Paragraph(prog_type, prog_type_style),
                    Paragraph(f"<b>{cat_display}</b>", prog_cat_style)
                ]],
                colWidths=[2.8 * inch, 1.8 * inch, 2.6 * inch]
            )
            sub_header_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 2),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
                ('BOX', (0,0), (-1,-1), 0.6, colors.HexColor('#CBD5E1')),
            ]))
            elements.append(sub_header_table)
            elements.append(Spacer(1, 6))

            # Table Header Row
            table_data = [
                [
                    Paragraph("<b>Chest No</b>", table_header_center),
                    Paragraph("<b>Participant</b>", table_header_style),
                    Paragraph("<b>Gender</b>", table_header_center),
                    Paragraph("<b>Code Letter</b>", table_header_center),
                    Paragraph("<b>Participants Signature</b>", table_header_style)
                ]
            ]

            if assignments.exists():
                entries = get_grouped_assignments_for_report(program, assignments, event)
                for entry in entries:
                    table_data.append([
                        Paragraph(escape(entry['chest_no']), table_body_center),
                        Paragraph(escape(entry['participant_names']), table_body_style),
                        Paragraph(escape(entry['gender']), table_body_center),
                        Paragraph("", table_body_center),
                        Paragraph("", table_body_style)
                    ])

            # Append 2 extra empty rows so it looks like a clean tabular form
            table_data.append([Paragraph("", table_body_style)] * 5)
            table_data.append([Paragraph("", table_body_style)] * 5)

            # Build Participant Table with exact widths and black border box matching image
            main_table = Table(table_data, colWidths=[0.9 * inch, 2.7 * inch, 1.0 * inch, 1.0 * inch, 1.6 * inch])
            main_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
                ('GRID', (0, 0), (-1, -1), 0.55, colors.HexColor('#CBD5E1')),
                ('BOX', (0, 0), (-1, -1), 0.9, colors.HexColor('#94A3B8')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ]))

            elements.append(main_table)
            elements.append(Spacer(1, 15))

        if not elements or program_count == 0:
            elements.append(Paragraph("No matching programs or participants found for Green Room Sign Sheet.", styles['Normal']))

        doc.build(elements)
        pdf_data = buffer.getvalue()
        buffer.close()

        response = HttpResponse(pdf_data, content_type='application/pdf')
        filename = f"Green_Room_Sign_Sheet_{event.title.replace(' ', '_')}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    except Event.DoesNotExist:
        return JsonResponse({'error': 'Event not found'}, status=404)
    except Exception as e:
        import traceback
        logger.exception('PDF generation failed')
        return JsonResponse({'error': 'PDF generation failed.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
def generate_valuation_sheet(request, event_id):
    """
    Generate Valuation Sheet PDF matching the exact user specification:
    - Top Left: Event Title (e.g. Chathamangalam Sahityotsav)
    - Top Right: Date & Time (e.g. 25/08/2026 10:48 AM)
    - Title: Valuation Sheet (with divider line)
    - Subheader Right: Stage No:
    - Program Header Box: [ PROGRAM NAME ] [ CATEGORY NAME ] [ Individual / Group ]
    - Main Evaluation Table:
      - Header Row 1: Code Letter | Marks (spans 4 columns) | Mark out of 100
      - Data Rows: Participant Code Letters (A, B, C, D...) with 4 blank mark sub-columns & 1 mark out of 100 column
    - Supports copies parameter (e.g. copies=3 for 3 copies per competition for judges)
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, HRFlowable
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from io import BytesIO
        from datetime import datetime

        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        
        category = request.GET.get('category', 'all')
        program_id = request.GET.get('program_id', 'all')
        only_with_participants = request.GET.get('only_with_participants', 'true').lower() == 'true'
        layout = request.GET.get('layout', 'single')
        try:
            copies = int(request.GET.get('copies', '3'))
        except (ValueError, TypeError):
            copies = 3
        copies = min(20, max(1, copies))

        programs = Program.objects.filter(event=event).order_by('category', 'name')

        if category != 'all':
            programs = programs.filter(category=category)
        if program_id != 'all':
            try:
                programs = programs.filter(id=int(program_id))
            except ValueError:
                programs = programs.none()

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=34,
            bottomMargin=34
        )

        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'ValuationTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=25,
            textColor=colors.HexColor('#0F172A'),
            spaceAfter=8
        )

        event_name_style = ParagraphStyle(
            'EventNameStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            alignment=TA_LEFT,
            textColor=colors.HexColor('#312E81')
        )

        datetime_style = ParagraphStyle(
            'DateTimeStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            alignment=TA_RIGHT,
            textColor=colors.HexColor('#64748B')
        )

        stage_style = ParagraphStyle(
            'StageStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            alignment=TA_RIGHT,
            textColor=colors.HexColor('#475569'),
            spaceAfter=6
        )

        prog_box_center = ParagraphStyle(
            'ProgBoxCenter',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#312E81')
        )

        table_header_center = ParagraphStyle(
            'TableHeaderCenter',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            alignment=TA_CENTER,
            textColor=colors.white
        )

        table_body_center = ParagraphStyle(
            'TableBodyCenter',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            alignment=TA_CENTER,
            textColor=colors.black
        )

        current_dt_str = datetime.now().strftime("%d/%m/%Y %I:%M %p")
        elements = []
        page_counter = 0

        for program in programs:
            assignments = ProgramAssignment.objects.filter(program=program).select_related('student', 'team').order_by('chest_number', 'student__first_name')
            
            if only_with_participants and not assignments.exists():
                continue

            for copy_num in range(max(1, copies)):
                page_counter += 1
                if page_counter > 1:
                    elements.append(PageBreak())

                # Top Header Row: Event Name (Left) | Date & Time (Right)
                top_header_table = Table(
                [[Paragraph(escape(event.title), event_name_style), Paragraph(current_dt_str, datetime_style)]],
                    colWidths=[4.2 * inch, 3.0 * inch]
                )
                top_header_table.setStyle(TableStyle([
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                    ('LEFTPADDING', (0,0), (-1,-1), 0),
                    ('RIGHTPADDING', (0,0), (-1,-1), 0),
                    ('TOPPADDING', (0,0), (-1,-1), 0),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                    ('LINEBELOW', (0,0), (-1,-1), 0.7, colors.HexColor('#CBD5E1')),
                ]))
                elements.append(top_header_table)
                elements.append(Spacer(1, 4))

                # Main Title
                elements.append(Paragraph("Valuation Sheet", title_style))
                
                # Black divider line
                elements.append(HRFlowable(width="100%", thickness=1.2, color=colors.HexColor('#4F46E5'), spaceBefore=4, spaceAfter=10))

                # Stage No (Right Aligned)
                elements.append(Paragraph("Stage No: ________", stage_style))

                # Program Info Box Table (3-columns matching user screenshot)
                prog_type = "Group" if program.is_team_based else "Individual"
                cat_display = program.get_category_display().upper() if hasattr(program, 'get_category_display') and callable(getattr(program, 'get_category_display', None)) else str(program.category).upper()

                prog_info_table = Table(
                    [[
                        Paragraph(f"<b>{escape(program.name.upper())}</b>", prog_box_center),
                        Paragraph(f"<b>{cat_display}</b>", prog_box_center),
                        Paragraph(f"<b>{prog_type}</b>", prog_box_center)
                    ]],
                    colWidths=[2.6 * inch, 2.6 * inch, 2.0 * inch]
                )
                prog_info_table.setStyle(TableStyle([
                    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#EEF2FF')),
                    ('GRID', (0,0), (-1,-1), 0.55, colors.HexColor('#C7D2FE')),
                    ('BOX', (0,0), (-1,-1), 0.9, colors.HexColor('#A5B4FC')),
                    ('TOPPADDING', (0,0), (-1,-1), 8),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                    ('LEFTPADDING', (0,0), (-1,-1), 6),
                    ('RIGHTPADDING', (0,0), (-1,-1), 6),
                ]))
                elements.append(prog_info_table)
                elements.append(Spacer(1, 4))

                max_mark_val = event.max_mark_per_judge
                judge_count = program.effective_num_judges

                # Main Valuation Table
                table_data = [[
                    Paragraph("<b>Code Letter</b>", table_header_center),
                    Paragraph("<b>Marks</b>", table_header_center),
                    *([""] * (judge_count - 1)),
                    Paragraph(f"<b>Converted mark out of {event.converted_total_mark}</b>", table_header_center),
                ]]

                # Determine total rows (1 row per participant for individual, 1 row per sub-team/team for group)
                if assignments.exists():
                    if program.is_team_based:
                        sub_teams = set()
                        for a in assignments:
                            sub_teams.add((a.team_id, a.sub_team_number or 1))
                        entry_count = len(sub_teams)
                    else:
                        entry_count = assignments.count()
                else:
                    entry_count = 3  # Minimum 3 empty rows if no participants

                # Add rows with free/blank Code Letter and scoring fields
                for _ in range(entry_count):
                    table_data.append([""] * (judge_count + 2))

                judge_width = (4.0 / judge_count) * inch
                main_table = Table(
                    table_data,
                    colWidths=[1.3 * inch] + [judge_width] * judge_count + [1.9 * inch],
                )
                main_table.setStyle(TableStyle([
                    ('SPAN', (1, 0), (judge_count, 0)),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('GRID', (0, 0), (-1, -1), 0.55, colors.HexColor('#CBD5E1')),
                    ('BOX', (0, 0), (-1, -1), 0.9, colors.HexColor('#94A3B8')),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
                    ('TOPPADDING', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                    ('LEFTPADDING', (0, 0), (-1, -1), 4),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ]))

                elements.append(main_table)

        if not elements or page_counter == 0:
            elements.append(Paragraph("No matching programs or participants found for Valuation Sheet.", styles['Normal']))

        doc.build(elements)
        pdf_data = buffer.getvalue()
        buffer.close()

        response = HttpResponse(pdf_data, content_type='application/pdf')
        filename = f"Valuation_Sheet_{event.title.replace(' ', '_')}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    except Event.DoesNotExist:
        return JsonResponse({'error': 'Event not found'}, status=404)
    except Exception as e:
        import traceback
        logger.exception('PDF generation failed')
        return JsonResponse({'error': 'PDF generation failed.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
def generate_call_list(request, event_id):
    """
    Generate Call List PDF supporting 2 modes matching user screenshots:
    1. Competition Wise Call List (mode='competition'):
       - Program Header: [ <u>PROGRAM NAME</u> ] [ <u>CATEGORY NAME</u> ] [ <u>TYPE</u> ]
       - Table: Sl. No | Chest No | Participant | Team Name
       - Footer: Total participants: N
    2. Team Wise Call List (mode='team'):
       - Subtitle: Team Name
       - Grouped by Category: Category (N)
       - Table: Competition | Chest No | Participant (Leader)
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, HRFlowable
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from io import BytesIO
        from datetime import datetime

        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        mode = request.GET.get('mode', 'competition')
        category = request.GET.get('category', 'all')
        program_id = request.GET.get('program_id', 'all')
        team_id = request.GET.get('team_id', 'all')
        only_with_participants = request.GET.get('only_with_participants', 'true').lower() == 'true'

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=34,
            bottomMargin=34
        )

        styles = getSampleStyleSheet()

        event_name_style = ParagraphStyle(
            'EventNameStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            alignment=TA_LEFT,
            textColor=colors.HexColor('#312E81')
        )

        datetime_style = ParagraphStyle(
            'DateTimeStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            alignment=TA_RIGHT,
            textColor=colors.HexColor('#64748B')
        )

        title_style = ParagraphStyle(
            'CallListTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=25,
            textColor=colors.HexColor('#0F172A'),
            spaceAfter=2
        )

        subtitle_style = ParagraphStyle(
            'CallListSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=13,
            textColor=colors.HexColor('#475569'),
            spaceAfter=4
        )

        prog_title_style = ParagraphStyle(
            'ProgTitleStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            alignment=TA_LEFT,
            textColor=colors.HexColor('#0F172A')
        )

        prog_cat_style = ParagraphStyle(
            'ProgCatStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#312E81')
        )

        prog_type_style = ParagraphStyle(
            'ProgTypeStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            alignment=TA_RIGHT,
            textColor=colors.HexColor('#475569')
        )

        category_section_style = ParagraphStyle(
            'CategorySectionStyle',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=12,
            leading=16,
            textColor=colors.HexColor('#312E81'),
            spaceBefore=10,
            spaceAfter=6
        )

        table_header_style = ParagraphStyle(
            'TableHeaderStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            alignment=TA_LEFT,
            textColor=colors.white
        )

        table_header_center = ParagraphStyle(
            'TableHeaderCenter',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            alignment=TA_CENTER,
            textColor=colors.white
        )

        table_body_style = ParagraphStyle(
            'TableBodyStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            alignment=TA_LEFT,
            textColor=colors.HexColor('#1E293B')
        )

        table_body_center = ParagraphStyle(
            'TableBodyCenter',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#1E293B')
        )

        total_part_style = ParagraphStyle(
            'TotalPartStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            alignment=TA_RIGHT,
            textColor=colors.HexColor('#374151'),
            spaceBefore=4
        )

        current_dt_str = datetime.now().strftime("%d/%m/%Y %I:%M %p")
        elements = []
        page_counter = 0

        if mode == 'team':
            # Format 2: Team Wise Call List (Screenshot 2)
            teams = Team.objects.filter(school=event.school).order_by('name')
            if team_id != 'all':
                try:
                    teams = teams.filter(id=int(team_id))
                except ValueError:
                    teams = teams.none()

            for team in teams:
                assignments = ProgramAssignment.objects.filter(team=team, program__event=event).select_related('program', 'student')
                if category != 'all':
                    assignments = assignments.filter(program__category=category)
                if program_id != 'all':
                    try:
                        assignments = assignments.filter(program_id=int(program_id))
                    except ValueError:
                        assignments = assignments.none()
                
                if only_with_participants and not assignments.exists():
                    continue

                page_counter += 1
                if page_counter > 1:
                    elements.append(PageBreak())

                top_header_table = Table(
                    [[Paragraph(escape(event.title), event_name_style), Paragraph(current_dt_str, datetime_style)]],
                    colWidths=[4.2 * inch, 3.0 * inch]
                )
                top_header_table.setStyle(TableStyle([
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                    ('LEFTPADDING', (0,0), (-1,-1), 0),
                    ('RIGHTPADDING', (0,0), (-1,-1), 0),
                    ('TOPPADDING', (0,0), (-1,-1), 0),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                    ('LINEBELOW', (0,0), (-1,-1), 0.7, colors.HexColor('#CBD5E1')),
                ]))
                elements.append(top_header_table)
                elements.append(Spacer(1, 4))

                elements.append(Paragraph("Call List", title_style))
                elements.append(Paragraph(team.name, subtitle_style))
                elements.append(HRFlowable(width="100%", thickness=1.2, color=colors.HexColor('#4F46E5'), spaceBefore=4, spaceAfter=10))

                categories_dict = {}
                for a in assignments:
                    cat_name = a.program.get_category_display() if hasattr(a.program, 'get_category_display') and callable(getattr(a.program, 'get_category_display', None)) else str(a.program.category).capitalize()
                    if cat_name not in categories_dict:
                        categories_dict[cat_name] = {}
                    prog_key = (a.program_id, getattr(a, 'sub_team_number', 1) or 1 if a.program.is_team_based else a.id)
                    if prog_key not in categories_dict[cat_name]:
                        categories_dict[cat_name][prog_key] = []
                    categories_dict[cat_name][prog_key].append(a)

                for cat_name, cat_prog_map in categories_dict.items():
                    elements.append(Paragraph(f"<b>{escape(cat_name)} ({len(cat_prog_map)})</b>", category_section_style))

                    table_data = [
                        [
                            Paragraph("<b>Competition</b>", table_header_style),
                            Paragraph("<b>Chest No</b>", table_header_center),
                            Paragraph("<b>Participant</b>", table_header_style),
                            Paragraph("<b>Gender</b>", table_header_center)
                        ]
                    ]

                    for prog_key, a_list in cat_prog_map.items():
                        first_a = a_list[0]
                        program_obj = first_a.program
                        entries = get_grouped_assignments_for_report(program_obj, ProgramAssignment.objects.filter(id__in=[x.id for x in a_list]), event)
                        for entry in entries:
                            prog_display = program_obj.name
                            if program_obj.is_team_based and program_obj.team_size:
                                prog_display += f" ({program_obj.team_size} Participants)"

                            table_data.append([
                                Paragraph(escape(prog_display), table_body_style),
                                Paragraph(escape(entry['chest_no']), table_body_center),
                                Paragraph(escape(entry['participant_names']), table_body_style),
                                Paragraph(escape(entry['gender']), table_body_center)
                            ])

                    table = Table(table_data, colWidths=[2.7 * inch, 1.0 * inch, 2.5 * inch, 1.0 * inch])
                    table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ('GRID', (0, 0), (-1, -1), 0.55, colors.HexColor('#CBD5E1')),
                        ('BOX', (0, 0), (-1, -1), 0.9, colors.HexColor('#94A3B8')),
                        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
                        ('TOPPADDING', (0, 0), (-1, -1), 6),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                        ('LEFTPADDING', (0, 0), (-1, -1), 6),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                    ]))

                    elements.append(table)
                    elements.append(Spacer(1, 10))

        else:
            # Format 1: Competition Wise Call List (Screenshot 1)
            programs = Program.objects.filter(event=event).order_by('category', 'name')
            if category != 'all':
                programs = programs.filter(category=category)
            if program_id != 'all':
                try:
                    programs = programs.filter(id=int(program_id))
                except ValueError:
                    programs = programs.none()

            for program in programs:
                assignments = ProgramAssignment.objects.filter(program=program).select_related('student', 'team').order_by('chest_number', 'student__first_name')
                if team_id != 'all':
                    try:
                        assignments = assignments.filter(team_id=int(team_id))
                    except ValueError:
                        assignments = assignments.none()

                if only_with_participants and not assignments.exists():
                    continue

                page_counter += 1
                if page_counter > 1:
                    elements.append(PageBreak())

                top_header_table = Table(
                    [[Paragraph(escape(event.title), event_name_style), Paragraph(current_dt_str, datetime_style)]],
                    colWidths=[4.2 * inch, 3.0 * inch]
                )
                top_header_table.setStyle(TableStyle([
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                    ('LEFTPADDING', (0,0), (-1,-1), 0),
                    ('RIGHTPADDING', (0,0), (-1,-1), 0),
                    ('TOPPADDING', (0,0), (-1,-1), 0),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                    ('LINEBELOW', (0,0), (-1,-1), 0.7, colors.HexColor('#CBD5E1')),
                ]))
                elements.append(top_header_table)
                elements.append(Spacer(1, 4))

                elements.append(Paragraph("Competitions Call List", title_style))
                elements.append(HRFlowable(width="100%", thickness=1.2, color=colors.HexColor('#4F46E5'), spaceBefore=4, spaceAfter=10))

                prog_type = "Group" if program.is_team_based else "Individual"
                cat_display = program.get_category_display().upper() if hasattr(program, 'get_category_display') and callable(getattr(program, 'get_category_display', None)) else str(program.category).upper()

                sub_header_table = Table(
                    [[
                        Paragraph(f"<b>{escape(program.name.upper())}</b>", prog_title_style),
                        Paragraph(f"<u><b>{cat_display}</b></u>", prog_cat_style),
                        Paragraph(f"<u><b>{prog_type}</b></u>", prog_type_style)
                    ]],
                    colWidths=[2.8 * inch, 2.6 * inch, 1.8 * inch]
                )
                sub_header_table.setStyle(TableStyle([
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                    ('LEFTPADDING', (0,0), (-1,-1), 0),
                    ('RIGHTPADDING', (0,0), (-1,-1), 0),
                    ('TOPPADDING', (0,0), (-1,-1), 2),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
                    ('BOX', (0,0), (-1,-1), 0.6, colors.HexColor('#CBD5E1')),
                ]))
                elements.append(sub_header_table)
                elements.append(Spacer(1, 6))

                table_data = [
                    [
                        Paragraph("<b>Sl. No</b>", table_header_center),
                        Paragraph("<b>Chest No</b>", table_header_center),
                        Paragraph("<b>Participant</b>", table_header_style),
                        Paragraph("<b>Gender</b>", table_header_center),
                        Paragraph("<b>Team Name</b>", table_header_style)
                    ]
                ]

                sl_no = 0
                if assignments.exists():
                    entries = get_grouped_assignments_for_report(program, assignments, event)
                    for entry in entries:
                        sl_no += 1
                        table_data.append([
                            Paragraph(str(sl_no), table_body_center),
                            Paragraph(escape(entry['chest_no']), table_body_center),
                            Paragraph(escape(entry['participant_names']), table_body_style),
                            Paragraph(escape(entry['gender']), table_body_center),
                            Paragraph(escape(entry['team_name']), table_body_style)
                        ])

                table = Table(table_data, colWidths=[0.6 * inch, 0.9 * inch, 2.7 * inch, 1.0 * inch, 2.0 * inch])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('GRID', (0, 0), (-1, -1), 0.55, colors.HexColor('#CBD5E1')),
                    ('BOX', (0, 0), (-1, -1), 0.9, colors.HexColor('#94A3B8')),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ]))

                elements.append(table)
                elements.append(Paragraph(f"Total participants: {sl_no}", total_part_style))
                elements.append(Spacer(1, 10))

        if not elements or page_counter == 0:
            elements.append(Paragraph("No matching assignments found for Call List.", styles['Normal']))

        doc.build(elements)
        pdf_data = buffer.getvalue()
        buffer.close()

        response = HttpResponse(pdf_data, content_type='application/pdf')
        filename = f"Call_List_{event.title.replace(' ', '_')}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    except Event.DoesNotExist:
        return JsonResponse({'error': 'Event not found'}, status=404)
    except Exception as e:
        import traceback
        logger.exception('PDF generation failed')
        return JsonResponse({'error': 'PDF generation failed.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
def certificate_templates(request, event_id):
    from .certificate_config import CERTIFICATE_TYPE_CHOICES, default_certificate_fields

    try:
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        existing = {
            template.certificate_type: template
            for template in CertificateTemplate.objects.filter(event=event)
        }
        return Response({
            'results': [
                _certificate_template_payload(
                    request, certificate_type, existing.get(certificate_type),
                    default_certificate_fields(),
                )
                for certificate_type, _label in CERTIFICATE_TYPE_CHOICES
            ]
        })
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)


def _certificate_template_payload(request, certificate_type, template, default_fields=None):
    default_fields = default_fields or {}
    background_url = ''
    if template and template.background_image:
        background_url = request.build_absolute_uri(template.background_image.url)
    default_aspect = 0.75 if certificate_type == 'badge' else 4 / 3
    return {
        'id': template.id if template else None,
        'certificateType': certificate_type,
        'bgImage': background_url,
        'status': 'Custom' if background_url else 'Missing',
        'aspectRatio': template.aspect_ratio if template else default_aspect,
        'naturalWidth': template.natural_width if template else None,
        'naturalHeight': template.natural_height if template else None,
        'fields': {**default_fields, **(template.fields or {})} if template else default_fields,
        'updatedAt': template.updated_at.isoformat() if template else None,
    }


def _validate_certificate_background(upload):
    import warnings
    from PIL import Image, UnidentifiedImageError

    allowed_types = {'image/png', 'image/jpeg', 'image/webp'}
    allowed_formats = {'PNG', 'JPEG', 'WEBP'}
    if upload.content_type not in allowed_types:
        raise DjangoValidationError('Use a PNG, JPEG or WebP certificate image.')
    if upload.size > 8 * 1024 * 1024:
        raise DjangoValidationError('Certificate images must be 8 MB or smaller.')

    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            image = Image.open(upload)
            image.verify()
            upload.seek(0)
            image = Image.open(upload)
            width, height = image.size
            image_format = image.format
    except (UnidentifiedImageError, OSError, Image.DecompressionBombWarning):
        raise DjangoValidationError('The uploaded certificate image is invalid or unsafe.')
    finally:
        upload.seek(0)

    if image_format not in allowed_formats:
        raise DjangoValidationError('Use a PNG, JPEG or WebP certificate image.')
    if width < 150 or height < 150:
        raise DjangoValidationError('Template images must be at least 150 x 150 pixels.')
    if width > 12000 or height > 12000 or width * height > 50_000_000:
        raise DjangoValidationError('Certificate image dimensions are too large.')
    ratio = width / height
    if ratio < 0.25 or ratio > 4:
        raise DjangoValidationError('Certificate image aspect ratio must be between 1:4 and 4:1.')
    return width, height, ratio


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAdminOrEventManager])
def certificate_template_detail(request, event_id, certificate_type):
    from .certificate_config import CERTIFICATE_TYPES, default_certificate_fields, normalize_certificate_fields

    try:
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        if certificate_type not in CERTIFICATE_TYPES:
            return Response({'error': 'Unsupported certificate type.'}, status=400)

        template = CertificateTemplate.objects.filter(
            event=event, certificate_type=certificate_type
        ).first()
        if request.method == 'DELETE':
            if template:
                template.delete()
            audit_security_event(
                request, 'certificate_template_reset', 'success',
                school_id=event.school_id, target=f'{event.id}:{certificate_type}',
            )
            return Response(status=204)

        fields_value = request.data.get('fields')
        if isinstance(fields_value, str):
            try:
                fields_value = json.loads(fields_value)
            except json.JSONDecodeError:
                return Response({'error': 'Certificate fields contain invalid JSON.'}, status=400)
        fields = normalize_certificate_fields(
            fields_value if fields_value is not None
            else (template.fields if template else default_certificate_fields())
        )

        background = request.FILES.get('background_image')
        dimensions = _validate_certificate_background(background) if background else None
        if template is None:
            template = CertificateTemplate(event=event, certificate_type=certificate_type)
        old_background_name = template.background_image.name if template.background_image else None
        template.fields = fields
        template.updated_by = request.user
        if background:
            template.background_image = background
            template.natural_width, template.natural_height, template.aspect_ratio = dimensions
        template.save()
        if background and old_background_name and old_background_name != template.background_image.name:
            template.background_image.storage.delete(old_background_name)

        audit_security_event(
            request, 'certificate_template_update', 'success',
            school_id=event.school_id, target=f'{event.id}:{certificate_type}',
        )
        return Response(_certificate_template_payload(request, certificate_type, template))
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)
    except (ValidationError, DjangoValidationError) as exc:
        message = exc.messages[0] if getattr(exc, 'messages', None) else str(exc)
        return Response({'error': message}, status=400)


@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
def certificate_preview_data(request, event_id):
    from .certificate_config import CERTIFICATE_TYPES
    from .certificate_service import certificate_field_values, certificate_recipients, event_category_names

    try:
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        certificate_type = request.GET.get('certificate_type', 'participation')
        if certificate_type not in CERTIFICATE_TYPES:
            return Response({'error': 'Unsupported certificate type.'}, status=400)
        programs = Program.objects.filter(event=event).order_by('category', 'name')
        program_id = request.GET.get('program_id')
        if program_id and program_id != 'all':
            try:
                programs = programs.filter(id=int(program_id))
            except (TypeError, ValueError):
                return Response({'error': 'Invalid program filter.'}, status=400)
        category_names = event_category_names(event)
        for program in programs:
            recipients = certificate_recipients(program, certificate_type)
            if recipients:
                return Response({
                    'recipient': certificate_field_values(recipients[0], event, category_names),
                    'programId': program.id,
                })
        return Response({'recipient': None, 'programId': None})
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)


@api_view(['GET'])
@permission_classes([IsAdminOrEventManager])
@throttle_classes([ExportRateThrottle])
def generate_certificates(request, event_id):
    from .certificate_config import CERTIFICATE_TYPES
    from .certificate_service import certificate_recipients, render_certificates_pdf

    try:
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        cert_types = list(dict.fromkeys(
            item.strip() for item in request.GET.get('cert_types', 'participation').split(',')
            if item.strip()
        ))
        if not cert_types or any(item not in CERTIFICATE_TYPES for item in cert_types):
            return Response({'error': 'Select a supported certificate type.'}, status=400)

        quality = request.GET.get('quality', 'standard')
        if quality not in ('screen', 'standard', 'print'):
            return Response({'error': 'Unsupported certificate quality.'}, status=400)

        is_badge_only = cert_types == ['badge']

        team_id_raw = request.GET.get('team_id') or request.GET.get('team')
        team_id = None
        if team_id_raw and team_id_raw != 'all':
            try:
                team_id = int(team_id_raw)
            except (TypeError, ValueError):
                return Response({'error': 'Invalid team filter.'}, status=400)

        category = request.GET.get('category', 'all')
        program_id = request.GET.get('program_id', 'all')

        templates = {
            template.certificate_type: template
            for template in CertificateTemplate.objects.filter(
                event=event, certificate_type__in=cert_types
            )
        }
        missing_templates = [
            certificate_type for certificate_type in cert_types
            if certificate_type not in templates or not templates[certificate_type].background_image
        ]
        if missing_templates:
            return Response({
                'error': 'Upload and save the required certificate templates first.',
                'missing_templates': missing_templates,
            }, status=400)

        recipients = []
        if is_badge_only:
            from .certificate_service import CertificateRecipient
            badge_assignments = ProgramAssignment.objects.filter(
                program__event=event
            ).select_related('student', 'team', 'program')

            if team_id:
                badge_assignments = badge_assignments.filter(
                    Q(team_id=team_id) | Q(student__team_memberships=team_id)
                )

            if category and category != 'all':
                badge_assignments = badge_assignments.filter(
                    Q(student__category__iexact=category) |
                    (Q(student__category__isnull=True) & Q(program__category__iexact=category))
                )

            badge_assignments = badge_assignments.order_by(
                'team__name', 'chest_number', 'student__first_name', 'student_id'
            )

            seen_students = set()
            for ba in badge_assignments:
                if ba.student_id not in seen_students:
                    seen_students.add(ba.student_id)
                    recipients.append(CertificateRecipient('badge', ba))
        else:
            programs = Program.objects.filter(event=event).order_by('category', 'name', 'id')
            if category and category != 'all':
                programs = programs.filter(category__iexact=category)
            if program_id and program_id != 'all':
                try:
                    programs = programs.filter(id=int(program_id))
                except (TypeError, ValueError):
                    return Response({'error': 'Invalid program filter.'}, status=400)
            if not programs.exists():
                return Response({'error': 'No programs match the selected filters.'}, status=400)

            for certificate_type in cert_types:
                seen_students_for_badge = set()
                for program in programs:
                    prog_recipients = certificate_recipients(program, certificate_type)
                    if team_id:
                        prog_recipients = [
                            r for r in prog_recipients
                            if (r.assignment.team_id == team_id or (r.student and r.student.team_memberships.filter(id=team_id).exists()))
                        ]
                    if certificate_type == 'badge':
                        for r in prog_recipients:
                            if r.student.id not in seen_students_for_badge:
                                seen_students_for_badge.add(r.student.id)
                                recipients.append(r)
                    else:
                        recipients.extend(prog_recipients)

        if not recipients:
            return Response({
                'error': 'No eligible recipients match the selected certificate types and filters.'
            }, status=400)
        if len(recipients) > 5000:
            return Response({'error': 'This export exceeds the 5,000-certificate safety limit.'}, status=400)

        team_suffix = ''
        if team_id:
            from .models import Team
            team_obj = Team.objects.filter(id=team_id, school_id=event.school_id).first()
            if team_obj:
                team_suffix = f'_{slugify(team_obj.name)}'

        category_suffix = f'_{slugify(category)}' if (category and category != 'all') else ''
        filename_prefix = 'Badges' if is_badge_only else 'Certificates'
        pdf_buffer = render_certificates_pdf(event, templates, recipients, quality)
        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = (
            f'attachment; filename="{filename_prefix}_{slugify(event.title) or event.id}{team_suffix}{category_suffix}.pdf"'
        )
        response['X-Certificate-Count'] = str(len(recipients))
        audit_security_event(
            request, 'certificate_export', 'success',
            school_id=event.school_id, target=f'{event.id}:{len(recipients)}',
        )
        return response

    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)
    except (ValidationError, DjangoValidationError) as exc:
        message = exc.messages[0] if getattr(exc, 'messages', None) else str(exc)
        return Response({'error': message}, status=400)
    except Exception:
        logger.exception('Certificate PDF generation failed')
        return Response({'error': 'Unable to generate certificates.'}, status=500)
