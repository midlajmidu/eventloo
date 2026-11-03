import logging
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

def _draw_paper_badge(pdf, cell_x, cell_y, badge_width, badge_height, recipient, event, category_names=None, base_url=None):
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
      - Right: Stats columns (Total Events, Stage Events, Off-Stage Events)
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
    p_wave1.moveTo(card_x, card_y + 20)
    p_wave1.curveTo(card_x + 50, card_y + 32, card_x + 110, card_y + 8, card_x + card_w, card_y + 22)
    p_wave1.lineTo(card_x + card_w, card_y)
    p_wave1.lineTo(card_x, card_y)
    p_wave1.close()
    pdf.setFillColor(HexColor('#C7D2FE'))
    pdf.drawPath(p_wave1, stroke=0, fill=1)

    # Foreground Dark Wave (Deep Indigo / #312E81)
    p_wave2 = pdf.beginPath()
    p_wave2.moveTo(card_x, card_y + 12)
    p_wave2.curveTo(card_x + 65, card_y + 22, card_x + 120, card_y + 4, card_x + card_w, card_y + 30)
    p_wave2.lineTo(card_x + card_w, card_y)
    p_wave2.lineTo(card_x, card_y)
    p_wave2.close()
    pdf.setFillColor(HexColor('#312E81'))
    pdf.drawPath(p_wave2, stroke=0, fill=1)

    # Card border redraw to keep corners crisp over waves
    pdf.setStrokeColor(HexColor('#CBD5E1'))
    pdf.setLineWidth(0.5)
    pdf.roundRect(card_x, card_y, card_w, card_h, radius=8, stroke=1, fill=0)

    # 3. Top Header: —— Eventloo ——
    y_logo = card_top - 20
    pdf.setStrokeColor(HexColor('#CBD5E1'))
    pdf.setLineWidth(0.5)
    pdf.line(card_x + 16, y_logo + 3, card_x + 46, y_logo + 3)
    pdf.line(card_x + card_w - 46, y_logo + 3, card_x + card_w - 16, y_logo + 3)

    # Eventloo Logo Icon + Text
    pdf.saveState()
    # Mini loop mark
    pdf.setStrokeColor(HexColor('#4F46E5'))
    pdf.setLineWidth(1.1)
    loop_cx = card_center_x - 30
    loop_cy = y_logo + 3.5
    pdf.circle(loop_cx - 3, loop_cy, 2.8, stroke=1, fill=0)
    pdf.circle(loop_cx + 3, loop_cy, 2.8, stroke=1, fill=0)
    pdf.restoreState()

    pdf.setFont('Helvetica-Bold', 10.5)
    pdf.setFillColor(HexColor('#0F172A'))
    pdf.drawString(card_center_x - 18, y_logo, 'Eventloo')

    # 4. Festival / Event Line: FESTIVAL : [EVENT NAME]
    y_fest = card_top - 38
    fest_lbl = 'FESTIVAL : '
    lbl_w = stringWidth(fest_lbl, 'Helvetica', 6.5)
    event_title = (event.title or 'FESTIVAL').upper()
    title_w = stringWidth(event_title, 'Helvetica-Bold', 7.5)
    start_fest_x = card_center_x - (lbl_w + title_w) / 2.0
    
    pdf.setFont('Helvetica', 6.5)
    pdf.setFillColor(HexColor('#64748B'))
    pdf.drawString(start_fest_x, y_fest, fest_lbl)

    pdf.setFont('Helvetica-Bold', 7.5)
    pdf.setFillColor(HexColor('#0F172A'))
    pdf.drawString(start_fest_x + lbl_w, y_fest, event_title)

    # 5. Participant Name
    y_name = card_top - 68
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
    chest_number = assignment.chest_number
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
    team_name = assignment.team.name if assignment.team else (
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
    if grade and section:
        grade_sec = f"Grade {grade} - {section}"
    elif grade:
        grade_sec = f"Grade {grade}"
    elif getattr(student, 'student_id', None):
        grade_sec = f"ID: {student.student_id}"
    else:
        grade_sec = getattr(student, 'gender', 'Student').title()

    pills_data = [
        (card_x + 10.0, team_name.upper()),
        (card_x + 65.0, category_display),
        (card_x + 120.0, grade_sec)
    ]

    for px, ptext in pills_data:
        # 1. Background pill with crisp light background and border
        pdf.setFillColor(HexColor('#F8FAFC'))
        pdf.setStrokeColor(HexColor('#CBD5E1'))
        pdf.setLineWidth(0.5)
        pdf.roundRect(px, y_badges, badge_item_w, badge_item_h, radius=4, stroke=1, fill=1)

        # 2. Text in clear dark slate
        pdf.setFont('Helvetica-Bold', 5.5)
        pdf.setFillColor(HexColor('#0F172A'))

        clean_text = str(ptext).strip()
        t_w = stringWidth(clean_text, 'Helvetica-Bold', 5.5)
        if t_w > badge_item_w - 4:
            while clean_text and stringWidth(clean_text + '…', 'Helvetica-Bold', 5.5) > badge_item_w - 4:
                clean_text = clean_text[:-1]
            clean_text = clean_text + '…'
        pdf.drawCentredString(px + badge_item_w / 2.0, y_badges + 4.5, clean_text)

    # 8. Divider Line
    y_div = card_top - 138
    pdf.setStrokeColor(HexColor('#F1F5F9'))
    pdf.setLineWidth(0.6)
    pdf.line(card_x + 10, y_div, card_x + card_w - 10, y_div)

    # 9. Programs List (Left) and Stats (Right)
    student_assignments = ProgramAssignment.objects.filter(
        student=student, program__event=event
    ).select_related('program').order_by('program__start_time', 'program__name')

    programs_list = []
    seen_progs = set()
    stage_count = 0
    offstage_count = 0
    for pa in student_assignments:
        p = pa.program
        if p and p.id not in seen_progs:
            seen_progs.add(p.id)
            programs_list.append(p.name)
            if getattr(p, 'program_type', 'off_stage') == 'stage':
                stage_count += 1
            else:
                offstage_count += 1

    if not programs_list and assignment.program:
        programs_list = [assignment.program.name]
        if getattr(assignment.program, 'program_type', 'off_stage') == 'stage':
            stage_count = 1
        else:
            offstage_count = 1

    total_count = len(programs_list)

    # Left: PROGRAMS
    y_prog_head = card_top - 150
    pdf.setFont('Helvetica-Bold', 6.5)
    pdf.setFillColor(HexColor('#4338CA'))
    pdf.drawString(card_x + 12, y_prog_head, 'PROGRAMS')

    for idx, p_name in enumerate(programs_list[:4]):
        y_item = y_prog_head - 9 - idx * 8.5
        pdf.setFillColor(HexColor('#4F46E5'))
        pdf.circle(card_x + 15, y_item + 2, 1.2, stroke=0, fill=1)
        pdf.setFont('Helvetica', 5.5)
        pdf.setFillColor(HexColor('#0F172A'))
        display_name = p_name if len(programs_list) <= 4 or idx < 3 else f'+ {len(programs_list) - 3} more'
        pdf.drawString(card_x + 19, y_item, display_name[:18])

    # Right: 3 Stats Columns
    stats_left = card_x + 82
    col_w = 29.0
    y_stat_num = y_prog_head - 10

    # Col 1: Total Events
    c1_cx = stats_left + col_w / 2.0
    pdf.setFont('Helvetica-Bold', 10.5)
    pdf.setFillColor(HexColor('#0F172A'))
    pdf.drawCentredString(c1_cx, y_stat_num, str(total_count))
    pdf.setFont('Helvetica', 4.5)
    pdf.setFillColor(HexColor('#64748B'))
    pdf.drawCentredString(c1_cx, y_stat_num - 7, 'Total')
    pdf.drawCentredString(c1_cx, y_stat_num - 12, 'Events')

    # Divider 1
    d1_x = stats_left + col_w
    pdf.setStrokeColor(HexColor('#E2E8F0'))
    pdf.setLineWidth(0.5)
    pdf.line(d1_x, y_stat_num + 8, d1_x, y_stat_num - 14)

    # Col 2: Stage Events
    c2_cx = d1_x + col_w / 2.0
    pdf.setFont('Helvetica-Bold', 10.5)
    pdf.setFillColor(HexColor('#0F172A'))
    pdf.drawCentredString(c2_cx, y_stat_num, str(stage_count))
    pdf.setFont('Helvetica', 4.5)
    pdf.setFillColor(HexColor('#64748B'))
    pdf.drawCentredString(c2_cx, y_stat_num - 7, 'Stage')
    pdf.drawCentredString(c2_cx, y_stat_num - 12, 'Events')

    # Divider 2
    d2_x = d1_x + col_w
    pdf.line(d2_x, y_stat_num + 8, d2_x, y_stat_num - 14)

    # Col 3: Off-Stage Events
    c3_cx = d2_x + col_w / 2.0
    pdf.setFont('Helvetica-Bold', 10.5)
    pdf.setFillColor(HexColor('#0F172A'))
    pdf.drawCentredString(c3_cx, y_stat_num, str(offstage_count))
    pdf.setFont('Helvetica', 4.5)
    pdf.setFillColor(HexColor('#64748B'))
    pdf.drawCentredString(c3_cx, y_stat_num - 7, 'Off-Stage')
    pdf.drawCentredString(c3_cx, y_stat_num - 12, 'Events')

    # 10. Official Verification QR Code in Bottom Right
    qr_box_w = 46.0
    qr_box_h = 52.0
    qr_box_x = card_x + card_w - qr_box_w - 9.0
    qr_box_y = card_y + 8.0

    # Clean white container badge with rounded corners and subtle border
    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.setStrokeColor(HexColor('#CBD5E1'))
    pdf.setLineWidth(0.6)
    pdf.roundRect(qr_box_x, qr_box_y, qr_box_w, qr_box_h, radius=5, stroke=1, fill=1)

    # Resolve target URL for public digital badge
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
        qr_draw_x = qr_box_x + (qr_box_w - qr_size) / 2.0
        qr_draw_y = qr_box_y + 11.5
        renderPDF.draw(d, pdf, qr_draw_x, qr_draw_y)
    except Exception as qr_err:
        logger.warning("Badge QR generation failed: %s", qr_err)

    # Micro label below QR
    pdf.setFont('Helvetica-Bold', 4.2)
    pdf.setFillColor(HexColor('#312E81'))
    pdf.drawCentredString(qr_box_x + qr_box_w / 2.0, qr_box_y + 4.0, 'SCAN TO VERIFY')

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

    # 2. Badges (9 badges per A4 portrait page, 3x3 grid)
    if badge_recipients:
        page_width, page_height = portrait(A4)
        cols = 3
        rows = 3
        badges_per_page = cols * rows  # 9
        badge_width = 186.0
        badge_height = 266.0
        margin_x = (page_width - cols * badge_width) / 2.0   # ~18.64 pt
        margin_y = (page_height - rows * badge_height) / 2.0  # ~21.94 pt

        for page_start in range(0, len(badge_recipients), badges_per_page):
            pdf.setPageSize((page_width, page_height))
            page_batch = badge_recipients[page_start:page_start + badges_per_page]

            # Draw outer cut marks in page margins
            _draw_crop_marks(pdf, page_width, page_height, margin_x, margin_y, cols, rows, badge_width, badge_height)

            # Draw 3x3 grid cut guides
            pdf.saveState()
            pdf.setStrokeColor(HexColor('#CBD5E1'))
            pdf.setLineWidth(0.4)
            pdf.setDash(2, 2)
            for i in range(badges_per_page):
                r = i // cols
                c = i % cols
                cx = margin_x + c * badge_width
                cy = page_height - margin_y - (r + 1) * badge_height
                pdf.rect(cx, cy, badge_width, badge_height, stroke=1, fill=0)
            pdf.restoreState()

            # Render each badge in current page batch using the official paper badge model
            for idx, recipient in enumerate(page_batch):
                row = idx // cols
                col = idx % cols
                cell_x = margin_x + col * badge_width
                cell_y = page_height - margin_y - (row + 1) * badge_height

                _draw_paper_badge(
                    pdf, cell_x, cell_y, badge_width, badge_height,
                    recipient, event, category_names, base_url=base_url
                )

            pdf.showPage()

    pdf.save()
    buffer.seek(0)
    return buffer
