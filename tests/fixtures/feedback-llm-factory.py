"""教学示例：按四种配色准备图块。"""
from demo_tiles import Tile
from demo_theme import palette

class PaletteFactory:
    task_id: str

    def __init__(self, task_id: str) -> None:
        self.task_id = task_id

    def make_all(self) -> tuple[Tile, Tile, Tile, Tile]:
        """把四组配色交给外部图块工具，再把结果一起交回。"""
        warm = Tile(
            shade=palette.RED,
            caption="warm",
            width=12,
            height=8,
            task_id=self.task_id,
            depth=1,
        )
        cool = Tile(
            shade=palette.BLUE,
            caption="cool",
            width=10,
            height=6,
            task_id=self.task_id,
            depth=2,
        )
        bright = Tile(
            shade=palette.YELLOW,
            caption="bright",
            width=9,
            height=9,
            task_id=self.task_id,
            depth=3,
        )
        dark = Tile(
            shade=palette.BLACK,
            caption="dark",
            width=7,
            height=5,
            task_id=self.task_id,
            depth=4,
        )
        return warm, cool, bright, dark
