"""ROOTS Instagram スライド画像生成スクリプト"""
from PIL import Image, ImageDraw, ImageFont
import os

FONTS_DIR = 'brand/assets/fonts'
OUT_DIR_00 = 'marketing/sns/posts/post-00-intro'
OUT_DIR_01 = 'marketing/sns/posts/post-01-hokkaido'
os.makedirs(OUT_DIR_00, exist_ok=True)
os.makedirs(OUT_DIR_01, exist_ok=True)

W, H = 1080, 1350

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

BG = hex_to_rgb('#090909')
TEXT = hex_to_rgb('#e0e0e0')
ORANGE = hex_to_rgb('#F0A032')
BLUE = hex_to_rgb('#50A0F0')

shippori_64 = ImageFont.truetype(f'{FONTS_DIR}/ShipporiMincho-Regular.ttf', 64)
shippori_56 = ImageFont.truetype(f'{FONTS_DIR}/ShipporiMincho-Regular.ttf', 56)
shippori_52 = ImageFont.truetype(f'{FONTS_DIR}/ShipporiMincho-Regular.ttf', 52)
shippori_36 = ImageFont.truetype(f'{FONTS_DIR}/ShipporiMincho-Regular.ttf', 36)
shippori_32 = ImageFont.truetype(f'{FONTS_DIR}/ShipporiMincho-Regular.ttf', 32)
bebas_112 = ImageFont.truetype(f'{FONTS_DIR}/BebasNeue-Regular.ttf', 112)
bebas_64 = ImageFont.truetype(f'{FONTS_DIR}/BebasNeue-Regular.ttf', 64)
space_28 = ImageFont.truetype(f'{FONTS_DIR}/SpaceMono-Regular.ttf', 28)


def measure(draw, text, font):
    """テキストの実際のピクセルサイズとオフセットを返す"""
    bbox = draw.textbbox((0, 0), text, font=font)
    return {
        'w': bbox[2] - bbox[0],
        'h': bbox[3] - bbox[1],
        'y_off': bbox[1],  # ベースラインオフセット
        'x_off': bbox[0],
    }


def draw_centered_block_with_lines(draw, lines, font, line_gap, text_color, line_color, line_margin=35):
    """テキストブロックを中央配置 + 上下に等距離の装飾線"""
    meas = [measure(draw, t, font) for t in lines]
    total_h = sum(m['h'] for m in meas) + line_gap * (len(lines) - 1)
    max_w = max(m['w'] for m in meas)

    # ブロック上端（実際のピクセル上端）
    block_top = (H - total_h) // 2
    y = block_top

    for i, (text, m) in enumerate(zip(lines, meas)):
        x = (W - m['w']) // 2 - m['x_off']
        draw.text((x, y - m['y_off']), text, font=font, fill=text_color)
        y += m['h'] + (line_gap if i < len(lines) - 1 else 0)

    block_bottom = block_top + total_h

    # 装飾線: テキストブロック上端/下端から等距離
    line_w = max_w + 100
    line_x = (W - line_w) // 2
    draw.rectangle([line_x, block_top - line_margin,
                     line_x + line_w, block_top - line_margin + 1], fill=line_color)
    draw.rectangle([line_x, block_bottom + line_margin - 1,
                     line_x + line_w, block_bottom + line_margin], fill=line_color)

    print(f'  block: {block_top}..{block_bottom} ({total_h}px)')
    print(f'  lines: top_y={block_top - line_margin}, bottom_y={block_bottom + line_margin}')
    print(f'  margin: {line_margin}px equal on both sides')


def draw_centered_block(draw, lines, font, line_gap, text_color):
    """装飾線なしのテキストブロック中央配置"""
    meas = [measure(draw, t, font) for t in lines]
    total_h = sum(m['h'] for m in meas) + line_gap * (len(lines) - 1)
    y = (H - total_h) // 2

    for i, (text, m) in enumerate(zip(lines, meas)):
        x = (W - m['w']) // 2 - m['x_off']
        draw.text((x, y - m['y_off']), text, font=font, fill=text_color)
        y += m['h'] + (line_gap if i < len(lines) - 1 else 0)


