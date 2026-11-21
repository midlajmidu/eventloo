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


_BADGE_ICON_CACHE = {}


def _get_badge_icon_image(name, color='#4338CA'):
    """
    Renders official Tabler/Lucide vector SVG icons to 400 DPI transparent PNG ImageReaders
    for high-fidelity ReportLab badge rendering, caching results in memory.
    """
    key = (name, color)
    if key in _BADGE_ICON_CACHE:
        return _BADGE_ICON_CACHE[key]

    svg_defs = {
        'trophy': f"""<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="{color}" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /><path d="M7 4h10v5a5 5 0 0 1 -10 0v-5" /><path d="M7 6h-2a2 2 0 0 0 -2 2v1a4 4 0 0 0 4 4" /><path d="M17 6h2a2 2 0 0 1 2 2v1a4 4 0 0 1 -4 4" /></svg>""",
        'stack': f"""<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="{color}" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l-8 4l8 4l8 -4l-8 -4" /><path d="M4 12l8 4l8 -4" /><path d="M4 16l8 4l8 -4" /></svg>""",
        'award': f"""<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="{color}" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6" /><polyline points="9 14.2 9 21 12 19 15 21 15 14.2" /></svg>""",
        'calendar': f"""<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="{color}" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="2" /><line x1="16" y1="3" x2="16" y2="7" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="4" y1="11" x2="20" y2="11" /></svg>""",
        'theater': f"""<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="{color}" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M8 4c0 3 -2 6 -3 8c1 3 1 6 -1 8" /><path d="M16 4c0 3 2 6 3 8c-1 3 -1 6 1 8" /><line x1="3" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="21" y2="12" /></svg>""",
        'run': f"""<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="{color}" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="1.2" fill="{color}" /><path d="M4 17l5 1l.75 -1.5" /><path d="M15 21l0 -4l-4 -3l1 -6" /><path d="M7 12l0 -3l5 -1l3 3l3 1" /></svg>"""
    }

    svg = svg_defs.get(name)
    if not svg:
        return None
    try:
        import fitz
        doc = fitz.open('svg', svg.encode('utf-8'))
        pix = doc[0].get_pixmap(dpi=400, alpha=True)
        reader = ImageReader(BytesIO(pix.tobytes('png')))
        _BADGE_ICON_CACHE[key] = reader
        return reader
    except Exception as exc:
        logger.warning("Failed to render vector badge icon %s: %s", name, exc)
        return None


