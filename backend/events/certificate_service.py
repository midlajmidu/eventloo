from dataclasses import dataclass
from io import BytesIO

from django.core.exceptions import ValidationError
from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape, portrait
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

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


def render_certificates_pdf(event, templates_by_type, recipients, quality='standard'):
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
        badge_template = templates_by_type['badge']
        fields = normalize_certificate_fields(badge_template.fields)
        if badge_template.id not in prepared_images:
            prepared_images[badge_template.id] = _prepare_background(badge_template, quality)
        badge_bg = prepared_images[badge_template.id]

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
            pdf.setStrokeColor(HexColor('#E2E8F0'))
            pdf.setLineWidth(0.4)
            pdf.setDash(2, 2)
            for i in range(badges_per_page):
                r = i // cols
                c = i % cols
                cx = margin_x + c * badge_width
                cy = page_height - margin_y - (r + 1) * badge_height
                pdf.rect(cx, cy, badge_width, badge_height, stroke=1, fill=0)
            pdf.restoreState()

            # Render each badge in current page batch
            for idx, recipient in enumerate(page_batch):
                row = idx // cols
                col = idx % cols
                cell_x = margin_x + col * badge_width
                cell_y = page_height - margin_y - (row + 1) * badge_height

                badge_bg.seek(0)
                pdf.drawImage(ImageReader(badge_bg), cell_x, cell_y, badge_width, badge_height, preserveAspectRatio=False)

                # Draw crisp card boundary for cutting
                pdf.saveState()
                pdf.setStrokeColor(HexColor('#CBD5E1'))
                pdf.setLineWidth(0.5)
                pdf.setDash(2, 2)
                pdf.rect(cell_x, cell_y, badge_width, badge_height, stroke=1, fill=0)
                pdf.restoreState()

                # Draw all enabled badge fields
                values = certificate_field_values(recipient, event, category_names)
                for field_id, field in fields.items():
                    if field.get('enabled'):
                        _draw_field(
                            pdf, field, values.get(field_id, field.get('sample', '')),
                            box_x=cell_x, box_y=cell_y, box_width=badge_width, box_height=badge_height,
                            reference_width=240.0
                        )

            pdf.showPage()

    pdf.save()
    buffer.seek(0)
    return buffer
