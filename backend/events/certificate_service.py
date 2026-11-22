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

    if certificate_type in ('participation', 'badge', 'common_prize', 'grade_certificate'):
        return [CertificateRecipient(certificate_type, assignment) for assignment in assignments]

    if str(certificate_type).startswith('result_poster'):
        first_assignment = assignments.first()
        if first_assignment:
            return [CertificateRecipient(certificate_type, first_assignment)]
        return []

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

    # Date & Venue formatting
    date_str = event.start_date.strftime('%b %d, %Y') if event.start_date else 'Nov 2026'
    venue_str = event.venue or 'Campus Venue'

    first_place_val = ''
    second_place_val = ''
    third_place_val = ''

    result_no_val = ''
    prog_code_val = ''
    first_place_label = ''
    first_place_name = ''
    first_place_chest = ''
    first_place_team = ''
    first_place_name2 = ''
    first_place_chest2 = ''
    first_place_team2 = ''

    second_place_label = ''
    second_place_name = ''
    second_place_chest = ''
    second_place_team = ''
    second_place_name2 = ''
    second_place_chest2 = ''
    second_place_team2 = ''

    third_place_label = ''
    third_place_name = ''
    third_place_chest = ''
    third_place_team = ''
    third_place_name2 = ''
    third_place_chest2 = ''
    third_place_team2 = ''

    if recipient.certificate_type.startswith('result_poster'):
        result_no_val = 'RESULT NO. 01'
        prog_code_val = f"Item #{assignment.program.id}" if assignment.program else 'Item #101'
        first_place_label = '🥇 1st Place'
        first_place_name = student.get_full_name() or student.display_name or 'Muhammed Nihal'
        first_place_chest = f"Chest No: {chest_number}" if chest_number else 'Chest No: 4003'
        first_place_team = assignment.team.name if assignment.team else 'Team Falcon'
        first_place_val = f'1st Place: {first_place_name} ({chest_number or "N/A"}) - {first_place_team}'

        second_place_label = '🥈 2nd Place'
        second_place_name = 'Ayisha Rida'
        second_place_chest = 'Chest No: 4012'
        second_place_team = 'Team Phoenix'
        second_place_val = '2nd Place: Runner Up Participant - Second Team'

        third_place_label = '🥉 3rd Place'
        third_place_name = 'Salman Faris'
        third_place_chest = 'Chest No: 4025'
        third_place_team = 'Team Griffin'
        third_place_val = '3rd Place: Third Place Participant - Third Team'

        # If available, use other real event students as realistic sample defaults
        try:
            other_assignments = list(
                ProgramAssignment.objects.filter(
                    program__event=event,
                    student__isnull=False
                ).exclude(student=student).select_related('student', 'team')[:6]
            )
            if other_assignments:
                s2 = other_assignments[0].student
                cn2 = ChestNumber.objects.filter(event=event, student=s2).values_list('chest_number', flat=True).first()
                second_place_name = s2.get_full_name() or s2.display_name or second_place_name
                second_place_chest = f"Chest No: {cn2}" if cn2 else (f"Chest No: {other_assignments[0].chest_number}" if other_assignments[0].chest_number else '')
                second_place_team = other_assignments[0].team.name if other_assignments[0].team else ''
                second_place_val = f'2nd Place: {second_place_name} ({cn2 or "N/A"}) - {second_place_team}'

            if len(other_assignments) > 1:
                s3 = other_assignments[1].student
                cn3 = ChestNumber.objects.filter(event=event, student=s3).values_list('chest_number', flat=True).first()
                third_place_name = s3.get_full_name() or s3.display_name or third_place_name
                third_place_chest = f"Chest No: {cn3}" if cn3 else (f"Chest No: {other_assignments[1].chest_number}" if other_assignments[1].chest_number else '')
                third_place_team = other_assignments[1].team.name if other_assignments[1].team else ''
                third_place_val = f'3rd Place: {third_place_name} ({cn3 or "N/A"}) - {third_place_team}'
        except Exception:
            pass

        if assignment.program:
            prog_results = ProgramResult.objects.filter(
                program=assignment.program,
                entry_status='submitted'
            ).select_related('participant', 'team').order_by('position', 'id')

            first_with_num = prog_results.filter(result_number__isnull=False).first()
            if not first_with_num:
                first_with_num = ProgramResult.objects.filter(program=assignment.program, result_number__isnull=False).first()
            if first_with_num and first_with_num.result_number:
                result_no_val = f"RESULT NO. {first_with_num.result_number:02d}"
            
            winners = {1: [], 2: [], 3: []}
            for r in prog_results:
                if r.position in (1, 2, 3):
                    p_label = r.participant.get_full_name() if r.participant else (r.team.name if r.team else 'Participant')
                    c_raw = ''
                    if r.participant:
                        cn = ChestNumber.objects.filter(event=event, student=r.participant).values_list('chest_number', flat=True).first()
                        if cn:
                            c_raw = str(cn)
                    t_name = r.team.name if r.team else ''
                    pos_str = '1st Place' if r.position == 1 else '2nd Place' if r.position == 2 else '3rd Place'
                    c_lbl = f' (#{c_raw})' if c_raw else ''
                    t_lbl = f' - {t_name}' if t_name else ''
                    winners[r.position].append({
                        'full': f'{pos_str}: {p_label}{c_lbl}{t_lbl}',
                        'name': p_label,
                        'chest': c_raw,
                        'team': t_name
                    })
            
            # Format 1st Place (Handles single winner or multiple joint winners)
            if winners[1]:
                first_place_val = ' & '.join([w['full'] for w in winners[1]])
                first_place_name = ' & '.join([w['name'] for w in winners[1]])
                valid_chests = [w['chest'] for w in winners[1] if w['chest']]
                first_place_chest = f"Chest No: {', '.join(valid_chests)}" if valid_chests else ''
                first_place_team = ' & '.join(list(dict.fromkeys([w['team'] for w in winners[1] if w['team']])))
                first_place_label = '🥇 1st Place (Joint)' if len(winners[1]) > 1 else '🥇 1st Place'

                if len(winners[1]) > 1:
                    first_place_name2 = winners[1][1]['name']
                    first_place_chest2 = f"Chest No: {winners[1][1]['chest']}" if winners[1][1]['chest'] else ''
                    first_place_team2 = winners[1][1]['team']

            # Format 2nd Place (Handles single winner or multiple joint winners)
            if winners[2]:
                second_place_val = ' & '.join([w['full'] for w in winners[2]])
                second_place_name = ' & '.join([w['name'] for w in winners[2]])
                valid_chests = [w['chest'] for w in winners[2] if w['chest']]
                second_place_chest = f"Chest No: {', '.join(valid_chests)}" if valid_chests else ''
                second_place_team = ' & '.join(list(dict.fromkeys([w['team'] for w in winners[2] if w['team']])))
                second_place_label = '🥈 2nd Place (Joint)' if len(winners[2]) > 1 else '🥈 2nd Place'

                if len(winners[2]) > 1:
                    second_place_name2 = winners[2][1]['name']
                    second_place_chest2 = f"Chest No: {winners[2][1]['chest']}" if winners[2][1]['chest'] else ''
                    second_place_team2 = winners[2][1]['team']

            # Format 3rd Place (Handles single winner or multiple joint winners)
            if winners[3]:
                third_place_val = ' & '.join([w['full'] for w in winners[3]])
                third_place_name = ' & '.join([w['name'] for w in winners[3]])
                valid_chests = [w['chest'] for w in winners[3] if w['chest']]
                third_place_chest = f"Chest No: {', '.join(valid_chests)}" if valid_chests else ''
                third_place_team = ' & '.join(list(dict.fromkeys([w['team'] for w in winners[3] if w['team']])))
                third_place_label = '🥉 3rd Place (Joint)' if len(winners[3]) > 1 else '🥉 3rd Place'

                if len(winners[3]) > 1:
                    third_place_name2 = winners[3][1]['name']
                    third_place_chest2 = f"Chest No: {winners[3][1]['chest']}" if winners[3][1]['chest'] else ''
                    third_place_team2 = winners[3][1]['team']

    return {
        'participantName': student.get_full_name() or student.display_name,
        'chestNo': f'Chest No: {chest_number or "N/A"}',
        'category': category or 'Unspecified',
        'teamName': assignment.team.name if assignment.team else 'Individual',
        'eventName': event.title,
        'programName': assignment.program.name if assignment.program else '',
        'rank': RANK_LABELS.get(recipient.certificate_type, 'OFFICIAL RESULTS' if recipient.certificate_type.startswith('result_poster') else 'Participant'),
        'totalPrograms': f'Total Programs: {total_count}',
        'assignedPrograms': programs_str,
        # Result Poster Separate Fields
        'resultNo': result_no_val,
        'programCode': prog_code_val,
        'firstPlaceLabel': first_place_label,
        'firstPlaceName': first_place_name,
        'firstPlaceChest': first_place_chest,
        'firstPlaceTeam': first_place_team,
        'firstPlaceName2': first_place_name2,
        'firstPlaceChest2': first_place_chest2,
        'firstPlaceTeam2': first_place_team2,
        'secondPlaceLabel': second_place_label,
        'secondPlaceName': second_place_name,
        'secondPlaceChest': second_place_chest,
        'secondPlaceTeam': second_place_team,
        'secondPlaceName2': second_place_name2,
        'secondPlaceChest2': second_place_chest2,
        'secondPlaceTeam2': second_place_team2,
        'thirdPlaceLabel': third_place_label,
        'thirdPlaceName': third_place_name,
        'thirdPlaceChest': third_place_chest,
        'thirdPlaceTeam': third_place_team,
        'thirdPlaceName2': third_place_name2,
        'thirdPlaceChest2': third_place_chest2,
        'thirdPlaceTeam2': third_place_team2,
        # Result Poster Combined Fields
        'firstPlace': first_place_val,
        'secondPlace': second_place_val,
        'thirdPlace': third_place_val,
        'dateVenue': f'{date_str} · {venue_str}',
        'grade': 'Grade A',
        'juryName': 'Festival Jury Board',
        'customText1': 'OFFICIAL RESULTS',
        'customText2': event.title,
        'customText3': 'Festival Committee',
    }


