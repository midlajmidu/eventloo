import re

from django.core.exceptions import ValidationError


CERTIFICATE_TYPE_CHOICES = (
    ('first_place', '1st Place Certificate'),
    ('second_place', '2nd Place Certificate'),
    ('third_place', '3rd Place Certificate'),
    ('participation', 'Participation Certificate'),
    ('badge', 'Badge'),
)

CERTIFICATE_TYPES = {value for value, _label in CERTIFICATE_TYPE_CHOICES}

FONT_CHOICES = {
    'helvetica': ('Helvetica', 'Helvetica-Bold'),
    'times': ('Times-Roman', 'Times-Bold'),
    'courier': ('Courier', 'Courier-Bold'),
    'zapf': ('ZapfChancery-MediumItalic', 'ZapfChancery-MediumItalic'),
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
}


def default_certificate_fields():
    return {
        field_id: {'id': field_id, **values}
        for field_id, values in FIELD_DEFINITIONS.items()
    }


def normalize_certificate_fields(value):
    if not isinstance(value, dict):
        raise ValidationError('Certificate fields must be an object.')

    unknown = set(value) - set(FIELD_DEFINITIONS)
    if unknown:
        raise ValidationError(f'Unsupported certificate fields: {", ".join(sorted(unknown))}.')

    normalized = default_certificate_fields()
    for field_id, supplied in value.items():
        if not isinstance(supplied, dict):
            raise ValidationError(f'{field_id} settings must be an object.')
        field = normalized[field_id]
        field.update({key: supplied[key] for key in (
            'x', 'y', 'fontSize', 'color', 'fontFamily', 'textAlign',
            'bold', 'letterSpacing', 'uppercase', 'enabled',
        ) if key in supplied})

        try:
            field['x'] = min(100.0, max(0.0, float(field['x'])))
            field['y'] = min(100.0, max(0.0, float(field['y'])))
            field['fontSize'] = min(120.0, max(6.0, float(field['fontSize'])))
            field['letterSpacing'] = min(20.0, max(-5.0, float(field['letterSpacing'])))
        except (TypeError, ValueError):
            raise ValidationError(f'{field_id} contains an invalid numeric setting.')

        if not re.fullmatch(r'#[0-9A-Fa-f]{6}', str(field['color'])):
            raise ValidationError(f'{field_id} contains an invalid text color.')
        if field['fontFamily'] not in FONT_CHOICES:
            raise ValidationError(f'{field_id} contains an unsupported font family.')
        if field['textAlign'] not in ('left', 'center', 'right'):
            raise ValidationError(f'{field_id} contains an invalid text alignment.')
        for boolean_key in ('bold', 'uppercase', 'enabled'):
            if not isinstance(field[boolean_key], bool):
                raise ValidationError(f'{field_id}.{boolean_key} must be true or false.')

    return normalized