def draw_elements_centered(draw, elements):
    """複数要素（テキスト+フォント+色+gap）を垂直中央に配置"""
    meas = [measure(draw, text, font) for text, font, color, gap in elements]
    total_h = sum(m['h'] for m in meas) + sum(gap for _, _, _, gap in elements[:-1])
    y = (H - total_h) // 2

    for i, ((text, font, color, gap), m) in enumerate(zip(elements, meas)):
        x = (W - m['w']) // 2 - m['x_off']
        draw.text((x, y - m['y_off']), text, font=font, fill=color)
        y += m['h'] + (gap if i < len(elements) - 1 else 0)


# ============================================================
# 投稿 #0: アカウント紹介
# ============================================================
print('=== Post #0 ===')

# S1
print('S1:')
img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)
draw_centered_block_with_lines(
    d, ['あなたの県を', '一杯で表すなら。'],
    shippori_64, 40, TEXT, BLUE, line_margin=35
)
img.save(f'{OUT_DIR_00}/slide-01-hook.png')

# S2
print('S2')
img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)
draw_centered_block(d, ['その設計図を', '描いていきます。'], shippori_56, 36, TEXT)
img.save(f'{OUT_DIR_00}/slide-02-educate.png')

# S3
print('S3')
img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)
draw_centered_block(d, ['47の味が、', 'ビールを待っている。'], shippori_56, 36, TEXT)
img.save(f'{OUT_DIR_00}/slide-03-imagine.png')

# S4
print('S4')
img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)
draw_elements_centered(d, [
    ('親愛なる故郷へ', shippori_52, TEXT, 50),
    ('ROOTS', bebas_112, ORANGE, 0),
])
img.save(f'{OUT_DIR_00}/slide-04-brand.png')

# ============================================================
# 投稿 #1: 北海道×メロン
# ============================================================
print('\n=== Post #1 ===')

# S1
print('S1')
img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)
draw_centered_block(
    d, ['富良野の夏。', '甘い香りが風に乗る。'],
    shippori_64, 40, TEXT
)
sub = 'FLAVOR BLUEPRINT vol.01'
m = measure(d, sub, space_28)
d.text(((W - m['w']) // 2, H - 150), sub, font=space_28, fill=BLUE)
img.save(f'{OUT_DIR_01}/slide-01-hook-text.png')

# S2
print('S2')
img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)
d.rectangle([80, 250, 82, 1100], fill=BLUE)

heading = '北海道のメロンがビールに入ると'
m = measure(d, heading, shippori_56)
d.text((140, 320 - m['y_off']), heading, font=shippori_56, fill=TEXT)

items = [
    ('AROMA', '芳醇な甘い香りが広がる'),
    ('BITTER', '苦味はほぼ影響しない'),
    ('SOUR', 'ほのかな酸味が加わる'),
    ('SWEET', '果実の甘みが余韻に残る'),
]
y = 500
for label, desc in items:
    ml = measure(d, label, space_28)
    d.text((140, y - ml['y_off']), label, font=space_28, fill=ORANGE)
    md = measure(d, desc, shippori_36)
    d.text((140, y + ml['h'] + 12 - md['y_off']), desc, font=shippori_36, fill=TEXT)
    y += ml['h'] + 12 + md['h'] + 50
img.save(f'{OUT_DIR_01}/slide-02-educate.png')

# S3
print('S3')
img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)
draw_elements_centered(d, [
    ('相性の良いビアスタイル', shippori_32, TEXT, 30),
    ('WEIZEN', bebas_64, ORANGE, 40),
    ('柔らかいボディと出会えば、', shippori_36, TEXT, 18),
    ('北海道の風土ごと飲む一杯に。', shippori_36, TEXT, 0),
])
img.save(f'{OUT_DIR_01}/slide-03-imagine-text.png')

# S4
print('S4')
img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)
draw_elements_centered(d, [
    ('メロンの一杯、', shippori_52, TEXT, 30),
    ('飲んでみたいですか。', shippori_52, TEXT, 60),
    ('ROOTS', bebas_112, ORANGE, 0),
])
m = measure(d, '@roots_brewing', space_28)
d.text((W - 80 - m['w'], H - 100), '@roots_brewing', font=space_28, fill=TEXT)
img.save(f'{OUT_DIR_01}/slide-04-brand.png')

print('\n=== ALL DONE ===')
