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
FIREBASE_VERSION = "10.13.2"
FIREBASE_FILES = ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js"]
FIREBASE_BASE_URL = "https://www.gstatic.com/firebasejs/" + FIREBASE_VERSION + "/"


def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def get_version():
    return read(os.path.join(ROOT, "VERSION")).strip()


def get_firebase_config():
    path = os.path.join(ROOT, "firebase-config.json")
    if not os.path.exists(path):
        return {"enabled": False}
    return json.loads(read(path))


def download_vendor_file(url, dest_path, cache_path, label):
    """CDN에서 받아 dest_path에 쓰고 cache_path에도 백업. 실패 시 캐시로 대체."""
    try:
        print(label, "다운로드 중...", url)
        req = urllib.request.Request(url, headers={"User-Agent": "build.py"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        with open(dest_path, "wb") as f:
            f.write(data)
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        shutil.copy2(dest_path, cache_path)
        print(label, "다운로드 완료:", len(data), "bytes")
    except Exception as e:
        if os.path.exists(cache_path):
            print(label, "다운로드 실패, 캐시 사용:", e)
            shutil.copy2(cache_path, dest_path)
        else:
            print("경고:", label, "을(를) 받지 못했어요:", e, file=sys.stderr)
            write(dest_path, "/* " + label + " download failed at build time */\n")


def build():
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST, exist_ok=True)

    version = get_version()
    print("버전:", version)
    firebase_config = get_firebase_config()

    css = read(os.path.join(SRC, "style.css"))
    app_js = read(os.path.join(SRC, "app.js"))
    dmc = read(os.path.join(DATA, "dmc.txt")).strip()
    html = read(os.path.join(SRC, "index.html"))

    html = html.replace("/*__CSS__*/", css)
    html = html.replace("/*__APP__*/", app_js)
    html = html.replace("__DMC__", dmc)
    html = html.replace("__VERSION__", version)
    html = html.replace("__FIREBASE_CONFIG__", json.dumps(firebase_config, ensure_ascii=False))

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

    # 벤더 라이브러리 다운로드 (오프라인 캐시용): jsPDF + Firebase(compat)
    vendor_dir = os.path.join(DIST, "vendor")
    os.makedirs(vendor_dir, exist_ok=True)
    cache_dir = os.path.join(ROOT, ".build-cache")

    download_vendor_file(
        JSPDF_URL,
        os.path.join(vendor_dir, "jspdf.umd.min.js"),
        os.path.join(cache_dir, "jspdf.umd.min.js"),
        "jsPDF",
    )
    for fname in FIREBASE_FILES:
        download_vendor_file(
            FIREBASE_BASE_URL + fname,
            os.path.join(vendor_dir, fname),
            os.path.join(cache_dir, fname),
            fname,
        )

    # version.json
    write(
        os.path.join(DIST, "version.json"),
        json.dumps({"version": version, "built": int(time.time() * 1000)}, ensure_ascii=False),
    )

    print("빌드 완료 ->", DIST)


if __name__ == "__main__":
    build()
