# Linux image for `node tests/run-evals.mjs --docker`: the plugin eval sandbox cannot run
# git on macOS, so cases tagged needs:git run here. Bubblewrap needs `docker run --privileged`.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git bubblewrap socat ripgrep python3 ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code
RUN useradd -m evals && mkdir -p /home/evals/t && chown evals /home/evals/t
USER evals
# The sandbox mounts /tmp read-only, so eval temp dirs live under the home folder.
ENV TMPDIR=/home/evals/t
WORKDIR /repo
