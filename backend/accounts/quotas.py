from rest_framework.exceptions import ValidationError

from .models import School, User


QUOTA_CONFIG = {
    'events': ('max_events', 'events', 'event'),
    'users': ('max_users', 'users', 'dashboard user'),
    'students': ('max_students', 'students', 'student'),
}


def quota_usage(school, resource):
    """Return current tenant usage for a quota-controlled resource."""
    if resource == 'events':
        return school.events.count()
    if resource == 'students':
        return User.objects.filter(school=school, role='student').count()
    if resource == 'users':
        return User.objects.filter(school=school).exclude(role='student').count()
    raise ValueError(f'Unknown quota resource: {resource}')


def lock_and_enforce_quota(school_id, resource, additional=1):
    """Lock a tenant row and reject a create that would exceed its quota.

    Call this inside transaction.atomic() and keep the lock until the new rows
    have been created. Serializing creates per tenant prevents concurrent
    requests from both passing the same limit check.
    """
    limit_field, _, singular = QUOTA_CONFIG[resource]
    school = School.objects.select_for_update().get(pk=school_id)
    limit = getattr(school, limit_field)
    used = quota_usage(school, resource)
    if limit is not None and used + additional > limit:
        noun = singular if limit == 1 else f'{singular}s'
        raise ValidationError({
            'quota': (
                f'Organization limit reached: {used} of {limit} {noun} used. '
                'Ask the platform super administrator to increase this limit.'
            ),
            'resource': resource,
            'used': used,
            'limit': limit,
        })
    return school
