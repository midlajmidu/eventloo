from reportlab.platypus import Table, TableStyle, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from io import BytesIO
import requests
from datetime import datetime
import os

class CustomPDFTemplate:
    """Custom PDF Template class for unified PDF styling with image header"""
    
    def __init__(self, school_settings):
        self.school_settings = school_settings
        self.styles = getSampleStyleSheet()
        self._setup_styles()
    
    def _setup_styles(self):
        self.custom_styles = {
            'table_header': ParagraphStyle(
                'TableHeader',
                parent=self.styles['Normal'],
                fontSize=10,
                spaceAfter=2,
                alignment=TA_CENTER,
                textColor=colors.black,
                fontName='Helvetica-Bold'
            ),
            'table_cell': ParagraphStyle(
                'TableCell',
                parent=self.styles['Normal'],
                fontSize=9,
                spaceAfter=1,
                alignment=TA_CENTER,
                textColor=colors.black
            ),
            'header_title': ParagraphStyle(
                'HeaderTitle',
                parent=self.styles['Heading1'],
                fontSize=16,
                spaceAfter=10,
                alignment=TA_CENTER,
                textColor=colors.black,
                fontName='Helvetica-Bold'
            )
        }
    
    def create_header(self, event_title=None, extra_title=None):
        """Add the school logo and name to the header for all pages"""
        elements = []
        # Use logo from school_settings if available
        if self.school_settings and self.school_settings.school_logo:
            try:
                # Get the absolute path to the logo file
                logo_path = self.school_settings.school_logo.path
                if os.path.exists(logo_path):
                    header_img = Image(
                        logo_path,
                        width=80.0,
                        height=54.0,
                        mask='auto'
                    )
                    elements.append(header_img)
                    elements.append(Spacer(1, 10))
            except Exception as e:
                # If there's an error loading the logo, just skip it
                print(f"Error loading school logo: {e}")
                pass
        # Add school name
        if self.school_settings and self.school_settings.school_name:
            elements.append(Paragraph(self.school_settings.school_name, self.custom_styles['header_title']))
        # Add event and extra title
        if event_title:
            elements.append(Paragraph(event_title, self.custom_styles['header_title']))
        if extra_title:
            elements.append(Paragraph(extra_title, self.custom_styles['header_title']))
        elements.append(Spacer(1, 20))
        return elements
    
    def create_data_table(self, headers, data, title=None, col_widths=None):
        elements = []
        if title:
            title_style = ParagraphStyle(
                'Title',
                parent=self.styles['Heading3'],
                fontSize=12,
                spaceAfter=6,
                alignment=TA_LEFT,
                textColor=colors.black,
                fontName='Helvetica-Bold'
            )
            elements.append(Paragraph(title, title_style))
            elements.append(Spacer(1, 10))
        
        table_data = [headers]
        table_data.extend(data)
        
        # Convert all cells to Paragraphs for better formatting
        for i, row in enumerate(table_data):
            for j, cell in enumerate(row):
                if i == 0:
                    # Header style - bold, centered
                    header_style = ParagraphStyle(
                        'Header',
                        parent=self.styles['Normal'],
                        fontSize=10,
                        alignment=TA_CENTER,
                        textColor=colors.black,
                        fontName='Helvetica-Bold',
                        spaceAfter=2
                    )
                    table_data[i][j] = Paragraph(str(cell), header_style)
                else:
                    # Data style - normal, centered
                    data_style = ParagraphStyle(
                        'Data',
                        parent=self.styles['Normal'],
                        fontSize=9,
                        alignment=TA_CENTER,
                        textColor=colors.black,
                        fontName='Helvetica',
                        spaceAfter=1
                    )
                    table_data[i][j] = Paragraph(str(cell), data_style)
        
        if col_widths:
            table = Table(table_data, colWidths=col_widths)
        else:
            table = Table(table_data)
        
        # Black and white styling only
        table.setStyle(TableStyle([
            # Header styling - black background, white text
            ('BACKGROUND', (0, 0), (-1, 0), colors.black),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 15),
            ('TOPPADDING', (0, 0), (-1, 0), 15),
            
            # Data row styling
            ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            
            # Enhanced padding for better spacing
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 1), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 12),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            
            # Black grid styling
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BOX', (0, 0), (-1, -1), 2, colors.black),
            ('LINEBELOW', (0, 0), (-1, 0), 2, colors.black),
            
            # Alternating row backgrounds - white and light gray
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
            
            # Subtle border on data rows
            ('LINEBELOW', (0, 1), (-1, -1), 0.5, colors.black),
        ]))
        
        elements.append(table)
        elements.append(Spacer(1, 15))
        return elements

def create_custom_pdf_template(school_settings):
    return CustomPDFTemplate(school_settings) 