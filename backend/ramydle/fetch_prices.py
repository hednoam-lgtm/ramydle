"""Download Rami Levy's daily PriceFull file from the public price-transparency portal.

Access route mandated by Israel's 2014 Food Act; credentials are published by
Rami Levy at https://www.rami-levy.co.il/he/price-transparency
"""

import argparse
import gzip
import json
import re
import shutil
import sys
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

BASE = "https://url.publishedprices.co.il"
USERNAME = "RamiLevi"
DEFAULT_STORE = "001"
DATA_RAW = Path(__file__).resolve().parent.parent / "data" / "raw"


def _csrf(html: str) -> str:
    tag = BeautifulSoup(html, "html.parser").find("meta", {"name": "csrftoken"})
    return tag["content"] if tag and tag.get("content") else ""


def login() -> tuple[httpx.Client, str]:
    client = httpx.Client(base_url=BASE, timeout=90.0, follow_redirects=True)
    page = client.get("/login")
    page.raise_for_status()
    resp = client.post(
        "/login/user",
        data={"username": USERNAME, "password": "", "csrftoken": _csrf(page.text)},
    )
    resp.raise_for_status()
    if "cftpSID" not in client.cookies:
        raise RuntimeError("login rejected by portal: no session cookie")
    return client, _csrf(resp.text)


def list_files(client: httpx.Client, token: str) -> list[dict]:
    resp = client.post(
        "/file/json/dir",
        data={"iDisplayLength": "100000", "sSearch": "", "csrftoken": token},
    )
    resp.raise_for_status()
    return resp.json().get("aaData", [])


def _filename(entry: dict) -> str:
    raw = entry.get("fname") or entry.get("name") or ""
    # some rows carry an <a> wrapper rather than a bare name
    return BeautifulSoup(str(raw), "html.parser").get_text().strip() or str(raw).strip()


STAMP = re.compile(r"-(\d{8})-(\d{6})\.gz$")


def pick_pricefull(files: list[dict], store: str) -> str:
    names = [_filename(f) for f in files]
    candidates = [
        n
        for n in names
        if n.lower().startswith("pricefull") and re.search(rf"-0*{int(store):03d}-\d{{8}}-", n)
    ]
    if not candidates:
        raise RuntimeError(f"no PriceFull file for store {store} among {len(names)} entries")
    # filenames end in -YYYYMMDD-HHMMSS.gz; newest stamp wins
    return max(candidates, key=lambda n: (m.groups() if (m := STAMP.search(n)) else ("", "")))


def download(client: httpx.Client, name: str) -> Path:
    DATA_RAW.mkdir(parents=True, exist_ok=True)
    xml_path = DATA_RAW / (name.replace(".gz", "") if name.endswith(".gz") else name)
    if xml_path.suffix != ".xml":
        xml_path = xml_path.with_suffix(".xml")
    if xml_path.exists():
        print(f"already have {xml_path.name}")
        return xml_path

    gz_path = DATA_RAW / name
    with client.stream("GET", f"/file/d/{name}") as resp:
        resp.raise_for_status()
        with open(gz_path, "wb") as fh:
            for chunk in resp.iter_bytes():
                fh.write(chunk)

    with gzip.open(gz_path, "rb") as src, open(xml_path, "wb") as dst:
        shutil.copyfileobj(src, dst)
    gz_path.unlink()
    print(f"downloaded {xml_path.name} ({xml_path.stat().st_size:,} bytes)")
    return xml_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=DEFAULT_STORE, help="store id to pin prices to")
    parser.add_argument("--list", action="store_true", help="list portal files and exit")
    parser.add_argument("--stores", action="store_true", help="download the Stores file and exit")
    args = parser.parse_args()

    client, token = login()
    files = list_files(client, token)

    if args.list:
        names = sorted(_filename(f) for f in files)
        print(f"{len(names)} files")
        print(json.dumps(names[:40], ensure_ascii=False, indent=2))
        return 0

    if args.stores:
        stores = [n for f in files if (n := _filename(f)).lower().startswith("stores")]
        download(client, max(stores))
        return 0

    download(client, pick_pricefull(files, args.store))
    return 0


if __name__ == "__main__":
    sys.exit(main())
