-- Chama Management System: MySQL schema (MySQL 8 / MariaDB 10.5+)
--
-- Plain-SQL equivalent of
-- backend-laravel/database/migrations/2026_11_03_000001_create_chama_tables.php.
-- Column types, index names and foreign-key names follow what that migration
-- produces on MySQL. created_at/updated_at also get CURRENT_TIMESTAMP defaults,
-- because only Laravel fills them in itself.
--
-- Run:  mysql -u root chama < schema.sql
-- Safe to re-run: tables are created only if missing, and settings rows are not duplicated.

SET NAMES utf8mb4;

-- Members are also the system's users; role drives role-based access control.
CREATE TABLE IF NOT EXISTS members (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_no   VARCHAR(20)  NULL,
  full_name   VARCHAR(120) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  email       VARCHAR(120) NULL,
  id_number   VARCHAR(20)  NULL,
  role        ENUM('chairperson','treasurer','secretary','member') NOT NULL DEFAULT 'member',
  password    VARCHAR(255) NOT NULL,
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  joined_at   DATE NOT NULL,
  created_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY members_member_no_unique (member_no),
  UNIQUE KEY members_phone_unique (phone),
  UNIQUE KEY members_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  name   VARCHAR(60)  NOT NULL,
  value  VARCHAR(255) NOT NULL,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default settings
INSERT IGNORE INTO settings (name, value) VALUES
  ('chama_name',          'Umoja Chama'),
  ('contribution_amount', '1000'),
  ('loan_interest_rate',  '10');

CREATE TABLE IF NOT EXISTS contributions (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_id          BIGINT UNSIGNED NOT NULL,
  amount             DECIMAL(12,2) NOT NULL,
  method             ENUM('mpesa','cash','bank') NOT NULL DEFAULT 'mpesa',
  reference          VARCHAR(50)  NULL,
  contribution_date  DATE NOT NULL,
  notes              VARCHAR(255) NULL,
  recorded_by        BIGINT UNSIGNED NULL,
  created_at         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT contributions_member_id_foreign   FOREIGN KEY (member_id)   REFERENCES members (id),
  CONSTRAINT contributions_recorded_by_foreign FOREIGN KEY (recorded_by) REFERENCES members (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Flat interest: total_due = principal * (1 + interest_rate / 100).
CREATE TABLE IF NOT EXISTS loans (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_id      BIGINT UNSIGNED NOT NULL,
  principal      DECIMAL(12,2) NOT NULL,
  interest_rate  DECIMAL(5,2)  NOT NULL,
  total_due      DECIMAL(12,2) NOT NULL,
  purpose        VARCHAR(255) NULL,
  status         ENUM('pending','active','cleared','rejected','defaulted') NOT NULL DEFAULT 'pending',
  applied_at     DATE NOT NULL,
  issue_date     DATE NULL,
  due_date       DATE NULL,
  approved_by    BIGINT UNSIGNED NULL,
  recorded_by    BIGINT UNSIGNED NULL,
  created_at     TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT loans_member_id_foreign   FOREIGN KEY (member_id)   REFERENCES members (id),
  CONSTRAINT loans_approved_by_foreign FOREIGN KEY (approved_by) REFERENCES members (id) ON DELETE SET NULL,
  CONSTRAINT loans_recorded_by_foreign FOREIGN KEY (recorded_by) REFERENCES members (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loan_repayments (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  loan_id       BIGINT UNSIGNED NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  method        ENUM('mpesa','cash','bank') NOT NULL DEFAULT 'mpesa',
  reference     VARCHAR(50) NULL,
  payment_date  DATE NOT NULL,
  recorded_by   BIGINT UNSIGNED NULL,
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT loan_repayments_loan_id_foreign     FOREIGN KEY (loan_id)     REFERENCES loans (id)   ON DELETE CASCADE,
  CONSTRAINT loan_repayments_recorded_by_foreign FOREIGN KEY (recorded_by) REFERENCES members (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fines (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_id    BIGINT UNSIGNED NOT NULL,
  reason       VARCHAR(255) NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  fine_date    DATE NOT NULL,
  status       ENUM('unpaid','paid','waived') NOT NULL DEFAULT 'unpaid',
  paid_date    DATE NULL,
  recorded_by  BIGINT UNSIGNED NULL,
  created_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fines_member_id_foreign   FOREIGN KEY (member_id)   REFERENCES members (id),
  CONSTRAINT fines_recorded_by_foreign FOREIGN KEY (recorded_by) REFERENCES members (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category      VARCHAR(60)  NOT NULL,
  description   VARCHAR(255) NULL,
  amount        DECIMAL(12,2) NOT NULL,
  expense_date  DATE NOT NULL,
  receipt_ref   VARCHAR(50) NULL,
  recorded_by   BIGINT UNSIGNED NULL,
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT expenses_recorded_by_foreign FOREIGN KEY (recorded_by) REFERENCES members (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meetings (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title         VARCHAR(120) NOT NULL,
  meeting_date  DATE NOT NULL,
  venue         VARCHAR(120) NULL,
  agenda        TEXT NULL,
  minutes       TEXT NULL,
  created_by    BIGINT UNSIGNED NULL,
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT meetings_created_by_foreign FOREIGN KEY (created_by) REFERENCES members (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  meeting_id  BIGINT UNSIGNED NOT NULL,
  member_id   BIGINT UNSIGNED NOT NULL,
  status      ENUM('present','absent','apology','late') NOT NULL DEFAULT 'present',
  created_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY attendance_meeting_id_member_id_unique (meeting_id, member_id),
  CONSTRAINT attendance_meeting_id_foreign FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE,
  CONSTRAINT attendance_member_id_foreign  FOREIGN KEY (member_id)  REFERENCES members (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment and meeting reminders. member_id NULL means the whole group.
CREATE TABLE IF NOT EXISTS reminders (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_id   BIGINT UNSIGNED NULL,
  type        ENUM('payment','meeting','loan','general') NOT NULL DEFAULT 'general',
  message     VARCHAR(255) NOT NULL,
  send_at     DATETIME NULL,
  sent_at     DATETIME NULL,
  read_at     DATETIME NULL,
  created_by  BIGINT UNSIGNED NULL,
  created_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT reminders_member_id_foreign  FOREIGN KEY (member_id)  REFERENCES members (id) ON DELETE CASCADE,
  CONSTRAINT reminders_created_by_foreign FOREIGN KEY (created_by) REFERENCES members (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
