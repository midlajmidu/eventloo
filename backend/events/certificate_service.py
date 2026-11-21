import logging
import os
from dataclasses import dataclass
from io import BytesIO

from django.core.exceptions import ValidationError
from PIL import Image
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape, portrait
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

logger = logging.getLogger(__name__)

from accounts.models import StudentCategory

from .certificate_config import FONT_CHOICES, normalize_certificate_fields
from .models import ChestNumber, ProgramAssignment, ProgramResult


POSITION_BY_CERTIFICATE_TYPE = {
    'first_place': 1,
    'second_place': 2,
    'third_place': 3,
}

RANK_LABELS = {
    'first_place': '1st Place',
    'second_place': '2nd Place',
    'third_place': '3rd Place',
    'participation': 'Participant',
    'badge': 'Participant',
}


@dataclass(frozen=True)
class CertificateRecipient:
    certificate_type: str
    assignment: ProgramAssignment
    result: ProgramResult | None = None

    @property
    def program(self):
        return self.assignment.program

    @property
    def student(self):
        return self.assignment.student


def certificate_recipients(program, certificate_type):
    assignments = ProgramAssignment.objects.filter(program=program).select_related(
        'student', 'team', 'program__event'
    ).order_by('team_id', 'sub_team_number', '-is_leader', 'chest_number', 'student_id')

    if certificate_type in ('participation', 'badge'):
        return [CertificateRecipient(certificate_type, assignment) for assignment in assignments]

    position = POSITION_BY_CERTIFICATE_TYPE.get(certificate_type)
    if position is None or not program.is_published:
        return []

    results = ProgramResult.objects.filter(
        program=program,
        entry_status='submitted',
        position=position,
    ).select_related('participant', 'team')

    recipients = []
    seen_assignment_ids = set()
    for result in results:
        if program.is_team_based:
            winning_assignments = assignments.filter(
                team_id=result.team_id,
                sub_team_number=result.sub_team_number or 1,
            )
        else:
            winning_assignments = assignments.filter(student_id=result.participant_id)

        for assignment in winning_assignments:
            if assignment.id in seen_assignment_ids:
                continue
            seen_assignment_ids.add(assignment.id)
            recipients.append(CertificateRecipient(certificate_type, assignment, result))
    return recipients


def certificate_field_values(recipient, event, category_names=None):
    assignment = recipient.assignment
    student = assignment.student
    category_names = category_names or {}
    category_code = student.category or assignment.program.category or ''
    category = category_names.get(category_code, category_code.replace('_', ' ').replace('-', ' ').title())
    chest_number = assignment.chest_number
    if not chest_number:
        chest_number = ChestNumber.objects.filter(event=event, student=student).values_list(
            'chest_number', flat=True
        ).first()

    # Retrieve all assigned programs for this student in this event (both general and standard category)
    student_assignments = ProgramAssignment.objects.filter(
        student=student, program__event=event
    ).select_related('program').order_by('program__category', 'program__name', 'id')

    assigned_programs_list = []
    seen_program_ids = set()
    for sa in student_assignments:
        if sa.program and sa.program_id not in seen_program_ids:
            seen_program_ids.add(sa.program_id)
            is_gen = bool(sa.program.category and sa.program.category.lower() in ('general', 'gen', 'all'))
            if is_gen and 'general' not in sa.program.name.lower():
                name_display = f"{sa.program.name} (General)"
            else:
                name_display = sa.program.name
            assigned_programs_list.append(name_display)

    if not assigned_programs_list and assignment.program:
        assigned_programs_list.append(assignment.program.name)

    total_count = len(assigned_programs_list)
    programs_str = ', '.join(assigned_programs_list) if assigned_programs_list else 'None'

    return {
        'participantName': student.get_full_name() or student.display_name,
        'chestNo': f'Chest No: {chest_number or "N/A"}',
        'category': category or 'Unspecified',
        'teamName': assignment.team.name if assignment.team else 'Individual',
        'eventName': event.title,
        'programName': assignment.program.name if assignment.program else '',
        'rank': RANK_LABELS.get(recipient.certificate_type, 'Participant'),
        'totalPrograms': f'Total Programs: {total_count}',
        'assignedPrograms': programs_str,
    }


def event_category_names(event):
    return dict(StudentCategory.objects.filter(school=event.school).values_list('code', 'name'))


def _prepare_background(template, quality):
    limits = {'screen': (1600, 78), 'standard': (2400, 88), 'print': (4800, 95)}
    max_edge, jpeg_quality = limits[quality]
    template.background_image.open('rb')
    try:
        image = Image.open(template.background_image)
        image.load()
    finally:
        template.background_image.close()

    if image.mode not in ('RGB', 'RGBA'):
        image = image.convert('RGBA' if 'transparency' in image.info else 'RGB')
    if max(image.size) > max_edge:
        image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)

    output = BytesIO()
    if image.mode == 'RGBA':
        image.save(output, format='PNG', optimize=True)
    else:
        image.save(output, format='JPEG', quality=jpeg_quality, optimize=True)
    output.seek(0)
    return output


def _page_size(aspect_ratio):
    if aspect_ratio >= 1:
        return landscape(A4)
    return portrait(A4)


