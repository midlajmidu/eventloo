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
    Returns a list of Flowables for the PDF header with logo (top left), school name, event name, and date.
    Uses the new custom template system for consistent styling.
    """
    # Use the new custom template system
    template = create_custom_pdf_template(school_settings)
    return template.create_header(event_title, extra_title)


def build_custom_pdf_template(school_settings):
    """
    Create a custom PDF template instance for advanced PDF generation.
    This provides access to all custom template features.
    """
    return create_custom_pdf_template(school_settings) 