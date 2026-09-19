#!/usr/bin/env python3
"""src/ + data/ + public/ -> dist/ (단일 index.html + PWA 파일 + version.json)

사용법: python3 build.py
"""
import json
import os
import shutil
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
DATA = os.path.join(ROOT, "data")
PUBLIC = os.path.join(ROOT, "public")
DIST = os.path.join(ROOT, "dist")

JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"


def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def get_version():
    return read(os.path.join(ROOT, "VERSION")).strip()


def build():
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST, exist_ok=True)

    version = get_version()
    print("버전:", version)

    css = read(os.path.join(SRC, "style.css"))
    app_js = read(os.path.join(SRC, "app.js"))
    dmc = read(os.path.join(DATA, "dmc.txt")).strip()
    html = read(os.path.join(SRC, "index.html"))

    html = html.replace("/*__CSS__*/", css)
    html = html.replace("/*__APP__*/", app_js)
    html = html.replace("__DMC__", dmc)
    html = html.replace("__VERSION__", version)

    write(os.path.join(DIST, "index.html"), html)

    # public/* 복사 (sw.js 는 버전 치환)
    for name in os.listdir(PUBLIC):
        src_path = os.path.join(PUBLIC, name)
        dst_path = os.path.join(DIST, name)
        if os.path.isdir(src_path):
            shutil.copytree(src_path, dst_path)
        elif name == "sw.js":
            sw = read(src_path).replace("__VERSION__", version)
            write(dst_path, sw)
        else:
            shutil.copy2(src_path, dst_path)

    # jsPDF 벤더 다운로드 (오프라인 캐시용)
    vendor_dir = os.path.join(DIST, "vendor")
    os.makedirs(vendor_dir, exist_ok=True)
    vendor_path = os.path.join(vendor_dir, "jspdf.umd.min.js")
    cached_vendor = os.path.join(ROOT, ".build-cache", "jspdf.umd.min.js")
    try:
        print("jsPDF 다운로드 중...", JSPDF_URL)
        req = urllib.request.Request(JSPDF_URL, headers={"User-Agent": "build.py"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        with open(vendor_path, "wb") as f:
            f.write(data)
        os.makedirs(os.path.dirname(cached_vendor), exist_ok=True)
        shutil.copy2(vendor_path, cached_vendor)
        print("jsPDF 다운로드 완료:", len(data), "bytes")
    except Exception as e:
        if os.path.exists(cached_vendor):
            print("jsPDF 다운로드 실패, 캐시 사용:", e)
            shutil.copy2(cached_vendor, vendor_path)
        else:
            print("경고: jsPDF를 받지 못했어요 (PDF 내보내기가 동작하지 않을 수 있어요):", e, file=sys.stderr)
            write(vendor_path, "/* jspdf download failed at build time */\n")

    # version.json
    write(
        os.path.join(DIST, "version.json"),
        json.dumps({"version": version, "built": int(time.time() * 1000)}, ensure_ascii=False),
    )

    print("빌드 완료 ->", DIST)


if __name__ == "__main__":
    build()
