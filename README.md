# Umoja Chama: Chama Management System

A web-based system (installable as a PWA, a Progressive Web App) for managing a chama's members, contributions,
loans and repayments, fines, expenses, meetings and attendance, and reports, with role-based access control.

There are **two interchangeable backends**: Node.js/Express and PHP/Laravel. Both implement the same
API ([docs/api.md](docs/api.md)) on the same MySQL schema, so the one frontend works with either.
Pick one to develop and present. You don't need to run both.

```
chama/
├── frontend/            PWA: plain HTML, CSS and JavaScript, no build step
│   ├── index.html       Landing page
│   ├── app.html         The system (login + all modules)
│   ├── js/config.js     ← set API_BASE to the backend you are running
│   ├── js/api.js        fetch wrapper (token, errors)
│   ├── js/app.js        Views for each module, role-aware
│   ├── css/style.css
│   └── sw.js, manifest.webmanifest, icon.svg
├── database/
│   └── schema.sql       MySQL schema: one source for the ERD and the Node backend
├── docs/
│   └── api.md           Endpoints, request/response shapes, who may call what
├── backend-node/        Option A: Node.js + Express + mysql2 + JWT
│   ├── src/server.js, src/app.js
│   ├── src/routes.js    Every route and the roles allowed on it
│   ├── src/middleware/  authenticate, authorize(roles), error handler
│   ├── src/controllers/ One file per module
│   └── scripts/         init-db.js, create-admin.js
└── backend-laravel/     Option B: PHP Laravel 12 + Sanctum
    ├── setup.sh         Downloads Laravel around these files (run once)
    ├── routes/api.php   Every route and the roles allowed on it
    ├── app/Http/Middleware/EnsureRole.php
    ├── app/Http/Controllers/Api/   One controller per module
    ├── app/Models/      Member, Contribution, Loan, LoanRepayment, Fine, Expense, Meeting, Attendance, Reminder
    └── database/migrations, database/seeders
```

## Modules and roles

| Module | Chairperson | Treasurer | Secretary | Member |
|---|---|---|---|---|
| Members | add, edit, assign roles, deactivate | view | add, edit | own profile |
| Contributions | view all, record | record, edit | view all | own only |
| Loans | approve / reject | record repayments | view all | apply, own only |
| Fines | waive | add, mark paid | add | own only |
| Expenses | view | record, edit, delete | view | view |
| Meetings & attendance | schedule, minutes | view | schedule, minutes, attendance | view |
| Reports | group summary, any statement | same | same | own statement |

## Prerequisites

- **MySQL 8** (or MariaDB 10.5+). XAMPP is fine on Windows
- **Option A:** Node.js 20+
- **Option B:** PHP 8.2+ and Composer

## Option A: run with Node.js

```bash
cd backend-node
cp .env.example .env              # then set DB_PASSWORD and JWT_SECRET
npm install
npm run db:init                   # creates the database and tables
npm run create-admin -- "Jane Wanjiru" 0712345678 secret123
npm run dev                       # API on http://localhost:3000/api
```

## Option B: run with Laravel

```bash
cd backend-laravel
bash setup.sh                     # once: fetches Laravel + Sanctum, keeps the Chama files
# create an empty MySQL database called "chama", check DB_* and ADMIN_* in .env
php artisan migrate --seed        # tables + first chairperson (ADMIN_PHONE / ADMIN_PASSWORD)
php artisan serve                 # API on http://localhost:8000/api
```

On Windows, run `setup.sh` from Git Bash, or follow its steps by hand: `composer create-project laravel/laravel`,
`php artisan install:api`, then copy this folder's files over the new project.

## Run the frontend

Set `API_BASE` in [frontend/js/config.js](frontend/js/config.js) (port 3000 for Node, 8000 for Laravel). Then serve the folder:

```bash
cd frontend
python3 -m http.server 5500       # or VS Code "Live Server"
```

Open http://localhost:5500/app.html and log in with the chairperson's phone number and password.
Add the treasurer, secretary and members from the Members page.

## Notes

- Interest is flat: KES 10,000 at 10% means KES 11,000 to repay. The default rate lives in the `settings` table.
- `cash_at_hand = contributions + repayments + fines paid − loans issued − expenses`.
- Members are deactivated, never deleted, so the financial history stays complete.
- The `reminders` table is in place for payment and meeting reminders. The SMS/email sending
  (e.g. Africa's Talking) and M-Pesa Daraja integration are the next things to build.
