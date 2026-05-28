from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    hf_token: str = ""
    sam3_model_id: str = "facebook/sam3"
    sam3_checkpoint_dir: Path = Path("./checkpoints")
    data_root: Path = Path("./data")
    export_root: Path = Path("./exports")
    api_key: str = "change-me"
    device: str = "cpu"
    max_batch_size: int = 8
    max_image_size: int = 1600
    use_mock: bool = True
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
