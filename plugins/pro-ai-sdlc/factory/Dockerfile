# Image for `factory.py run`: one throwaway container per phase on a fresh clone.
# Build it with: docker build -t pro-dev-factory plugins/pro-ai-sdlc/factory
# Same approach as tests/docker/Dockerfile (node 22, git, python3, claude-code) plus the gh CLI.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git python3 ca-certificates curl ripgrep \
    && mkdir -p -m 755 /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && apt-get clean
RUN npm install -g @anthropic-ai/claude-code
RUN useradd -m factory && mkdir -p /opt/factory /work && chown factory /work
COPY session.sh /opt/factory/session.sh
RUN chmod 755 /opt/factory/session.sh
USER factory
WORKDIR /work
ENTRYPOINT []
