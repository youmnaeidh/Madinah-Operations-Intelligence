"""Inspect saved PBIX geometry/resources; this is not a substitute for Desktop."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def inspect(original, corrected):
    with zipfile.ZipFile(original) as old, zipfile.ZipFile(corrected) as new:
        layout = json.loads(old.read("Report/Layout").decode("utf-16-le"))
        old_pages = {p["name"]: p for p in layout["sections"]}
        order = json.loads(new.read("Report/definition/pages/pages.json"))["pageOrder"]
        if set(order) != set(old_pages) or len(order) != 4:
            raise ValueError("The original four pages were not preserved")
        checked = 0
        for page_id in order:
            old_page = old_pages[page_id]
            page = json.loads(new.read(f"Report/definition/pages/{page_id}/page.json"))
            if page["displayName"] != old_page["displayName"]:
                raise ValueError("Page label changed")
            for visual in old_page["visualContainers"]:
                config = json.loads(visual["config"])
                name = config["name"]
                item = json.loads(new.read(f"Report/definition/pages/{page_id}/visuals/{name}/visual.json"))
                for key in ["x", "y", "z", "width", "height"]:
                    if abs(float(item["position"][key]) - float(visual[key])) > 1e-6:
                        raise ValueError(f"Geometry changed: {page_id}/{name}/{key}")
                old_type = config.get("singleVisual", {}).get("visualType")
                if old_type and item.get("visual", {}).get("visualType") != old_type:
                    raise ValueError("Visual type changed: " + name)
                checked += 1
        new_visuals = [n for n in new.namelist() if n.startswith("Report/definition/pages/") and n.endswith("/visual.json")]
        if checked != 119 or len(new_visuals) != checked:
            raise ValueError("Visual-container count changed")
        protected = {}
        normalized_json_resources = []
        changed_information_overlays = []
        for name in old.namelist():
            if not name.startswith("Report/StaticResources/") or name.endswith("/"):
                continue
            if "project-info-content" in name:
                changed_information_overlays.append(name)
                continue
            if old.read(name) != new.read(name):
                if name.endswith(".json") and json.loads(old.read(name)) == json.loads(new.read(name)):
                    normalized_json_resources.append(name)
                else:
                    raise ValueError("Protected visual resource changed: " + name)
            protected[name] = hashlib.sha256(new.read(name)).hexdigest()
        return {"pages": len(order), "visual_containers": checked, "geometry_and_visual_types_preserved": True,
                "protected_resource_sha256": protected, "information_overlay_updated": changed_information_overlays,
                "json_reserialized_without_semantic_changes": normalized_json_resources,
                "original_pbix_sha256": hashlib.sha256(Path(original).read_bytes()).hexdigest(),
                "corrected_pbix_sha256": hashlib.sha256(Path(corrected).read_bytes()).hexdigest(),
                "scope": "Saved archive, visual geometry and protected resource bytes; engine verification is separately recorded in desktop-validation.json"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original", type=Path, default=ROOT / "dashboard/Madinah Operations Intelligence.pbix")
    parser.add_argument("--corrected", type=Path, default=ROOT / "dashboard/MOI-Corrected-2026-11-02.pbix")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    text = json.dumps(inspect(args.original, args.corrected), indent=2) + "\n"
    if args.output:
        args.output.write_text(text, encoding="utf-8", newline="\n")
    else:
        print(text, end="")
