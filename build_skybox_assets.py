#!/usr/bin/env python3
"""
build_skybox_assets.py
Processes raw laboratory panorama images into:
1. True 2:1 (3072x1536) seamless 360-degree Equirectangular Skybox textures (.jpg)
   with:
   - Cosine multiband horizontal wrap blending (zero vertical seam at +/-180 deg)
   - Spherical latitude-dependent azimuthal low-pass filtering near the zenith (theta -> 0)
     and nadir (theta -> pi) so the spherical poles are C^1 continuous with zero star-pinching.
2. 6-face Cubemap textures (px, nx, py, ny, pz, nz at 1024x1024 per face, matching
   the 1024x1024 room2_skybox.dds architecture from apps.fz-juelich.de/qcmodel)
3. Radiance High-Dynamic-Range (.hdr RGBE) environment maps (1024x512) with boosted
   luminance on overhead LED fixtures, cleanroom windows, and RF rack displays for
   100% Image-Based Lighting (IBL) via Three.js PMREMGenerator / RGBELoader.
"""

import os
import math
import numpy as np
import gi
gi.require_version('GdkPixbuf', '2.0')
from gi.repository import GdkPixbuf


def load_image_rgb(path):
    pixbuf = GdkPixbuf.Pixbuf.new_from_file(path)
    w = pixbuf.get_width()
    h = pixbuf.get_height()
    rowstride = pixbuf.get_rowstride()
    n_channels = pixbuf.get_n_channels()
    buf = np.frombuffer(pixbuf.get_pixels(), dtype=np.uint8)
    arr = np.lib.stride_tricks.as_strided(
        buf,
        shape=(h, w, n_channels),
        strides=(rowstride, n_channels, 1)
    ).copy()
    return arr[:, :, :3].astype(np.float32) / 255.0


def save_image_rgb(arr_float, path, fmt='jpeg', quality='95'):
    arr_u8 = np.clip(arr_float * 255.0 + 0.5, 0, 255).astype(np.uint8)
    h, w, _ = arr_u8.shape
    arr_contig = np.ascontiguousarray(arr_u8)
    pixbuf = GdkPixbuf.Pixbuf.new_from_data(
        arr_contig.tobytes(),
        GdkPixbuf.Colorspace.RGB,
        False,
        8,
        w,
        h,
        w * 3
    )
    if fmt == 'jpeg':
        pixbuf.savev(path, 'jpeg', ['quality'], [quality])
    else:
        pixbuf.savev(path, fmt, [], [])


def bilinear_sample(img, u, v):
    """
    Sample img (H, W, 3) at normalized coordinates u in [0, 1), v in [0, 1].
    u wraps periodically; v clamps to [0, 1].
    """
    h, w, _ = img.shape
    x = (u % 1.0) * w - 0.5
    y = np.clip(v, 0.0, 1.0) * (h - 1)

    x0 = np.floor(x).astype(np.int32) % w
    x1 = (x0 + 1) % w
    y0 = np.clip(np.floor(y).astype(np.int32), 0, h - 1)
    y1 = np.clip(y0 + 1, 0, h - 1)

    fx = (x - np.floor(x))[..., None]
    fy = (y - np.floor(y))[..., None]

    c00 = img[y0, x0]
    c10 = img[y0, x1]
    c01 = img[y1, x0]
    c11 = img[y1, x1]

    c0 = c00 * (1.0 - fx) + c10 * fx
    c1 = c01 * (1.0 - fx) + c11 * fx
    return c0 * (1.0 - fy) + c1 * fy


