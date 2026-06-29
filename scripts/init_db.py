#!/usr/bin/env python3
"""Initialize the database and optionally create an admin user."""

from __future__ import annotations

import argparse

from app.core.security import hash_password
from app.db.session import SessionLocal, init_db
from app.models.user import User, UserRole


def create_admin(email: str, password: str, full_name: str) -> None:
    init_db()
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email.lower()).first()
        if existing:
            print(f"User already exists: {email}")
            return
        user = User(
            email=email.lower(),
            hashed_password=hash_password(password),
            full_name=full_name,
            role=UserRole.admin,
        )
        db.add(user)
        db.commit()
        print(f"Admin created: {email}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="ClassroomAI database setup")
    parser.add_argument("--init", action="store_true", help="Create database tables")
    parser.add_argument("--admin-email", help="Create admin user with this email")
    parser.add_argument("--admin-password", help="Admin password (min 8 chars)")
    parser.add_argument("--admin-name", default="Admin", help="Admin display name")
    args = parser.parse_args()

    if args.init or not args.admin_email:
        init_db()
        print("Database tables ready.")

    if args.admin_email:
        if not args.admin_password or len(args.admin_password) < 8:
            raise SystemExit("--admin-password is required (min 8 characters)")
        create_admin(args.admin_email, args.admin_password, args.admin_name)


if __name__ == "__main__":
    main()
