# 自编构建语法练习，不在测试中构建镜像
FROM python:3.12-slim AS lesson
WORKDIR /lesson
COPY --from=ghcr.io/astral-sh/uv:0.8.0 /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
# 检查缓存参数、续行和跳过项目安装三个不同概念
RUN --mount=type=cache,target=/tmp/lesson-cache \
    uv sync --locked --no-install-project
COPY lesson.py ./
RUN uv sync --locked
ENV LESSON_MODE=example
EXPOSE 8000
# 教学注释声称使用系统 Python；解析器不能据此确认环境
CMD ["python", "lesson.py"]
