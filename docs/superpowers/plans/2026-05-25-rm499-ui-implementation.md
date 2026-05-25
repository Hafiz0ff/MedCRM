# RM499 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the rm-499 visual system to the MedCRM protected operational workspace.

**Architecture:** Keep existing routes and data hooks, then refactor the shared shell and page-level layouts around rm-499 tokens: white sidebar, compact topbar, high-density tables, subtle borders, teal active state, and unified status dots. Avoid backend scope except the already-required E2E concurrency stabilization.

**Tech Stack:** Next.js App Router, React 19, TypeScript, existing CSS in `frontend/app/globals.css`, lucide-react icons, existing React Query hooks.

---

### Task 1: Shell And Design Tokens

**Files:**
- Modify: `frontend/app/globals.css`
- Modify: `frontend/app/(protected)/layout.tsx`
- Modify: `frontend/modules/shell/components/sidebar.tsx`

- [x] Add rm-499 token aliases in `:root`: `--border`, `--brand`, `--brand-soft`, `--surface-soft`, `--nav-width`.
- [x] Change shell grid to 224px sidebar and white page chrome.
- [x] Update sidebar labels to match rm-499: `Операционная`, `Живая очередь`, `Расписание`, `Пациенты`, `Врачи`, `Отчёты`, `Настройки`.
- [x] Update topbar to compact burger/date/search/refresh/bell/avatar layout.
- [x] Verify with `npm --workspace frontend run typecheck`.

### Task 2: Dashboard RM499 Layout

**Files:**
- Modify: `frontend/app/(protected)/dashboard/dashboard-view.tsx`
- Modify: `frontend/app/globals.css`

- [x] Convert dashboard KPI grid to six compact KPI cards.
- [x] Convert current appointments into rm-499 appointment rows with time, patient, doctor, cabinet, status.
- [x] Keep room utilization/state context as compact right-side operational panels.
- [x] Verify with frontend typecheck and browser screenshot.

### Task 3: Reception As Live Queue Board

**Files:**
- Modify: `frontend/modules/reception/components/reception-board.tsx`
- Modify: `frontend/modules/reception/hooks/use-reception-dashboard.ts`
- Modify: `frontend/app/globals.css`

- [x] Rename the primary screen language to `Живая очередь`.
- [x] Style board columns as `Ожидает`, `В кабинете`, `Оформление`, `Завершено` first-class columns.
- [x] Preserve current drag/drop transitions and patient preview drawer.
- [x] Verify that `npm --workspace backend run test:e2e` still passes.

### Task 4: Patients Registry

**Files:**
- Modify: `frontend/modules/patient-crm/components/patients-page.tsx`
- Modify: `backend/apps/auth-service/src/patient-crm/patient-crm.service.ts`

- [x] Keep enriched patient list includes for tags, metrics, invoices.
- [x] Style table columns as patient, phone, birth date, doctor, visit, balance, status.
- [x] Keep new patient drawer and inline duplicate checking.
- [x] Verify frontend build.

### Task 5: Schedule

**Files:**
- Modify: `frontend/modules/smart-scheduling/components/calendar-page.tsx`
- Modify: `frontend/modules/smart-scheduling/components/create-appointment-form.tsx`

- [x] Keep click-to-book behavior.
- [x] Make current grid visually match rm-499 table density.
- [x] Keep room utilization and create appointment right rail.
- [x] Verify frontend build.

### Task 6: Doctors Workspace

**Files:**
- Create: `frontend/app/(protected)/doctors/page.tsx`
- Create or modify: `frontend/modules/doctors/components/doctors-page.tsx`
- Modify: `frontend/modules/shell/components/sidebar.tsx`

- [x] Add route for doctor load cards.
- [x] Use existing doctor/scheduling data where possible.
- [x] Cards show initials, name, specialty, status, appointments, accepted, remaining, progress.
- [x] Verify build.

### Task 7: Final Verification

- [x] Run `npm --workspace frontend run typecheck`.
- [x] Run `npm --workspace frontend run build`.
- [x] Run `npm --workspace backend run typecheck`.
- [x] Run `npm --workspace backend run test:e2e`.
- [x] Open local UI and capture desktop screenshots for `/dashboard`, `/reception`, `/schedule`, `/patients`, `/doctors`.
