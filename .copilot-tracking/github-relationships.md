# Tile Fighter GitHub Issue Relationships

**Repository**: dkirby-ms/tile-fighter  
**Created**: 2026-06-29  
**Purpose**: Document and track GitHub issue parent-child and blocking relationships

---

## Epic-to-Story Parent Relationships (child_of)

### Epic E2 (#2)
- [ ] #13 (E2-S1) - child_of #2
- [ ] #14 (E2-S2) - child_of #2
- [ ] #15 (E2-S3) - child_of #2
- [ ] #16 (E2-S4) - child_of #2

### Epic E3 (#3)
- [ ] #17 (E3-S1) - child_of #3
- [ ] #18 (E3-S2) - child_of #3
- [ ] #19 (E3-S3) - child_of #3
- [ ] #20 (E3-S4) - child_of #3

### Epic E4 (#4)
- [ ] #21 (E4-S1) - child_of #4
- [ ] #22 (E4-S2) - child_of #4
- [ ] #23 (E4-S3) - child_of #4
- [ ] #24 (E4-S4) - child_of #4

### Epic E5 (#5)
- [ ] #25 (E5-S1) - child_of #5
- [ ] #26 (E5-S2) - child_of #5
- [ ] #27 (E5-S3) - child_of #5
- [ ] #28 (E5-S4) - child_of #5

### Epic E6 (#6)
- [ ] #29 (E6-S1) - child_of #6
- [ ] #30 (E6-S2) - child_of #6
- [ ] #31 (E6-S3) - child_of #6
- [ ] #32 (E6-S4) - child_of #6

### Epic E7 (#7)
- [ ] #33 (E7-S1) - child_of #7
- [ ] #34 (E7-S2) - child_of #7
- [ ] #35 (E7-S3) - child_of #7
- [ ] #36 (E7-S4) - child_of #7

### Epic E8 (#8)
- [ ] #37 (E8-S1) - child_of #8
- [ ] #38 (E8-S2) - child_of #8
- [ ] #39 (E8-S3) - child_of #8
- [ ] #40 (E8-S4) - child_of #8

**Subtotal**: 32 parent-child relationships

---

## Story-to-Story Blocking Dependencies

### Epic E1 (Base Stories)
- [ ] #9 blocks #10 (E1-S1 blocks E1-S2)
- [ ] #10 blocks #11 (E1-S2 blocks E1-S3)

### Epic E2
- [ ] #13 blocks #14 (E2-S1 blocks E2-S2)
- [ ] #14 blocks #15 (E2-S2 blocks E2-S3)
- [ ] #13 blocks #16 (E2-S1 blocks E2-S4)

### Epic E3
- [ ] #17 blocks #18 (E3-S1 blocks E3-S2)
- [ ] #18 blocks #19 (E3-S2 blocks E3-S3)
- [ ] #18 blocks #20 (E3-S2 blocks E3-S4)

### Epic E4
- [ ] #21 blocks #22 (E4-S1 blocks E4-S2)
- [ ] #22 blocks #23 (E4-S2 blocks E4-S3)
- [ ] #21 blocks #24 (E4-S1 blocks E4-S4)

### Epic E5
- [ ] #25 blocks #26 (E5-S1 blocks E5-S2)
- [ ] #26 blocks #27 (E5-S2 blocks E5-S3)
- [ ] #25 blocks #28 (E5-S1 blocks E5-S4)

### Epic E6
- [ ] #29 blocks #30 (E6-S1 blocks E6-S2)
- [ ] #30 blocks #31 (E6-S2 blocks E6-S3)
- [ ] #29 blocks #32 (E6-S1 blocks E6-S4)

### Epic E7
- [ ] #33 blocks #34 (E7-S1 blocks E7-S2)
- [ ] #34 blocks #35 (E7-S2 blocks E7-S3)
- [ ] #33 blocks #36 (E7-S1 blocks E7-S4)

### Epic E8
- [ ] #37 blocks #38 (E8-S1 blocks E8-S2)
- [ ] #38 blocks #39 (E8-S2 blocks E8-S3)
- [ ] #37 blocks #40 (E8-S1 blocks E8-S4)

**Subtotal**: 2 + 15 = 17 blocking relationships

---

## Summary

| Relationship Type | Count |
|------------------|-------|
| Parent-Child (Epic → Story) | 32 |
| Blocking Dependencies | 17 |
| **Total Relationships** | **49** |

---

## How to Create These Relationships

### Option 1: GitHub UI
1. Navigate to each issue in the dkirby-ms/tile-fighter repository
2. In the issue details, find the "Linked issues" section
3. Click "Add" and select the appropriate relationship type:
   - For epics → stories: Select "child_of" and specify the epic issue number
   - For blocking dependencies: Select "blocks" and specify the blocking issue number

### Option 2: GitHub CLI (gh)
```bash
# Parent-child relationships
gh issue link <CHILD_ISSUE> --web --body "Related to #{PARENT_ISSUE}"

# Or using the API directly
gh api repos/dkirby-ms/tile-fighter/issues/<ISSUE_NUMBER>/relationships \
  --input - << 'EOF'
{
  "type": "child_of",
  "target_issue_number": <PARENT_ISSUE>
}
EOF
```

### Option 3: GitHub GraphQL API
```graphql
mutation CreateIssueLink(
  $issueId: ID!
  $targetIssueId: ID!
  $relationship: IssueRelationshipType!
) {
  createIssueRelationship(
    input: {
      issueId: $issueId
      targetIssueId: $targetIssueId
      relationship: $relationship
    }
  ) {
    relationship {
      id
      type
    }
  }
}
```

---

## Notes

- Issue #12 is marked as deleted and is skipped
- The dependency pattern for each epic (E2-E8) follows:
  - S1 blocks S2
  - S2 blocks S3
  - S1 blocks S4
- E1 stories (#9, #10, #11) follow the same pattern
- All relationships use GitHub's native issue linking feature

---

## Execution Status

| Phase | Status | Notes |
|-------|--------|-------|
| Planning | ✓ Complete | Relationships documented |
| Creation | ⏳ Pending | Awaiting manual execution or API call |
| Verification | ⏳ Pending | Will verify after creation |

---

**Last Updated**: 2026-06-29
