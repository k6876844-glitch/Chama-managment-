-- Chama Management System: MySQL schema (MySQL 8 / MariaDB 10.5+)
--
-- Used directly by backend-node (npm run db:init) and handy for phpMyAdmin
-- imports and drawing the ERD. backend-laravel creates the same tables with
-- its migration in database/migrations, so keep the two in step.

SET NAMES utf8mb4;

-- Members are also the system's users: every member logs in with their phone
-- number and the role column drives role-based access control.
CREATE TABLE IF NOT EXISTS members (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_no   VARCHAR(20)  NULL UNIQUE,
  full_name   VARCHAR(120) NOT NULL,
  phone       VARCHAR(20)  NOT NULL UNIQUE,
  email       VARCHAR(120) NULL UNIQUE,
  id_number   VARCHAR(20)  NULL,
  role        ENUM('chairperson','treasurer','secretary','member') NOT NULL DEFAULT 'member',
  password    VARCHAR(255) NOT NULL,
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  joined_at   DATE NOT NULL,
  created_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
  name   VARCHAR(60)  NOT NULL PRIMARY KEY,
  value  VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO settings (name, value) VALUES
  ('chama_name', 'Umoja Chama'),
  ('contribution_amount', '1000'),
  ('loan_interest_rate', '10');

CREATE TABLE IF NOT EXISTS contributions (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id          BIGINT UNSIGNED NOT NULL,
  amount             DECIMAL(12,2) NOT NULL,
  method             ENUM('mpesa','cash','bank') NOT NULL DEFAULT 'mpesa',
  reference          VARCHAR(50)  NULL,
  contribution_date  DATE NOT NULL,
  notes              VARCHAR(255) NULL,
  recorded_by        BIGINT UNSIGNED NULL,
  created_at         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id)   REFERENCES members(id),
  FOREIGN KEY (recorded_by) REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Flat interest: total_due = principal * (1 + interest_rate / 100).
CREATE TABLE IF NOT EXISTS loans (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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
  FOREIGN KEY (member_id)   REFERENCES members(id),
  FOREIGN KEY (approved_by) REFERENCES members(id) ON DELETE SET NULL,
  FOREIGN KEY (recorded_by) REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS loan_repayments (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  loan_id       BIGINT UNSIGNED NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  method        ENUM('mpesa','cash','bank') NOT NULL DEFAULT 'mpesa',
  reference     VARCHAR(50) NULL,
  payment_date  DATE NOT NULL,
  recorded_by   BIGINT UNSIGNED NULL,
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id)     REFERENCES loans(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fines (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id    BIGINT UNSIGNED NOT NULL,
  reason       VARCHAR(255) NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  fine_date    DATE NOT NULL,
  status       ENUM('unpaid','paid','waived') NOT NULL DEFAULT 'unpaid',
  paid_date    DATE NULL,
  recorded_by  BIGINT UNSIGNED NULL,
  created_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id)   REFERENCES members(id),
  FOREIGN KEY (recorded_by) REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expenses (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category      VARCHAR(60)  NOT NULL,
  description   VARCHAR(255) NULL,
  amount        DECIMAL(12,2) NOT NULL,
  expense_date  DATE NOT NULL,
  receipt_ref   VARCHAR(50) NULL,
  recorded_by   BIGINT UNSIGNED NULL,
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (recorded_by) REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS meetings (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(120) NOT NULL,
  meeting_date  DATE NOT NULL,
  venue         VARCHAR(120) NULL,
  agenda        TEXT NULL,
  minutes       TEXT NULL,
  created_by    BIGINT UNSIGNED NULL,
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendance (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  meeting_id  BIGINT UNSIGNED NOT NULL,
  member_id   BIGINT UNSIGNED NOT NULL,
  status      ENUM('present','absent','apology','late') NOT NULL DEFAULT 'present',
  created_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY attendance_meeting_member (meeting_id, member_id),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id)  REFERENCES members(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Payment and meeting reminders. member_id NULL means the whole group.
CREATE TABLE IF NOT EXISTS reminders (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id   BIGINT UNSIGNED NULL,
  type        ENUM('payment','meeting','loan','general') NOT NULL DEFAULT 'general',
  message     VARCHAR(255) NOT NULL,
  send_at     DATETIME NULL,
  sent_at     DATETIME NULL,
  read_at     DATETIME NULL,
  created_by  BIGINT UNSIGNED NULL,
  created_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id)  REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
