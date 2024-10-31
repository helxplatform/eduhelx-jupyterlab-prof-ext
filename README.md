# eduhelx-jupyterlab-prof-ext (JLS-ext)

[![Github Actions Status](https://github.com/helxplatform/eduhelx_jupyterlab_prof/workflows/Build/badge.svg)](https://github.com/helxplatform/eduhelx_jupyterlab_prof/actions/workflows/build.yml)
A JupyterLab extension for managing assignments/submissions in EduHeLx

This extension is composed of a Python package named `eduhelx_jupyterlab_prof`
for the server extension and a NPM package named `eduhelx_jupyterlab_prof`
for the frontend extension.

## Requirements

- JupyterLab >= 4.0.0

## Install

To install the extension, execute:

```bash
pip install eduhelx_jupyterlab_prof
jupyter server extension enable eduhelx_jupyterlab_prof
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall eduhelx_jupyterlab_prof
```

## Troubleshoot

If you are seeing the frontend extension, but it is not working, check
that the server extension is enabled:

```bash
jupyter server extension list
```

If the server extension is installed and enabled, but you are not seeing
the frontend extension, check the frontend extension is installed:

```bash
jupyter labextension list
```

## Contributing

### Development install

You can either run via Docker or install the extension into your local Jupyter installation in development mode.

#### Local Docker environment
Run the extension locally in Docker via `docker-compose`:

1. Configure your environment for running inside Docker. Also see: `.env.docker.sample`.
```
export COMPOSE_PROJECT_NAME=jlp
export GRADER_API_URL=http://host.docker.internal:8000
export USER_NAME="username"
export USER_AUTOGEN_PASSWORD="password"
export GITEA_SSH_URL=ssh://git@host.docker.internal:2222
```
In this scenario, you'd either be port-forwarding or running the [Grader API](https://github.com/helxplatform/eduhelx-grader-api)
on port 8000, and port-forwarding your Gitea SSH service to port 2222. You can find the password for a user by decoding their credential secret.

You can also define a separate environment file specifically for working in Docker:
```bash
cp .env.docker.sample .env.docker
vim .env.docker
set -a && source .env.docker
```

2. Start the Docker containers:
```bash
docker-compose up
```

3. Open the authenticated Jupyter URL.

Jupyterlab will run on `localhost:8888`, but it requires an authentication token to access the UI.
The jupyter container will log the authenticated URL for accessing the UI at startup,
but you can also run the following to recover the token:
```bash
docker exec jlp_jupyter_1 jupyter server list 
```

#### Local install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

Installing the extension
```bash
# Clone the repo to your local environment
# Change directory to the eduhelx_jupyterlab_prof directory
# Install package in development mode
pip install -ve ".[test]"
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Server extension must be manually installed in develop mode
jupyter server extension enable eduhelx_jupyterlab_prof
```

Frontend Development (after install)
```bash
jlpm watch
```

Backend Development (after install)
```bash
cp .env.sample .env
source .env
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
# Server extension must be manually disabled in develop mode
jupyter server extension disable eduhelx_jupyterlab_prof
pip uninstall eduhelx_jupyterlab_prof
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `eduhelx_jupyterlab_prof` within that folder.

### Testing the extension

#### Server tests

This extension is using [Pytest](https://docs.pytest.org/) for Python code testing.

Install test dependencies (needed only once):

```sh
pip install -e ".[test]"
# Each time you install the Python package, you need to restore the front-end extension link
jupyter labextension develop . --overwrite
```

To execute them, run:

```sh
pytest -vv -r ap --cov eduhelx_jupyterlab_prof
```

#### Frontend tests

This extension is using [Jest](https://jestjs.io/) for JavaScript code testing.

To execute them, execute:

```sh
jlpm
jlpm test
```

#### Integration tests

This extension uses [Playwright](https://playwright.dev/docs/intro/) for the integration tests (aka user level tests).
More precisely, the JupyterLab helper [Galata](https://github.com/jupyterlab/jupyterlab/tree/master/galata) is used to handle testing the extension in JupyterLab.

More information are provided within the [ui-tests](./ui-tests/README.md) README.

### Packaging the extension

See [RELEASE](RELEASE.md)
