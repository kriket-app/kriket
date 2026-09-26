"""Wrap an artifact-style page (title + style + content, no html/head/body) into a full document.
Usage: python3 wrap-page.py <source.html> <output.html>"""
import pathlib, re, sys

src = pathlib.Path(sys.argv[1]).read_text()
title = re.search(r'<title>(.*?)</title>', src).group(1)
body = re.sub(r'^\s*<title>.*?</title>\n', '', src, count=1)
doc = (
    '<!doctype html>\n<html lang="en">\n<head>\n'
    '<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    '<meta name="robots" content="noindex">\n'
    f'<title>{title}</title>\n'
    '<style>:root{color-scheme:light dark}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>\n'
    '</head>\n<body>\n' + body + '\n</body>\n</html>\n'
)
out = pathlib.Path(sys.argv[2])
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(doc)
print(out, len(doc), 'bytes')
