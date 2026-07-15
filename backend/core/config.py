from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    # Gemini
    GEMINI_API_KEY: str
    
    # JWT Auth
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    
    # Database
    DATABASE_URL: str = "sqlite:///./studybuddy.db"
    
    # ChromaDB
    CHROMA_PERSIST_PATH: str = "./vector_store"
    
    # Uploads
    UPLOAD_DIR: str = "./uploads"
    
    # File settings
    ALLOWED_EXTENSIONS: str = "pdf,docx,txt"
    MAX_FILE_SIZE_MB: int = 50

    # Cloudinary (for persistent file storage on Render free tier)
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# Single instance imported everywhere
settings = Settings()

# Derived helpers used across the app
ALLOWED_EXTENSIONS_LIST = settings.ALLOWED_EXTENSIONS.split(",")
MAX_FILE_SIZE_BYTES = settings.MAX_FILE_SIZE_MB * 1024 * 1024

# Ensure required folders exist on startup
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.CHROMA_PERSIST_PATH).mkdir(parents=True, exist_ok=True)