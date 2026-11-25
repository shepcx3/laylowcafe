# Makes the merch page's photos from cut-out product shots.
#
#   python3 tools/merch-photos.py CUT_DIR assets/img/merch
#
# CUT_DIR holds each photo with its background already removed (transparent PNG), named as in ITEMS
# below. rembg does this well (pip install "rembg[cpu]"; the u2net model was best on the dark totes).
# For each item it writes NAME-front.webp and NAME-back.webp: 900x1000, item centred on a transparent
# background, framed the same way so the two sides line up when the item turns. Without a back photo,
# the back is the front mirrored with its print painted out.
# Needs: pip install numpy opencv-python-headless pillow
import sys
import numpy as np
import cv2
from PIL import Image

# name: (front photo, back photo or None, how strongly to paint out the front print)
ITEMS = {
    "hoodie": ("HOODIEV1.png", "HOODIEV2.png", 36),
    "crewneck": ("CREWNECKV1.png", None, 38),
    "tee-sage": ("SHIRTV1.png", "SHIRTV2.png", 30),
    "tee-grey": ("THSIRTV1.png", "TSHIRTV2.png", 30),
    "cap": ("CAPV1.png", None, 24),
    "script-cap": ("HATV1.png", None, 26),
    "tote-black": ("u2net-BLACKTOTEBAGV1.png", None, 45),
    "tote-cream": ("CREAMTOTEBAGV1.png", None, 30),
    "tote-green": ("u2net-GREENTOTEBAGV1.png", None, 40),
}
TRIM_SHADOW = {"script-cap"}  # the cut-out kept a strip of shadow on its right edge
W, H, PAD = 900, 1000, 40


def fit(im, trim_shadow=False):
    a = np.array(im.convert("RGBA"))
    a[..., 3][a[..., 3] < 12] = 0
    if trim_shadow:  # drop dark blobs touching the right edge of the item
        m = a[..., 3] > 200
        L = a[..., :3].mean(-1)
        dark = ((L < np.median(L[m]) * 0.8) & m).astype(np.uint8)
        dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        n, lab, st, _ = cv2.connectedComponentsWithStats(dark)
        right = Image.fromarray(a).getbbox()[2]
        for k in range(1, n):
            if st[k, 0] + st[k, 2] >= right - 3 and st[k, 4] > 400:
                a[..., 3][lab == k] = 0
        a[..., 3] = cv2.erode(a[..., 3], np.ones((3, 3), np.uint8))
    im = Image.fromarray(a)
    im = im.crop(im.getbbox())
    s = min((W - 2 * PAD) / im.width, (H - 2 * PAD) / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.alpha_composite(im, ((W - im.width) // 2, (H - im.height) // 2))
    return np.array(out)


def paint_out_print(front, thr):
    """The front with its print painted out (same outline, not mirrored)."""
    rgb = front[..., :3].copy()
    m = front[..., 3] > 200
    rgb[~m] = np.median(rgb[m], axis=0).astype(np.uint8)
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    d = np.sqrt((((lab - np.median(lab[m], axis=0)) * np.array([0.5, 1, 1])) ** 2).sum(-1))
    mask = cv2.dilate(((d > thr) & m).astype(np.uint8) * 255, np.ones((21, 21), np.uint8))
    bgr = cv2.inpaint(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), mask, 12, cv2.INPAINT_TELEA)
    return (cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB) * 0.9).astype(np.uint8)  # a touch darker: it's the back


def save(a, path):
    Image.fromarray(a).save(path, quality=92, method=6)


def main(cut_dir, out_dir):
    for slug, (front_name, back_name, thr) in ITEMS.items():
        front = fit(Image.open(f"{cut_dir}/{front_name}"), slug in TRIM_SHADOW)
        if back_name:
            back = fit(Image.open(f"{cut_dir}/{back_name}"))
        else:  # mirrored, because the back is seen from behind
            back = np.dstack([paint_out_print(front, thr)[:, ::-1], front[..., 3][:, ::-1]])
        save(front, f"{out_dir}/{slug}-front.webp")
        save(back, f"{out_dir}/{slug}-back.webp")
        print(slug)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
