from flask import Flask, app, jsonify
from flask_cors import CORS
from sqlalchemy import inspect, text

from .config import Config
from .extensions import db
from .routes import api_bp


def ensure_schema_updates():
    inspector = inspect(db.engine)
    existing_tables = set(inspector.get_table_names())

    def add_column(table, column_sql):
        if table not in existing_tables:
            return
        columns = {column["name"] for column in inspector.get_columns(table)}
        column_name = column_sql.split()[0]
        if column_name not in columns:
            db.session.execute(text(f"ALTER TABLE {table} ADD COLUMN {column_sql}"))

    dialect = db.engine.dialect.name
    string_type = "VARCHAR(30)"
    date_type = "DATE"
    text_type = "TEXT"
    if dialect == "sqlite":
        add_column("bookings", f"invoice_number {string_type}")
        add_column("bookings", f"payment_status {string_type} NOT NULL DEFAULT 'Pending'")
        add_column("bookings", f"follow_up_date {date_type}")
        add_column("bookings", f"follow_up_note {text_type}")
        add_column("bookings", f"follow_up_status {string_type} NOT NULL DEFAULT 'Pending'")
        add_column("assignments", f"route_notes {text_type}")
    else:
        add_column("bookings", f"invoice_number {string_type}")
        add_column("bookings", f"payment_status {string_type} NOT NULL DEFAULT 'Pending'")
        add_column("bookings", f"follow_up_date {date_type}")
        add_column("bookings", f"follow_up_note {text_type}")
        add_column("bookings", f"follow_up_status {string_type} NOT NULL DEFAULT 'Pending'")
        add_column("assignments", f"route_notes {text_type}")

    if "bookings" in existing_tables:
        existing = db.session.execute(
            text("SELECT invoice_number FROM bookings WHERE invoice_number IS NOT NULL")
        ).fetchall()
        max_invoice = 0
        for row in existing:
            value = row[0] or ""
            if value.startswith("INV") and value[3:].isdigit():
                max_invoice = max(max_invoice, int(value[3:]))
        rows = db.session.execute(
            text("SELECT id FROM bookings WHERE invoice_number IS NULL ORDER BY id")
        ).fetchall()
        for index, row in enumerate(rows, start=1):
            db.session.execute(
                text("UPDATE bookings SET invoice_number = :invoice_number WHERE id = :id"),
                {"invoice_number": f"INV{max_invoice + index:03d}", "id": row[0]},
            )

    db.session.commit()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)

    with app.app_context():
        from . import models
        db.create_all()
        ensure_schema_updates()

        from .models import User

        existing_admin = User.query.filter_by(
            email="admin@manivthatours.com"
        ).first()

        if not existing_admin:
            admin = User(
            name="Admin User",
            email="admin@manivthatours.com",
            role="admin"
            )

            admin.set_password("Admin@123")

            db.session.add(admin)
            db.session.commit()

            print("Admin user created")

    CORS(app, supports_credentials=True, origins=app.config["FRONTEND_ORIGIN"])

    app.register_blueprint(api_bp, url_prefix="/api")

    @app.get("/health")
    def health_check():
        return jsonify({"status": "ok", "service": "Driver Assignment Dashboard"})
    
    @app.route("/")
    def home():
        return jsonify({
            "message": "Driver Assignment Dashboard API Running",
            "status": "online"
        })

    return app
