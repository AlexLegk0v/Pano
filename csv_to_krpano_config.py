#!/usr/bin/env python3
"""
csv_to_krpano_config.py
Конвертер panoramicPoses.csv (Lixel Studio) → tour_config.js для krpano 1.19-pr16

Использование:
  1. Положите panoramicPoses.csv рядом со скриптом
  2. Запустите: python csv_to_krpano_config.py
  3. Получите tour_config.js
"""

import math
import os
import sys


def quaternion_to_yaw(qw, qx, qy, qz):
    """
    Конвертирует кватернион (qw, qx, qy, qz) в угол YAW (в градусах).
    YAW — это направление взгляда камеры по горизонту.
    В krpano это параметр hlookat.
    """
    # Yaw (Z-axis rotation)
    siny_cosp = 2.0 * (qw * qz + qx * qy)
    cosy_cosp = 1.0 - 2.0 * (qy * qy + qz * qz)
    yaw = math.atan2(siny_cosp, cosy_cosp)

    yaw_deg = math.degrees(yaw)
    if yaw_deg < 0:
        yaw_deg += 360.0
    return yaw_deg


def parse_lixel_csv(csv_path):
    """Парсит CSV от Lixel Studio. Разделитель — пробел."""
    panoramas = []
    with open(csv_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    # Пропускаем заголовок
    start_line = 0
    if lines and lines[0].strip().lower().startswith("imgname"):
        start_line = 1

    idx = 0
    for i, line in enumerate(lines[start_line:], start=start_line):
        parts = line.strip().split()
        if len(parts) < 8:
            print(f"  Пропущена строка {i + 1}: недостаточно колонок ({len(parts)}/8)")
            continue

        imgname = parts[0]
        x = float(parts[1])
        y = float(parts[2])
        z = float(parts[3])
        qw = float(parts[4])
        qx = float(parts[5])
        qy = float(parts[6])
        qz = float(parts[7])

        yaw = quaternion_to_yaw(qw, qx, qy, qz)

        panoramas.append({
            "id": idx,
            "filename": imgname,
            "x": x,
            "y": y,
            "z": z,
            "qw": qw,
            "qx": qx,
            "qy": qy,
            "qz": qz,
            "yaw": round(yaw, 2),
        })
        idx += 1

    return panoramas


def generate_tour_config(panoramas, output_path="tour_config.js"):
    """Генерирует JS-файл с массивом PANORAMAS."""
    lines = []
    lines.append("// Автогенерировано csv_to_krpano_config.py")
    lines.append("// Источник: panoramicPoses.csv (Lixel Studio)")
    lines.append("// Панорам: " + str(len(panoramas)))
    lines.append("const PANORAMAS = [")

    entries = []
    for p in panoramas:
        entry = (
            "  {\n"
            f'    id: {p["id"]},\n'
            f'    filename: "{p["filename"]}",\n'
            f'    x: {p["x"]},\n'
            f'    y: {p["y"]},\n'
            f'    z: {p["z"]},\n'
            f'    qw: {p["qw"]},\n'
            f'    qx: {p["qx"]},\n'
            f'    qy: {p["qy"]},\n'
            f'    qz: {p["qz"]},\n'
            f'    yaw: {p["yaw"]}\n'
            "  }"
        )
        entries.append(entry)

    lines.append(",\n".join(entries))
    lines.append("];")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\nГотово! {output_path} — {len(panoramas)} панорам.")


if __name__ == "__main__":
    csv_file = "panoramicPoses.csv"

    if not os.path.exists(csv_file):
        print(f"Файл {csv_file} не найден!")
        print("Положите panoramicPoses.csv рядом со скриптом.")
        sys.exit(1)

    print(f"Читаю {csv_file}...")
    panoramas = parse_lixel_csv(csv_file)

    if not panoramas:
        print("Не найдено панорам в CSV!")
        sys.exit(1)

    generate_tour_config(panoramas)
