# Self-authored acceptance input. Read statically; do not execute.
from collections import defaultdict
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


def parse_row(row):
    sku = str(row.get("sku", "")).strip()
    if not sku:
        raise ValueError("missing sku")
    quantity = int(row["quantity"])
    price = Decimal(str(row["unit_price"]))
    if quantity <= 0 or not price.is_finite() or price < 0:
        raise ValueError("invalid quantity or price")
    return sku, quantity, price


def allocate(stock, rows):
    remaining = dict(stock)
    accepted = []
    rejected = []
    totals = defaultdict(lambda: Decimal("0"))
    for index, row in enumerate(rows):
        try:
            sku, quantity, price = parse_row(row)
        except (KeyError, ValueError, TypeError, InvalidOperation) as error:
            rejected.append({"row": index, "reason": str(error)})
            continue
        available = remaining.get(sku, 0)
        if available < quantity:
            rejected.append({"row": index, "reason": "insufficient stock"})
            continue
        remaining[sku] = available - quantity
        subtotal = price * quantity
        totals[sku] += subtotal
        accepted.append({"sku": sku, "quantity": quantity, "subtotal": subtotal})
    return {
        "remaining": remaining,
        "accepted": accepted,
        "rejected": rejected,
        "totals": {sku: amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                   for sku, amount in totals.items()},
    }


def merge_reports(reports):
    counts = defaultdict(int)
    for report in reports:
        for item in report["accepted"]:
            counts[item["sku"]] += item["quantity"]
    return sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))