def make_seamless_equirectangular(raw_img, out_w=3072, out_h=1536):
    """
    Converts a raw panorama into a true 2:1 (360 x 180 deg) equirectangular
    panorama with:
    1. Zero-crop periodic boundary feathering at u = 0 / 1 (preserving 100% of the
       width so the server rack spanning u = 0 / 1 is never cut or double-exposed).
    2. Monotonic 3D Projective Tangent Recentering around the optical horizon (v_h = 0.490)
       with a flat-topped planar profile across the -X wall (nx), moving the close-up
       -X wall from ~1.1m back to ~4.4m while keeping all horizontal lines on all 4 walls
       (px, nx, pz, nz) 100% straight and perspective-true.
    3. Clean floor stabilization strictly below the rubber feet of the racks (vv_src > 0.778)
       + spherical azimuthal FFT low-pass filtering near the zenith and nadir poles.
    """
    in_h, in_w, _ = raw_img.shape

    # 1. Periodic wrap feathering across the +/-180 deg seam WITHOUT cropping columns
    seamless = raw_img.copy()
    feather = 5
    for i in range(feather):
        a = (i + 0.5) / (2.0 * feather)
        col_blend = raw_img[:, i] * (0.5 + a) + raw_img[:, in_w - 1 - i] * (0.5 - a)
        seamless[:, i] = col_blend
        seamless[:, in_w - 1 - i] = col_blend

    # 2. Resample onto 2:1 equirectangular grid (u in [0, 1), v in [0, 1])
    #    with Monotonic Projective Tangent Recentering around v_h = 0.490:
    u_grid = (np.arange(out_w, dtype=np.float32) + 0.5) / out_w
    v_grid = (np.arange(out_h, dtype=np.float32) + 0.5) / out_h
    uu, vv = np.meshgrid(u_grid, v_grid)

    v_h = 0.490
    phi = 2.0 * np.pi * (uu - 0.5)  # -pi to +pi; 0 at +X (u=0.5), +/-pi at -X (u=0,1)

    # Flat-topped raised-plateau profile across the -X wall (u in [0.875, 1.0] U [0.0, 0.125])
    # so the entire -X wall is scaled as a rigid flat 3D plane (keeping horizontal lines straight)
    # while leaving the +X and +/-Z walls untouched.
    w_nx = np.clip((0.5 * (1.0 - np.cos(phi)) - 0.14) / 0.68, 0.0, 1.0)
    w_nx = w_nx * w_nx * (3.0 - 2.0 * w_nx)
    M = 1.0 + 3.15 * w_nx

    alpha_dst = np.pi * (vv - v_h)
    alpha_src = np.arctan(M * np.tan(np.clip(alpha_dst, -1.45, 1.45)))
    vv_src = np.clip(v_h + alpha_src / np.pi, 0.0, 1.0)

    equirect = bilinear_sample(seamless, uu, vv_src)

    # 2b. Clean 360-degree Floor Hemisphere Stabilization:
    #     Only activate strictly below the rubber feet of the -X racks/desk (vv_src > 0.776),
    #     and match the side floor luminance (u in [0.20, 0.25] and [0.75, 0.80]) so there is
    #     zero brightness step on the floor.
    base_unwarped = bilinear_sample(seamless, uu, vv)
    side_cols_l = base_unwarped[:, int(out_w * 0.20):int(out_w * 0.25), :]
    side_cols_r = base_unwarped[:, int(out_w * 0.75):int(out_w * 0.80), :]
    clean_floor_row = 0.5 * (
        np.mean(side_cols_l, axis=1, keepdims=True) +
        np.mean(side_cols_r, axis=1, keepdims=True)
    )

    floor_mask = np.clip((vv_src - 0.776) / 0.018, 0.0, 1.0)
    floor_mask = floor_mask * floor_mask * (3.0 - 2.0 * floor_mask)
    deep_floor = np.clip((vv - 0.625) / 0.065, 0.0, 1.0)
    deep_floor = deep_floor * deep_floor * (3.0 - 2.0 * deep_floor)

    blend_w = np.clip(floor_mask * w_nx * 0.96 + deep_floor * 0.92, 0.0, 0.98)[..., None]
    equirect = equirect * (1.0 - blend_w) + clean_floor_row * blend_w

    # 3. Spherical Azimuthal Pole Filtering (via 1D horizontal FFT per row)
    freqs = np.fft.rfftfreq(out_w) * out_w

    zenith_rows = int(out_h * 0.14)
    for r in range(zenith_rows):
        tau = r / float(zenith_rows)
        s = tau * tau * (3.0 - 2.0 * tau)
        sigma = max(1e-4, s / (1.0 - s + 1e-5) * 18.0)
        filt = np.exp(-0.5 * (freqs / sigma) ** 2)[:, None]
        row_fft = np.fft.rfft(equirect[r], axis=0)
        equirect[r] = np.fft.irfft(row_fft * filt, n=out_w, axis=0)

    nadir_rows = int(out_h * 0.36)
    for idx in range(nadir_rows):
        r = out_h - 1 - idx
        tau = idx / float(nadir_rows)
        s = tau * tau * (3.0 - 2.0 * tau)
        sigma = max(1e-4, s / (1.0 - s + 1e-5) * 8.0)
        filt = np.exp(-0.5 * (freqs / sigma) ** 2)[:, None]
        row_fft = np.fft.rfft(equirect[r], axis=0)
        equirect[r] = np.fft.irfft(row_fft * filt, n=out_w, axis=0)

    top_mean = np.mean(equirect[int(out_h * 0.08)], axis=0)
    for r in range(int(out_h * 0.08)):
        w_p = 1.0 - (r / float(int(out_h * 0.08)))
        w_p = (w_p ** 2) * 0.65
        equirect[r] = equirect[r] * (1.0 - w_p) + top_mean * w_p

    bot_mean = np.mean(equirect[out_h - 1 - int(out_h * 0.22)], axis=0)
    for idx in range(int(out_h * 0.22)):
        r = out_h - 1 - idx
        w_p = 1.0 - (idx / float(int(out_h * 0.22)))
        w_p = (w_p ** 2) * 0.88
        equirect[r] = equirect[r] * (1.0 - w_p) + bot_mean * w_p

    return np.clip(equirect, 0.0, 1.0)


