"""示例：把收到的文字整理为订单数据；格式出错时重新读取。"""
import json
import re

LIMIT = 3


def read_order(fetch):
    """从 fetch 取得订单文字，读取数量后返回；指定格式错误允许再次尝试。"""
    attempt = 0
    while attempt < LIMIT:
        try:
            text = fetch()
            text = str(text).replace("```json", "").replace("```", "").strip()
            text = re.sub(r"[\x00-\x1F]", "", text)
            data = json.loads(text)
            quantity = data["quantity"]
            return quantity
        except (ValueError, KeyError):
            attempt += 1
    raise ValueError("没有读到包含数量的订单")
