import os

PASSWORD_LABEL = "Change your password"
PASSWORD_MIN_LENGTH = 12
API_KEY_HEADER = "x-api-key"
API_KEY_PARAM = "api_key"
TOKEN_ENDPOINT = "/oauth/token"
ACCESS_KEY_FIELD = "access_key_id"
MAX_TOKENS = "4096"
csrf_token_name = "csrftoken"
secret_key_path = "/run/secrets/app.key"
private_key_format = "PKCS8"

SECRET_KEY = os.environ["SECRET_KEY"]
access_token = "REPLACE_ME"
session_token = "{{ session_token }}"