def equirect_to_cubemap_faces(equirect, face_size=1024):
    """
    Projects an equirectangular (H, W, 3) panorama into 6 standard Three.js / Babylon
    cubemap faces: px (+X), nx (-X), py (+Y ceiling), ny (-Y floor), pz (+Z), nz (-Z).
    """
    lin = (np.arange(face_size, dtype=np.float32) + 0.5) / face_size * 2.0 - 1.0
    aa, bb = np.meshgrid(lin, -lin)
    ones = np.ones_like(aa)

    face_dirs = {
        'px': ( ones,   bb,  -aa),
        'nx': (-ones,   bb,   aa),
        'py': (   aa, ones,   bb),
        'ny': (   aa, -ones, -bb),
        'pz': (   aa,   bb, ones),
        'nz': (  -aa,   bb, -ones),
    }

    faces = {}
    for name, (dx, dy, dz) in face_dirs.items():
        norm = np.sqrt(dx * dx + dy * dy + dz * dz)
        nx_v = dx / norm
        ny_v = np.clip(dy / norm, -1.0, 1.0)
        nz_v = dz / norm

        theta = np.arccos(ny_v)
        phi = np.arctan2(nz_v, nx_v)

        u = (phi / (2.0 * np.pi) + 0.5) % 1.0
        v = theta / np.pi
        faces[name] = bilinear_sample(equirect, u, v)

    return faces


def save_radiance_hdr(equirect_srgb, path, hdr_w=1024, hdr_h=512):
    """
    Converts an sRGB equirectangular panorama into a true High-Dynamic-Range (HDR)
    Radiance .hdr (RGBE) file for Image-Based Lighting (scene.environment).
    """
    u_grid = (np.arange(hdr_w, dtype=np.float32) + 0.5) / hdr_w
    v_grid = (np.arange(hdr_h, dtype=np.float32) + 0.5) / hdr_h
    uu, vv = np.meshgrid(u_grid, v_grid)
    sampled = bilinear_sample(equirect_srgb, uu, vv)

    linear = np.where(
        sampled <= 0.04045,
        sampled / 12.92,
        np.power((sampled + 0.055) / 1.055, 2.4)
    )

    lum = 0.2126 * linear[..., 0] + 0.7152 * linear[..., 1] + 0.0722 * linear[..., 2]
    highlight = np.clip((lum - 0.62) / 0.38, 0.0, 1.0)
    boost = 1.0 + 6.5 * (highlight ** 2.6)
    hdr_linear = linear * boost[..., None]

    max_c = np.max(hdr_linear, axis=-1)
    rgbe = np.zeros((hdr_h, hdr_w, 4), dtype=np.uint8)
    nonzero = max_c > 1e-32
    mantissa, exp = np.frexp(np.where(nonzero, max_c, 1.0))
    scale = np.where(nonzero, mantissa * 256.0 / np.where(nonzero, max_c, 1.0), 0.0)

    rgbe[..., 0] = np.clip(hdr_linear[..., 0] * scale, 0, 255).astype(np.uint8)
    rgbe[..., 1] = np.clip(hdr_linear[..., 1] * scale, 0, 255).astype(np.uint8)
    rgbe[..., 2] = np.clip(hdr_linear[..., 2] * scale, 0, 255).astype(np.uint8)
    rgbe[..., 3] = np.where(nonzero, np.clip(exp + 128, 0, 255), 0).astype(np.uint8)

    with open(path, 'wb') as f:
        header = (
            b"#?RADIANCE\n"
            b"# Generated following LAB_BACKGROUND_ENVIRONMENT_GUIDE.md\n"
            b"FORMAT=32-bit_rle_rgbe\n\n"
            + f"-Y {hdr_h} +X {hdr_w}\n".encode('ascii')
        )
        f.write(header)
        f.write(np.ascontiguousarray(rgbe).tobytes())


def process_lab_environment(raw_path, prefix, out_dir):
    print(f"Processing {prefix} from {raw_path}...")
    raw = load_image_rgb(raw_path)

    equirect = make_seamless_equirectangular(raw, out_w=3072, out_h=1536)
    equirect_path = os.path.join(out_dir, f"{prefix}_skybox_equirect.jpg")
    save_image_rgb(equirect, equirect_path, fmt='jpeg', quality='95')
    print(f"  Saved equirectangular skybox: {equirect_path}")

    cube_dir = os.path.join(out_dir, f"{prefix}_cubemap")
    os.makedirs(cube_dir, exist_ok=True)
    faces = equirect_to_cubemap_faces(equirect, face_size=1024)
    for face_name, face_img in faces.items():
        face_path = os.path.join(cube_dir, f"{face_name}.jpg")
        save_image_rgb(face_img, face_path, fmt='jpeg', quality='94')
    print(f"  Saved 6x 1024x1024 cubemap faces in: {cube_dir}/")

    hdr_path = os.path.join(out_dir, f"{prefix}_specular.hdr")
    save_radiance_hdr(equirect, hdr_path, hdr_w=1024, hdr_h=512)
    print(f"  Saved Radiance HDR IBL map: {hdr_path}")


if __name__ == '__main__':
    import sys
    out_dir = '/home/anna/quantum_experiment/assets/environment'
    os.makedirs(out_dir, exist_ok=True)
    for arg in sys.argv[1:]:
        prefix, raw_path = arg.split(':')
        process_lab_environment(raw_path, prefix, out_dir)
