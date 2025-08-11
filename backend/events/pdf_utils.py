from reportlab.platypus import Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from io import BytesIO
import requests
from datetime import datetime
from .custom_pdf_template import create_custom_pdf_template


def build_pdf_header(school_settings, event_title=None, extra_title=None):
    """
    Returns a list of Flowables for the PDF header with logo (top left),
    school name, event name, and optional extra title using the custom template.
    """
    template = create_custom_pdf_template(school_settings)
    elements = []
    if template is not None:
        elements.extend(template.create_header(event_title=event_title, extra_title=extra_title))
    else:
        # Very small fallback: plain text header if template cannot be created
        styles = getSampleStyleSheet()
        elements.append(Paragraph(str(school_settings.school_name) if school_settings else 'School', styles['Heading1']))
        if event_title:
            elements.append(Paragraph(str(event_title), styles['Heading2']))
        if extra_title:
            elements.append(Paragraph(str(extra_title), styles['Heading3']))
        elements.append(Spacer(1, 20))
    return elements


def build_custom_pdf_template(school_settings):
    """
    Create a custom PDF template instance for advanced PDF generation.
    This provides access to all custom template features.
    """
    return create_custom_pdf_template(school_settings)