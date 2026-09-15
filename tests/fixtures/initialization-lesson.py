from tools import Base, Model
import asyncio

DEFAULT_PROMPT = "请先列出步骤"

class Helper(Base):
    def __init__(
        self,
        task_id: str,
        model: Model,
        context_window: int = 128000,
        cancel_event: asyncio.Event | None = None,
    ) -> None:
        super().__init__(task_id, model, context_window, cancel_event=cancel_event)
        self.system_prompt = DEFAULT_PROMPT