def _draw_crop_marks(pdf, page_width, page_height, margin_x, margin_y, cols, rows, badge_width, badge_height):
    pdf.saveState()
    pdf.setStrokeColor(HexColor('#94A3B8'))
    pdf.setLineWidth(0.4)
    tick = 8.0

    # Vertical cut ticks at margins
    for c in range(cols + 1):
        x = margin_x + c * badge_width
        pdf.line(x, page_height - margin_y, x, min(page_height, page_height - margin_y + tick))
        pdf.line(x, margin_y, x, max(0, margin_y - tick))

    # Horizontal cut ticks at margins
    for r in range(rows + 1):
        y = margin_y + r * badge_height
        pdf.line(margin_x, y, max(0, margin_x - tick), y)
        pdf.line(page_width - margin_x, y, min(page_width, page_width - margin_x + tick), y)

    pdf.restoreState()


def _draw_field(pdf, field, value, box_x=0, box_y=None, box_width=None, box_height=None, reference_width=672.0):
    if box_height is None:
        # Backward compatibility with _draw_field(pdf, field, value, page_width, page_height)
        page_width = box_x
        page_height = box_y
        box_x = 0
        box_y = 0
        box_width = page_width
        box_height = page_height

    text = str(value or '')
    if field.get('uppercase'):
        text = text.upper()
    if not text:
        return

    font_normal, font_bold = FONT_CHOICES[field['fontFamily']]
    font_name = font_bold if field.get('bold') else font_normal
    font_size = float(field['fontSize']) * box_width / reference_width
    char_space = float(field.get('letterSpacing') or 0) * box_width / reference_width
    max_text_width = box_width * 0.94

    # Split into lines if wrapped or long
    words = text.split(' ')
    lines = []
    current_line = []
    for word in words:
        test_line = ' '.join(current_line + [word])
        w = stringWidth(test_line, font_name, font_size) + max(0, len(test_line) - 1) * char_space
        if w <= max_text_width or not current_line:
            current_line.append(word)
        else:
            lines.append(' '.join(current_line))
            current_line = [word]
    if current_line:
        lines.append(' '.join(current_line))

    while font_size > 5 and any(
        (stringWidth(line, font_name, font_size) + max(0, len(line) - 1) * char_space) > max_text_width
        for line in lines
    ):
        font_size -= 0.5

    align = field.get('textAlign', 'center')
    base_x = box_x + box_width * float(field['x']) / 100.0
    start_y = box_y + box_height * (1.0 - float(field['y']) / 100.0) - font_size * 0.32
    line_spacing = font_size * 1.25

    for idx, line in enumerate(lines):
        line_w = stringWidth(line, font_name, font_size) + max(0, len(line) - 1) * char_space
        x = base_x
        if align == 'center':
            x -= line_w / 2
        elif align == 'right':
            x -= line_w
        y = start_y - (idx * line_spacing)

        text_object = pdf.beginText()
        text_object.setTextOrigin(x, y)
        text_object.setFont(font_name, font_size)
        text_object.setFillColor(HexColor(field['color']))
        text_object.setCharSpace(char_space)
        text_object.textLine(line)
        pdf.drawText(text_object)

def _normalize_color(col):
    if not col:
        return '#4F46E5'
    if col.startswith('#') or col.startswith('rgb'):
        return col
    named = {
        'indigo': '#4F46E5',
        'emerald': '#10B981',
        'amber': '#F59E0B',
        'rose': '#F43F5E',
        'sky': '#0EA5E9',
        'blue': '#3B82F6',
        'purple': '#8B5CF6',
        'teal': '#14B8A6',
        'orange': '#F97316',
        'green': '#10B981',
        'red': '#EF4444',
    }
    return named.get(col.lower(), '#4F46E5')


def _resolve_event_logo_path(event):
    """
    Finds the event logo image path.
    Checks event.logo, then school.settings.school_logo, then school.logo.
    """
    if getattr(event, 'logo', None) and getattr(event.logo, 'name', None):
        try:
            if os.path.exists(event.logo.path):
                return event.logo.path
        except Exception:
            pass
    school = getattr(event, 'school', None)
    if school:
        if hasattr(school, 'settings') and getattr(school.settings, 'school_logo', None):
            try:
                if school.settings.school_logo.name and os.path.exists(school.settings.school_logo.path):
                    return school.settings.school_logo.path
            except Exception:
                pass
        if getattr(school, 'logo', None) and getattr(school.logo, 'name', None):
            try:
                if os.path.exists(school.logo.path):
                    return school.logo.path
            except Exception:
                pass
    return None


