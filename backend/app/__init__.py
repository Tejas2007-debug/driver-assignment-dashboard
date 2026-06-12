from flask import Flask, jsonify
from flask_cors import CORS

from .config import Config
from .extensions import db
from .routes import api_bp


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
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