def _draw_paper_badge(pdf, cell_x, cell_y, badge_width, badge_height, recipient, event, category_names=None, base_url=None, event_program_types=None, prefetched_assignments=None, prefetched_chest_number=None):
    """
    Renders a single high-quality participant paper badge matching the official Eventloo
    physical credential model reference:
      - Top: Event Logo + Event Name
      - Participant Name: Upper-case bold
      - Hero Chest Pill: Centered [ CHEST NO | #1000 ]
      - Metadata: [ Team ] [ Category ] [ Class / Grade ] with vector icons
      - Divider
      - Minimal Stats Columns: Total Events, On-Stage, Off-Stage, Sports with shaded icon boxes
      - Bottom Right: SCAN TO VERIFY QR Card blending into footer wave
      - Bottom Left: Powered by Eventloo branding
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

    # 1. Base Card White Background & subtle border
    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.setStrokeColor(HexColor('#E2E8F0'))
    pdf.setLineWidth(0.6)
    pdf.roundRect(card_x, card_y, card_w, card_h, radius=8, stroke=1, fill=1)

    # Decorative soft lavender curve in top right corner
    pdf.saveState()
    p_top_corner = pdf.beginPath()
    p_top_corner.moveTo(card_x + card_w - 40, card_top)
    p_top_corner.curveTo(card_x + card_w - 20, card_top - 20, card_x + card_w, card_top - 35, card_x + card_w, card_top - 50)
    p_top_corner.lineTo(card_x + card_w, card_top)
    p_top_corner.close()
    pdf.setFillColor(HexColor('#EEF2FF'))
    pdf.drawPath(p_top_corner, stroke=0, fill=1)
    pdf.restoreState()

    # 2. Dual-Tone Bottom Waves
    pdf.saveState()
    # Light wave (Lavender/Indigo-200)
    p_wave1 = pdf.beginPath()
    p_wave1.moveTo(card_x, card_y)
    p_wave1.lineTo(card_x, card_y + 14)
    p_wave1.curveTo(card_x + 50, card_y + 24, card_x + 110, card_y + 10, card_x + card_w, card_y + 22)
    p_wave1.lineTo(card_x + card_w, card_y)
    p_wave1.close()
    pdf.setFillColor(HexColor('#C7D2FE'))
    pdf.drawPath(p_wave1, stroke=0, fill=1)

    # Foreground Dark Wave (Deep Indigo / #1E1B4B)
    p_wave2 = pdf.beginPath()
    p_wave2.moveTo(card_x, card_y)
    p_wave2.lineTo(card_x, card_y + 6)
    p_wave2.curveTo(card_x + 60, card_y + 18, card_x + 120, card_y + 4, card_x + card_w, card_y + 24)
    p_wave2.lineTo(card_x + card_w, card_y)
    p_wave2.close()
    pdf.setFillColor(HexColor('#1E1B4B'))
    pdf.drawPath(p_wave2, stroke=0, fill=1)
    pdf.restoreState()

    # Card border redraw to clip cleanly over bottom waves
    pdf.setStrokeColor(HexColor('#CBD5E1'))
    pdf.setLineWidth(0.5)
    pdf.roundRect(card_x, card_y, card_w, card_h, radius=8, stroke=1, fill=0)

    # 3. Top Header: Event Logo + Event Name
    event_logo_path = _resolve_event_logo_path(event)
    event_title = (event.title or 'EVENT').strip().upper()

    if event_logo_path:
        try:
            with Image.open(event_logo_path) as im:
                orig_w, orig_h = im.size
            box_w, box_h = 32.0, 18.0
            scale = min(box_w / float(orig_w), box_h / float(orig_h))
            logo_w = orig_w * scale
            logo_h = orig_h * scale
            logo_cy = card_top - 20.0
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
        y_title = card_top - 28.0
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
        y_title = card_top - 40.0
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

    # 4. Participant Name (Space after event name until participant name)
    y_name = card_top - 76.0
    name = (student.get_full_name() or student.display_name or 'Participant').strip()
    name_len = len(name)
    if name_len > 24:
        f_size = 9.0
    elif name_len > 18:
        f_size = 11.0
    else:
        f_size = 13.5
    pdf.setFont('Helvetica-Bold', f_size)
    pdf.setFillColor(HexColor('#0F172A'))
    pdf.drawCentredString(card_center_x, y_name, name.upper())

    # 5. Hero Chest Number Pill: [ CHEST NO | #1000 ] - Space after name for chest no
    chest_number = prefetched_chest_number if prefetched_chest_number is not None else (assignment.chest_number if assignment else None)
    if not chest_number:
        chest_number = ChestNumber.objects.filter(event=event, student=student).values_list(
            'chest_number', flat=True
        ).first()
    chest_str = str(chest_number) if chest_number else 'N/A'

    y_pill = card_top - 108.0
    label_text = 'CHEST NO'
    label_fs = 5.5
    num_text = f'#{chest_str}'
    num_fs = 9.0

    label_w = stringWidth(label_text, 'Helvetica-Bold', label_fs)
    num_w = stringWidth(num_text, 'Helvetica-Bold', num_fs)
    pad_x = 12.0
    gap = 6.5
    pill_w = pad_x + label_w + gap + 1.0 + gap + num_w + pad_x
    pill_h = 17.5
    pill_x = card_center_x - pill_w / 2.0
    cy_pill = y_pill + pill_h / 2.0

    pdf.setFillColor(HexColor('#1E1B4B'))
    pdf.roundRect(pill_x, y_pill, pill_w, pill_h, radius=8.75, stroke=0, fill=1)

    label_x = pill_x + pad_x
    pdf.setFont('Helvetica-Bold', label_fs)
    pdf.setFillColor(HexColor('#C7D2FE'))
    pdf.drawString(label_x, cy_pill - 2.0, label_text)

    div_x = label_x + label_w + gap
    pdf.setStrokeColor(HexColor('#4338CA'))
    pdf.setLineWidth(0.6)
    pdf.line(div_x, cy_pill - 5.0, div_x, cy_pill + 5.0)

    num_x = div_x + gap + 1.0
    pdf.setFont('Helvetica-Bold', num_fs)
    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.drawString(num_x, cy_pill - 3.2, num_text)

    # 6. Metadata Pills Row: [ Team ] [ Category ] [ Class / Grade ]
    # Generous spacing after chest pill
    y_badges = card_top - 135.5

    # Team
    team_name = assignment.team.name if assignment and assignment.team else (
        student.team_memberships.first().name if hasattr(student, 'team_memberships') and student.team_memberships.exists() else 'INDIVIDUAL'
    )

    # Category
    cat_code = (student.category or (assignment.program.category if assignment and assignment.program else '') or '').strip()
    if cat_code and len(cat_code) <= 5:
        category_display = cat_code.upper()
    else:
        cat_name = category_names.get(cat_code) or category_names.get(cat_code.lower()) or category_names.get(cat_code.upper()) or cat_code
        if cat_name and len(cat_name) <= 12:
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
        (card_x + 8.0, team_name.upper(), 'trophy'),
        (card_x + 64.0, category_display, 'stack'),
        (card_x + 120.0, grade_sec, 'award')
    ]
    pill_w = 52.0
    pill_h = 15.0

    for px, ptext, icon_key in pills_data:
        pdf.setFillColor(HexColor('#F8FAFC'))
        pdf.setStrokeColor(HexColor('#DDE2F8'))
        pdf.setLineWidth(0.6)
        pdf.roundRect(px, y_badges, pill_w, pill_h, radius=4.5, stroke=1, fill=1)

        cy = y_badges + pill_h / 2.0
        clean_text = str(ptext).strip()
        icon_sz = 8.5
        gap_it = 3.0
        fs = 4.8
        max_t_w = pill_w - (icon_sz + gap_it + 6.0)
        while fs > 3.8 and stringWidth(clean_text, 'Helvetica-Bold', fs) > max_t_w:
            fs -= 0.3
        if stringWidth(clean_text, 'Helvetica-Bold', fs) > max_t_w:
            while clean_text and stringWidth(clean_text + '…', 'Helvetica-Bold', fs) > max_t_w:
                clean_text = clean_text[:-1]
            clean_text += '…'

        tw = stringWidth(clean_text, 'Helvetica-Bold', fs)
        group_w = icon_sz + gap_it + tw
        start_x = px + (pill_w - group_w) / 2.0

        icon_img = _get_badge_icon_image(icon_key, '#4338CA')
        if icon_img:
            pdf.drawImage(icon_img, start_x, cy - icon_sz / 2.0, icon_sz, icon_sz, mask='auto')

        pdf.setFont('Helvetica-Bold', fs)
        pdf.setFillColor(HexColor('#0F172A'))
        pdf.drawString(start_x + icon_sz + gap_it, cy - (fs * 0.35), clean_text)

    # 7. Subtle Divider Line below Metadata Pills
    y_div = card_top - 144.0
    pdf.setStrokeColor(HexColor('#EEF2F6'))
    pdf.setLineWidth(0.5)
    pdf.line(card_x + 8.0, y_div, card_x + card_w - 8.0, y_div)

    # 8. Reduced Minimal Stats Section with generous spacing
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
    cols_to_show = [('Total', total_count, 'calendar')]
    if len(event_program_types) <= 3:
        for pt in event_program_types:
            c = type_counts.get(pt.code, 0)
            norm_code = (pt.code or '').lower()
            kind = 'theater' if 'stage' in norm_code and 'off' not in norm_code else ('stack' if 'off' in norm_code else ('run' if 'sport' in norm_code else 'award'))
            cols_to_show.append((pt.name.title(), c, kind))
    else:
        active_pts = [pt for pt in event_program_types if type_counts.get(pt.code, 0) > 0]
        other_pts = [pt for pt in event_program_types if type_counts.get(pt.code, 0) == 0]
        selected_pts = (active_pts + other_pts)[:3]
        selected_pts.sort(key=lambda x: getattr(x, 'display_order', 0))
        for pt in selected_pts:
            c = type_counts.get(pt.code, 0)
            norm_code = (pt.code or '').lower()
            kind = 'theater' if 'stage' in norm_code and 'off' not in norm_code else ('stack' if 'off' in norm_code else ('run' if 'sport' in norm_code else 'award'))
            cols_to_show.append((pt.name.title(), c, kind))

    num_cols = max(1, len(cols_to_show))

    stats_top = card_top - 153.5
    stats_w = card_w - 16.0
    stats_left = card_x + 8.0
    col_w = stats_w / float(num_cols)

    sh_w = 12.5
    sh_h = 12.5
    sh_y = stats_top - sh_h
    sh_cy = sh_y + sh_h / 2.0
    num_y = card_top - 177.0

    for i, (col_label, count_val, icon_key) in enumerate(cols_to_show):
        cx = stats_left + (i + 0.5) * col_w

        # 1. Shaded icon box
        pdf.setFillColor(HexColor('#EEF2FF'))
        pdf.setStrokeColor(HexColor('#E0E7FF'))
        pdf.setLineWidth(0.5)
        pdf.roundRect(cx - sh_w / 2.0, sh_y, sh_w, sh_h, radius=3.0, stroke=1, fill=1)

        # 2. Real vector icon inside
        icon_img = _get_badge_icon_image(icon_key, '#4338CA')
        icon_sz = 8.0
        if icon_img:
            pdf.drawImage(icon_img, cx - icon_sz / 2.0, sh_cy - icon_sz / 2.0, icon_sz, icon_sz, mask='auto')

        # 3. Number
        pdf.setFont('Helvetica-Bold', 11.0)
        pdf.setFillColor(HexColor('#0F172A'))
        pdf.drawCentredString(cx, num_y, str(count_val))

        # 4. Two-line label
        clean_lbl = col_label.strip()
        norm_l = clean_lbl.lower()
        if 'on' in norm_l and 'stage' in norm_l:
            l1, l2 = 'On-Stage', 'Events'
        elif 'off' in norm_l and 'stage' in norm_l:
            l1, l2 = 'Off-Stage', 'Events'
        elif 'total' in norm_l:
            l1, l2 = 'Total', 'Events'
        elif 'sport' in norm_l:
            l1, l2 = 'Sports', 'Events'
        elif norm_l.endswith('events') or norm_l.endswith('programs'):
            words = clean_lbl.split()
            l1 = words[0]
            l2 = ' '.join(words[1:]) if len(words) > 1 else 'Events'
        else:
            l1 = clean_lbl
            l2 = 'Events'

        pdf.setFont('Helvetica-Bold', 3.8)
        pdf.setFillColor(HexColor('#64748B'))
        pdf.drawCentredString(cx, num_y - 6.5, l1)
        if l2:
            pdf.drawCentredString(cx, num_y - 10.8, l2)

        # 5. Hairline vertical divider between columns
        if i > 0:
            div_x = stats_left + i * col_w
            pdf.setStrokeColor(HexColor('#F1F5F9'))
            pdf.setLineWidth(0.5)
            pdf.line(div_x, num_y - 11.0, div_x, num_y + 8.0)

    # 9. Lower Footer Area: QR Code Container blending into footer wave
    qr_box_w = 44.0
    qr_box_h = 50.0
    qr_box_x = card_x + card_w - qr_box_w - 9.0
    qr_box_y = card_y + 8.0

    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.setStrokeColor(HexColor('#DDE2F8'))
    pdf.setLineWidth(0.6)
    pdf.roundRect(qr_box_x, qr_box_y, qr_box_w, qr_box_h, radius=6.0, stroke=1, fill=1)

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

    qr_sz = 33.0
    try:
        qr = QrCodeWidget(qr_target_url)
        bounds = qr.getBounds()
        d = Drawing(bounds[2], bounds[3], transform=[qr_sz / bounds[2], 0, 0, qr_sz / bounds[3], 0, 0])
        d.add(qr)
        qr_draw_x = qr_box_x + (qr_box_w - qr_sz) / 2.0
        qr_draw_y = qr_box_y + 11.5
        renderPDF.draw(d, pdf, qr_draw_x, qr_draw_y)
    except Exception as qr_err:
        logger.warning("Badge QR generation failed: %s", qr_err)

    pdf.setFont('Helvetica-Bold', 4.5)
    pdf.setFillColor(HexColor('#312E81'))
    pdf.drawCentredString(qr_box_x + qr_box_w / 2.0, qr_box_y + 4.2, 'SCAN TO VERIFY')

    # 10. "Powered by Eventloo" on bottom-left white card area
    eventloo_icon_path = _resolve_eventloo_icon_path()
    pow_y = qr_box_y + (qr_box_h / 2.0) - 4.0
    f_x = card_x + 12.0
    icon_offset = 0.0

    if eventloo_icon_path:
        try:
            pdf.drawImage(eventloo_icon_path, f_x, pow_y - 1.0, width=8.5, height=8.5, mask='auto', preserveAspectRatio=True)
            icon_offset = 12.0
        except Exception as icon_err:
            logger.warning("Eventloo badge icon draw failed: %s", icon_err)
            icon_offset = 0.0

    pdf.setFont('Helvetica', 5.2)
    pdf.setFillColor(HexColor('#64748B'))
    pdf.drawString(f_x + icon_offset, pow_y + 1.2, 'Powered by ')
    pw = stringWidth('Powered by ', 'Helvetica', 5.2)
    pdf.setFont('Helvetica-Bold', 5.5)
    pdf.setFillColor(HexColor('#0F172A'))
    pdf.drawString(f_x + icon_offset + pw, pow_y + 1.2, 'Eventloo')

    pdf.restoreState()


def _draw_paper_badge_back(pdf, cell_x, cell_y, badge_width, badge_height, recipient, event, category_names=None, base_url=None, event_program_types=None, prefetched_assignments=None, prefetched_chest_number=None):
    """
    Renders the backside of a participant paper badge matching the official Eventloo design:
      - Top: Event Logo + Event Name
      - Subheader: [Student Name] • CHEST NO #[number]
      - Header: REGISTERED PROGRAMS (N)
      - Program Cards: Program name, type (On-Stage, Off-Stage, Sports), venue/stage, and start time
      - Bottom: Dual-tone wave graphic
      - Bottom Center: Powered by Eventloo branding
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

    # 1. Base Card White Background & subtle border
    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.setStrokeColor(HexColor('#E2E8F0'))
    pdf.setLineWidth(0.6)
    pdf.roundRect(card_x, card_y, card_w, card_h, radius=8, stroke=1, fill=1)

    # Decorative soft lavender curve in top left corner (mirrored from front's top right)
    pdf.saveState()
    p_top_corner = pdf.beginPath()
    p_top_corner.moveTo(card_x + 40, card_top)
    p_top_corner.curveTo(card_x + 20, card_top - 20, card_x, card_top - 35, card_x, card_top - 50)
    p_top_corner.lineTo(card_x, card_top)
    p_top_corner.close()
    pdf.setFillColor(HexColor('#EEF2FF'))
    pdf.drawPath(p_top_corner, stroke=0, fill=1)
    pdf.restoreState()

    # 2. Dual-Tone Bottom Waves
    pdf.saveState()
    # Light wave (Lavender/Indigo-200)
    p_wave1 = pdf.beginPath()
    p_wave1.moveTo(card_x, card_y)
    p_wave1.lineTo(card_x, card_y + 14)
    p_wave1.curveTo(card_x + 50, card_y + 24, card_x + 110, card_y + 10, card_x + card_w, card_y + 22)
    p_wave1.lineTo(card_x + card_w, card_y)
    p_wave1.close()
    pdf.setFillColor(HexColor('#C7D2FE'))
    pdf.drawPath(p_wave1, stroke=0, fill=1)

    # Foreground Dark Wave (Deep Indigo / #1E1B4B)
    p_wave2 = pdf.beginPath()
    p_wave2.moveTo(card_x, card_y)
    p_wave2.lineTo(card_x, card_y + 6)
    p_wave2.curveTo(card_x + 60, card_y + 18, card_x + 120, card_y + 4, card_x + card_w, card_y + 24)
    p_wave2.lineTo(card_x + card_w, card_y)
    p_wave2.close()
    pdf.setFillColor(HexColor('#1E1B4B'))
    pdf.drawPath(p_wave2, stroke=0, fill=1)
    pdf.restoreState()

    # Card border redraw to clip cleanly over bottom waves
    pdf.setStrokeColor(HexColor('#CBD5E1'))
    pdf.setLineWidth(0.5)
    pdf.roundRect(card_x, card_y, card_w, card_h, radius=8, stroke=1, fill=0)

    # 3. Top Header: Event Logo + Event Name
    event_logo_path = _resolve_event_logo_path(event)
    event_title = (event.title or 'EVENT').strip().upper()

    if event_logo_path:
        try:
            with Image.open(event_logo_path) as im:
                orig_w, orig_h = im.size
            box_w, box_h = 32.0, 18.0
            scale = min(box_w / float(orig_w), box_h / float(orig_h))
            logo_w = orig_w * scale
            logo_h = orig_h * scale
            logo_cy = card_top - 20.0
            logo_x = card_center_x - logo_w / 2.0
            logo_y = logo_cy - logo_h / 2.0
            pdf.drawImage(event_logo_path, logo_x, logo_y, width=logo_w, height=logo_h, mask='auto', preserveAspectRatio=True)

            pdf.setStrokeColor(HexColor('#CBD5E1'))
            pdf.setLineWidth(0.5)
            pdf.line(card_x + 16, logo_cy, logo_x - 6, logo_cy)
            pdf.line(logo_x + logo_w + 6, logo_cy, card_x + card_w - 16, logo_cy)
        except Exception as err:
            logger.warning("Failed to render event logo on badge backside: %s", err)
            event_logo_path = None

    if not event_logo_path:
        y_title = card_top - 28.0
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
        y_title = card_top - 40.0
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

    # 4. Student Name & Chest No Banner
    chest_number = prefetched_chest_number if prefetched_chest_number is not None else (assignment.chest_number if assignment else None)
    if not chest_number:
        chest_number = ChestNumber.objects.filter(event=event, student=student).values_list(
            'chest_number', flat=True
        ).first()
    chest_str = str(chest_number) if chest_number else 'N/A'
    name = (student.get_full_name() or student.display_name or 'Participant').strip().upper()

    y_sub = y_title - 14.0
    sub_text = f"{name}  •  CHEST NO #{chest_str}"
    max_sw = card_w - 20.0
    sub_fs = 7.5
    while sub_fs > 5.5 and stringWidth(sub_text, 'Helvetica-Bold', sub_fs) > max_sw:
        sub_fs -= 0.3
    if stringWidth(sub_text, 'Helvetica-Bold', sub_fs) > max_sw:
        while sub_text and stringWidth(sub_text + '…', 'Helvetica-Bold', sub_fs) > max_sw:
            sub_text = sub_text[:-1]
        sub_text += '…'

    pdf.setFont('Helvetica-Bold', sub_fs)
    pdf.setFillColor(HexColor('#312E81'))
    pdf.drawCentredString(card_center_x, y_sub, sub_text)

    # 5. Retrieve Student's Assigned Programs
    if prefetched_assignments is not None:
        student_assignments = prefetched_assignments
    else:
        student_assignments = ProgramAssignment.objects.filter(
            student=student, program__event=event
        ).select_related('program', 'program__stage').order_by('program__start_time', 'program__name')

    programs_list = []
    seen_progs = set()
    for pa in student_assignments:
        p = pa.program
        if p and p.id not in seen_progs:
            seen_progs.add(p.id)
            programs_list.append((p.name, p))

    if not programs_list and assignment and getattr(assignment, 'program', None):
        p = assignment.program
        programs_list = [(p.name, p)]

    num_progs = len(programs_list)

    # 6. Section Divider: REGISTERED PROGRAMS
    y_sec = y_sub - 14.0
    hdr_text = f"REGISTERED PROGRAMS ({num_progs})" if num_progs > 0 else "REGISTERED PROGRAMS"
    hdr_w = stringWidth(hdr_text, 'Helvetica-Bold', 6.0)
    pdf.setStrokeColor(HexColor('#EEF2F6'))
    pdf.setLineWidth(0.6)
    pdf.line(card_x + 12.0, y_sec + 2.0, card_center_x - hdr_w / 2.0 - 6.0, y_sec + 2.0)
    pdf.line(card_center_x + hdr_w / 2.0 + 6.0, y_sec + 2.0, card_x + card_w - 12.0, y_sec + 2.0)
    pdf.setFont('Helvetica-Bold', 6.0)
    pdf.setFillColor(HexColor('#64748B'))
    pdf.drawCentredString(card_center_x, y_sec, hdr_text)

    # 7. Render Programs List
    available_top = y_sec - 7.0
    available_bottom = card_y + 30.0
    total_avail = available_top - available_bottom
    item_w = card_w - 20.0
    left_x = card_x + 10.0

    if num_progs == 0:
        empty_box_h = 44.0
        empty_y = (available_top + available_bottom - empty_box_h) / 2.0
        pdf.setFillColor(HexColor('#F8FAFC'))
        pdf.setStrokeColor(HexColor('#E2E8F0'))
        pdf.setLineWidth(0.5)
        pdf.roundRect(left_x, empty_y, item_w, empty_box_h, radius=4.0, stroke=1, fill=1)

        pdf.setFont('Helvetica-Bold', 6.5)
        pdf.setFillColor(HexColor('#64748B'))
        pdf.drawCentredString(card_center_x, empty_y + 24.0, 'No Registered Programs')
        pdf.setFont('Helvetica', 5.0)
        pdf.setFillColor(HexColor('#94A3B8'))
        pdf.drawCentredString(card_center_x, empty_y + 12.0, 'Contact event desk for program schedule')

    elif num_progs <= 5:
        # Roomy 2-line cards
        box_h = min(24.0, (total_avail - (num_progs - 1) * 5.0) / float(num_progs))
        gap_y = 5.0

        for i, (p_name, p) in enumerate(programs_list):
            cur_y = available_top - i * (box_h + gap_y) - box_h

            pdf.setFillColor(HexColor('#F8FAFC'))
            pdf.setStrokeColor(HexColor('#E2E8F0'))
            pdf.setLineWidth(0.5)
            pdf.roundRect(left_x, cur_y, item_w, box_h, radius=4.0, stroke=1, fill=1)

            # Program Type classification & accent stripe
            p_type_val = getattr(p, 'program_type', None) or ('stage' if getattr(p, 'is_stage', False) else 'off_stage')
            norm_t = (p_type_val or '').lower()
            if 'on' in norm_t and 'stage' in norm_t or norm_t == 'stage':
                type_label = 'On-Stage'
                accent_color = HexColor('#4F46E5')
            elif 'sport' in norm_t:
                type_label = 'Sports'
                accent_color = HexColor('#059669')
            elif 'off' in norm_t:
                type_label = 'Off-Stage'
                accent_color = HexColor('#D97706')
            else:
                type_label = str(p_type_val).title()
                accent_color = HexColor('#4F46E5')

            pdf.setFillColor(accent_color)
            pdf.roundRect(left_x, cur_y + 3.0, 2.5, box_h - 6.0, radius=1.0, stroke=0, fill=1)

            # Index
            pdf.setFont('Helvetica-Bold', 5.5)
            pdf.setFillColor(HexColor('#64748B'))
            pdf.drawString(left_x + 8.0, cur_y + box_h - 8.5, f'{i+1:02d}.')

            # Program name
            clean_n = str(p_name).strip().upper()
            max_nw = item_w - 32.0
            fs = 6.5
            while fs > 4.8 and stringWidth(clean_n, 'Helvetica-Bold', fs) > max_nw:
                fs -= 0.3
            if stringWidth(clean_n, 'Helvetica-Bold', fs) > max_nw:
                while clean_n and stringWidth(clean_n + '…', 'Helvetica-Bold', fs) > max_nw:
                    clean_n = clean_n[:-1]
                clean_n += '…'
            pdf.setFont('Helvetica-Bold', fs)
            pdf.setFillColor(HexColor('#0F172A'))
            pdf.drawString(left_x + 22.0, cur_y + box_h - 8.5, clean_n)

            # Details: Type • Stage • Time
            p_stage = (p.stage.name if getattr(p, 'stage', None) else (getattr(p, 'venue', '') or '')).strip()
            p_time = p.start_time.strftime('%I:%M %p') if getattr(p, 'start_time', None) else ''
            details_parts = [type_label]
            if p_stage:
                details_parts.append(p_stage)
            if p_time:
                details_parts.append(p_time)
            details_str = '  •  '.join(details_parts)

            max_dw = item_w - 32.0
            dfs = 5.0
            while dfs > 4.0 and stringWidth(details_str, 'Helvetica', dfs) > max_dw:
                dfs -= 0.2
            pdf.setFont('Helvetica', dfs)
            pdf.setFillColor(HexColor('#64748B'))
            pdf.drawString(left_x + 22.0, cur_y + 4.5, details_str)

    else:
        # Compact single-line cards for 6+ programs
        gap_y = max(2.5, min(4.0, 18.0 / float(num_progs)))
        box_h = min(17.0, (total_avail - (num_progs - 1) * gap_y) / float(num_progs))

        for i, (p_name, p) in enumerate(programs_list):
            cur_y = available_top - i * (box_h + gap_y) - box_h

            pdf.setFillColor(HexColor('#F8FAFC'))
            pdf.setStrokeColor(HexColor('#E2E8F0'))
            pdf.setLineWidth(0.5)
            pdf.roundRect(left_x, cur_y, item_w, box_h, radius=3.5, stroke=1, fill=1)

            # Program Type classification & accent stripe
            p_type_val = getattr(p, 'program_type', None) or ('stage' if getattr(p, 'is_stage', False) else 'off_stage')
            norm_t = (p_type_val or '').lower()
            if 'on' in norm_t and 'stage' in norm_t or norm_t == 'stage':
                type_label = 'On-Stage'
                accent_color = HexColor('#4F46E5')
            elif 'sport' in norm_t:
                type_label = 'Sports'
                accent_color = HexColor('#059669')
            elif 'off' in norm_t:
                type_label = 'Off-Stage'
                accent_color = HexColor('#D97706')
            else:
                type_label = str(p_type_val).title()
                accent_color = HexColor('#4F46E5')

            pdf.setFillColor(accent_color)
            pdf.roundRect(left_x, cur_y + 2.5, 2.0, box_h - 5.0, radius=1.0, stroke=0, fill=1)

            # Index
            pdf.setFont('Helvetica-Bold', 5.2)
            pdf.setFillColor(HexColor('#64748B'))
            pdf.drawString(left_x + 6.0, cur_y + (box_h - 5.2) / 2.0, f'{i+1:02d}.')

            # Stage / Type Tag on the right
            p_stage = (p.stage.name if getattr(p, 'stage', None) else (getattr(p, 'venue', '') or '')).strip()
            tag_text = f"{type_label} • {p_stage}" if p_stage else type_label
            tag_w = stringWidth(tag_text, 'Helvetica-Bold', 4.5)
            tag_box_w = tag_w + 6.0
            tag_x = left_x + item_w - tag_box_w - 4.0
            tag_h = min(10.5, box_h - 4.0)
            tag_y = cur_y + (box_h - tag_h) / 2.0
            pdf.setFillColor(HexColor('#EEF2FF'))
            pdf.roundRect(tag_x, tag_y, tag_box_w, tag_h, radius=2.5, stroke=0, fill=1)
            pdf.setFont('Helvetica-Bold', 4.5)
            pdf.setFillColor(HexColor('#312E81'))
            pdf.drawCentredString(tag_x + tag_box_w / 2.0, tag_y + 2.5, tag_text)

            # Program Name
            clean_n = str(p_name).strip().upper()
            max_nw = (tag_x - (left_x + 18.0)) - 4.0
            fs = 6.0
            while fs > 4.5 and stringWidth(clean_n, 'Helvetica-Bold', fs) > max_nw:
                fs -= 0.3
            if stringWidth(clean_n, 'Helvetica-Bold', fs) > max_nw:
                while clean_n and stringWidth(clean_n + '…', 'Helvetica-Bold', fs) > max_nw:
                    clean_n = clean_n[:-1]
                clean_n += '…'

            pdf.setFont('Helvetica-Bold', fs)
            pdf.setFillColor(HexColor('#0F172A'))
            pdf.drawString(left_x + 18.0, cur_y + (box_h - fs) / 2.0, clean_n)

    # 8. "Powered by Eventloo" at bottom center
    eventloo_icon_path = _resolve_eventloo_icon_path()
    f_y = card_y + 14.0
    icon_w = 8.5
    gap = 4.0
    p_w = stringWidth('Powered by ', 'Helvetica', 5.2)
    e_w = stringWidth('Eventloo', 'Helvetica-Bold', 5.5)
    total_brand_w = (icon_w + gap if eventloo_icon_path else 0.0) + p_w + e_w
    brand_start_x = card_center_x - total_brand_w / 2.0

    if eventloo_icon_path:
        try:
            pdf.drawImage(eventloo_icon_path, brand_start_x, f_y - 1.0, width=icon_w, height=icon_w, mask='auto', preserveAspectRatio=True)
            brand_start_x += icon_w + gap
        except Exception as err:
            logger.warning("Eventloo back badge icon draw failed: %s", err)

    pdf.setFont('Helvetica', 5.2)
    pdf.setFillColor(HexColor('#64748B'))
    pdf.drawString(brand_start_x, f_y + 0.8, 'Powered by ')
    pdf.setFont('Helvetica-Bold', 5.5)
    pdf.setFillColor(HexColor('#0F172A'))
    pdf.drawString(brand_start_x + p_w, f_y + 0.8, 'Eventloo')

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
            rec_student_id = getattr(recipient.student, 'id', None)
            student_assignments_list = assignments_by_student.get(rec_student_id)
            student_chest_num = chest_numbers_by_student.get(rec_student_id)

            # 1. Front Side Badge
            pdf.setPageSize((page_width, page_height))
            pdf.saveState()
            pdf.translate(offset_x, offset_y)
            pdf.scale(scale, scale)
            _draw_paper_badge(
                pdf, 0, 0, badge_ref_w, badge_ref_h,
                recipient, event, category_names, base_url=base_url,
                event_program_types=event_program_types,
                prefetched_assignments=student_assignments_list,
                prefetched_chest_number=student_chest_num,
            )
            pdf.restoreState()
            pdf.showPage()

            # 2. Back Side Badge (Programs list & event info)
            pdf.setPageSize((page_width, page_height))
            pdf.saveState()
            pdf.translate(offset_x, offset_y)
            pdf.scale(scale, scale)
            _draw_paper_badge_back(
                pdf, 0, 0, badge_ref_w, badge_ref_h,
                recipient, event, category_names, base_url=base_url,
                event_program_types=event_program_types,
                prefetched_assignments=student_assignments_list,
                prefetched_chest_number=student_chest_num,
            )
            pdf.restoreState()
            pdf.showPage()

    pdf.save()
    buffer.seek(0)
    return buffer
