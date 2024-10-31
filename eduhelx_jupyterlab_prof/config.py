import os
from typing import get_type_hints, Union
from jupyter_server.serverapp import ServerApp

validators = []

def _parse_bool(value: Union[str, bool]) -> bool:
    if type(value) == bool: return value
    return True if value.lower() in ["true", "yes", "1"] else False

""" Adapted boilerplate from https://www.doppler.com/blog/environment-variables-in-python
- Specify default values in config, and it will override them if present in env.
- If a value does not have default value (only a type hint) and is not specified in env, it will raise an exception.
- Methods names of the template `process_{CONFIG_FIELD}` are reserved and may be used to post-process the value of the variable.
"""
class Config:
    GRADER_API_URL: str
    USER_NAME: str
    ACCESS_TOKEN: str = ""
    USER_AUTOGEN_PASSWORD: str = ""
    GITEA_SSH_URL: str = ""
    UPSTREAM_SYNC_INTERVAL: int = 60
    # Which credential helper to use in Git
    CREDENTIAL_HELPER: str = "store"
    # How far ahead of time the API should refresh the access token
    # (proactively refreshing using a buffer deals with issues such as latency and clock sync)
    JWT_REFRESH_LEEWAY_SECONDS: int = 60
    # How long to keep long-polling connections alive before dropping the client.
    LONG_POLLING_TIMEOUT_SECONDS: int = 60
    # For polling that depends on unobservable data, how long to sleep in between data fetches.
    LONG_POLLING_SLEEP_INTERVAL_SECONDS: int = 5


    """
    Map environment variables to class fields according to these rules:
      - Field won't be parsed unless it has a type annotation
      - Field will be skipped if not in all caps
      - Class field and environment variable name are the same
    """
    def __init__(self, env):
        for field in self.__annotations__:
            if not field.isupper():
                continue

            # Raise AppConfigError if required field not supplied
            default_value = getattr(self, field, None)
            if default_value is None and env.get(field) is None:
                raise ValueError('The {} field is required'.format(field))

            # Cast env var value to expected type and raise AppConfigError on failure
            try:
                var_type = get_type_hints(self.__class__)[field]
                if var_type == bool:
                    value = _parse_bool(env.get(field, default_value))
                else:
                    value = var_type(env.get(field, default_value))

                postprocessing_method = getattr(self, f"process_{field}", None)
                if postprocessing_method is not None:
                    value = postprocessing_method(value)

                self.__setattr__(field, value)
            except ValueError:
                raise ValueError('Unable to cast value of "{}" to type "{}" for "{}" field'.format(
                    env[field],
                    var_type,
                    field
                )
            )

        for validator in validators:
            if not validator(self):
                raise ValueError(f"Config misconfiguration: { validator.__validation_description__ }")

    def validator(validation_description: str):
        def decorator(method):
            method.__validation_description__ = validation_description
            if method not in validators: validators.append(method)
            return method
        return decorator
    
    
    @validator("password or auth token must be provided")
    def validate_auth_set(self) -> bool:
        if self.USER_AUTOGEN_PASSWORD and self.ACCESS_TOKEN:
            print("Warning: both password and identity token provided, defaulting to password auth...")
        return self.USER_AUTOGEN_PASSWORD != "" or self.ACCESS_TOKEN != ""

    """ Add a trailing slash to the URL if not present """
    def process_GRADER_API_URL(self, value: str):
        if not value.endswith("/"):
            value += "/"
        return value

    def __repr__(self):
        return str(self.__dict__)

"""
By default, use environment variables to instantiate the config.
Override with any values specified in the extension's config.
Note that extension config values are specified in camelCase,
and converted into SCREAMING_SNAKE_CASE/CONSTANT_CASE.
E.g.
    export GRADER_API_URL="url_A"
    jupyter lab --EduhelxSubmission.graderApiUrl="url_B"
    # Then we'll use "url_B" for GRADER_API_URL, since it's specified directly inside the config.
"""
class ExtensionConfig(Config):
    def __init__(
        self,
        server_app: ServerApp = None
    ):
        data_source = os.environ.copy()
        if server_app is not None:
            for key in server_app.config["EduhelxSubmission"].keys():
                # Jupyter doesn't allow config variables to start with capitals, so they are passed
                # as camelCase and converted into their actual CONSTANT_CASE form.
                key_constant_case = ''.join(['_' + c if c.isupper() else c for c in key]).lstrip('_').upper()
                data_source[key_constant_case] = server_app.config["EduhelxSubmission"][key].get_value(None)

        super().__init__(data_source)