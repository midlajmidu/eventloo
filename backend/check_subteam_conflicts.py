import os
import sys
import django

# Setup django environment if executed directly
if __name__ == '__main__':
    try:
        import dotenv
        dotenv.load_dotenv()
    except ImportError:
        pass
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'event_management.settings')
    try:
        django.setup()
    except Exception as e:
        pass

from events.models import Program, Team, ProgramAssignment, ProgramResult, User

def run_diagnostics(fix=False):
    print("=" * 65)
    print("        SUB-TEAM & PROGRAM RESULT DIAGNOSTIC TOOL")
    print("=" * 65)

    team_programs = Program.objects.filter(is_team_based=True).order_by('id')
    print(f"\n[1] Checking {team_programs.count()} group/team-based programs...\n")

    issues_found = []

    for prog in team_programs:
        # Check all results for this program
        results = list(ProgramResult.objects.filter(program=prog))
        assignments = list(ProgramAssignment.objects.filter(program=prog))

        # Build map of (team_id, sub_team_number) from assignments
        assigned_subteams = set()
        for a in assignments:
            if a.team_id:
                sub_num = a.sub_team_number or 1
                assigned_subteams.add((a.team_id, sub_num))

        # Check results
        seen_results = {}
        for r in results:
            team_id = r.team_id
            sub_num = r.sub_team_number or 1
            key = (team_id, sub_num)

            # Check for duplicate results in DB
            if key in seen_results and r.is_team_result:
                issues_found.append({
                    'type': 'DUPLICATE_RESULT',
                    'program': prog,
                    'result': r,
                    'detail': f'Duplicate result found! ID {r.id} clashes with ID {seen_results[key].id} for Team ID {team_id}, Sub-Team {sub_num}'
                })
            else:
                seen_results[key] = r

            # Check for orphan results (Result exists, but 0 students assigned)
            if key not in assigned_subteams:
                team_name = r.team.name if r.team else "NO TEAM"
                issues_found.append({
                    'type': 'ORPHAN_RESULT',
                    'program': prog,
                    'result': r,
                    'detail': f'Orphan Result ID {r.id}: Team "{team_name}" (ID {team_id}), Sub-Team {sub_num} has a Result record, but ZERO student assignments in the UI!'
                })

            # Check for is_team_result mismatch
            if not r.is_team_result:
                team_name = r.team.name if r.team else "NO TEAM"
                issues_found.append({
                    'type': 'FLAG_MISMATCH',
                    'program': prog,
                    'result': r,
                    'detail': f'Result ID {r.id} for team program "{prog.name}" has is_team_result=False! (Should be True)'
                })

    if not issues_found:
        print(">> No orphaned or conflicting ProgramResult records found across all group events.")
    else:
        print(f">> FOUND {len(issues_found)} POTENTIAL CONFLICT(S):\n")
        for i, issue in enumerate(issues_found, 1):
            prog = issue['program']
            print(f"[{i}] Program: \"{prog.name}\" (ID: {prog.id})")
            print(f"    Issue: {issue['type']}")
            print(f"    Detail: {issue['detail']}")
            res = issue['result']
            print(f"    Data: Result ID={res.id}, code_letter='{res.code_letter}', marks={res.total_marks}, status='{res.entry_status}'")
            print("-" * 65)

    if fix and issues_found:
        print("\n[!] FIX MODE ACTIVE: Resolving orphaned empty results...")
        deleted_count = 0
        for issue in issues_found:
            if issue['type'] == 'ORPHAN_RESULT':
                res = issue['result']
                # Only delete if no submitted marks or force
                if not res.has_marks():
                    print(f"    Deleting empty orphan Result ID {res.id} for Program '{issue['program'].name}'...")
                    res.delete()
                    deleted_count += 1
                else:
                    print(f"    WARNING: Result ID {res.id} has marks entered. Skipping deletion to avoid data loss.")
            elif issue['type'] == 'FLAG_MISMATCH':
                res = issue['result']
                print(f"    Fixing is_team_result flag on Result ID {res.id} -> True...")
                res.is_team_result = True
                res.save()
        print(f"\n>> Cleaned up {deleted_count} orphaned records. You should now be able to assign the sub-team!")

if __name__ == '__main__':
    fix_arg = '--fix' in sys.argv
    run_diagnostics(fix=fix_arg)
