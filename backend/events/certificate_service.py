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


def _draw_paper_badge(pdf, cell_x, cell_y, badge_width, badge_height, recipient, event, category_names=None, base_url=None, event_program_types=None, prefetched_assignments=None, prefetched_chest_number=None):
    """
    Renders a single high-quality participant paper badge (1 of 9 per A4 sheet)
    matching the official Eventloo physical credential model reference:
      - Top: —— Eventloo ——
      - Festival: FESTIVAL : [EVENT NAME]
      - Participant Name: [NAME]
      - Hero Chest Pill: [ CHEST NO | #1000 ]
      - Metadata: [ TEAM ] [ CATEGORY ] [ GRADE / SECTION ]
      - Divider
      - Left: PROGRAMS bullet list
      - Right: Dynamic Stats columns (Total Events, Stage, Off-Stage, Sports, etc.)
      - Bottom Right: Official verification QR code to participant digital badge
      - Bottom: Smooth dual-tone wave graphic in Eventloo Indigo
    """
    student = recipient.student
    assignment = recipient.assignment
    category_names = category_names or {}

    card_x = cell_x + 3.0
    card_y = cell_y + 3.0
    card_w = badge_width - 6.0    # 180.0 pt
    card_h = badge_height - 6.0   # 260.0 pt
    card_top = card_y + card_h
    card_center_x = card_x + card_w / 2.0

    pdf.saveState()

    # 1. White Card Background
    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.setStrokeColor(HexColor('#E2E8F0'))
    pdf.setLineWidth(0.6)
    pdf.roundRect(card_x, card_y, card_w, card_h, radius=8, stroke=1, fill=1)

    # 2. Dual-Tone Vector Wave Graphic at Bottom
    # Light Wave (Indigo-200 / #C7D2FE)
    p_wave1 = pdf.beginPath()
    p_wave1.moveTo(card_x, card_y + 24)
    p_wave1.curveTo(card_x + 50, card_y + 34, card_x + 110, card_y + 12, card_x + card_w, card_y + 26)
    p_wave1.lineTo(card_x + card_w, card_y)
    p_wave1.lineTo(card_x, card_y)
    p_wave1.close()
    pdf.setFillColor(HexColor('#C7D2FE'))
    pdf.drawPath(p_wave1, stroke=0, fill=1)

    # Foreground Dark Wave (Deep Indigo / #312E81)
    p_wave2 = pdf.beginPath()
    p_wave2.moveTo(card_x, card_y + 20)
    p_wave2.curveTo(card_x + 60, card_y + 26, card_x + 115, card_y + 8, card_x + card_w, card_y + 30)
    p_wave2.lineTo(card_x + card_w, card_y)
    p_wave2.lineTo(card_x, card_y)
    p_wave2.close()
    pdf.setFillColor(HexColor('#312E81'))
    pdf.drawPath(p_wave2, stroke=0, fill=1)

    # Card border redraw to keep corners crisp over waves
    pdf.setStrokeColor(HexColor('#CBD5E1'))
    pdf.setLineWidth(0.5)
    pdf.roundRect(card_x, card_y, card_w, card_h, radius=8, stroke=1, fill=0)

    # 3. Top Header: Event Logo + Event Name (Clean Title, No "FESTIVAL : ")
    event_logo_path = _resolve_event_logo_path(event)
    event_title = (event.title or 'EVENT').strip().upper()

    if event_logo_path:
        try:
            with Image.open(event_logo_path) as im:
                orig_w, orig_h = im.size
            box_w, box_h = 34.0, 20.0
            scale = min(box_w / float(orig_w), box_h / float(orig_h))
            logo_w = orig_w * scale
            logo_h = orig_h * scale
            logo_cy = card_top - 18.0
            logo_x = card_center_x - logo_w / 2.0
            logo_y = logo_cy - logo_h / 2.0
            pdf.drawImage(event_logo_path, logo_x, logo_y, width=logo_w, height=logo_h, mask='auto', preserveAspectRatio=True)

            # Flanking subtle divider lines
            pdf.setStrokeColor(HexColor('#CBD5E1'))
            pdf.setLineWidth(0.5)
            pdf.line(card_x + 16, logo_cy, logo_x - 6, logo_cy)
            pdf.line(logo_x + logo_w + 6, logo_cy, card_x + card_w - 16, logo_cy)
        except Exception as err:
            logger.warning("Failed to render event logo on badge: %s", err)
            event_logo_path = None

    if not event_logo_path:
        y_title = card_top - 24.0
        t_size = 9.5 if len(event_title) <= 20 else 8.0
        max_title_w = card_w - 48.0
        while t_size > 6.0 and stringWidth(event_title, 'Helvetica-Bold', t_size) > max_title_w:
            t_size -= 0.5
        if stringWidth(event_title, 'Helvetica-Bold', t_size) > max_title_w:
            while event_title and stringWidth(event_title + '…', 'Helvetica-Bold', t_size) > max_title_w:
                event_title = event_title[:-1]
            event_title += '…'
        t_w = stringWidth(event_title, 'Helvetica-Bold', t_size)
        pdf.setStrokeColor(HexColor('#CBD5E1'))
        pdf.setLineWidth(0.5)
        pdf.line(card_x + 16, y_title + 3, card_center_x - t_w / 2.0 - 6, y_title + 3)
        pdf.line(card_center_x + t_w / 2.0 + 6, y_title + 3, card_x + card_w - 16, y_title + 3)
        pdf.setFont('Helvetica-Bold', t_size)
        pdf.setFillColor(HexColor('#0F172A'))
        pdf.drawCentredString(card_center_x, y_title, event_title)
    else:
        y_title = card_top - 36.0
        t_size = 8.5 if len(event_title) <= 20 else (7.5 if len(event_title) <= 30 else 6.5)
        max_title_w = card_w - 24.0
        while t_size > 5.5 and stringWidth(event_title, 'Helvetica-Bold', t_size) > max_title_w:
            t_size -= 0.5
        if stringWidth(event_title, 'Helvetica-Bold', t_size) > max_title_w:
            while event_title and stringWidth(event_title + '…', 'Helvetica-Bold', t_size) > max_title_w:
                event_title = event_title[:-1]
            event_title += '…'
        pdf.setFont('Helvetica-Bold', t_size)
        pdf.setFillColor(HexColor('#0F172A'))
        pdf.drawCentredString(card_center_x, y_title, event_title)

    # 4. Participant Name
    y_name = card_top - 66
    name = (student.get_full_name() or student.display_name or 'Participant').strip()
    name_len = len(name)
    if name_len > 24:
        f_size = 9.0
    elif name_len > 18:
        f_size = 10.5
    else:
        f_size = 13.0
    pdf.setFont('Helvetica-Bold', f_size)
    pdf.setFillColor(HexColor('#0F172A'))
    pdf.drawCentredString(card_center_x, y_name, name.upper())

    # 6. Hero Chest Number Pill: [ CHEST NO | #1000 ]
    chest_number = prefetched_chest_number if prefetched_chest_number is not None else (assignment.chest_number if assignment else None)
    if not chest_number:
        chest_number = ChestNumber.objects.filter(event=event, student=student).values_list(
            'chest_number', flat=True
        ).first()
    chest_str = str(chest_number) if chest_number else 'N/A'

    y_pill = card_top - 98
    pill_w = 98.0
    pill_h = 18.0
    pill_x = card_center_x - pill_w / 2.0
    pdf.setFillColor(HexColor('#1E1B4B'))
    pdf.roundRect(pill_x, y_pill, pill_w, pill_h, radius=9, stroke=0, fill=1)

    pdf.setFont('Helvetica-Bold', 5.5)
    pdf.setFillColor(HexColor('#C7D2FE'))
    pdf.drawString(pill_x + 10, y_pill + 5.5, 'CHEST NO')

    pdf.setStrokeColor(HexColor('#4338CA'))
    pdf.setLineWidth(0.6)
    pdf.line(pill_x + 47, y_pill + 3.5, pill_x + 47, y_pill + 14.5)

    pdf.setFont('Helvetica-Bold', 9)
    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.drawString(pill_x + 54, y_pill + 5, f'#{chest_str}')

    # 7. Metadata Badges Row: [ TEAM ] [ CATEGORY ] [ GRADE / SECTION ]
    y_badges = card_top - 124
    badge_item_w = 50.0
    badge_item_h = 15.0

    # Team
    team_name = assignment.team.name if assignment and assignment.team else (
        student.team_memberships.first().name if hasattr(student, 'team_memberships') and student.team_memberships.exists() else 'INDIVIDUAL'
    )

    # Category (prefer clean category code e.g. LP, UP, HS matching reference model)
    cat_code = (student.category or (assignment.program.category if assignment and assignment.program else '') or '').strip()
    if cat_code and len(cat_code) <= 5:
        category_display = cat_code.upper()
    else:
        cat_name = category_names.get(cat_code) or category_names.get(cat_code.lower()) or category_names.get(cat_code.upper()) or cat_code
        if cat_name and len(cat_name) <= 10:
            category_display = cat_name.upper()
        elif cat_code:
            category_display = cat_code.upper()
        else:
            category_display = 'GENERAL'

    # Grade / Section
    grade = getattr(student, 'grade', '') or ''
    section = getattr(student, 'section', '') or ''
    classroom = getattr(student, 'classroom', None)
    if classroom:
        c_name = getattr(classroom, 'name', '') or ''
        c_sec = getattr(classroom, 'section', '') or ''
        grade_sec = f"{c_name} {c_sec}".strip()
    elif grade and section:
        grade_sec = f"Grade {grade} - {section}"
    elif grade:
        grade_sec = f"Grade {grade}"
    elif getattr(student, 'student_id', None):
        grade_sec = f"ID: {student.student_id}"
    else:
        grade_sec = getattr(student, 'gender', 'Student').title()

    pills_data = [
        (card_x + 8.0, team_name.upper(), 'team'),
        (card_x + 64.0, category_display, 'category'),
        (card_x + 120.0, grade_sec, 'class')
    ]
    pill_w = 52.0
    pill_h = 16.0
    y_badges = card_top - 124.0

    for px, ptext, ptype in pills_data:
        # Background pill with soft light tint and subtle border
        pdf.setFillColor(HexColor('#F8FAFC'))
        pdf.setStrokeColor(HexColor('#DDE2F8'))
        pdf.setLineWidth(0.6)
        pdf.roundRect(px, y_badges, pill_w, pill_h, radius=5, stroke=1, fill=1)

        cy = y_badges + pill_h / 2.0

        # Calculate text width and center icon + text group
        clean_text = str(ptext).strip()
        max_t_w = pill_w - 18.0

        t_size = 5.2
        while t_size > 4.2 and stringWidth(clean_text, 'Helvetica-Bold', t_size) > max_t_w:
            t_size -= 0.3
        if stringWidth(clean_text, 'Helvetica-Bold', t_size) > max_t_w:
            while clean_text and stringWidth(clean_text + '…', 'Helvetica-Bold', t_size) > max_t_w:
                clean_text = clean_text[:-1]
            clean_text += '…'

        t_w = stringWidth(clean_text, 'Helvetica-Bold', t_size)
        total_w = 7.0 + 3.0 + t_w
        if total_w < pill_w - 4.0:
            start_x = px + (pill_w - total_w) / 2.0
            icon_cx = start_x + 3.5
            text_x = start_x + 9.5
        else:
            icon_cx = px + 6.5
            text_x = px + 13.5

        # Vector icons matching reference model
        if ptype == 'team':
            # Trophy icon
            pdf.setStrokeColor(HexColor('#4338CA'))
            pdf.setFillColor(HexColor('#4338CA'))
            pdf.setLineWidth(0.6)
            p_cup = pdf.beginPath()
            p_cup.moveTo(icon_cx - 2.6, cy + 3.0)
            p_cup.lineTo(icon_cx + 2.6, cy + 3.0)
            p_cup.lineTo(icon_cx + 2.0, cy + 0.4)
            p_cup.curveTo(icon_cx + 1.6, cy - 1.4, icon_cx - 1.6, cy - 1.4, icon_cx - 2.0, cy + 0.4)
            p_cup.close()
            pdf.drawPath(p_cup, stroke=1, fill=0)
            p_h1 = pdf.beginPath()
            p_h1.moveTo(icon_cx - 2.4, cy + 2.6)
            p_h1.curveTo(icon_cx - 4.0, cy + 2.6, icon_cx - 4.0, cy + 0.6, icon_cx - 1.8, cy + 0.4)
            pdf.drawPath(p_h1, stroke=1, fill=0)
            p_h2 = pdf.beginPath()
            p_h2.moveTo(icon_cx + 2.4, cy + 2.6)
            p_h2.curveTo(icon_cx + 4.0, cy + 2.6, icon_cx + 4.0, cy + 0.6, icon_cx + 1.8, cy + 0.4)
            pdf.drawPath(p_h2, stroke=1, fill=0)
            pdf.line(icon_cx, cy - 1.4, icon_cx, cy - 3.2)
            pdf.line(icon_cx - 2.0, cy - 3.2, icon_cx + 2.0, cy - 3.2)
        elif ptype == 'category':
            # 3-layer stacked diamonds icon
            pdf.setStrokeColor(HexColor('#4338CA'))
            pdf.setLineWidth(0.6)
            p_d1 = pdf.beginPath()
            p_d1.moveTo(icon_cx, cy + 3.2)
            p_d1.lineTo(icon_cx + 3.0, cy + 1.6)
            p_d1.lineTo(icon_cx, cy + 0.0)
            p_d1.lineTo(icon_cx - 3.0, cy + 1.6)
            p_d1.close()
            pdf.drawPath(p_d1, stroke=1, fill=0)
            p_d2 = pdf.beginPath()
            p_d2.moveTo(icon_cx - 3.0, cy - 0.4)
            p_d2.lineTo(icon_cx, cy - 2.0)
            p_d2.lineTo(icon_cx + 3.0, cy - 0.4)
            pdf.drawPath(p_d2, stroke=1, fill=0)
            p_d3 = pdf.beginPath()
            p_d3.moveTo(icon_cx - 3.0, cy - 2.2)
            p_d3.lineTo(icon_cx, cy - 3.8)
            p_d3.lineTo(icon_cx + 3.0, cy - 2.2)
            pdf.drawPath(p_d3, stroke=1, fill=0)
        else:
            # Medal rosette with ribbon tails icon
            pdf.setStrokeColor(HexColor('#4338CA'))
            pdf.setLineWidth(0.6)
            pdf.circle(icon_cx, cy + 0.8, 2.6, stroke=1, fill=0)
            p_r1 = pdf.beginPath()
            p_r1.moveTo(icon_cx - 1.0, cy - 1.6)
            p_r1.lineTo(icon_cx - 2.4, cy - 3.8)
            p_r1.lineTo(icon_cx - 0.6, cy - 3.0)
            pdf.drawPath(p_r1, stroke=1, fill=0)
            p_r2 = pdf.beginPath()
            p_r2.moveTo(icon_cx + 1.0, cy - 1.6)
            p_r2.lineTo(icon_cx + 2.4, cy - 3.8)
            p_r2.lineTo(icon_cx + 0.6, cy - 3.0)
            pdf.drawPath(p_r2, stroke=1, fill=0)

        # Text in clear dark slate next to icon
        pdf.setFont('Helvetica-Bold', t_size)
        pdf.setFillColor(HexColor('#0F172A'))
        pdf.drawString(text_x, cy - (t_size * 0.35), clean_text)

    # 8. Subtle Divider Line below Metadata Pills
    y_div = y_badges - 7.5
    pdf.setStrokeColor(HexColor('#F1F5F9'))
    pdf.setLineWidth(0.6)
    pdf.line(card_x + 8.0, y_div, card_x + card_w - 8.0, y_div)

    # 9. Stats Section with Shaded Icon Badges (No Outer Box, matching UI reference)
    if event_program_types is None:
        event_program_types = list(event.get_program_types())

    type_by_code = {}
    for pt in event_program_types:
        norm = (pt.code or '').lower().replace(' ', '_').replace('-', '_')
        type_by_code[norm] = pt
        type_by_code[pt.code] = pt

    if prefetched_assignments is not None:
        student_assignments = prefetched_assignments
    else:
        student_assignments = ProgramAssignment.objects.filter(
            student=student, program__event=event
        ).select_related('program', 'program__stage').order_by('program__start_time', 'program__name')

    programs_list = []
    seen_progs = set()
    type_counts = {pt.code: 0 for pt in event_program_types}

    for pa in student_assignments:
        p = pa.program
        if p and p.id not in seen_progs:
            seen_progs.add(p.id)
            programs_list.append((p.name, p))
            p_type = getattr(p, 'program_type', None) or ('stage' if getattr(p, 'is_stage', False) else 'off_stage')
            p_type_norm = (p_type or 'stage').lower().replace(' ', '_').replace('-', '_')
            pt_match = type_by_code.get(p_type_norm) or type_by_code.get(p_type)
            if pt_match:
                type_counts[pt_match.code] = type_counts.get(pt_match.code, 0) + 1
            else:
                if getattr(p, 'is_stage', False) or p_type_norm in ('stage', 'onstage'):
                    type_counts['stage'] = type_counts.get('stage', 0) + 1
                else:
                    type_counts['off_stage'] = type_counts.get('off_stage', 0) + 1

    if not programs_list and assignment and getattr(assignment, 'program', None):
        p = assignment.program
        programs_list = [(p.name, p)]
        p_type = getattr(p, 'program_type', None) or ('stage' if getattr(p, 'is_stage', False) else 'off_stage')
        p_type_norm = (p_type or 'stage').lower().replace(' ', '_').replace('-', '_')
        pt_match = type_by_code.get(p_type_norm) or type_by_code.get(p_type)
        if pt_match:
            type_counts[pt_match.code] = type_counts.get(pt_match.code, 0) + 1
        else:
            if getattr(p, 'is_stage', False) or p_type_norm in ('stage', 'onstage'):
                type_counts['stage'] = type_counts.get('stage', 0) + 1
            else:
                type_counts['off_stage'] = type_counts.get('off_stage', 0) + 1

    total_count = len(programs_list)

    # Determine dynamic stats columns to show
    cols_to_show = [('Total', total_count, 'total')]
    if len(event_program_types) <= 3:
        for pt in event_program_types:
            c = type_counts.get(pt.code, 0)
            norm_code = (pt.code or '').lower()
            kind = 'stage' if 'stage' in norm_code and 'off' not in norm_code else ('off_stage' if 'off' in norm_code else ('sports' if 'sport' in norm_code else 'general'))
            cols_to_show.append((pt.name.title(), c, kind))
    else:
        active_pts = [pt for pt in event_program_types if type_counts.get(pt.code, 0) > 0]
        other_pts = [pt for pt in event_program_types if type_counts.get(pt.code, 0) == 0]
        selected_pts = (active_pts + other_pts)[:3]
        selected_pts.sort(key=lambda x: getattr(x, 'display_order', 0))
        for pt in selected_pts:
            c = type_counts.get(pt.code, 0)
            norm_code = (pt.code or '').lower()
            kind = 'stage' if 'stage' in norm_code and 'off' not in norm_code else ('off_stage' if 'off' in norm_code else ('sports' if 'sport' in norm_code else 'general'))
            cols_to_show.append((pt.name.title(), c, kind))

    num_cols = max(1, len(cols_to_show))

    stats_top = y_div - 7.0
    stats_w = card_w - 16.0
    stats_left = card_x + 8.0
    col_w = stats_w / float(num_cols)

    sh_w = 14.5
    sh_h = 14.5
    sh_y = stats_top - sh_h
    num_y = sh_y - 13.0

    for i, (col_label, count_val, kind) in enumerate(cols_to_show):
        cx = stats_left + i * col_w + col_w / 2.0

        # 1. Small shading background square for icon
        sh_x = cx - sh_w / 2.0
        pdf.setFillColor(HexColor('#EEF2FF'))
        pdf.setStrokeColor(HexColor('#E0E7FF'))
        pdf.setLineWidth(0.5)
        pdf.roundRect(sh_x, sh_y, sh_w, sh_h, radius=3.5, stroke=1, fill=1)

        # 2. Vector icon inside shaded square
        icon_cy = sh_y + sh_h / 2.0
        pdf.setStrokeColor(HexColor('#312E81'))
        pdf.setFillColor(HexColor('#312E81'))

        if kind == 'total':
            # Calendar icon
            pdf.setLineWidth(0.6)
            pdf.roundRect(cx - 3.2, icon_cy - 3.2, 6.4, 6.0, radius=0.8, stroke=1, fill=0)
            pdf.line(cx - 3.2, icon_cy + 1.2, cx + 3.2, icon_cy + 1.2)
            pdf.line(cx - 1.8, icon_cy + 2.8, cx - 1.8, icon_cy + 4.0)
            pdf.line(cx + 1.8, icon_cy + 2.8, cx + 1.8, icon_cy + 4.0)
        elif kind == 'stage':
            # Stage curtains icon with valance, draped sides and tie-backs
            fx, fy, fw, fh = cx - 3.4, icon_cy - 3.2, 6.8, 6.4
            pdf.setLineWidth(0.6)
            pdf.roundRect(fx, fy, fw, fh, radius=0.6, stroke=1, fill=0)
            # valance top bar
            pdf.line(fx, icon_cy + 2.0, fx + fw, icon_cy + 2.0)
            # left curtain
            p1 = pdf.beginPath()
            p1.moveTo(cx - 0.4, icon_cy + 2.0)
            p1.curveTo(cx - 1.1, icon_cy + 0.7, fx + 1.4, icon_cy + 0.1, fx + 1.3, icon_cy - 0.6)
            p1.curveTo(fx + 1.3, icon_cy - 1.3, fx + 0.9, icon_cy - 2.5, fx + 0.6, fy)
            pdf.drawPath(p1, stroke=1, fill=0)
            # left tieback
            pdf.line(fx, icon_cy - 0.6, fx + 1.3, icon_cy - 0.6)
            # right curtain
            p2 = pdf.beginPath()
            p2.moveTo(cx + 0.4, icon_cy + 2.0)
            p2.curveTo(cx + 1.1, icon_cy + 0.7, fx + fw - 1.4, icon_cy + 0.1, fx + fw - 1.3, icon_cy - 0.6)
            p2.curveTo(fx + fw - 1.3, icon_cy - 1.3, fx + fw - 0.9, icon_cy - 2.5, fx + fw - 0.6, fy)
            pdf.drawPath(p2, stroke=1, fill=0)
            # right tieback
            pdf.line(fx + fw - 1.3, icon_cy - 0.6, fx + fw, icon_cy - 0.6)
        elif kind == 'off_stage':
            # 3-layer stacked diamond icon
            pdf.setLineWidth(0.6)
            p_d1 = pdf.beginPath()
            p_d1.moveTo(cx, icon_cy + 3.2)
            p_d1.lineTo(cx + 3.2, icon_cy + 1.6)
            p_d1.lineTo(cx, icon_cy + 0.0)
            p_d1.lineTo(cx - 3.2, icon_cy + 1.6)
            p_d1.close()
            pdf.drawPath(p_d1, stroke=1, fill=0)
            p_d2 = pdf.beginPath()
            p_d2.moveTo(cx - 3.2, icon_cy - 0.4)
            p_d2.lineTo(cx, icon_cy - 2.0)
            p_d2.lineTo(cx + 3.2, icon_cy - 0.4)
            pdf.drawPath(p_d2, stroke=1, fill=0)
            p_d3 = pdf.beginPath()
            p_d3.moveTo(cx - 3.2, icon_cy - 2.2)
            p_d3.lineTo(cx, icon_cy - 3.8)
            p_d3.lineTo(cx + 3.2, icon_cy - 2.2)
            pdf.drawPath(p_d3, stroke=1, fill=0)
        elif kind == 'sports':
            # Running athlete icon
            pdf.setLineWidth(0.6)
            pdf.circle(cx + 1.5, icon_cy + 2.6, 0.9, stroke=0, fill=1)
            pdf.line(cx + 0.8, icon_cy + 1.8, cx - 0.6, icon_cy - 0.5)
            p_arm = pdf.beginPath()
            p_arm.moveTo(cx + 0.6, icon_cy + 1.2)
            p_arm.lineTo(cx + 2.4, icon_cy + 1.2)
            p_arm.lineTo(cx + 3.2, icon_cy + 2.2)
            pdf.drawPath(p_arm, stroke=1, fill=0)
            pdf.line(cx + 0.6, icon_cy + 1.2, cx - 1.6, icon_cy + 0.2)
            p_leg1 = pdf.beginPath()
            p_leg1.moveTo(cx - 0.6, icon_cy - 0.5)
            p_leg1.lineTo(cx + 1.2, icon_cy - 1.6)
            p_leg1.lineTo(cx + 0.6, icon_cy - 3.6)
            pdf.drawPath(p_leg1, stroke=1, fill=0)
            p_leg2 = pdf.beginPath()
            p_leg2.moveTo(cx - 0.6, icon_cy - 0.5)
            p_leg2.lineTo(cx - 2.0, icon_cy - 1.8)
            p_leg2.lineTo(cx - 1.2, icon_cy - 3.4)
            pdf.drawPath(p_leg2, stroke=1, fill=0)
        else:
            pdf.setLineWidth(0.6)
            p_cup = pdf.beginPath()
            p_cup.moveTo(cx - 2.6, icon_cy + 3.0)
            p_cup.lineTo(cx + 2.6, icon_cy + 3.0)
            p_cup.lineTo(cx + 2.0, icon_cy + 0.2)
            p_cup.curveTo(cx + 1.6, icon_cy - 1.5, cx - 1.6, icon_cy - 1.5, cx - 2.0, icon_cy + 0.2)
            p_cup.close()
            pdf.drawPath(p_cup, stroke=1, fill=0)
            pdf.line(cx, icon_cy - 1.5, cx, icon_cy - 3.0)
            pdf.line(cx - 1.8, icon_cy - 3.0, cx + 1.8, icon_cy - 3.0)

        # 3. Big bold count
        pdf.setFont('Helvetica-Bold', 13.0)
        pdf.setFillColor(HexColor('#0F172A'))
        pdf.drawCentredString(cx, num_y, str(count_val))

        # 4. Two-line label
        clean_lbl = col_label.strip()
        norm_l = clean_lbl.lower()
        if 'on' in norm_l and 'stage' in norm_l:
            l1 = 'On-Stage'
            l2 = 'Events'
        elif 'off' in norm_l and 'stage' in norm_l:
            l1 = 'Off-Stage'
            l2 = 'Events'
        elif 'total' in norm_l:
            l1 = 'Total'
            l2 = 'Events'
        elif 'sport' in norm_l:
            l1 = 'Sports'
            l2 = 'Events'
        elif norm_l.endswith('events') or norm_l.endswith('programs'):
            words = clean_lbl.split()
            l1 = words[0]
            l2 = ' '.join(words[1:]) if len(words) > 1 else 'Events'
        else:
            l1 = clean_lbl
            l2 = 'Events'

        pdf.setFont('Helvetica-Bold', 4.5)
        pdf.setFillColor(HexColor('#64748B'))
        pdf.drawCentredString(cx, num_y - 7.5, l1)
        if l2:
            pdf.drawCentredString(cx, num_y - 12.5, l2)

        # 5. Hairline vertical divider between columns (between number & labels)
        if i > 0:
            div_x = stats_left + i * col_w
            pdf.setStrokeColor(HexColor('#F1F5F9'))
            pdf.setLineWidth(0.6)
            pdf.line(div_x, num_y - 13.0, div_x, num_y + 10.0)

    # 9. Middle Left: Participant Role & Event / School Subtitle
    pdf.setFillColor(HexColor('#4F46E5'))
    pdf.roundRect(card_x + 10.0, card_y + 68.0, 16.0, 2.2, radius=1.0, stroke=0, fill=1)

    pdf.setFont('Helvetica-Bold', 12.0)
    pdf.setFillColor(HexColor('#0F172A'))
    pdf.drawString(card_x + 10.0, card_y + 51.0, 'Participant')

    # Subtitle: EVENT • SCHOOL
    school_name = (event.school.name if event.school else '').strip().upper()
    event_sub_title = (event.title or 'EVENT').strip().upper()
    full_sub = f"{event_sub_title}  •  {school_name}" if school_name else event_sub_title
    max_sub_w = card_w - 75.0   # room to the left of the QR code box
    sub_size = 5.2
    while sub_size > 4.2 and stringWidth(full_sub, 'Helvetica-Bold', sub_size) > max_sub_w:
        sub_size -= 0.3
    if stringWidth(full_sub, 'Helvetica-Bold', sub_size) > max_sub_w:
        while full_sub and stringWidth(full_sub + '…', 'Helvetica-Bold', sub_size) > max_sub_w:
            full_sub = full_sub[:-1]
        full_sub += '…'

    pdf.setFont('Helvetica-Bold', sub_size)
    pdf.setFillColor(HexColor('#64748B'))
    pdf.drawString(card_x + 10.0, card_y + 40.0, full_sub)

    # 10. Middle Right: Official Verification QR Code Container
    qr_box_w = 44.0
    qr_box_h = 49.0
    qr_box_x = card_x + card_w - qr_box_w - 8.0
    qr_box_y = card_y + 30.0

    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.setStrokeColor(HexColor('#CBD5E1'))
    pdf.setLineWidth(0.6)
    pdf.roundRect(qr_box_x, qr_box_y, qr_box_w, qr_box_h, radius=5, stroke=1, fill=1)

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

    qr_size = 33.0
    try:
        qr = QrCodeWidget(qr_target_url)
        qr.barWidth = qr_size
        qr.barHeight = qr_size
        qr.barBorder = 0
        d = Drawing(qr_size, qr_size)
        d.add(qr)
        qr_draw_x = qr_box_x + (qr_box_w - qr_size) / 2.0
        qr_draw_y = qr_box_y + 11.0
        renderPDF.draw(d, pdf, qr_draw_x, qr_draw_y)
    except Exception as qr_err:
        logger.warning("Badge QR generation failed: %s", qr_err)

    pdf.setFont('Helvetica-Bold', 4.2)
    pdf.setFillColor(HexColor('#312E81'))
    pdf.drawCentredString(qr_box_x + qr_box_w / 2.0, qr_box_y + 4.0, 'SCAN TO VERIFY')

    # 11. "Powered by Eventloo" inside the bottom dark wave in WHITE color
    eventloo_icon_path = _resolve_eventloo_icon_path()
    f_x = card_x + 10.0
    f_y = card_y + 6.0
    icon_offset = 0.0
    if eventloo_icon_path:
        try:
            pdf.drawImage(eventloo_icon_path, f_x, f_y - 1.0, width=8.5, height=8.5, mask='auto', preserveAspectRatio=True)
            icon_offset = 12.0
        except Exception as icon_err:
            logger.warning("Eventloo badge icon draw failed: %s", icon_err)
            icon_offset = 0.0

    pdf.setFont('Helvetica', 5.2)
    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.drawString(f_x + icon_offset, f_y + 1.2, 'Powered by ')
    pw = stringWidth('Powered by ', 'Helvetica', 5.2)
    pdf.setFont('Helvetica-Bold', 5.8)
    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.drawString(f_x + icon_offset + pw, f_y + 1.2, 'Eventloo')

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
