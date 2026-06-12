from flask import Flask, app, jsonify
from flask_cors import CORS

from .config import Config
from .extensions import db
from .routes import api_bp


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)

    with app.app_context():
        from . import models
        db.create_all()

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
