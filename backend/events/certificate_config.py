import re

from django.core.exceptions import ValidationError


CERTIFICATE_TYPE_CHOICES = (
    ('result_poster', 'Result Poster 1'),
    ('result_poster_2', 'Result Poster 2'),
    ('result_poster_3', 'Result Poster 3'),
    ('result_poster_4', 'Result Poster 4'),
    ('result_poster_5', 'Result Poster 5'),
    ('first_place', '1st Place Certificate'),
    ('second_place', '2nd Place Certificate'),
    ('third_place', '3rd Place Certificate'),
    ('participation', 'Participation Certificate'),
    ('badge', 'Badge'),
    ('common_prize', 'Common Prize Certificate'),
    ('grade_certificate', 'Grade Certificate'),
)

CERTIFICATE_TYPES = {value for value, _label in CERTIFICATE_TYPE_CHOICES}

FONT_CHOICES = {
    # Standard PostScript / Core fonts
    'helvetica': ('Helvetica', 'Helvetica-Bold'),
    'times': ('Times-Roman', 'Times-Bold'),
    'courier': ('Courier', 'Courier-Bold'),
    'zapf': ('ZapfChancery-MediumItalic', 'ZapfChancery-MediumItalic'),

    # Elegant Serifs (Royal / Certificate / Diplomas)
    'cinzel': ('Times-Bold', 'Times-Bold'),
    'playfair': ('Times-Bold', 'Times-Bold'),
    'cormorant': ('Times-Roman', 'Times-Bold'),
    'libre_baskerville': ('Times-Roman', 'Times-Bold'),
    'merriweather': ('Times-Roman', 'Times-Bold'),
    'lora': ('Times-Roman', 'Times-Bold'),
    'fraunces': ('Times-Bold', 'Times-Bold'),
    'abril_fatface': ('Times-Bold', 'Times-Bold'),
    'garamond': ('Times-Roman', 'Times-Bold'),

    # Bold & Clean Sans-Serif (Result Posters, Headlines & Badges)
    'montserrat': ('Helvetica-Bold', 'Helvetica-Bold'),
    'poppins': ('Helvetica-Bold', 'Helvetica-Bold'),
    'oswald': ('Helvetica-Bold', 'Helvetica-Bold'),
    'bebas_neue': ('Helvetica-Bold', 'Helvetica-Bold'),
    'anton': ('Helvetica-Bold', 'Helvetica-Bold'),
    'archivo_black': ('Helvetica-Bold', 'Helvetica-Bold'),
    'inter': ('Helvetica', 'Helvetica-Bold'),
    'plus_jakarta': ('Helvetica', 'Helvetica-Bold'),
    'dm_sans': ('Helvetica', 'Helvetica-Bold'),
    'space_grotesk': ('Helvetica-Bold', 'Helvetica-Bold'),
    'roboto': ('Helvetica', 'Helvetica-Bold'),
    'fredoka': ('Helvetica-Bold', 'Helvetica-Bold'),
    'raleway': ('Helvetica', 'Helvetica-Bold'),

    # Cursive & Calligraphy (Signatures & Honors)
    'great_vibes': ('ZapfChancery-MediumItalic', 'ZapfChancery-MediumItalic'),
    'alex_brush': ('ZapfChancery-MediumItalic', 'ZapfChancery-MediumItalic'),
    'dancing_script': ('ZapfChancery-MediumItalic', 'ZapfChancery-MediumItalic'),
    'pacifico': ('ZapfChancery-MediumItalic', 'ZapfChancery-MediumItalic'),
    'caveat': ('ZapfChancery-MediumItalic', 'ZapfChancery-MediumItalic'),
    'satisfy': ('ZapfChancery-MediumItalic', 'ZapfChancery-MediumItalic'),
    'lobster': ('ZapfChancery-MediumItalic', 'ZapfChancery-MediumItalic'),

    # Monospace
    'space_mono': ('Courier', 'Courier-Bold'),
}

