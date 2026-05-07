"""Seed the HR Portal database with employees, chat messages, and sample data."""
import os
import sqlite3
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "hr_portal.db")
DOCS_DIR = os.path.join(os.path.dirname(__file__), "docs")
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "static", "uploads")


def init_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'employee',
            department TEXT,
            position TEXT,
            location TEXT,
            hire_date TEXT,
            dob TEXT,
            gender TEXT,
            salary INTEGER,
            ssn TEXT,
            emergency_contact_name TEXT,
            emergency_contact_phone TEXT,
            emergency_contact_relation TEXT,
            bio TEXT,
            avatar TEXT
        )
    """)

    c.execute("""
        CREATE TABLE chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            message TEXT NOT NULL,
            channel TEXT NOT NULL DEFAULT 'general',
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    c.execute("""
        CREATE TABLE promotion_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            target_position TEXT NOT NULL,
            justification TEXT,
            attachment TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    c.execute("""
        CREATE TABLE notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    employees = [
        # username, password, full_name, email, role, dept, position, location, hire, dob, gender, salary, ssn, ec_name, ec_phone, ec_rel, bio
        ("admin", "WormholeAdmin2049!", "System Administrator", "admin@wormholeresort.com", "admin",
         "IT", "HR System Administrator", "Mars Vegas HQ", "2018-01-15", "1980-05-22", "Other",
         145000, "000-00-0001", "Help Desk", "555-0100", "Internal", "System administrator account."),

        ("hpartner", "hr2025!", "HR Partner", "hr.partner@wormholeresort.com", "hr",
         "Human Resources", "HR Partner", "Mars Vegas HQ", "2020-03-01", "1985-08-14", "Female",
         92000, "100-20-3001", "Front Desk", "555-0101", "Colleague", "HR Partner for the Wormhole Resort."),

        ("awong", "Password1!", "Amy Wong", "amy.wong@wormholeresort.com", "employee",
         "Technology", "CTO", "Mars Vegas HQ", "2019-06-12", "1992-04-03", "Female",
         68000, "541-22-7813", "Leela Turanga", "555-0182", "Spouse",
         "Floor supervisor on the high-roller pit. Mars Vegas alum."),

        ("bwest", "BillyW!2024", "Billy West", "billy.west@wormholeresort.com", "employee",
         "Information Security", "Security Engineer Intern", "Atlantic City Branch", "2017-11-04", "1970-04-16", "Male",
         54000, "287-44-1190", "Phil Fry", "555-0143", "Friend",
         "Long-running lounge act, six nights a week."),

        ("blauer", "Br33se!", "Breese Lauer", "breese.lauer@wormholeresort.com", "manager",
         "Product", "Product Management Intern", "Reno Branch", "2015-02-20", "1988-09-30", "Female",
         81000, "612-77-2240", "Marcus Lauer", "555-0177", "Brother",
         "Manages the entire front-desk rotation across both shifts."),

        ("acheeksgone", "ChEEks!2023", "Alexi Cheeksgone", "alexi.cheeksgone@wormholeresort.com", "employee",
         "Special Operations", "Seal Team 6", "Mars Vegas HQ", "2021-08-18", "1995-12-01", "Male",
         62000, "773-88-4451", "Petra Cheeksgone", "555-0166", "Mother",
         "Reviews surveillance footage and flags incidents for the floor team."),

        ("rtselevic", "MaximusR0me!", "Romulus Maximus Tselevic", "romulus.tselevic@wormholeresort.com", "manager",
         "Information Security", "Penetration Tester", "Mars Vegas HQ", "2014-05-09", "1978-02-11", "Male",
         118000, "904-15-6677", "Antonia Tselevic", "555-0119", "Wife",
         "Executive chef for The Event Horizon restaurant."),

        ("astratt", "AvaSt!88", "Ava Stratt", "ava.stratt@wormholeresort.com", "employee",
         "Antimatter Operations", "Antimatter Containment Field Engineer", "Mars Vegas HQ", "2022-04-25", "1994-07-22", "Female",
         71000, "356-44-9012", "Jordan Stratt", "555-0155", "Sibling",
         "Runs the resort's TikTok and Instagram channels."),

        ("nvega", "N@omiV3ga", "Naomi Vega", "naomi.vega@wormholeresort.com", "employee",
         "Casino Operations", "Pit Boss", "Mars Vegas HQ", "2018-09-30", "1986-11-19", "Female",
         88000, "229-31-7766", "Esteban Vega", "555-0188", "Husband",
         "Oversees blackjack and baccarat tables on the main floor."),

        ("dvolkov", "VolkovDmitri!7", "Dmitri Volkov", "dmitri.volkov@wormholeresort.com", "employee",
         "Security", "Casino Security Lead", "Mars Vegas HQ", "2016-01-12", "1982-03-06", "Male",
         95000, "118-92-5503", "Anya Volkov", "555-0122", "Daughter",
         "Heads the on-floor security team. Previously with international resort security."),

        ("pnandakar", "Priya!2024", "Priya Nandakar", "priya.nandakar@wormholeresort.com", "employee",
         "Finance", "Senior Accountant", "Mars Vegas HQ", "2019-10-07", "1990-06-28", "Female",
         96000, "445-08-1129", "Raj Nandakar", "555-0134", "Father",
         "Senior accountant for the gaming-revenue reconciliation team."),

        ("emercer", "El!asM3rcer", "Elias Mercer", "elias.mercer@wormholeresort.com", "employee",
         "IT", "Network Engineer", "Mars Vegas HQ", "2020-12-01", "1991-01-09", "Male",
         103000, "667-23-4488", "Hannah Mercer", "555-0190", "Wife",
         "Maintains the resort's internal network and surveillance backbone."),
    ]

    now = datetime.utcnow().isoformat()
    for emp in employees:
        c.execute("""
            INSERT INTO users (username, password, full_name, email, role, department, position,
                               location, hire_date, dob, gender, salary, ssn,
                               emergency_contact_name, emergency_contact_phone, emergency_contact_relation, bio, avatar)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (*emp, "default.png"))

    seed_messages = [
        ("hpartner", "Welcome to the new internal chat! Please keep things professional."),
        ("rtselevic", "Reminder: kitchen staff meeting on Friday, 2pm in the Event Horizon kitchen."),
        ("nvega", "Anyone covering my Tuesday graveyard? Trade for Saturday day shift."),
        ("blauer", "Reno front desk is short-staffed this weekend, please reach out if you can travel."),
        ("astratt", "Marketing team — the resort relaunch deck is in the shared drive. Reviews by Thursday."),
        ("emercer", "Network maintenance window scheduled Sunday 2-4am. Wi-Fi may drop briefly."),
        ("awong", "High-roller lounge had a great night, biggest payout this quarter."),
        ("dvolkov", "Reminder to swipe out at the secondary turnstile if the main one shows red."),
    ]
    for username, msg in seed_messages:
        c.execute("SELECT id FROM users WHERE username = ?", (username,))
        uid = c.fetchone()[0]
        c.execute(
            "INSERT INTO chat_messages (user_id, username, message, channel, created_at) VALUES (?, ?, ?, ?, ?)",
            (uid, username, msg, "general", now),
        )

    conn.commit()
    conn.close()


def seed_documents():
    os.makedirs(DOCS_DIR, exist_ok=True)
    docs = {
        "employee_handbook.txt": (
            "WORMHOLE RESORT & CASINO\n"
            "EMPLOYEE HANDBOOK (rev. 2025-01)\n\n"
            "1. Welcome\n"
            "Welcome to the Wormhole Resort & Casino family. This handbook outlines\n"
            "expectations for all employees across our Mars Vegas HQ, Reno, and Atlantic\n"
            "City branches.\n\n"
            "2. Code of conduct\n"
            "Treat every guest and colleague with respect. Report incidents to your\n"
            "manager or to HR via the internal portal.\n\n"
            "3. Time-off policy\n"
            "Full-time employees accrue 15 PTO days per year, plus 10 paid holidays.\n"
        ),
        "benefits_overview.txt": (
            "BENEFITS OVERVIEW 2025\n\n"
            "- Medical: Anthem Gold PPO\n"
            "- Dental: Delta Dental PPO\n"
            "- Vision: VSP Choice\n"
            "- 401(k): 4% company match, vests over 3 years\n"
            "- Resort discount: 25% off rooms, 15% off dining\n"
        ),
        "payroll_calendar.txt": (
            "2025 PAYROLL CALENDAR\n\n"
            "Pay periods run Sunday through Saturday, biweekly.\n"
            "Direct deposits hit on the Friday following each pay period.\n"
            "Questions? Contact payroll@wormholeresort.com\n"
        ),
        "code_of_conduct.txt": (
            "CODE OF CONDUCT\n\n"
            "All employees are expected to comply with state and federal gaming\n"
            "regulations at all times. Suspected violations should be reported to\n"
            "the Compliance Officer (compliance@wormholeresort.com) or anonymously\n"
            "via the ethics hotline.\n"
        ),
        "remote_work_policy.txt": (
            "REMOTE WORK POLICY\n\n"
            "Remote work is available for IT, Marketing, Finance, and HR staff up to\n"
            "2 days per week with manager approval.\n"
        ),
    }
    for name, content in docs.items():
        with open(os.path.join(DOCS_DIR, name), "w", encoding="utf-8") as f:
            f.write(content)


def ensure_uploads_dir():
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    keep = os.path.join(UPLOADS_DIR, ".gitkeep")
    if not os.path.exists(keep):
        open(keep, "w").close()


if __name__ == "__main__":
    init_db()
    seed_documents()
    ensure_uploads_dir()
    print(f"Seeded database at {DB_PATH}")
    print(f"Seeded {len(os.listdir(DOCS_DIR))} documents in {DOCS_DIR}")
    print("Done. Run: python app.py")
