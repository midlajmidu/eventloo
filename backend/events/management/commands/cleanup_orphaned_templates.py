import os
from glob import glob
from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand
from events.models import CertificateTemplate


class Command(BaseCommand):
    help = 'Cleans up orphaned certificate and result poster template files from media storage.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Scan and list orphaned files without deleting them.',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        base_dir = os.path.join(settings.MEDIA_ROOT, 'certificate_templates')

        if not os.path.exists(base_dir):
            self.stdout.write(self.style.SUCCESS('No certificate_templates directory found.'))
            return

        all_files = [f for f in glob(os.path.join(base_dir, '**/*'), recursive=True) if os.path.isfile(f)]
        active_images = set(
            CertificateTemplate.objects.exclude(background_image='').values_list('background_image', flat=True)
        )

        orphans = []
        for file_path in all_files:
            rel_path = os.path.relpath(file_path, settings.MEDIA_ROOT)
            if rel_path not in active_images:
                orphans.append(file_path)

        self.stdout.write(f'Scanned {len(all_files)} template files on disk.')
        self.stdout.write(f'Active templates in database: {len(active_images)}')
        self.stdout.write(f'Orphaned files detected: {len(orphans)}')

        if not orphans:
            self.stdout.write(self.style.SUCCESS('Storage is completely clean! Zero orphaned files found.'))
            return

        total_bytes = sum(os.path.getsize(f) for f in orphans)

        if dry_run:
            self.stdout.write(self.style.WARNING(
                f'[DRY RUN] Would delete {len(orphans)} orphaned files ({total_bytes / 1024 / 1024:.2f} MB).'
            ))
            for f in orphans[:10]:
                self.stdout.write(f'  - {f}')
            if len(orphans) > 10:
                self.stdout.write(f'  ... and {len(orphans) - 10} more.')
            return

        deleted_count = 0
        reclaimed_bytes = 0
        for f in orphans:
            try:
                sz = os.path.getsize(f)
                os.remove(f)
                deleted_count += 1
                reclaimed_bytes += sz
            except Exception as e:
                self.stderr.write(f'Failed to remove {f}: {e}')

        # Clean empty directories
        for root, dirs, _ in os.walk(base_dir, topdown=False):
            for d in dirs:
                dirpath = os.path.join(root, d)
                try:
                    if not os.listdir(dirpath):
                        os.rmdir(dirpath)
                except Exception:
                    pass

        self.stdout.write(self.style.SUCCESS(
            f'Purged {deleted_count} orphaned files, reclaiming {reclaimed_bytes / 1024 / 1024:.2f} MB.'
        ))

