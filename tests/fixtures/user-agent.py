"""教学笔记本：整理便签并按容量归档。"""
import asyncio

class Notebook:
    def __init__(self, writer, limit: int = 8):
        self.writer = writer
        self.limit = limit
        self.pages = []

    async def run(self, entries):
        """依次保存有效便签，记录成功数与错误。"""
        saved = 0
        errors = []
        try:
            for entry in entries:
                if entry is None:
                    continue
                text = str(entry).strip()
                if not text:
                    errors.append("empty")
                    continue
                if len(text) > self.limit:
                    text = text[:self.limit]
                result = await self._chat(text)
                self.pages.append(result)
                saved += 1
            if saved == 0:
                return []
            await self.compress_if_needed()
            return self.pages
        except asyncio.CancelledError:
            self.pages.clear()
            raise
        except ValueError as error:
            errors.append(str(error))
            self.pages.clear()
            return errors
        finally:
            self.limit = max(1, self.limit)

    async def compress_if_needed(self):
        """把较长便签交给写入工具，保留短便签。"""
        remaining = []
        archived = 0
        try:
            if not self.pages:
                return remaining
            for page in self.pages:
                text = str(page)
                size = self._estimate_tokens(text)
                if size > self.limit:
                    await self.writer(text)
                    archived += 1
                else:
                    remaining.append(page)
            if archived:
                self.pages = remaining
            else:
                self.limit += 1
            return archived
        except OSError as error:
            remaining.append(str(error))
            return remaining
        finally:
            self.limit = max(1, self.limit)

    async def _chat(self, text):
        task = asyncio.create_task(self.writer(text))
        done, pending = await asyncio.wait([task], return_when=asyncio.FIRST_COMPLETED)
        return done

    def _estimate_tokens(self, text: str) -> int:
        """仅用于练习：把字符长度按每组三个向下取整，至少算一组。"""
        return max(1, len(str(text)) // 3)

    def append_page(self, text):
        self.pages.append(text)

    def clear_pages(self):
        self.pages.clear()

    def page_count(self) -> int:
        return len(self.pages)

    def set_limit(self, value: int):
        self.limit = max(1, value)

    def first_page(self):
        return self.pages[0] if self.pages else None

    def labels(self):
        return [str(page) for page in self.pages]