FIELD_DEFINITIONS = {
    'participantName': {
        'label': 'Participant Name', 'sample': 'Ayisha Amna',
        'x': 42, 'y': 60, 'fontSize': 22, 'color': '#000000',
        'fontFamily': 'helvetica', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': True,
    },
    'chestNo': {
        'label': 'Participant ID / Chest No', 'sample': 'Chest No: 4003',
        'x': 42, 'y': 68, 'fontSize': 16, 'color': '#1E40AF',
        'fontFamily': 'helvetica', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': True,
    },
    'category': {
        'label': 'Category', 'sample': 'Higher Secondary',
        'x': 42, 'y': 75, 'fontSize': 14, 'color': '#374151',
        'fontFamily': 'helvetica', 'textAlign': 'center', 'bold': False,
        'letterSpacing': 0, 'uppercase': False, 'enabled': True,
    },
    'teamName': {
        'label': 'Team / Institution', 'sample': 'Palakkutty Unit',
        'x': 42, 'y': 82, 'fontSize': 14, 'color': '#374151',
        'fontFamily': 'helvetica', 'textAlign': 'center', 'bold': False,
        'letterSpacing': 0, 'uppercase': False, 'enabled': True,
    },
    'eventName': {
        'label': 'Event Name', 'sample': 'School Arts Festival',
        'x': 42, 'y': 88, 'fontSize': 14, 'color': '#1F2937',
        'fontFamily': 'helvetica', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'programName': {
        'label': 'Program Name', 'sample': 'Solo Song',
        'x': 42, 'y': 92, 'fontSize': 13, 'color': '#374151',
        'fontFamily': 'helvetica', 'textAlign': 'center', 'bold': False,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'rank': {
        'label': 'Rank / Place', 'sample': '1st Place',
        'x': 75, 'y': 60, 'fontSize': 16, 'color': '#D97706',
        'fontFamily': 'helvetica', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'totalPrograms': {
        'label': 'Total Programs Count', 'sample': 'Total Programs: 3',
        'x': 50, 'y': 77, 'fontSize': 13, 'color': '#D97706',
        'fontFamily': 'helvetica', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'assignedPrograms': {
        'label': 'Assigned Programs List', 'sample': 'Solo Song, Elocution, Quiz (General)',
        'x': 50, 'y': 85, 'fontSize': 11, 'color': '#1F2937',
        'fontFamily': 'helvetica', 'textAlign': 'center', 'bold': False,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    # Result Poster Specific Fields
    'resultNo': {
        'label': 'Result Number', 'sample': 'RESULT NO. 01',
        'x': 50, 'y': 12, 'fontSize': 26, 'color': '#0F172A',
        'fontFamily': 'anton', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 2, 'uppercase': True, 'enabled': False,
    },
    'programCode': {
        'label': 'Program Code / No', 'sample': 'Item #104',
        'x': 50, 'y': 25, 'fontSize': 13, 'color': '#4338CA',
        'fontFamily': 'poppins', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 1, 'uppercase': True, 'enabled': False,
    },
    'firstPlaceLabel': {
        'label': '1st Place Title / Label', 'sample': '🥇 1st Place',
        'x': 50, 'y': 36, 'fontSize': 14, 'color': '#B45309',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 1, 'uppercase': True, 'enabled': False,
    },
    'firstPlaceName': {
        'label': '1st Place Participant Name', 'sample': 'Muhammed Nihal',
        'x': 50, 'y': 41, 'fontSize': 18, 'color': '#0F172A',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'firstPlaceChest': {
        'label': '1st Place Chest No', 'sample': 'Chest No: 4003',
        'x': 50, 'y': 46, 'fontSize': 14, 'color': '#4338CA',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'firstPlaceTeam': {
        'label': '1st Place Team', 'sample': 'Team Falcon',
        'x': 50, 'y': 50, 'fontSize': 13, 'color': '#64748B',
        'fontFamily': 'poppins', 'textAlign': 'center', 'bold': False,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'firstPlaceName2': {
        'label': '1st Place Joint Winner 2', 'sample': 'Fathima Zahra',
        'x': 50, 'y': 52, 'fontSize': 17, 'color': '#0F172A',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'firstPlaceChest2': {
        'label': '1st Place Joint Chest 2', 'sample': 'Chest No: 4009',
        'x': 50, 'y': 56, 'fontSize': 13, 'color': '#4338CA',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'firstPlaceTeam2': {
        'label': '1st Place Joint Team 2', 'sample': 'Team Phoenix',
        'x': 50, 'y': 60, 'fontSize': 12, 'color': '#64748B',
        'fontFamily': 'poppins', 'textAlign': 'center', 'bold': False,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'secondPlaceLabel': {
        'label': '2nd Place Title / Label', 'sample': '🥈 2nd Place',
        'x': 50, 'y': 56, 'fontSize': 13, 'color': '#475569',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 1, 'uppercase': True, 'enabled': False,
    },
    'secondPlaceName': {
        'label': '2nd Place Participant Name', 'sample': 'Ayisha Rida',
        'x': 50, 'y': 60, 'fontSize': 16, 'color': '#1E293B',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'secondPlaceChest': {
        'label': '2nd Place Chest No', 'sample': 'Chest No: 4012',
        'x': 50, 'y': 64, 'fontSize': 13, 'color': '#4338CA',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'secondPlaceTeam': {
        'label': '2nd Place Team', 'sample': 'Team Phoenix',
        'x': 50, 'y': 68, 'fontSize': 12, 'color': '#64748B',
        'fontFamily': 'poppins', 'textAlign': 'center', 'bold': False,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'secondPlaceName2': {
        'label': '2nd Place Joint Winner 2', 'sample': 'Nafih Razak',
        'x': 50, 'y': 70, 'fontSize': 15, 'color': '#1E293B',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'secondPlaceChest2': {
        'label': '2nd Place Joint Chest 2', 'sample': 'Chest No: 4018',
        'x': 50, 'y': 73, 'fontSize': 12, 'color': '#4338CA',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'secondPlaceTeam2': {
        'label': '2nd Place Joint Team 2', 'sample': 'Team Falcon',
        'x': 50, 'y': 75, 'fontSize': 11, 'color': '#64748B',
        'fontFamily': 'poppins', 'textAlign': 'center', 'bold': False,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'thirdPlaceLabel': {
        'label': '3rd Place Title / Label', 'sample': '🥉 3rd Place',
        'x': 50, 'y': 73, 'fontSize': 13, 'color': '#78350F',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 1, 'uppercase': True, 'enabled': False,
    },
    'thirdPlaceName': {
        'label': '3rd Place Participant Name', 'sample': 'Salman Faris',
        'x': 50, 'y': 77, 'fontSize': 15, 'color': '#334155',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'thirdPlaceChest': {
        'label': '3rd Place Chest No', 'sample': 'Chest No: 4025',
        'x': 50, 'y': 81, 'fontSize': 13, 'color': '#4338CA',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'thirdPlaceTeam': {
        'label': '3rd Place Team', 'sample': 'Team Griffin',
        'x': 50, 'y': 85, 'fontSize': 12, 'color': '#64748B',
        'fontFamily': 'poppins', 'textAlign': 'center', 'bold': False,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'thirdPlaceName2': {
        'label': '3rd Place Joint Winner 2', 'sample': 'Danish Ali',
        'x': 50, 'y': 87, 'fontSize': 14, 'color': '#334155',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'thirdPlaceChest2': {
        'label': '3rd Place Joint Chest 2', 'sample': 'Chest No: 4031',
        'x': 50, 'y': 90, 'fontSize': 12, 'color': '#4338CA',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'thirdPlaceTeam2': {
        'label': '3rd Place Joint Team 2', 'sample': 'Team Vortex',
        'x': 50, 'y': 92, 'fontSize': 11, 'color': '#64748B',
        'fontFamily': 'poppins', 'textAlign': 'center', 'bold': False,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'firstPlace': {
        'label': '1st Place Winner (Combined)', 'sample': '1st: Ayisha Amna (Chest: 4003) - Palakkutty Unit',
        'x': 50, 'y': 38, 'fontSize': 16, 'color': '#1E40AF',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'secondPlace': {
        'label': '2nd Place Winner (Combined)', 'sample': '2nd: Muhammed Bilal (Chest: 4012) - Vortex',
        'x': 50, 'y': 48, 'fontSize': 15, 'color': '#374151',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'thirdPlace': {
        'label': '3rd Place Winner (Combined)', 'sample': '3rd: Fathima Raniya (Chest: 4025) - Phoenix',
        'x': 50, 'y': 58, 'fontSize': 15, 'color': '#374151',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'dateVenue': {
        'label': 'Date & Venue', 'sample': 'Nov 22, 2026 · Main Auditorium',
        'x': 50, 'y': 92, 'fontSize': 12, 'color': '#4B5563',
        'fontFamily': 'inter', 'textAlign': 'center', 'bold': False,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'grade': {
        'label': 'Grade / Score', 'sample': 'Grade: A | 10 Points',
        'x': 50, 'y': 66, 'fontSize': 14, 'color': '#059669',
        'fontFamily': 'inter', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'juryName': {
        'label': 'Jury / Official Authority', 'sample': 'Chief Judge: Dr. K. Raman',
        'x': 50, 'y': 72, 'fontSize': 13, 'color': '#374151',
        'fontFamily': 'inter', 'textAlign': 'center', 'bold': False,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
    'customText1': {
        'label': 'Custom Text 1', 'sample': 'OFFICIAL RESULTS',
        'x': 50, 'y': 12, 'fontSize': 24, 'color': '#1F2937',
        'fontFamily': 'oswald', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 1, 'uppercase': True, 'enabled': False,
    },
    'customText2': {
        'label': 'Custom Text 2', 'sample': 'ARTS FESTIVAL 2026',
        'x': 50, 'y': 18, 'fontSize': 16, 'color': '#4B5563',
        'fontFamily': 'montserrat', 'textAlign': 'center', 'bold': True,
        'letterSpacing': 1, 'uppercase': True, 'enabled': False,
    },
    'customText3': {
        'label': 'Custom Text 3', 'sample': 'General Convener',
        'x': 80, 'y': 95, 'fontSize': 12, 'color': '#374151',
        'fontFamily': 'inter', 'textAlign': 'center', 'bold': False,
        'letterSpacing': 0, 'uppercase': False, 'enabled': False,
    },
}


def default_certificate_fields(certificate_type=None):
    fields = {
        field_id: {'id': field_id, 'boxWidth': 35.0, **values}
        for field_id, values in FIELD_DEFINITIONS.items()
    }
    if str(certificate_type).startswith('result_poster'):
        for f in fields.values():
            f['enabled'] = False
    return fields


def normalize_certificate_fields(value, certificate_type=None):
    if not isinstance(value, dict):
        raise ValidationError('Certificate fields must be an object.')

    unknown = set(value) - set(FIELD_DEFINITIONS)
    # Allow dynamic custom fields like custom_xxx
    custom_dynamic = {k for k in unknown if k.startswith('custom')}
    unsupported = unknown - custom_dynamic
    if unsupported:
        raise ValidationError(f'Unsupported certificate fields: {", ".join(sorted(unsupported))}.')

    normalized = default_certificate_fields(certificate_type=certificate_type)
    for field_id, supplied in value.items():
        if not isinstance(supplied, dict):
            raise ValidationError(f'{field_id} settings must be an object.')
        
        # If dynamic custom field, initialize from a sensible template
        if field_id not in normalized:
            normalized[field_id] = {
                'id': field_id,
                'label': supplied.get('label', field_id),
                'sample': supplied.get('sample', 'Custom Text'),
                'x': 50, 'y': 50, 'fontSize': 16, 'color': '#000000',
                'fontFamily': 'helvetica', 'textAlign': 'center', 'bold': False,
                'letterSpacing': 0, 'uppercase': False, 'enabled': True,
                'boxWidth': 35.0,
            }

        field = normalized[field_id]
        field.update({key: supplied[key] for key in (
            'x', 'y', 'fontSize', 'color', 'fontFamily', 'textAlign',
            'bold', 'letterSpacing', 'uppercase', 'enabled', 'label', 'sample',
            'italic', 'opacity', 'shadow', 'shadowColor', 'badgeBg', 'lineHeight',
            'boxWidth'
        ) if key in supplied})

        try:
            field['x'] = min(100.0, max(0.0, float(field['x'])))
            field['y'] = min(100.0, max(0.0, float(field['y'])))
            field['fontSize'] = min(160.0, max(6.0, float(field['fontSize'])))
            field['letterSpacing'] = min(30.0, max(-5.0, float(field.get('letterSpacing', 0))))
            field['boxWidth'] = min(100.0, max(5.0, float(field.get('boxWidth', 35.0))))
        except (TypeError, ValueError):
            raise ValidationError(f'{field_id} contains an invalid numeric setting.')

        color_str = str(field['color'])
        if not re.fullmatch(r'#[0-9A-Fa-f]{6}', color_str) and not re.fullmatch(r'#[0-9A-Fa-f]{8}', color_str):
            field['color'] = '#000000'
        if field['fontFamily'] not in FONT_CHOICES:
            field['fontFamily'] = 'helvetica'
        if field['textAlign'] not in ('left', 'center', 'right'):
            field['textAlign'] = 'center'
        for boolean_key in ('bold', 'uppercase', 'enabled'):
            if boolean_key in field and not isinstance(field[boolean_key], bool):
                field[boolean_key] = bool(field[boolean_key])

    # If result_poster, disable generic fields if they were not explicitly passed as enabled
    if str(certificate_type).startswith('result_poster'):
        for non_poster_field in ('participantName', 'chestNo', 'teamName', 'rank', 'totalPrograms', 'assignedPrograms'):
            if non_poster_field in normalized and (non_poster_field not in value or not value[non_poster_field].get('enabled')):
                normalized[non_poster_field]['enabled'] = False

    return normalized
