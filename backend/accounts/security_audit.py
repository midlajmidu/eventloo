import json
import logging


logger = logging.getLogger('security.audit')


def audit_security_event(request, action, outcome, *, actor=None, school_id=None, target=None):
    """Emit a structured event without recording credentials, tokens, or request bodies."""
    principal = actor or getattr(request, 'user', None)
    if isinstance(principal, dict):
        actor_id = principal.get('id')
        actor_role = principal.get('role')
        principal_school = (principal.get('school') or {}).get('id')
    else:
        actor_id = getattr(principal, 'id', None)
        actor_role = getattr(principal, 'role', None)
        principal_school = getattr(principal, 'school_id', None)
    payload = {
        'event': action,
        'outcome': outcome,
        'actor_id': actor_id,
        'actor_role': actor_role,
        'school_id': school_id if school_id is not None else principal_school,
        'target': str(target) if target is not None else None,
        'ip': request.META.get('REMOTE_ADDR'),
        'request_id': request.headers.get('X-Request-ID'),
    }
    logger.info(json.dumps(payload, sort_keys=True, separators=(',', ':')))
