# Generated by Django 4.2.7 on 2025-07-03 10:30

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_user_address_user_category_user_date_of_birth_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='section',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
    ]
