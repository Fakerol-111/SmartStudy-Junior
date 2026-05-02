from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置，优先从环境变量 / .env 文件读取。"""

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"

    database_url: str = "sqlite+aiosqlite:///./smartstudy.db"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}
