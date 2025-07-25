# Custom PDF Template System Guide

## Overview

The custom PDF template system provides a unified way to generate professional PDFs across the entire application with consistent styling and branding.

## Features

✅ **Consistent Styling** - All PDFs use the same header, fonts, and color scheme  
✅ **School Branding** - Automatic logo and school name integration  
✅ **Professional Layout** - Clean, organized tables and sections  
✅ **Easy to Use** - Simple API for creating headers and tables  
✅ **Customizable** - Easy to modify colors, fonts, and layouts  

## How to Use

### 1. Basic Usage

```python
from events.pdf_utils import build_custom_pdf_template
from accounts.models import SchoolSettings

# Get school settings
school_settings = SchoolSettings.get_settings()

# Create template instance
template = build_custom_pdf_template(school_settings)

# Create PDF content
story = []

# Add header
story.extend(template.create_header(
    event_title="My Event",
    extra_title="Additional Info"
))

# Add data table
headers = ['Name', 'Score', 'Position']
data = [
    ['John Doe', '95', '1st'],
    ['Jane Smith', '92', '2nd']
]

story.extend(template.create_data_table(
    headers=headers,
    data=data,
    title='Results'
))
```

### 2. Available Methods

#### `create_header(event_title=None, extra_title=None, show_date=True)`
Creates a professional header with:
- School logo (or emoji fallback)
- School name
- Event title (optional)
- Extra subtitle (optional)
- Current date/time (optional)

#### `create_data_table(headers, data, title=None, col_widths=None)`
Creates a styled data table with:
- Custom header styling (dark blue background, white text)
- Alternating row colors
- Professional grid lines
- Optional title
- Custom column widths

### 3. Example: Complete PDF Generation

```python
from django.http import HttpResponse
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate
from io import BytesIO
from events.pdf_utils import build_custom_pdf_template
from accounts.models import SchoolSettings

def generate_custom_pdf(request):
    # Setup
    school_settings = SchoolSettings.get_settings()
    template = build_custom_pdf_template(school_settings)
    
    # Create PDF buffer
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4, 
        rightMargin=50, 
        leftMargin=50, 
        topMargin=50, 
        bottomMargin=50
    )
    
    # Build content
    story = []
    
    # Add header
    story.extend(template.create_header(
        event_title="Annual Sports Meet",
        extra_title="Results Report"
    ))
    
    # Add information table
    info_data = [
        ['Event Date', '15/12/2024'],
        ['Total Participants', '150'],
        ['Categories', '3']
    ]
    story.extend(template.create_data_table(
        headers=['Field', 'Value'],
        data=info_data,
        title='Event Information'
    ))
    
    # Add results table
    results_headers = ['Position', 'Name', 'Team', 'Score']
    results_data = [
        ['1st', 'John Doe', 'Team Alpha', '95'],
        ['2nd', 'Jane Smith', 'Team Beta', '92'],
        ['3rd', 'Bob Johnson', 'Team Gamma', '89']
    ]
    story.extend(template.create_data_table(
        headers=results_headers,
        data=results_data,
        title='Final Results'
    ))
    
    # Generate PDF
    doc.build(story)
    buffer.seek(0)
    
    response = HttpResponse(buffer.read(), content_type='application/pdf')
    response['Content-Disposition'] = 'attachment; filename="custom_report.pdf"'
    return response
```

## Customization

### Colors
The template uses these default colors:
- **Header Background**: Light grey
- **Table Header**: Dark blue
- **Table Rows**: Beige
- **Text**: Black/White (depending on background)

### Fonts
- **Headers**: Helvetica-Bold
- **Table Headers**: Helvetica-Bold
- **Table Data**: Helvetica

### Sizes
- **Header Title**: 16pt
- **Subtitle**: 14pt
- **Table Headers**: 10pt
- **Table Data**: 9pt

## Integration with Existing PDFs

The system is backward compatible. Existing PDFs using `build_pdf_header()` will automatically use the new template system.

## Benefits

1. **Consistency** - All PDFs look professional and uniform
2. **Maintainability** - Changes to styling only need to be made in one place
3. **Branding** - Automatic school logo and name integration
4. **Efficiency** - Reusable components reduce code duplication
5. **Flexibility** - Easy to customize for different needs

## File Structure

```
backend/events/
├── custom_pdf_template.py    # Main template class
├── pdf_utils.py             # Utility functions
└── views.py                 # PDF generation endpoints
```

## Usage in Views

The custom template system is already integrated into:
- Results PDF generation
- Team list PDF generation
- All other PDF endpoints

Simply use `build_custom_pdf_template()` instead of manual styling for consistent, professional PDFs. 