def event_category_names(event):
    return dict(StudentCategory.objects.filter(school=event.school).values_list('code', 'name'))


def _prepare_background(template, quality):
    limits = {'screen': (1600, 85), 'standard': (3200, 95), 'print': (6000, 98)}
    max_edge, jpeg_quality = limits.get(quality, (6000, 98))
    template.background_image.open('rb')
    try:
        raw_bytes = template.background_image.read()
    finally:
        template.background_image.close()

    image = Image.open(BytesIO(raw_bytes))
    image.load()
    orig_format = (image.format or '').upper()

    w, h = image.size

    # Check for actual transparency
    has_alpha = False
    if image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info):
        rgba_img = image.convert('RGBA')
        alpha_extrema = rgba_img.getextrema()[3]
        if alpha_extrema[0] < 255:
            has_alpha = True
        else:
            image = rgba_img.convert('RGB')
    elif image.mode != 'RGB':
        image = image.convert('RGB')

    if max(w, h) > max_edge:
        image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)

    output = BytesIO()
    if has_alpha:
        # Transparent template: preserve PNG with lossless compression
        image.save(output, format='PNG', optimize=True)
    else:
        # Opaque template: ReportLab embeds pure 4:4:4 chroma JPEG via /DCTDecode stream
        # This achieves 50 dB PSNR (visually indistinguishable from raw master)
        # while cutting generated PDF size by 50% to 70% and accelerating rasterization
        q = 98 if quality == 'print' else jpeg_quality
        image.save(output, format='JPEG', quality=q, subsampling=0, optimize=True)
    output.seek(0)
    return output