def _resolve_eventloo_icon_path():
    """
    Resolves official Eventloo favicon or square icon for 'Powered by Eventloo' badge footer.
    """
    from django.conf import settings
    candidates = [
        os.path.join(settings.BASE_DIR, 'assets', 'eventloo-icon.png'),
        os.path.abspath(os.path.join(settings.BASE_DIR, '..', 'frontend', 'public', 'eventloo-icon.png')),
        os.path.join(settings.BASE_DIR, 'assets', 'favicon.png'),
        os.path.abspath(os.path.join(settings.BASE_DIR, '..', 'frontend', 'public', 'favicon.png')),
        os.path.join(settings.BASE_DIR, 'assets', 'eventloo-logo.png'),
        os.path.abspath(os.path.join(settings.BASE_DIR, '..', 'frontend', 'public', 'eventloo-logo.png')),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def _draw_badge_star(pdf, cx, cy, r_outer, r_inner, color_hex):
    """Draws a 4-point sparkle star polygon at (cx, cy)."""
    pdf.setFillColor(HexColor(color_hex))
    p = pdf.beginPath()
    p.moveTo(cx, cy + r_outer)
    p.lineTo(cx + r_inner, cy + r_inner)
    p.lineTo(cx + r_outer, cy)
    p.lineTo(cx + r_inner, cy - r_inner)
    p.lineTo(cx, cy - r_outer)
    p.lineTo(cx - r_inner, cy - r_inner)
    p.lineTo(cx - r_outer, cy)
    p.lineTo(cx - r_inner, cy + r_inner)
    p.close()
    pdf.drawPath(p, stroke=0, fill=1)


def _draw_paper_badge(pdf, cell_x, cell_y, badge_width, badge_height, recipient, event, category_names=None, base_url=None, event_program_types=None, prefetched_assignments=None, prefetched_chest_number=None):
    """
    Renders a single premium full-A4 participant badge matching the official
    Eventloo credential reference model:
      - Top: Centered Event Logo flanked by subtle horizontal separator lines
      - Event Title (bold uppercase) + Letter-spaced School Subtitle
      - Participant Name: Hero bold uppercase title
      - Hero Chest Pill: [ CHEST NO | #2000 ] in deep indigo
      - Three Info Pills: [ ✨ TEAM ] [ ☰ CATEGORY ] [ 📊 CLASS ]
      - Stats Card: Dynamic columns (Total Events + each event program type e.g. On-Stage, Off-Stage, Sports)
        with vector icons, large bold numbers, and two-line labels
      - Bottom: Purple accent bar + "Participant" + Event • School subtitle + architectural watermark
      - Floating QR Card: [ QR Code + "SCAN TO VERIFY" ]
      - Dual-tone Indigo/Purple bottom wave + "Powered by Eventloo |"
    """
    student = recipient.student
    assignment = recipient.assignment
    category_names = category_names or {}

    card_x = cell_x + 3.0
    card_y = cell_y + 3.0
    card_w = badge_width - 6.0
    card_h = badge_height - 6.0
    card_top = card_y + card_h
    card_center_x = card_x + card_w / 2.0

    pdf.saveState()

    # ── 1. White Card Container with rounded corners & border ──
    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.setStrokeColor(HexColor('#CBD5E1'))
    pdf.setLineWidth(0.6)
    pdf.roundRect(card_x, card_y, card_w, card_h, radius=10, stroke=1, fill=1)

    # ── 2. Top-Right Soft Purple Wave Accents ──
    p_tr = pdf.beginPath()
    p_tr.moveTo(card_x + card_w * 0.42, card_top)
    p_tr.curveTo(card_x + card_w * 0.65, card_top - 18, card_x + card_w * 0.8, card_top - 6, card_x + card_w, card_top - 32)
    p_tr.lineTo(card_x + card_w, card_top)
    p_tr.close()
    pdf.setFillColor(HexColor('#EDE9FE'))
    pdf.drawPath(p_tr, stroke=0, fill=1)

    p_tr2 = pdf.beginPath()
    p_tr2.moveTo(card_x + card_w * 0.62, card_top)
    p_tr2.curveTo(card_x + card_w * 0.76, card_top - 12, card_x + card_w * 0.86, card_top - 4, card_x + card_w, card_top - 20)
    p_tr2.lineTo(card_x + card_w, card_top)
    p_tr2.close()
    pdf.setFillColor(HexColor('#DDD6FE'))
    pdf.drawPath(p_tr2, stroke=0, fill=1)

    # ── 3. Bottom Dual-Tone Wave Graphic ──
    # Light violet background wave
    p_wave1 = pdf.beginPath()
    p_wave1.moveTo(card_x, card_y + 24)
    p_wave1.curveTo(card_x + 45, card_y + 34, card_x + 105, card_y + 12, card_x + card_w, card_y + 30)
    p_wave1.lineTo(card_x + card_w, card_y)
    p_wave1.lineTo(card_x, card_y)
    p_wave1.close()
    pdf.setFillColor(HexColor('#C7D2FE'))
    pdf.drawPath(p_wave1, stroke=0, fill=1)

    # Deep rich indigo foreground wave
    p_wave2 = pdf.beginPath()
    p_wave2.moveTo(card_x, card_y + 18)
    p_wave2.curveTo(card_x + 45, card_y + 28, card_x + 100, card_y + 8, card_x + card_w, card_y + 38)
    p_wave2.lineTo(card_x + card_w, card_y)
    p_wave2.lineTo(card_x, card_y)
    p_wave2.close()
    pdf.setFillColor(HexColor('#1E1B4B'))
    pdf.drawPath(p_wave2, stroke=0, fill=1)

    # ── 4. Architectural Watermark in Bottom-Left Background ──
    pdf.saveState()
    pdf.setStrokeColor(HexColor('#F1F5F9'))
    pdf.setLineWidth(0.6)
    tw_base_y = card_y + 14
    # Clock tower body
    pdf.rect(card_x + 82, tw_base_y + 10, 15, 36, stroke=1, fill=0)
    pdf.circle(card_x + 89.5, tw_base_y + 34, 4.0, stroke=1, fill=0)
    p_rf = pdf.beginPath()
    p_rf.moveTo(card_x + 81, tw_base_y + 46)
    p_rf.lineTo(card_x + 89.5, tw_base_y + 54)
    p_rf.lineTo(card_x + 98, tw_base_y + 46)
    p_rf.close()
    pdf.drawPath(p_rf, stroke=1, fill=0)
    # Left building wing
    pdf.rect(card_x + 46, tw_base_y + 6, 36, 18, stroke=1, fill=0)
    pdf.rect(card_x + 50, tw_base_y + 12, 6, 8, stroke=1, fill=0)
    pdf.rect(card_x + 60, tw_base_y + 12, 6, 8, stroke=1, fill=0)
    pdf.rect(card_x + 70, tw_base_y + 12, 6, 8, stroke=1, fill=0)
    # Right building wing
    pdf.rect(card_x + 97, tw_base_y + 6, 36, 18, stroke=1, fill=0)
    pdf.rect(card_x + 101, tw_base_y + 12, 6, 8, stroke=1, fill=0)
    pdf.rect(card_x + 111, tw_base_y + 12, 6, 8, stroke=1, fill=0)
    pdf.rect(card_x + 121, tw_base_y + 12, 6, 8, stroke=1, fill=0)
    pdf.restoreState()

    # Redraw outer border crisp over waves
    pdf.setStrokeColor(HexColor('#CBD5E1'))
    pdf.setLineWidth(0.6)
    pdf.roundRect(card_x, card_y, card_w, card_h, radius=10, stroke=1, fill=0)

    # ── 5. Top Logo & Flanking Horizontal Separator Lines ──
    event_logo_path = _resolve_event_logo_path(event)
    event_title = (event.title or 'EVENT').strip().upper()
    school_name = (event.school.name if event.school else '').strip().upper()

    logo_y_center = card_top - 26.0
    logo_w, logo_h = 32.0, 24.0
    logo_drawn = False

    if event_logo_path:
        try:
            with Image.open(event_logo_path) as im:
                orig_w, orig_h = im.size
            scale_f = min(36.0 / float(orig_w), 26.0 / float(orig_h))
            logo_w = orig_w * scale_f
            logo_h = orig_h * scale_f
            logo_x = card_center_x - logo_w / 2.0
            logo_y = logo_y_center - logo_h / 2.0
            pdf.drawImage(event_logo_path, logo_x, logo_y, width=logo_w, height=logo_h, mask='auto', preserveAspectRatio=True)
            logo_drawn = True
        except Exception as err:
            logger.warning("Badge logo render failed: %s", err)
            logo_drawn = False

    if not logo_drawn:
        pdf.setFillColor(HexColor('#EEF2FF'))
        pdf.setStrokeColor(HexColor('#C7D2FE'))
        pdf.setLineWidth(0.8)
        pdf.circle(card_center_x, logo_y_center, 12.0, stroke=1, fill=1)
        pdf.setFont('Helvetica-Bold', 10.0)
        pdf.setFillColor(HexColor('#4338CA'))
        pdf.drawCentredString(card_center_x, logo_y_center - 3.5, event_title[:1])
        logo_w = 26.0

    # Horizontal divider lines on left and right of logo: ——— [LOGO] ———
    pdf.setStrokeColor(HexColor('#CBD5E1'))
    pdf.setLineWidth(0.5)
    line_y = logo_y_center
    gap = (logo_w / 2.0 + 8.0)
    pdf.line(card_x + 18.0, line_y, card_center_x - gap, line_y)
    pdf.line(card_center_x + gap, line_y, card_x + card_w - 18.0, line_y)

    # ── 6. Event Title & Subtitle ──
    y_event_title = card_top - 44.0
    pdf.setFont('Helvetica-Bold', 12.5)
    pdf.setFillColor(HexColor('#0F172A'))
    pdf.drawCentredString(card_center_x, y_event_title, event_title)

    y_sub = y_event_title - 9.0
    pdf.setFont('Helvetica', 4.8)
    pdf.setFillColor(HexColor('#64748B'))
    sub_title = school_name or 'ANNUAL LITERARY FEST'
    spaced_sub = '   '.join(list(sub_title))
    if stringWidth(spaced_sub, 'Helvetica', 4.8) > (card_w - 24.0):
        spaced_sub = ' '.join(list(sub_title))
        if stringWidth(spaced_sub, 'Helvetica', 4.8) > (card_w - 24.0):
            spaced_sub = sub_title
    pdf.drawCentredString(card_center_x, y_sub, spaced_sub)

    # ── 7. Participant Name (Hero Title) ──
    y_name = y_sub - 22.0
    name = (student.get_full_name() or student.display_name or 'Participant').strip()
    name_len = len(name)
    if name_len > 24:
        f_size = 11.5
    elif name_len > 18:
        f_size = 13.5
    elif name_len > 12:
        f_size = 15.5
    else:
        f_size = 18.0
    pdf.setFont('Helvetica-Bold', f_size)
    pdf.setFillColor(HexColor('#0F172A'))
    pdf.drawCentredString(card_center_x, y_name, name.upper())

    # ── 8. Hero Chest Number Pill: [ CHEST NO | #2000 ] ──
    chest_number = prefetched_chest_number
    if not chest_number and assignment:
        chest_number = assignment.chest_number
    if not chest_number:
        try:
            chest_number = ChestNumber.objects.filter(event=event, student=student).values_list(
                'chest_number', flat=True
            ).first()
        except Exception:
            chest_number = None
    if not chest_number:
        chest_number = getattr(student, 'student_id', 'N/A')
    chest_str = str(chest_number) if chest_number else 'N/A'

    y_pill = y_name - 22.0
    pill_w = 100.0
    pill_h = 16.5
    pill_x = card_center_x - pill_w / 2.0
    pdf.setFillColor(HexColor('#1E1B4B'))
    pdf.roundRect(pill_x, y_pill, pill_w, pill_h, radius=8.25, stroke=0, fill=1)

    pdf.setFont('Helvetica-Bold', 6.0)
    pdf.setFillColor(HexColor('#C7D2FE'))
    pdf.drawString(pill_x + 13.0, y_pill + 5.2, 'CHEST NO')

    pdf.setStrokeColor(HexColor('#4338CA'))
    pdf.setLineWidth(0.6)
    pdf.line(pill_x + 50.0, y_pill + 3.0, pill_x + 50.0, y_pill + pill_h - 3.0)

    chest_display = f'#{chest_str}'
    pdf.setFont('Helvetica-Bold', 8.5)
    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.drawString(pill_x + 59.0, y_pill + 4.8, chest_display)

    # ── 9. Three Info Pills Row: [ ✨ TEAM ] [ ☰ CATEGORY ] [ 📊 GRADE ] ──
    y_meta = y_pill - 21.0
    meta_pill_w = 52.0
    meta_pill_h = 15.0
    gap_pills = (card_w - 16.0 - 3 * meta_pill_w) / 2.0
    p1_x = card_x + 8.0
    p2_x = p1_x + meta_pill_w + gap_pills
    p3_x = p2_x + meta_pill_w + gap_pills

    # Team
    team_name = ''
    if assignment and assignment.team:
        team_name = assignment.team.name
    elif hasattr(student, 'team_memberships') and student.team_memberships.exists():
        first_tm = student.team_memberships.first()
        team_name = getattr(first_tm, 'name', '') or ''
    if not team_name:
        team_name = 'INDIVIDUAL'

    # Category
    cat_code = (student.category or (assignment.program.category if assignment and assignment.program else '') or '').strip()
    cat_name = category_names.get(cat_code) or category_names.get(cat_code.lower()) or category_names.get(cat_code.upper()) or cat_code
    category_display = (cat_name if cat_name else 'GENERAL').upper()

    # Grade / Section
    grade = getattr(student, 'grade', '') or ''
    section = getattr(student, 'section', '') or ''
    if grade and section:
        grade_sec = f"Grade {grade}{section}"
    elif grade:
        grade_sec = f"Grade {grade}"
    elif getattr(student, 'student_id', None):
        grade_sec = f"ID: {student.student_id}"
    else:
        grade_sec = getattr(student, 'gender', 'Student').title()

    pills_data = [
        (p1_x, team_name.upper(), 'star', '#7C3AED'),
        (p2_x, category_display, 'layers', '#7C3AED'),
        (p3_x, grade_sec, 'chart', '#4F46E5'),
    ]

    for px, ptext, icon_type, icon_color in pills_data:
        pdf.setFillColor(HexColor('#FFFFFF'))
        pdf.setStrokeColor(HexColor('#CBD5E1'))
        pdf.setLineWidth(0.5)
        pdf.roundRect(px, y_meta, meta_pill_w, meta_pill_h, radius=5, stroke=1, fill=1)

        ic_cx = px + 8.0
        ic_cy = y_meta + meta_pill_h / 2.0

        if icon_type == 'star':
            # Double sparkle star ✨
            _draw_badge_star(pdf, ic_cx - 1.0, ic_cy, 2.8, 0.8, icon_color)
            _draw_badge_star(pdf, ic_cx + 2.5, ic_cy + 2.2, 1.4, 0.4, icon_color)
        elif icon_type == 'layers':
            # 3 stacked rounded layers
            pdf.setFillColor(HexColor(icon_color))
            pdf.roundRect(ic_cx - 2.8, ic_cy + 1.8, 5.6, 1.2, radius=0.4, stroke=0, fill=1)
            pdf.roundRect(ic_cx - 2.8, ic_cy - 0.6, 5.6, 1.2, radius=0.4, stroke=0, fill=1)
            pdf.roundRect(ic_cx - 2.8, ic_cy - 3.0, 5.6, 1.2, radius=0.4, stroke=0, fill=1)
        elif icon_type == 'chart':
            # 3 vertical ascending bars
            pdf.setFillColor(HexColor(icon_color))
            pdf.roundRect(ic_cx - 2.8, ic_cy - 3.0, 1.4, 2.5, radius=0.3, stroke=0, fill=1)
            pdf.roundRect(ic_cx - 0.7, ic_cy - 3.0, 1.4, 4.5, radius=0.3, stroke=0, fill=1)
            pdf.roundRect(ic_cx + 1.4, ic_cy - 3.0, 1.4, 6.0, radius=0.3, stroke=0, fill=1)

        # Pill text
        pdf.setFont('Helvetica-Bold', 5.2)
        pdf.setFillColor(HexColor('#0F172A'))
        clean_text = str(ptext).strip()
        avail_w = meta_pill_w - 16.0
        while stringWidth(clean_text, 'Helvetica-Bold', 5.2) > avail_w and len(clean_text) > 2:
            clean_text = clean_text[:-1]
        pdf.drawString(px + 14.0, y_meta + 4.8, clean_text)

    # ── 10. Dynamic Stats Card (Total Events + Event Program Types) ──
    if event_program_types is None:
        event_program_types = list(event.get_program_types())

    type_by_code = {}
    for pt in event_program_types:
        norm = (pt.code or '').lower().replace(' ', '_').replace('-', '_')
        type_by_code[norm] = pt
        type_by_code[pt.code] = pt

    if prefetched_assignments is not None:
        assignments_list = prefetched_assignments
    else:
        try:
            assignments_list = list(
                ProgramAssignment.objects.filter(
                    student=student, program__event=event
                ).select_related('program', 'program__stage').order_by('program__start_time', 'program__name')
            )
        except Exception:
            assignments_list = []

    if not assignments_list and assignment and getattr(assignment, 'program', None):
        assignments_list = [assignment]

    seen_progs = set()
    type_counts = {pt.code: 0 for pt in event_program_types}

    for pa in assignments_list:
        p = getattr(pa, 'program', None)
        if p and p.id not in seen_progs:
            seen_progs.add(p.id)
            p_type = getattr(p, 'program_type', None) or ('stage' if getattr(p, 'is_stage', False) else 'off_stage')
            p_type_norm = (p_type or 'stage').lower().replace(' ', '_').replace('-', '_')
            pt_match = type_by_code.get(p_type_norm) or type_by_code.get(p_type)
            if pt_match:
                type_counts[pt_match.code] = type_counts.get(pt_match.code, 0) + 1
            else:
                if getattr(p, 'is_stage', False) or p_type_norm in ('stage', 'onstage'):
                    if 'stage' in type_counts:
                        type_counts['stage'] = type_counts.get('stage', 0) + 1
                else:
                    if 'off_stage' in type_counts:
                        type_counts['off_stage'] = type_counts.get('off_stage', 0) + 1

    total_count = len(seen_progs)

    # Dynamic Stats Columns:
    # 1. Total Events is ALWAYS first
    cols_to_show = [('calendar', total_count, 'Total', 'Events', '#6366F1')]

    # 2. Add each program type that exists for the event (e.g. On-Stage, Off-Stage, Sports)
    for pt in event_program_types:
        c = type_counts.get(pt.code, 0)
        pt_name = (pt.name or pt.code or '').strip()
        code_lower = (pt.code or '').lower()
        name_lower = pt_name.lower()

        if 'stage' in code_lower and 'off' not in code_lower:
            ic_type = 'lightning'
            def_col = '#4F46E5'
        elif 'off' in code_lower or 'off' in name_lower:
            ic_type = 'layers'
            def_col = '#7C3AED'
        elif 'sport' in code_lower or 'sport' in name_lower or 'game' in code_lower:
            ic_type = 'trophy'
            def_col = '#D97706'
        else:
            ic_type = 'star'
            def_col = '#6366F1'

        pt_color = _normalize_color(getattr(pt, 'color', None)) or def_col

        if name_lower.endswith(' events') or name_lower.endswith(' event'):
            l1 = pt_name.rsplit(' ', 1)[0].title()
            l2 = 'Events'
        elif ' ' in pt_name:
            parts = pt_name.split()
            l1 = parts[0].title()
            l2 = ' '.join(parts[1:]).title()
        else:
            l1 = pt_name.title()
            l2 = 'Events'

        cols_to_show.append((ic_type, c, l1, l2, pt_color))

    if len(cols_to_show) > 4:
        cols_to_show = cols_to_show[:4]

    stats_card_x = card_x + 8.0
    stats_card_y = y_meta - 45.0
    stats_card_w = card_w - 16.0
    stats_card_h = 38.0

    pdf.setFillColor(HexColor('#F8FAFC'))
    pdf.setStrokeColor(HexColor('#E2E8F0'))
    pdf.setLineWidth(0.6)
    pdf.roundRect(stats_card_x, stats_card_y, stats_card_w, stats_card_h, radius=7, stroke=1, fill=1)

    col_w = stats_card_w / float(len(cols_to_show))
    for i, (ic_type, val, l1, l2, col_hex) in enumerate(cols_to_show):
        cx = stats_card_x + i * col_w + col_w / 2.0
        ic_y = stats_card_y + stats_card_h - 7.5

        if ic_type == 'calendar':
            pdf.setStrokeColor(HexColor(col_hex))
            pdf.setLineWidth(0.6)
            pdf.roundRect(cx - 3.5, ic_y - 4.0, 7.0, 6.0, radius=0.8, stroke=1, fill=0)
            pdf.line(cx - 3.5, ic_y - 0.5, cx + 3.5, ic_y - 0.5)
            pdf.line(cx - 2.0, ic_y + 2.0, cx - 2.0, ic_y + 3.2)
            pdf.line(cx + 2.0, ic_y + 2.0, cx + 2.0, ic_y + 3.2)
        elif ic_type == 'lightning':
            pdf.setFillColor(HexColor(col_hex))
            p_lt = pdf.beginPath()
            p_lt.moveTo(cx + 0.6, ic_y + 3.2)
            p_lt.lineTo(cx - 2.2, ic_y - 0.2)
            p_lt.lineTo(cx - 0.2, ic_y - 0.2)
            p_lt.lineTo(cx - 0.8, ic_y - 4.0)
            p_lt.lineTo(cx + 2.2, ic_y - 0.6)
            p_lt.lineTo(cx + 0.2, ic_y - 0.6)
            p_lt.close()
            pdf.drawPath(p_lt, stroke=0, fill=1)
        elif ic_type == 'layers':
            pdf.setFillColor(HexColor(col_hex))
            for dy in [2.2, -0.3, -2.8]:
                p_dia = pdf.beginPath()
                p_dia.moveTo(cx, ic_y + dy + 1.2)
                p_dia.lineTo(cx + 3.5, ic_y + dy)
                p_dia.lineTo(cx, ic_y + dy - 1.2)
                p_dia.lineTo(cx - 3.5, ic_y + dy)
                p_dia.close()
                pdf.drawPath(p_dia, stroke=0, fill=1)
        elif ic_type == 'trophy':
            pdf.setFillColor(HexColor(col_hex))
            p_cup = pdf.beginPath()
            p_cup.moveTo(cx - 2.8, ic_y + 2.5)
            p_cup.lineTo(cx + 2.8, ic_y + 2.5)
            p_cup.curveTo(cx + 2.5, ic_y - 0.5, cx + 1.2, ic_y - 1.5, cx, ic_y - 1.5)
            p_cup.curveTo(cx - 1.2, ic_y - 1.5, cx - 2.5, ic_y - 0.5, cx - 2.8, ic_y + 2.5)
            p_cup.close()
            pdf.drawPath(p_cup, stroke=0, fill=1)
            pdf.rect(cx - 0.8, ic_y - 3.0, 1.6, 1.5, stroke=0, fill=1)
            pdf.rect(cx - 2.5, ic_y - 4.0, 5.0, 1.0, stroke=0, fill=1)
        else:
            # Fallback sparkle star
            _draw_badge_star(pdf, cx, ic_y, 3.0, 1.0, col_hex)

        # Number (large bold)
        pdf.setFont('Helvetica-Bold', 12.0)
        pdf.setFillColor(HexColor('#0F172A'))
        pdf.drawCentredString(cx, stats_card_y + 15.5, str(val))

        # Two-line label
        pdf.setFont('Helvetica', 4.2)
        pdf.setFillColor(HexColor('#64748B'))
        pdf.drawCentredString(cx, stats_card_y + 9.5, l1)
        pdf.drawCentredString(cx, stats_card_y + 5.0, l2)

        # Column divider
        if i > 0:
            div_x = stats_card_x + i * col_w
            pdf.setStrokeColor(HexColor('#E2E8F0'))
            pdf.setLineWidth(0.5)
            pdf.line(div_x, stats_card_y + 4.0, div_x, stats_card_y + stats_card_h - 4.0)

    # ── 11. Bottom Section: Participant & QR Code ──
    y_part_bar = stats_card_y - 20.0
    pdf.setFillColor(HexColor('#4F46E5'))
    pdf.roundRect(card_x + 10.0, y_part_bar, 14.0, 2.2, radius=1.1, stroke=0, fill=1)

    y_part_title = y_part_bar - 11.0
    pdf.setFont('Helvetica-Bold', 11.0)
    pdf.setFillColor(HexColor('#0F172A'))
    pdf.drawString(card_x + 10.0, y_part_title, 'Participant')

    y_part_sub = y_part_title - 8.0
    pdf.setFont('Helvetica', 4.5)
    pdf.setFillColor(HexColor('#64748B'))
    part_sub_str = f'{event_title}  \u2022  {school_name}'
    if stringWidth(part_sub_str, 'Helvetica', 4.5) > 90.0:
        part_sub_str = event_title
    pdf.drawString(card_x + 10.0, y_part_sub, part_sub_str)

    # Floating QR Code Card (bottom-right)
    qr_card_w = 46.0
    qr_card_h = 56.0
    qr_card_x = card_x + card_w - qr_card_w - 9.0
    qr_card_y = card_y + 10.0

    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.setStrokeColor(HexColor('#CBD5E1'))
    pdf.setLineWidth(0.6)
    pdf.roundRect(qr_card_x, qr_card_y, qr_card_w, qr_card_h, radius=6.0, stroke=1, fill=1)

    effective_base = base_url
    if not effective_base:
        from django.conf import settings
        origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
        prod_origins = [o for o in origins if 'eventloo' in o and o.startswith('https')]
        if prod_origins:
            effective_base = prod_origins[0]
        elif origins:
            effective_base = origins[0]
        else:
            effective_base = ''
    qr_target_url = f"{effective_base.rstrip('/')}/events/{event.id}/badge/{student.id}" if effective_base else f"/events/{event.id}/badge/{student.id}"

    qr_size = 36.0
    try:
        qr = QrCodeWidget(qr_target_url)
        qr.barWidth = qr_size
        qr.barHeight = qr_size
        qr.barBorder = 0
        d = Drawing(qr_size, qr_size)
        d.add(qr)
        qr_draw_x = qr_card_x + (qr_card_w - qr_size) / 2.0
        qr_draw_y = qr_card_y + 13.0
        renderPDF.draw(d, pdf, qr_draw_x, qr_draw_y)
    except Exception as qr_err:
        logger.warning("Badge QR generation failed: %s", qr_err)

    pdf.setFont('Helvetica-Bold', 4.5)
    pdf.setFillColor(HexColor('#312E81'))
    pdf.drawCentredString(qr_card_x + qr_card_w / 2.0, qr_card_y + 5.0, 'SCAN TO VERIFY')

    # ── 12. Bottom Wave Footer: Powered by Eventloo ──
    eventloo_icon_path = _resolve_eventloo_icon_path()
    f_x = card_x + 10.0
    f_y = card_y + 7.5
    icon_offset = 0.0
    if eventloo_icon_path:
        try:
            pdf.drawImage(eventloo_icon_path, f_x, f_y, width=8, height=8, mask='auto', preserveAspectRatio=True)
            icon_offset = 12.0
        except Exception as icon_err:
            logger.warning("Eventloo badge icon draw failed: %s", icon_err)
            icon_offset = 0.0

    if icon_offset == 0.0:
        pdf.saveState()
        pdf.setFillColor(HexColor('#38BDF8'))
        pdf.circle(f_x + 2.5, f_y + 2.5, 2.2, stroke=0, fill=1)
        pdf.setFillColor(HexColor('#818CF8'))
        pdf.circle(f_x + 5.5, f_y + 2.5, 2.2, stroke=0, fill=1)
        pdf.setFillColor(HexColor('#6366F1'))
        pdf.circle(f_x + 4.0, f_y + 2.5, 1.5, stroke=0, fill=1)
        pdf.restoreState()
        icon_offset = 12.0

    pdf.setFont('Helvetica', 4.8)
    pdf.setFillColor(HexColor('#94A3B8'))
    pdf.drawString(f_x + icon_offset, f_y + 1.2, 'Powered by ')
    pw = stringWidth('Powered by ', 'Helvetica', 4.8)
    pdf.setFont('Helvetica-Bold', 5.2)
    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.drawString(f_x + icon_offset + pw, f_y + 1.2, 'Eventloo')
    ew = stringWidth('Eventloo', 'Helvetica-Bold', 5.2)

    pdf.setStrokeColor(HexColor('#475569'))
    pdf.setLineWidth(0.4)
    pdf.line(f_x + icon_offset + pw + ew + 8.0, f_y, f_x + icon_offset + pw + ew + 8.0, f_y + 6.0)

    pdf.restoreState()


def render_certificates_pdf(event, templates_by_type, recipients, quality='standard', base_url=None):
    if quality not in ('screen', 'standard', 'print'):
        raise ValidationError('Unsupported certificate quality.')
    if not recipients:
        raise ValidationError('No eligible certificate recipients match the selected filters.')

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pageCompression=1)
    pdf.setTitle(f'{event.title} Documents')
    pdf.setAuthor(event.school.name)
    category_names = event_category_names(event)
    prepared_images = {}

    badge_recipients = [r for r in recipients if r.certificate_type == 'badge']
    other_recipients = [r for r in recipients if r.certificate_type != 'badge']

    # 1. Non-badge certificates (1 per page, standard A4 landscape or portrait)
    for recipient in other_recipients:
        template = templates_by_type[recipient.certificate_type]
        fields = normalize_certificate_fields(template.fields)
        aspect_ratio = template.aspect_ratio or (
            template.natural_width / template.natural_height
            if template.natural_width and template.natural_height else 4 / 3
        )
        page_width, page_height = _page_size(aspect_ratio)
        pdf.setPageSize((page_width, page_height))

        if template.id not in prepared_images:
            prepared_images[template.id] = _prepare_background(template, quality)
        background = prepared_images[template.id]
        background.seek(0)
        pdf.drawImage(ImageReader(background), 0, 0, page_width, page_height, preserveAspectRatio=False)

        values = certificate_field_values(recipient, event, category_names)
        for field_id, field in fields.items():
            if field.get('enabled'):
                _draw_field(
                    pdf, field, values.get(field_id, field.get('sample', '')),
                    box_x=0, box_y=0, box_width=page_width, box_height=page_height,
                    reference_width=672.0
                )
        pdf.showPage()

    # 2. Badges (1 single full A4 badge per page)
    if badge_recipients:
        page_width, page_height = portrait(A4)
        badge_ref_w = 186.0
        badge_ref_h = 266.0
        scale = min((page_width - 48.0) / badge_ref_w, (page_height - 48.0) / badge_ref_h)
        draw_w = badge_ref_w * scale
        draw_h = badge_ref_h * scale
        offset_x = (page_width - draw_w) / 2.0
        offset_y = (page_height - draw_h) / 2.0
        event_program_types = list(event.get_program_types())

        # Batch prefetch student assignments and chest numbers for badge recipients
        student_ids = [r.student.id for r in badge_recipients if hasattr(r.student, 'id') and r.student.id]
        assignments_by_student = {}
        chest_numbers_by_student = {}
        if student_ids:
            try:
                pa_qs = ProgramAssignment.objects.filter(
                    student_id__in=student_ids, program__event=event
                ).select_related('program', 'program__stage').order_by('program__start_time', 'program__name')
                for pa in pa_qs:
                    assignments_by_student.setdefault(pa.student_id, []).append(pa)
            except Exception as e:
                logger.warning("Batch assignments prefetch failed: %s", e)

            try:
                chest_numbers_by_student = dict(
                    ChestNumber.objects.filter(event=event, student_id__in=student_ids).values_list('student_id', 'chest_number')
                )
            except Exception as e:
                logger.warning("Batch chest numbers prefetch failed: %s", e)

        for recipient in badge_recipients:
            pdf.setPageSize((page_width, page_height))
            pdf.saveState()
            pdf.translate(offset_x, offset_y)
            pdf.scale(scale, scale)
            rec_student_id = getattr(recipient.student, 'id', None)
            _draw_paper_badge(
                pdf, 0, 0, badge_ref_w, badge_ref_h,
                recipient, event, category_names, base_url=base_url,
                event_program_types=event_program_types,
                prefetched_assignments=assignments_by_student.get(rec_student_id),
                prefetched_chest_number=chest_numbers_by_student.get(rec_student_id),
            )
            pdf.restoreState()
            pdf.showPage()

    pdf.save()
    buffer.seek(0)
    return buffer
