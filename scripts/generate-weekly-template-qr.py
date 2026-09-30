"""Rebuild fixed public QR graphics without copying original PDF image pixels."""
import hashlib
import json
from pathlib import Path

from reportlab.graphics.barcode.qrencoder import QRCode, QRErrorCorrectLevel

directory = Path(__file__).resolve().parent.parent / "public/assets/weekly/v1"
manifest = json.loads((directory / "manifest.json").read_text())
payloads = {
    "website": "https://www.alive.org.tw/",
    "youtube": "https://www.youtube.com/c/%E5%93%88%E5%88%A9%E8%B7%AF%E4%BA%9E%E5%AE%B6%E6%95%99%E6%9C%83",
    "stream": "https://www.youtube.com/@GKPMusic777",
}
for role, payload in payloads.items():
    qr = QRCode(None, QRErrorCorrectLevel.H)
    qr.addData(payload)
    qr.make()
    runs = []
    for y, row in enumerate(qr.modules):
        x = 0
        while x < len(row):
            if not row[x]:
                x += 1
                continue
            start = x
            while x < len(row) and row[x]:
                x += 1
            width = x - start
            runs.append(f"M{start + 4},{y + 4}h{width}v1h-{width}z")
    side = len(qr.modules) + 8
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side} {side}"><rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="' + ''.join(runs) + '"/></svg>\n').encode()
    checksum = hashlib.sha256(svg).hexdigest()
    name = f"qr-{role}-{checksum}.svg"
    path = directory / name
    if path.exists() and path.read_bytes() != svg:
        raise ValueError("immutable_asset_collision")
    path.write_bytes(svg)
    entry = {"url": f"/assets/weekly/v1/{name}", "sha256": checksum, "mime": "image/svg+xml", "sizeBytes": len(svg), "kind": "decoration", "sourceUrl": payload}
    if entry not in manifest["assets"]:
        manifest["assets"].append(entry)
(directory / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