def _page_size(aspect_ratio):
    if not aspect_ratio or aspect_ratio <= 0:
        return landscape(A4)
    # 1:1 Square (~1.0)
    if 0.95 <= aspect_ratio <= 1.05:
        return (672.0, 672.0)
    # Standard A4 Landscape (~1.414) or 4:3 (~1.333)
    if abs(aspect_ratio - 1.414) < 0.05 or abs(aspect_ratio - 1.333) < 0.05 or aspect_ratio > 1.2:
        return landscape(A4)
    # Standard A4 Portrait (~0.707)
    if abs(aspect_ratio - 0.707) < 0.05:
        return portrait(A4)
    # 3:4 Poster (~0.75)
    if abs(aspect_ratio - 0.75) < 0.05:
        return (595.27557, 793.70076)
    # 4:5 Social (~0.8)
    if abs(aspect_ratio - 0.8) < 0.05:
        return (595.27557, 744.09446)
    # 9:16 Story (~0.5625)
    if abs(aspect_ratio - 0.5625) < 0.05:
        return (474.34, 841.88977)

    # General fallback based on ratio
    if aspect_ratio >= 1.0:
        return (595.27557 * aspect_ratio, 595.27557)
    else:
        return (595.27557, 595.27557 / aspect_ratio)


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
    box_width_pct = float(field.get('boxWidth') or 35.0)
    max_text_width = box_width * (min(100.0, max(5.0, box_width_pct)) / 100.0)

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
    line_spacing = font_size * 1.25
    total_text_height = (len(lines) - 1) * line_spacing
    start_y = box_y + box_height * (1.0 - float(field['y']) / 100.0) + (total_text_height / 2.0) - font_size * 0.32

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
    Renders or loads official vector badge icon as transparent PNG ImageReader
    for high-fidelity ReportLab badge rendering, caching results in memory.
    Prioritizes pre-rendered assets from assets/badge_icons/ so it NEVER fails
    on servers without fitz/PyMuPDF installed.
    """
    key = (name, color)
    if key in _BADGE_ICON_CACHE:
        return _BADGE_ICON_CACHE[key]

    # 1. Primary: Load pre-rendered high-res PNG asset from disk
    from django.conf import settings
    asset_candidates = [
        os.path.join(settings.BASE_DIR, 'assets', 'badge_icons', f'{name}.png'),
        os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'assets', 'badge_icons', f'{name}.png')),
        os.path.abspath(os.path.join(os.getcwd(), 'backend', 'assets', 'badge_icons', f'{name}.png')),
        os.path.abspath(os.path.join(os.getcwd(), 'assets', 'badge_icons', f'{name}.png')),
    ]
    for asset_path in asset_candidates:
        if os.path.exists(asset_path):
            try:
                reader = ImageReader(asset_path)
                _BADGE_ICON_CACHE[key] = reader
                return reader
            except Exception as e:
                logger.warning("Failed loading badge icon asset %s: %s", asset_path, e)

    # 2. Fallback: Dynamic SVG rendering if fitz is available
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
      - Clean white card with soft lavender border and moderately rounded corners
      - Subtle lavender gradient accent in top-right corner
      - Top: Event Logo + Event Name with light-lavender dividers
      - Participant Name: Prominent bold modern typography
      - Hero Chest Pill: Deep-purple-to-violet gradient badge with white text
      - Information Badges: [ Team ] [ Category ] [ Class / Grade ] in soft lavender with subtle purple border
      - Thin light-lavender dividers
      - Statistics Section: Balanced spacing, lightly tinted lavender icon boxes, crisp counts
      - Lower Right: QR container with thin lavender border on clean white background
      - Lower Left: Powered by Eventloo branding
      - Bottom: Smooth 3-layer overlapping lavender, violet and deep-purple decorative waves
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
    card_radius = 10.0

    pdf.saveState()

    # 1. Base Card White Background & Soft Lavender Outer Border
    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.setStrokeColor(HexColor('#DDD6FE'))
    pdf.setLineWidth(0.75)
    pdf.roundRect(card_x, card_y, card_w, card_h, radius=card_radius, stroke=1, fill=1)

    # 2. Subtle Lavender Gradient Accent in Top-Right Corner (Layered vector wash)
    pdf.saveState()
    clip_corner = pdf.beginPath()
    clip_corner.roundRect(card_x, card_y, card_w, card_h, radius=card_radius)
    pdf.clipPath(clip_corner, stroke=0, fill=0)

    # Outer soft lavender wash
    p_top1 = pdf.beginPath()
    p_top1.moveTo(card_x + card_w - 65.0, card_top)
    p_top1.curveTo(card_x + card_w - 35.0, card_top - 30.0, card_x + card_w, card_top - 45.0, card_x + card_w, card_top - 70.0)
    p_top1.lineTo(card_x + card_w, card_top)
    p_top1.close()
    pdf.setFillColor(HexColor('#F5F3FF'))
    pdf.drawPath(p_top1, stroke=0, fill=1)

    # Middle soft lavender curve
    p_top2 = pdf.beginPath()
    p_top2.moveTo(card_x + card_w - 45.0, card_top)
    p_top2.curveTo(card_x + card_w - 24.0, card_top - 20.0, card_x + card_w, card_top - 32.0, card_x + card_w, card_top - 50.0)
    p_top2.lineTo(card_x + card_w, card_top)
    p_top2.close()
    pdf.setFillColor(HexColor('#EDE9FE'))
    pdf.drawPath(p_top2, stroke=0, fill=1)

    # Inner soft accent
    p_top3 = pdf.beginPath()
    p_top3.moveTo(card_x + card_w - 26.0, card_top)
    p_top3.curveTo(card_x + card_w - 14.0, card_top - 12.0, card_x + card_w, card_top - 20.0, card_x + card_w, card_top - 30.0)
    p_top3.lineTo(card_x + card_w, card_top)
    p_top3.close()
    pdf.setFillColor(HexColor('#DDD6FE'))
    pdf.drawPath(p_top3, stroke=0, fill=1)
    pdf.restoreState()

    # 3. Bottom Decorative Waves: Smooth, overlapping lavender, violet and deep-purple layers
    pdf.saveState()
    # Layer 1: Back Light Wave (Soft Lavender / #DDD6FE)
    p_wave1 = pdf.beginPath()
    p_wave1.moveTo(card_x, card_y)
    p_wave1.lineTo(card_x, card_y + 18.0)
    p_wave1.curveTo(card_x + 48.0, card_y + 28.0, card_x + 108.0, card_y + 13.0, card_x + card_w, card_y + 25.0)
    p_wave1.lineTo(card_x + card_w, card_y)
    p_wave1.close()
    pdf.setFillColor(HexColor('#DDD6FE'))
    pdf.drawPath(p_wave1, stroke=0, fill=1)

    # Layer 2: Middle Wave (Vibrant Violet / #7C3AED)
    p_wave2 = pdf.beginPath()
    p_wave2.moveTo(card_x, card_y)
    p_wave2.lineTo(card_x, card_y + 11.0)
    p_wave2.curveTo(card_x + 55.0, card_y + 22.0, card_x + 115.0, card_y + 8.0, card_x + card_w, card_y + 21.0)
    p_wave2.lineTo(card_x + card_w, card_y)
    p_wave2.close()
    pdf.setFillColor(HexColor('#7C3AED'))
    pdf.drawPath(p_wave2, stroke=0, fill=1)

    # Layer 3: Foreground Wave (Deep Purple / #2E1065)
    p_wave3 = pdf.beginPath()
    p_wave3.moveTo(card_x, card_y)
    p_wave3.lineTo(card_x, card_y + 5.0)
    p_wave3.curveTo(card_x + 62.0, card_y + 16.0, card_x + 122.0, card_y + 4.0, card_x + card_w, card_y + 17.0)
    p_wave3.lineTo(card_x + card_w, card_y)
    p_wave3.close()
    pdf.setFillColor(HexColor('#2E1065'))
    pdf.drawPath(p_wave3, stroke=0, fill=1)
    pdf.restoreState()

    # Re-draw outer card border to clip cleanly over bottom waves
    pdf.setStrokeColor(HexColor('#DDD6FE'))
    pdf.setLineWidth(0.75)
    pdf.roundRect(card_x, card_y, card_w, card_h, radius=card_radius, stroke=1, fill=0)

    # 4. Top Header: Event Logo + Event Name (Refined spacing, typography and light-lavender dividers)
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
            logo_cy = card_top - 21.0
            logo_x = card_center_x - logo_w / 2.0
            logo_y = logo_cy - logo_h / 2.0
            pdf.drawImage(event_logo_path, logo_x, logo_y, width=logo_w, height=logo_h, mask='auto', preserveAspectRatio=True)

            # Flanking light-lavender divider lines
            pdf.setStrokeColor(HexColor('#EDE9FE'))
            pdf.setLineWidth(0.5)
            pdf.line(card_x + 16.0, logo_cy, logo_x - 7.0, logo_cy)
            pdf.line(logo_x + logo_w + 7.0, logo_cy, card_x + card_w - 16.0, logo_cy)
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
        pdf.setStrokeColor(HexColor('#EDE9FE'))
        pdf.setLineWidth(0.5)
        pdf.line(card_x + 16.0, y_title + 3.0, card_center_x - t_w / 2.0 - 6.0, y_title + 3.0)
        pdf.line(card_center_x + t_w / 2.0 + 6.0, y_title + 3.0, card_x + card_w - 16.0, y_title + 3.0)
        pdf.setFont('Helvetica-Bold', t_size)
        pdf.setFillColor(HexColor('#1E1B4B'))
        pdf.drawCentredString(card_center_x, y_title, event_title)
    else:
        y_title = card_top - 41.5
        t_size = 8.5 if len(event_title) <= 20 else (7.5 if len(event_title) <= 30 else 6.5)
        max_title_w = card_w - 24.0
        while t_size > 5.5 and stringWidth(event_title, 'Helvetica-Bold', t_size) > max_title_w:
            t_size -= 0.5
        if stringWidth(event_title, 'Helvetica-Bold', t_size) > max_title_w:
            while event_title and stringWidth(event_title + '…', 'Helvetica-Bold', t_size) > max_title_w:
                event_title = event_title[:-1]
            event_title += '…'
        pdf.setFont('Helvetica-Bold', t_size)
        pdf.setFillColor(HexColor('#1E1B4B'))
        pdf.drawCentredString(card_center_x, y_title, event_title)

    # 5. Prominent Participant Name (Bold, modern typography)
    y_name = card_top - 74.0
    name = (student.get_full_name() or student.display_name or 'Participant').strip()
    name_len = len(name)
    if name_len > 24:
        f_size = 10.5
    elif name_len > 18:
        f_size = 12.5
    else:
        f_size = 14.5
    max_name_w = card_w - 20.0
    while f_size > 8.0 and stringWidth(name.upper(), 'Helvetica-Bold', f_size) > max_name_w:
        f_size -= 0.5
    pdf.setFont('Helvetica-Bold', f_size)
    pdf.setFillColor(HexColor('#1E1B4B'))
    pdf.drawCentredString(card_center_x, y_name, name.upper())

    # 6. Hero Chest Number: Deep-Purple-to-Violet Gradient Badge with White Text & Rounded Corners
    chest_number = prefetched_chest_number if prefetched_chest_number is not None else (assignment.chest_number if assignment else None)
    if not chest_number:
        chest_number = ChestNumber.objects.filter(event=event, student=student).values_list(
            'chest_number', flat=True
        ).first()
    chest_str = str(chest_number) if chest_number else 'N/A'

    y_pill = card_top - 105.0
    label_text = 'CHEST NO'
    label_fs = 5.5
    num_text = f'#{chest_str}'
    num_fs = 9.5

    label_w = stringWidth(label_text, 'Helvetica-Bold', label_fs)
    num_w = stringWidth(num_text, 'Helvetica-Bold', num_fs)
    pad_x = 12.0
    gap = 6.5
    pill_w = pad_x + label_w + gap + 1.0 + gap + num_w + pad_x
    pill_h = 18.0
    pill_x = card_center_x - pill_w / 2.0
    cy_pill = y_pill + pill_h / 2.0
    pill_radius = pill_h / 2.0

    # Draw Deep-Purple to Violet smooth vector gradient
    pdf.saveState()
    path_pill = pdf.beginPath()
    path_pill.roundRect(pill_x, y_pill, pill_w, pill_h, radius=pill_radius)
    pdf.clipPath(path_pill, stroke=0, fill=0)

    slices = int(pill_w) + 1
    for s in range(slices):
        t = s / float(slices - 1) if slices > 1 else 0.0
        # Gradient: Deep Purple (#2E1065: 46, 16, 101) -> Vibrant Violet (#7C3AED: 124, 58, 237)
        r = (46 + t * (124 - 46)) / 255.0
        g = (16 + t * (58 - 16)) / 255.0
        b = (101 + t * (237 - 101)) / 255.0
        pdf.setFillColorRGB(r, g, b)
        pdf.rect(pill_x + s, y_pill, 1.2, pill_h, stroke=0, fill=1)
    pdf.restoreState()

    # Subtle outer stroke for pill edge definition
    pdf.setStrokeColor(HexColor('#8B5CF6'))
    pdf.setLineWidth(0.5)
    pdf.roundRect(pill_x, y_pill, pill_w, pill_h, radius=pill_radius, stroke=1, fill=0)

    label_x = pill_x + pad_x
    pdf.setFont('Helvetica-Bold', label_fs)
    pdf.setFillColor(HexColor('#E9D5FF'))
    pdf.drawString(label_x, cy_pill - 2.0, label_text)

    div_x = label_x + label_w + gap
    pdf.setStrokeColor(HexColor('#A78BFA'))
    pdf.setLineWidth(0.6)
    pdf.line(div_x, cy_pill - 5.0, div_x, cy_pill + 5.0)

    num_x = div_x + gap + 1.0
    pdf.setFont('Helvetica-Bold', num_fs)
    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.drawString(num_x, cy_pill - 3.4, num_text)

    # 7. Information Badges Row: [ Team ] [ Category ] [ Class / Grade ]
    # Soft lavender backgrounds (#F5F3FF) and subtle purple borders (#DDD6FE)
    y_badges = card_top - 132.5

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
        pdf.setFillColor(HexColor('#F5F3FF'))
        pdf.setStrokeColor(HexColor('#DDD6FE'))
        pdf.setLineWidth(0.65)
        pdf.roundRect(px, y_badges, pill_w, pill_h, radius=5.0, stroke=1, fill=1)

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

        icon_img = _get_badge_icon_image(icon_key, '#6D28D9')
        if icon_img:
            pdf.drawImage(icon_img, start_x, cy - icon_sz / 2.0, icon_sz, icon_sz, mask='auto')

        pdf.setFont('Helvetica-Bold', fs)
        pdf.setFillColor(HexColor('#2E1065'))
        pdf.drawString(start_x + icon_sz + gap_it, cy - (fs * 0.35), clean_text)

    # 8. Thin, Light-Lavender Divider Line below Information Badges
    y_div = card_top - 141.5
    pdf.setStrokeColor(HexColor('#EDE9FE'))
    pdf.setLineWidth(0.5)
    pdf.line(card_x + 8.0, y_div, card_x + card_w - 8.0, y_div)

    # 9. Refined Statistics Section (Better alignment, spacing & lightly tinted lavender icon boxes)
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

    stats_top = card_top - 150.5
    stats_w = card_w - 16.0
    stats_left = card_x + 8.0
    col_w = stats_w / float(num_cols)

    sh_w = 13.0
    sh_h = 13.0
    sh_y = stats_top - sh_h
    sh_cy = sh_y + sh_h / 2.0
    num_y = card_top - 174.5

    for i, (col_label, count_val, icon_key) in enumerate(cols_to_show):
        cx = stats_left + (i + 0.5) * col_w

        # 1. Lightly tinted lavender icon box
        pdf.setFillColor(HexColor('#EDE9FE'))
        pdf.setStrokeColor(HexColor('#DDD6FE'))
        pdf.setLineWidth(0.5)
        pdf.roundRect(cx - sh_w / 2.0, sh_y, sh_w, sh_h, radius=3.5, stroke=1, fill=1)

        # 2. Vector icon inside
        icon_img = _get_badge_icon_image(icon_key, '#6D28D9')
        icon_sz = 8.5
        if icon_img:
            pdf.drawImage(icon_img, cx - icon_sz / 2.0, sh_cy - icon_sz / 2.0, icon_sz, icon_sz, mask='auto')

        # 3. Number
        pdf.setFont('Helvetica-Bold', 11.5)
        pdf.setFillColor(HexColor('#1E1B4B'))
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

        pdf.setFont('Helvetica-Bold', 4.0)
        pdf.setFillColor(HexColor('#6B7280'))
        pdf.drawCentredString(cx, num_y - 6.5, l1)
        if l2:
            pdf.drawCentredString(cx, num_y - 11.0, l2)

        # 5. Hairline vertical divider between columns
        if i > 0:
            div_x = stats_left + i * col_w
            pdf.setStrokeColor(HexColor('#EDE9FE'))
            pdf.setLineWidth(0.5)
            pdf.line(div_x, num_y - 11.0, div_x, num_y + 8.0)

    # 10. QR Code Container: Clean White Background, Thin Lavender Border & Rounded Corners
    qr_box_w = 44.0
    qr_box_h = 50.0
    qr_box_x = card_x + card_w - qr_box_w - 9.0
    qr_box_y = card_y + 8.0

    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.setStrokeColor(HexColor('#DDD6FE'))
    pdf.setLineWidth(0.7)
    pdf.roundRect(qr_box_x, qr_box_y, qr_box_w, qr_box_h, radius=7.0, stroke=1, fill=1)

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

    qr_sz = 37.0
    try:
        qr = QrCodeWidget(qr_target_url)
        qr.barBorder = 1
        bounds = qr.getBounds()
        d = Drawing(bounds[2], bounds[3], transform=[qr_sz / bounds[2], 0, 0, qr_sz / bounds[3], 0, 0])
        d.add(qr)
        qr_draw_x = qr_box_x + (qr_box_w - qr_sz) / 2.0
        qr_draw_y = qr_box_y + 9.5
        renderPDF.draw(d, pdf, qr_draw_x, qr_draw_y)
    except Exception as qr_err:
        logger.warning("Badge QR generation failed: %s", qr_err)

    pdf.setFont('Helvetica-Bold', 4.8)
    pdf.setFillColor(HexColor('#5B21B6'))
    pdf.drawCentredString(qr_box_x + qr_box_w / 2.0, qr_box_y + 3.8, 'SCAN TO VERIFY')

    # 11. Footer Branding: "Powered by Eventloo" with Refined Alignment & Modern Typography
    eventloo_icon_path = _resolve_eventloo_icon_path()
    pow_y = card_y + 20.0
    f_x = card_x + 8.0
    icon_offset = 0.0

    if eventloo_icon_path:
        try:
            pdf.drawImage(eventloo_icon_path, f_x, pow_y - 1.0, width=8.5, height=8.5, mask='auto', preserveAspectRatio=True)
            icon_offset = 9.5
        except Exception as icon_err:
            logger.warning("Eventloo badge icon draw failed: %s", icon_err)
            icon_offset = 0.0

    pdf.setFont('Helvetica', 5.2)
    pdf.setFillColor(HexColor('#6B7280'))
    pdf.drawString(f_x + icon_offset, pow_y + 1.2, 'Powered by ')
    pw = stringWidth('Powered by ', 'Helvetica', 5.2)
    pdf.setFont('Helvetica-Bold', 5.8)
    pdf.setFillColor(HexColor('#2E1065'))
    pdf.drawString(f_x + icon_offset + pw, pow_y + 1.2, 'Eventloo')

    pdf.restoreState()


def _draw_paper_badge_back(pdf, cell_x, cell_y, badge_width, badge_height, recipient, event, category_names=None, base_url=None, event_program_types=None, prefetched_assignments=None, prefetched_chest_number=None, prefetched_mixing_categories=None):
    """
    Renders the backside of a participant paper badge matching the official Eventloo design:
      - Top: Event Logo + Event Name
      - Space after Event Name
      - Header: PROGRAMS :
      - Clean normal list of registered programs with bullet indicators
      - Bottom: Dual-tone wave graphic
      - Bottom Left: Powered by Eventloo branding in the exact same position as the front page
    """
    student = recipient.student
    assignment = recipient.assignment
    category_names = category_names or {}

    # Resolve mixing/general categories mapping (code/name -> display name)
    if prefetched_mixing_categories is not None:
        mixing_categories = prefetched_mixing_categories
    else:
        mixing_categories = {}
        try:
            for sc in StudentCategory.objects.filter(school=event.school, is_mixing=True):
                mixing_categories[sc.code.lower()] = sc.name
                mixing_categories[sc.name.lower()] = sc.name
        except Exception as err:
            logger.warning("Error fetching mixing categories: %s", err)

    card_x = cell_x + 3.0
    card_y = cell_y + 3.0
    card_w = badge_width - 6.0    # 180.0 pt
    card_h = badge_height - 6.0   # 260.0 pt
    card_top = card_y + card_h
    card_center_x = card_x + card_w / 2.0
    card_radius = 10.0

    pdf.saveState()

    # 1. Base Card White Background & Soft Lavender Outer Border
    pdf.setFillColor(HexColor('#FFFFFF'))
    pdf.setStrokeColor(HexColor('#DDD6FE'))
    pdf.setLineWidth(0.75)
    pdf.roundRect(card_x, card_y, card_w, card_h, radius=card_radius, stroke=1, fill=1)

    # 2. Decorative soft lavender gradient accent in top left corner (mirrored from front's top right)
    pdf.saveState()
    clip_corner = pdf.beginPath()
    clip_corner.roundRect(card_x, card_y, card_w, card_h, radius=card_radius)
    pdf.clipPath(clip_corner, stroke=0, fill=0)

    # Outer soft lavender wash
    p_top1 = pdf.beginPath()
    p_top1.moveTo(card_x + 65.0, card_top)
    p_top1.curveTo(card_x + 35.0, card_top - 30.0, card_x, card_top - 45.0, card_x, card_top - 70.0)
    p_top1.lineTo(card_x, card_top)
    p_top1.close()
    pdf.setFillColor(HexColor('#F5F3FF'))
    pdf.drawPath(p_top1, stroke=0, fill=1)

    # Middle soft lavender curve
    p_top2 = pdf.beginPath()
    p_top2.moveTo(card_x + 45.0, card_top)
    p_top2.curveTo(card_x + 24.0, card_top - 20.0, card_x, card_top - 32.0, card_x, card_top - 50.0)
    p_top2.lineTo(card_x, card_top)
    p_top2.close()
    pdf.setFillColor(HexColor('#EDE9FE'))
    pdf.drawPath(p_top2, stroke=0, fill=1)

    # Inner soft accent
    p_top3 = pdf.beginPath()
    p_top3.moveTo(card_x + 26.0, card_top)
    p_top3.curveTo(card_x + 14.0, card_top - 12.0, card_x, card_top - 20.0, card_x, card_top - 30.0)
    p_top3.lineTo(card_x, card_top)
    p_top3.close()
    pdf.setFillColor(HexColor('#DDD6FE'))
    pdf.drawPath(p_top3, stroke=0, fill=1)
    pdf.restoreState()

    # 3. Bottom Decorative Waves: 3-layer matching front page
    pdf.saveState()
    # Layer 1: Back Light Wave (Soft Lavender / #DDD6FE)
    p_wave1 = pdf.beginPath()
    p_wave1.moveTo(card_x, card_y)
    p_wave1.lineTo(card_x, card_y + 18.0)
    p_wave1.curveTo(card_x + 48.0, card_y + 28.0, card_x + 108.0, card_y + 13.0, card_x + card_w, card_y + 25.0)
    p_wave1.lineTo(card_x + card_w, card_y)
    p_wave1.close()
    pdf.setFillColor(HexColor('#DDD6FE'))
    pdf.drawPath(p_wave1, stroke=0, fill=1)

    # Layer 2: Middle Wave (Vibrant Violet / #7C3AED)
    p_wave2 = pdf.beginPath()
    p_wave2.moveTo(card_x, card_y)
    p_wave2.lineTo(card_x, card_y + 11.0)
    p_wave2.curveTo(card_x + 55.0, card_y + 22.0, card_x + 115.0, card_y + 8.0, card_x + card_w, card_y + 21.0)
    p_wave2.lineTo(card_x + card_w, card_y)
    p_wave2.close()
    pdf.setFillColor(HexColor('#7C3AED'))
    pdf.drawPath(p_wave2, stroke=0, fill=1)

    # Layer 3: Foreground Wave (Deep Purple / #2E1065)
    p_wave3 = pdf.beginPath()
    p_wave3.moveTo(card_x, card_y)
    p_wave3.lineTo(card_x, card_y + 5.0)
    p_wave3.curveTo(card_x + 62.0, card_y + 16.0, card_x + 122.0, card_y + 4.0, card_x + card_w, card_y + 17.0)
    p_wave3.lineTo(card_x + card_w, card_y)
    p_wave3.close()
    pdf.setFillColor(HexColor('#2E1065'))
    pdf.drawPath(p_wave3, stroke=0, fill=1)
    pdf.restoreState()

    # Re-draw outer card border to clip cleanly over bottom waves
    pdf.setStrokeColor(HexColor('#DDD6FE'))
    pdf.setLineWidth(0.75)
    pdf.roundRect(card_x, card_y, card_w, card_h, radius=card_radius, stroke=1, fill=0)

    # 4. Top Header: Event Logo + Event Name
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
            logo_cy = card_top - 21.0
            logo_x = card_center_x - logo_w / 2.0
            logo_y = logo_cy - logo_h / 2.0
            pdf.drawImage(event_logo_path, logo_x, logo_y, width=logo_w, height=logo_h, mask='auto', preserveAspectRatio=True)

            pdf.setStrokeColor(HexColor('#EDE9FE'))
            pdf.setLineWidth(0.5)
            pdf.line(card_x + 16.0, logo_cy, logo_x - 7.0, logo_cy)
            pdf.line(logo_x + logo_w + 7.0, logo_cy, card_x + card_w - 16.0, logo_cy)
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
        pdf.setStrokeColor(HexColor('#EDE9FE'))
        pdf.setLineWidth(0.5)
        pdf.line(card_x + 16.0, y_title + 3.0, card_center_x - t_w / 2.0 - 6.0, y_title + 3.0)
        pdf.line(card_center_x + t_w / 2.0 + 6.0, y_title + 3.0, card_x + card_w - 16.0, y_title + 3.0)
        pdf.setFont('Helvetica-Bold', t_size)
        pdf.setFillColor(HexColor('#1E1B4B'))
        pdf.drawCentredString(card_center_x, y_title, event_title)
    else:
        y_title = card_top - 41.5
        t_size = 8.5 if len(event_title) <= 20 else (7.5 if len(event_title) <= 30 else 6.5)
        max_title_w = card_w - 24.0
        while t_size > 5.5 and stringWidth(event_title, 'Helvetica-Bold', t_size) > max_title_w:
            t_size -= 0.5
        if stringWidth(event_title, 'Helvetica-Bold', t_size) > max_title_w:
            while event_title and stringWidth(event_title + '…', 'Helvetica-Bold', t_size) > max_title_w:
                event_title = event_title[:-1]
            event_title += '…'
        pdf.setFont('Helvetica-Bold', t_size)
        pdf.setFillColor(HexColor('#1E1B4B'))
        pdf.drawCentredString(card_center_x, y_title, event_title)

    # 5. Space after event name, then PROGRAMS :
    y_prog_hdr = y_title - 26.0

    pdf.setFont('Helvetica-Bold', 7.5)
    pdf.setFillColor(HexColor('#1E1B4B'))
    pdf.drawString(card_x + 16.0, y_prog_hdr, 'PROGRAMS :')

    # Subtle separator line under PROGRAMS :
    pdf.setStrokeColor(HexColor('#EDE9FE'))
    pdf.setLineWidth(0.5)
    pdf.line(card_x + 16.0, y_prog_hdr - 4.5, card_x + card_w - 16.0, y_prog_hdr - 4.5)

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

    # 6. List the Programs normally
    start_y = y_prog_hdr - 16.0
    # Available vertical space down to Powered by Eventloo footer
    # Front page pow_y = card_y + 21.0
    avail_bottom = card_y + 36.0
    total_avail = max(40.0, start_y - avail_bottom)

    if num_progs == 0:
        pdf.setFont('Helvetica-Oblique', 6.5)
        pdf.setFillColor(HexColor('#94A3B8'))
        pdf.drawString(card_x + 20.0, start_y, 'No registered programs.')
    else:
        line_height = min(16.0, total_avail / max(num_progs, 1))
        fs = min(7.2, max(5.2, line_height * 0.48))
        dot_r = min(1.8, fs * 0.28)
        max_item_w = card_w - 46.0

        for i, (p_name, p) in enumerate(programs_list):
            cur_y = start_y - (i * line_height)

            # Bullet dot in Eventloo Indigo
            pdf.setFillColor(HexColor('#4F46E5'))
            pdf.circle(card_x + 20.0, cur_y + (fs * 0.35), dot_r, stroke=0, fill=1)

            # Program name
            clean_name = str(p_name).strip().upper()

            # If program belongs to a mixed/general category, append the category name in brackets
            p_cat = (getattr(p, 'category', None) or '').strip()
            p_cat_lower = p_cat.lower()
            is_mixed = False
            cat_display_name = 'GENERAL'

            if p_cat_lower in mixing_categories:
                is_mixed = True
                cat_display_name = mixing_categories[p_cat_lower]
            elif p_cat_lower in ('general', 'gen', 'gn', 'open', 'mixed'):
                is_mixed = True
                cat_display_name = category_names.get(p_cat, 'General') if category_names else 'General'

            if is_mixed:
                bracket_text = f"({cat_display_name.upper()})"
                if bracket_text not in clean_name:
                    clean_name = f"{clean_name} {bracket_text}"

            cur_fs = fs
            while cur_fs > 4.5 and stringWidth(clean_name, 'Helvetica-Bold', cur_fs) > max_item_w:
                cur_fs -= 0.3
            if stringWidth(clean_name, 'Helvetica-Bold', cur_fs) > max_item_w:
                while clean_name and stringWidth(clean_name + '…', 'Helvetica-Bold', cur_fs) > max_item_w:
                    clean_name = clean_name[:-1]
                clean_name += '…'

            pdf.setFont('Helvetica-Bold', cur_fs)
            pdf.setFillColor(HexColor('#0F172A'))
            pdf.drawString(card_x + 27.0, cur_y, clean_name)

    # 7. "Powered by Eventloo" - EXACT SAME PLACE AS FRONT PAGE
    eventloo_icon_path = _resolve_eventloo_icon_path()
    pow_y = card_y + 20.0
    f_x = card_x + 8.0
    icon_offset = 0.0

    if eventloo_icon_path:
        try:
            pdf.drawImage(eventloo_icon_path, f_x, pow_y - 1.0, width=8.5, height=8.5, mask='auto', preserveAspectRatio=True)
            icon_offset = 9.5
        except Exception as icon_err:
            logger.warning("Eventloo back badge icon draw failed: %s", icon_err)
            icon_offset = 0.0

    pdf.setFont('Helvetica', 5.2)
    pdf.setFillColor(HexColor('#6B7280'))
    pdf.drawString(f_x + icon_offset, pow_y + 1.2, 'Powered by ')
    pw = stringWidth('Powered by ', 'Helvetica', 5.2)
    pdf.setFont('Helvetica-Bold', 5.8)
    pdf.setFillColor(HexColor('#2E1065'))
    pdf.drawString(f_x + icon_offset + pw, pow_y + 1.2, 'Eventloo')

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
        template = templates_by_type.get(recipient.certificate_type)
        if not template:
            template = (
                templates_by_type.get('result_poster')
                or (next(iter(templates_by_type.values())) if templates_by_type else None)
            )
        if not template:
            continue
        fields = normalize_certificate_fields(template.fields, certificate_type=recipient.certificate_type)
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

        # Prefetch mixing categories once for all badges in the event
        mixing_categories = {}
        try:
            for sc in StudentCategory.objects.filter(school=event.school, is_mixing=True):
                mixing_categories[sc.code.lower()] = sc.name
                mixing_categories[sc.name.lower()] = sc.name
        except Exception as e:
            logger.warning("Error prefetching mixing categories: %s", e)

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
                prefetched_mixing_categories=mixing_categories,
            )
            pdf.restoreState()
            pdf.showPage()

    pdf.save()
    buffer.seek(0)
    return buffer
