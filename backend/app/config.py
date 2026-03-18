from pydantic_settings import BaseSettings


class Config(BaseSettings):
    tripo_api_key: str = ""
    anthropic_api_key: str = ""
    bestbuy_api_key: str = ""
    nexar_api_key: str = ""
    upcitemdb_api_key: str = ""
    icecat_username: str = "openIcecat-live"
    upload_dir: str = "/tmp/product-viewer-uploads"
    catalog_dir: str = "/tmp/product-viewer-catalog"
    max_upload_mb: int = 10

    model_config = {"env_file": ".env"}


config = Config()
