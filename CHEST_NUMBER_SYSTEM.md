# Chest Number System Implementation

## Overview

The chest number system automatically generates unique identification numbers for students participating in events. This system ensures easy identification during events and provides a systematic way to track student participation.

## Features Implemented

### 🎯 **Automatic Chest Number Generation**

- **Team-Based Ranges**: Each team gets a specific range of 100 numbers based on team_number
  - Team 1: 100-199
  - Team 2: 200-299
  - Team 3: 300-399
  - And so on...

- **General Category Dynamic Ranges**: General category (open) programs start from higher numbers based on total team count
  - 2 teams total → General starts from 300
  - 3 teams total → General starts from 400
  - 4 teams total → General starts from 500
  - Formula: `(total_teams + 1) * 100`

- **Smart Assignment**: Chest numbers are automatically generated when students are assigned to programs
- **One Number Per Event**: Each student gets one chest number per event, reused across all programs in that event
- **Participation-Based**: Only students who actually participate in programs get chest numbers (not all students)
- **Team Number Based**: Uses team.team_number instead of team.id for consistent numbering

### 🔄 **Chest Number Consistency**

- **Same Student, Same Event, Same Number**: A student participating in multiple programs within the same event will have the same chest number across all programs
- **Automatic Reuse**: When a student is assigned to a new program in an event where they already have a chest number, the existing number is reused
- **Team-Based Ranges**: Chest numbers are assigned within the team's designated range (team_number * 100 to team_number * 100 + 99)
- **General Category Isolation**: General category numbers are completely separate from team-based numbers

### 🔍 **Search by Chest Number**

- **Event-Specific Search**: Search for students by chest number within specific events
- **Comprehensive Information**: Shows student details, team info, programs, and results
- **Real-Time Search**: Instant search functionality in the Calling Sheet section

### 📊 **Enhanced Student Profiles**

- **Chest Number Display**: Shows chest numbers in student participation history
- **Event Tracking**: Displays which events have chest numbers assigned
- **Program Details**: Enhanced program cards with chest number badges

### 📄 **PDF Generation Improvements**

- **General Category Programs**: PDFs show only the main name from each team with "and team" suffix (no chest numbers)
- **HS/HSS Programs**: PDFs show chest numbers and all individual participants with their names
- **Single Member Teams**: Show just the member's name without "and team" suffix
- **Cleaner Layout**: Reduced clutter in all calling sheets, valuation sheets, and results PDFs

## Usage Instructions

### For Administrators

1. **Assign Students to Teams**: Students must be assigned to teams first
2. **Create Events and Programs**: Set up events with their programs
3. **Assign Students to Programs**: When students are assigned to programs, chest numbers are automatically generated
4. **Search Students**: Use the Calling Sheet section to search by chest number

### Chest Number Ranges

#### Team-Based Programs
- **Team 1**: 100-199
- **Team 2**: 200-299
- **Team 3**: 300-399
- **Team 4**: 400-499
- And so on...

#### General Category Programs
- **2 teams total**: 300-399, 400-499, etc.
- **3 teams total**: 400-499, 500-599, etc.
- **4 teams total**: 500-599, 600-699, etc.

### PDF Display Rules

#### Calling Sheets, Valuation Sheets, and Results PDFs
- **General Category Programs**: Show only the main name from each team with "and team" suffix (no chest numbers)
- **HS/HSS Programs**: Show chest numbers and all individual participants with their names
- **Single Member Teams**: Show just the member's name without "and team" suffix
- **Consistent Logic**: All three PDF types (Calling List, Valuation Sheet, Results) follow the same grouping and display rules

## Management Commands

### Update General Category Chest Numbers
```bash
# Dry run to see what would be changed
python3 manage.py update_general_chest_numbers --dry-run

# Apply the changes
python3 manage.py update_general_chest_numbers
```

### Fix Team-Based Chest Numbers
```bash
# Dry run to see what would be changed
python3 manage.py fix_chest_numbers --dry-run

# Apply the changes
python3 manage.py fix_chest_numbers
```

## Technical Implementation

### Model Changes
- `ProgramAssignment.chest_number`: Auto-generated based on team and category
- `ChestNumber`: Backward compatibility model for chest number tracking

### Logic Flow
1. Student assigned to program
2. Check if team exists
3. If team exists: Use team-based numbering (team_number * 100 + sequence)
4. If no team (general category): Use dynamic starting number based on total teams
5. Generate chest code for student
6. Create/update ChestNumber record

### PDF Generation
- Different logic for general vs HS/HSS programs
- Grouping by team for general category
- Representative chest number and name display
- **All three PDF types** (Calling List, Valuation Sheet, Results) use the same grouping logic