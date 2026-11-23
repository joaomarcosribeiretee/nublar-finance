"""Pixel diff between two screenshots, for PR evidence.

    python -I pixel-diff.py antes.png depois.png [diff.png]

Prints how many pixels differ and where. With a third path, saves an image
that highlights the changed pixels in magenta over a faded "depois".
"""
import sys

from PIL import Image, ImageChops


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    before = Image.open(sys.argv[1]).convert("RGB")
    after = Image.open(sys.argv[2]).convert("RGB")
    if before.size != after.size:
        print(f"tamanhos diferentes: {before.size} x {after.size}")
        return 2

    diff = ImageChops.difference(before, after)
    mask = diff.convert("L").point(lambda v: 255 if v else 0)
    changed = mask.histogram()[255]
    total = before.size[0] * before.size[1]
    print(f"pixels diferentes: {changed} de {total} ({changed / total:.4%}) area: {diff.getbbox()}")

    if len(sys.argv) > 3:
        faded = Image.blend(after, Image.new("RGB", after.size, "white"), 0.6)
        faded.paste(Image.new("RGB", after.size, (255, 0, 255)), mask=mask)
        faded.save(sys.argv[3])
        print("imagem do diff:", sys.argv[3])
    return 0


if __name__ == "__main__":
    sys.exit(main())
