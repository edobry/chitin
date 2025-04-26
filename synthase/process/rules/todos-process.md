# Todos Process Rule

## Rule Name: todos-process

## Description

This rule defines the mandatory process for working with tasks in the Synthase project. All code changes must follow this process to maintain consistency and quality.

## Process

### 1. Check Todos First
- Before starting any work, check `/process/todos.md` for related tasks
- If your work relates to an existing task, follow that task's process
- If no task exists for your work, create one following the task template

### 2. Follow Task Documentation
- Each task has a detailed specification in `/process/tasks/{id}-{name}.md`
- Read the entire specification before starting work
- Follow all implementation steps in order
- Complete all verification steps
- Update documentation as specified

### 3. Task Completion Rules
- Tasks are only considered complete when:
  - All verification steps pass
  - All documentation is updated
  - CHANGELOG is updated
  - PR is created with proper references
- Use `[x]` to mark completed tasks in todos.md
- Document any incomplete verification steps
- Never skip verification steps

### 4. CHANGELOG Updates
- Location: `CHANGELOG.md` in project root
- Add entries under [Unreleased] section
- Use appropriate categories:
  - Added: New features
  - Changed: Changes in existing functionality
  - Deprecated: Soon-to-be removed features
  - Removed: Removed features
  - Fixed: Bug fixes
  - Security: Security fixes
- Be specific about changes and their impact

### 5. Pull Request Requirements
- Reference task number in PR title: `[#123] Add new feature`
- Include in PR description:
  - Link to task doc
  - Verification evidence
  - Related issues/docs
  - Testing steps
  - Screenshots if UI changes

### 6. Task Dependencies
- Check task docs for listed dependencies
- Complete dependencies before starting dependent task
- Document any new dependencies discovered
- Update task docs if new dependencies are found

## Task Template

```markdown
# Task Title

## Overview
Brief description of the task and its goals

## Current Issues
List of current issues being addressed

## Required Changes
Detailed list of required changes

## Implementation Steps
Step-by-step implementation guide

## Verification
Checklist of verification steps

## Notes
Additional information and considerations
```

## Benefits

- Ensures consistent task tracking
- Maintains high code quality
- Provides clear documentation
- Facilitates code review
- Enables project tracking
- Preserves implementation context

## Violations

The following are considered violations of this rule:

1. Making code changes without a corresponding task
2. Skipping verification steps
3. Not updating CHANGELOG
4. Marking tasks complete without meeting all requirements
5. Creating PRs without proper task references
6. Not following task dependencies

## Enforcement

This rule is enforced through:
- PR review process
- Automated checks for CHANGELOG updates
- Task completion verification
- Documentation reviews 
