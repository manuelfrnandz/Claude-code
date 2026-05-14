import random
import string
from datetime import datetime


def generate_order_number() -> str:
    """Generate a short human-readable order number like ORD-240514-A3F."""
    date_part = datetime.utcnow().strftime("%y%m%d")
    random_part = "".join(random.choices(string.ascii_uppercase + string.digits, k=3))
    return f"ORD-{date_part}-{random_part}"
