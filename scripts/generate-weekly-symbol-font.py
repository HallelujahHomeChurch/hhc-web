"""Build-time only: full licensed symbol cmap, never embedded PDF font bytes."""
import hashlib
import io
import json
from pathlib import Path
import sys

from fontTools.ttLib import TTFont

source, license_path = map(Path, sys.argv[1:])
source_hash = "7d5fb73b7ca67a6798101741f5d280a3d016a56a197afcd4199dbb57b4b82a21"
license_hash = "b118dd41337806a5d4797052c77caf3bd096aed783e5eb21b4d11154351e1ac0"
if hashlib.sha256(source.read_bytes()).hexdigest() != source_hash:
    raise ValueError("source_checksum")
license_bytes = license_path.read_bytes()
if hashlib.sha256(license_bytes).hexdigest() != license_hash:
    raise ValueError("license_checksum")
license_bytes = ("\n".join(line.rstrip() for line in license_bytes.decode().splitlines()) + "\n").encode()
license_hash = hashlib.sha256(license_bytes).hexdigest()
font = TTFont(source, recalcTimestamp=False)
assert {0x2605, 0x1F7CB}.issubset(font.getBestCmap()), "missing_source_symbols"
family = "HHC Weekly Symbols"
for identifier, value in {
    1: family, 16: family, 2: "Regular", 17: "Regular",
    3: family + "-Regular", 4: family + " Regular",
    6: "HHCWeeklySymbols-Regular",
}.items():
    font["name"].removeNames(nameID=identifier)
    font["name"].setName(value, identifier, 3, 1, 0x409)
font.flavor = "woff2"
output = io.BytesIO()
font.save(output)
data = output.getvalue()
checksum = hashlib.sha256(data).hexdigest()
directory = Path(__file__).resolve().parent.parent / "public/assets/weekly/v1"
font_url = f"/assets/weekly/v1/symbol-{checksum}.woff2"
license_url = f"/assets/weekly/v1/symbol-license-{license_hash}.txt"
source_url = "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/notosanssymbols2/NotoSansSymbols2-Regular.ttf"
entries = [
    {"url": font_url, "sha256": checksum, "mime": "font/woff2", "sizeBytes": len(data),
     "kind": "font", "family": family, "weight": 400, "roles": ["symbol"],
     "licenseUrl": license_url, "sourceUrl": source_url, "sourceSha256": source_hash},
    {"url": license_url, "sha256": license_hash, "mime": "text/plain",
     "sizeBytes": len(license_bytes), "kind": "license"},
]
manifest_path = directory / "manifest.json"
manifest = json.loads(manifest_path.read_text())
for entry, contents in zip(entries, [data, license_bytes]):
    target = directory / Path(entry["url"]).name
    if target.exists() and target.read_bytes() != contents:
        raise ValueError("immutable_asset_changed")
    target.write_bytes(contents)
    previous = next((item for item in manifest["assets"] if item["url"] == entry["url"]), None)
    if previous is not None and previous != entry:
        raise ValueError("immutable_provenance_changed")
    if previous is None:
        manifest["assets"].append(entry)
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"sha256": checksum, "sizeBytes": len(data), "cmapEntries": len(font.getBestCmap())}))
