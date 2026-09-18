from pathlib import Path
from zipfile import BadZipFile, ZipFile


MAX_EXCEL_BYTES = 10 * 1024 * 1024
MAX_EXCEL_ROWS = 5000
MAX_EXCEL_COLUMNS = 100
MAX_XLSX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024
MAX_XLSX_MEMBERS = 1000


def validate_excel_upload(upload):
    """Validate size, extension, and container signature before parsing Excel data."""
    extension = Path(upload.name or '').suffix.lower()
    if extension not in {'.xlsx', '.xls'}:
        raise ValueError('Please upload an Excel file (.xlsx or .xls).')
    if upload.size > MAX_EXCEL_BYTES:
        raise ValueError('File size must not exceed 10 MB.')
    header = upload.read(8)
    upload.seek(0)
    if extension == '.xlsx' and not header.startswith(b'PK\x03\x04'):
        raise ValueError('The uploaded file is not a valid XLSX workbook.')
    if extension == '.xls' and header != bytes.fromhex('D0CF11E0A1B11AE1'):
        raise ValueError('The uploaded file is not a valid XLS workbook.')
    if extension == '.xlsx':
        try:
            with ZipFile(upload) as workbook:
                members = workbook.infolist()
                uncompressed = sum(member.file_size for member in members)
                if len(members) > MAX_XLSX_MEMBERS or uncompressed > MAX_XLSX_UNCOMPRESSED_BYTES:
                    raise ValueError('The XLSX workbook expands beyond the allowed size.')
                for member in members:
                    if (
                        member.file_size > 1024 * 1024
                        and member.compress_size > 0
                        and member.file_size / member.compress_size > 100
                    ):
                        raise ValueError('The XLSX workbook contains suspicious compressed content.')
        except BadZipFile as exc:
            raise ValueError('The uploaded file is not a valid XLSX workbook.') from exc
        finally:
            upload.seek(0)


def validate_excel_shape(dataframe):
    rows, columns = dataframe.shape
    if rows > MAX_EXCEL_ROWS or columns > MAX_EXCEL_COLUMNS:
        raise ValueError(
            f'Workbook is too large; maximum is {MAX_EXCEL_ROWS} rows and '
            f'{MAX_EXCEL_COLUMNS} columns.'
        )


def sanitize_spreadsheet_dataframe(dataframe):
    """Prevent user-controlled strings from becoming spreadsheet formulas."""
    def safe_value(value):
        if isinstance(value, str) and value.lstrip().startswith(('=', '+', '-', '@')):
            return "'" + value
        return value

    return dataframe.map(safe_value)
