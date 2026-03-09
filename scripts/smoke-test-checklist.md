# Requirements Foundry -- AWS Smoke Test Checklist

**Date:** _______________
**ALB URL:** _______________
**Tester:** _______________

> **Note:** A simple test document with requirements-like content is needed for the upload step. Any PDF containing bullet points or numbered requirements will work (e.g., a product spec, feature list, or even a short requirements document created for testing).

---

## Section 1: Pre-Flight (VAL-04)

| # | Step | Expected Result | Pass/Fail |
|---|------|-----------------|-----------|
| 1.1 | Get ALB URL: `aws cloudformation describe-stacks --stack-name RequirementsFoundryStack --query 'Stacks[0].Outputs[?ExportName==\`rf-prod-alb-dns\`].OutputValue' --output text --region us-east-1` | ALB DNS name returned | [ ] Pass / [ ] Fail |
| 1.2 | Open `http://<ALB_URL>` in browser | Homepage renders with navigation, no errors | [ ] Pass / [ ] Fail |
| 1.3 | Check health endpoint: `curl -s http://<ALB_URL>/api/health` | 200 OK with JSON response | [ ] Pass / [ ] Fail |
| 1.4 | ECS task running: `aws ecs describe-services --cluster requirements-foundry-prod-cluster --services requirements-foundry-prod-service --region us-east-1 --query 'services[0].runningCount' --no-cli-pager` | Returns `1` | [ ] Pass / [ ] Fail |

---

## Section 2: Core Generative Flow (VAL-01)

| # | Step | Expected Result | Pass/Fail |
|---|------|-----------------|-----------|
| 2.1 | Create a new project (enter project name and description) | Project created, redirected to project page | [ ] Pass / [ ] Fail |
| 2.2 | Upload a test document (any PDF or text file with requirements-like content) | Upload progress shown, file appears in project uploads | [ ] Pass / [ ] Fail |
| 2.3 | Run card analysis on uploaded document | Analysis starts, progress indicator shown, cards generated after 30-60 seconds | [ ] Pass / [ ] Fail |
| 2.4 | Verify cards are displayed with titles and descriptions | Card list populated with extracted requirements | [ ] Pass / [ ] Fail |
| 2.5 | Generate epics from analyzed cards | Epic generation starts, progress shown, epics created | [ ] Pass / [ ] Fail |
| 2.6 | Verify epics displayed with correct hierarchy | Epic list with linked cards | [ ] Pass / [ ] Fail |
| 2.7 | Generate stories for at least one epic | Story generation starts, stories created under the epic | [ ] Pass / [ ] Fail |
| 2.8 | Verify stories displayed under the parent epic | Story list visible with descriptions | [ ] Pass / [ ] Fail |
| 2.9 | Generate subtasks for at least one story | Subtask generation starts, subtasks created | [ ] Pass / [ ] Fail |
| 2.10 | Verify subtasks displayed under the parent story | Subtask list with acceptance criteria | [ ] Pass / [ ] Fail |
| 2.11 | Export to JIRA format | JIRA export file downloads (CSV or JSON), contains epics/stories/subtasks | [ ] Pass / [ ] Fail |
| 2.12 | Open export file and verify structure | Valid format with project hierarchy preserved | [ ] Pass / [ ] Fail |

---

## Section 3: MSS Flow (VAL-02)

| # | Step | Expected Result | Pass/Fail |
|---|------|-----------------|-----------|
| 3.1 | Navigate to MSS management page | MSS page loads | [ ] Pass / [ ] Fail |
| 3.2 | Import MSS taxonomy CSV (use existing CSV file) | Service lines, service areas, and activities imported | [ ] Pass / [ ] Fail |
| 3.3 | Verify imported taxonomy displays correctly | Hierarchical display of service lines > areas > activities | [ ] Pass / [ ] Fail |
| 3.4 | Map at least one epic or story to an MSS service area | Mapping saved successfully | [ ] Pass / [ ] Fail |
| 3.5 | Check MSS dashboard | Dashboard shows mapped items, counts are correct | [ ] Pass / [ ] Fail |

---

## Section 4: Data Integrity (VAL-03)

> **Note:** If starting fresh (no Neon migration), mark this entire section N/A.

| # | Step | Expected Result | Pass/Fail |
|---|------|-----------------|-----------|
| 4.1 | Navigate to existing projects (from Neon data) | Previously created projects appear in project list | [ ] Pass / [ ] Fail / [ ] N/A |
| 4.2 | Open an existing project | Project details, uploads, cards visible | [ ] Pass / [ ] Fail / [ ] N/A |
| 4.3 | Verify epics for existing project | Previously generated epics are accessible | [ ] Pass / [ ] Fail / [ ] N/A |
| 4.4 | Verify stories and subtasks | Full hierarchy from old data intact | [ ] Pass / [ ] Fail / [ ] N/A |

---

## Section 5: AI Verification (AI-01, AI-04)

| # | Step | Expected Result | Pass/Fail |
|---|------|-----------------|-----------|
| 5.1 | Bedrock AI was used for card analysis (verified in Section 2, step 2.3) | Cards generated successfully using Bedrock Claude | [ ] Pass / [ ] Fail |
| 5.2 | Bedrock AI was used for epic generation (verified in Section 2, step 2.5) | Epics generated successfully | [ ] Pass / [ ] Fail |

---

## Section 6: Results Summary

```
Pre-Flight:      [ ] PASS  [ ] FAIL
Core Flow:       [ ] PASS  [ ] FAIL
MSS Flow:        [ ] PASS  [ ] FAIL
Data Integrity:  [ ] PASS  [ ] FAIL  [ ] N/A
AI Verification: [ ] PASS  [ ] FAIL

Overall:         [ ] PASS  [ ] FAIL
Tested by:       _______________
Date:            _______________
Notes:           _______________
```
