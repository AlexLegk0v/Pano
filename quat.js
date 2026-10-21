function decomposeMatrix4x4(m) {
    // Превращаем объект math.js в стандартный двумерный массив JS
    const matrixData = m.toArray();

    // 1. ИЗВЛЕКАЕМ ПОЗИЦИЮ (X, Y, Z)
    // В формате Row-Major они находятся в крайнем правом столбце
    const x = matrixData[0][3];
    const y = matrixData[1][3];
    const z = matrixData[2][3];

    // 2. ИЗВЛЕКАЕМ БАЗИСНЫЕ ВЕКТОРЫ ДЛЯ ОПРЕДЕЛЕНИЯ МАСШТАБА
    const row0 = [matrixData[0][0], matrixData[0][1], matrixData[0][2]];
    const row1 = [matrixData[1][0], matrixData[1][1], matrixData[1][2]];
    const row2 = [matrixData[2][0], matrixData[2][1], matrixData[2][2]];

    // Вычисляем масштаб по осям (длину векторов) с помощью math.norm
    const scaleX = math.norm(row0);
    const scaleY = math.norm(row1);
    const scaleZ = math.norm(row2);

    // Защита от деления на ноль
    const sX = scaleX === 0 ? 1 : scaleX;
    const sY = scaleY === 0 ? 1 : scaleY;
    const sZ = scaleZ === 0 ? 1 : scaleZ;

    // 3. ОЧИЩАЕМ МАТРИЦУ ВРАЩЕНИЯ ОТ МАСШТАБА
    const r00 = matrixData[0][0] / sX;
    const r01 = matrixData[0][1] / sX;
    const r02 = matrixData[0][2] / sX;
    
    const r10 = matrixData[1][0] / sY;
    const r11 = matrixData[1][1] / sY;
    const r12 = matrixData[1][2] / sY;
    
    const r20 = matrixData[2][0] / sZ;
    const r21 = matrixData[2][1] / sZ;
    const r22 = matrixData[2][2] / sZ;

    // 4. ВЫЧИСЛЯЕМ КВАТЕРНИОН (Алгоритм Шепперда)
    const tr = r00 + r11 + r22;
    let qw, qx, qy, qz;

    if (tr > 0) {
        const S = Math.sqrt(tr + 1.0) * 2;
        qw = 0.25 * S;
        qx = (r21 - r12) / S;
        qy = (r02 - r20) / S;
        qz = (r10 - r01) / S;
    } else if ((r00 > r11) && (r00 > r22)) {
        const S = Math.sqrt(1.0 + r00 - r11 - r22) * 2;
        qw = (r21 - r12) / S;
        qx = 0.25 * S;
        qy = (r01 + r10) / S;
        qz = (r02 + r20) / S;
    } else if (r11 > r22) {
        const S = Math.sqrt(1.0 + r11 - r00 - r22) * 2;
        qw = (r02 - r20) / S;
        qx = (r01 + r10) / S;
        qy = 0.25 * S;
        qz = (r12 + r21) / S;
    } else {
        const S = Math.sqrt(1.0 + r22 - r00 - r11) * 2;
        qw = (r10 - r01) / S;
        qx = (r02 + r20) / S;
        qy = (r12 + r21) / S;
        qz = 0.25 * S;
    }

    // Возвращаем результат в виде структурированного объекта
    return {
        translation: { x, y, z },
        quaternion: [qw, qx, qy, qz],
        scale: { x: scaleX, y: scaleY, z: scaleZ } // добавлено в качестве бонуса
    };
}

// === Пример использования ===
// Матрица поворота на 90 градусов по Y, с масштабом 2х и позицией (5, -12, 0)
const myComplexMatrix = math.matrix([
    [ 0,  0,  2,   5],
    [ 0,  2,  0, -12],
    [-2,  0,  0,   0],
    [ 0,  0,  0,   1]
]);

const result = decomposeMatrix4x4(myComplexMatrix);

console.log("Позиция:", result.translation); 
// Выведет: { x: 5, y: -12, z: 0 }

console.log("Кватернион [w, x, y, z]:", result.quaternion); 
// Выведет: [0.707106, 0, 0.707106, 0]

console.log("Масштаб:", result.scale); 
// Выведет: { x: 2, y: 2, z: 2 }


function composeMatrix4x4(translation, quaternion, scale = { x: 1, y: 1, z: 1 }) {
    const { x, y, z } = translation;
    const { x: sX, y: sY, z: sZ } = scale;
    
    // 1. Нормализуем кватернион перед созданием матрицы вращения
    let [w, qx, qy, qz] = quaternion;
    const len = Math.sqrt(w*w + qx*qx + qy*qy + qz*qz);
    if (len === 0) {
        w = 1; qx = 0; qy = 0; qz = 0;
    } else {
        w /= len; qx /= len; qy /= len; qz /= len;
    }

    // 2. Вычисляем компоненты чистой матрицы вращения 3x3
    const r00 = 1 - 2 * (qy * qy + qz * qz);
    const r01 = 2 * (qx * qy - w * qz);
    const r02 = 2 * (qx * qz + w * qy);

    const r10 = 2 * (qx * qy + w * qz);
    const r11 = 1 - 2 * (qx * qx + qz * qz);
    const r12 = 2 * (qy * qz - w * qx);

    const r20 = 2 * (qx * qz - w * qy);
    const r21 = 2 * (qy * qz + w * qx);
    const r22 = 1 - 2 * (qx * qx + qy * qy);

    // 3. Собираем финальную матрицу, перемножая вращение на масштаб (по строкам)
    // и подставляя позицию (x, y, z) в правый столбец
    const matrixData = [
        [r00 * sX, r01 * sX, r02 * sX, x],
        [r10 * sY, r11 * sY, r12 * sY, y],
        [r20 * sZ, r21 * sZ, r22 * sZ, z],
        [0,        0,        0,        1]
    ];

    // Возвращаем объект матрицы math.js
    return math.matrix(matrixData);
}

// === Пример использования (Полный цикл: Сборка -> Проверка) ===

// Входные данные
const inputTranslation = { x: 5, y: -12, z: 0 };
const inputQuaternion = [0.707106, 0, 0.707106, 0]; // Поворот на 90 градусов по Y
const inputScale = { x: 2, y: 2, z: 2 };

// Собираем матрицу
const reconstructedMatrix = composeMatrix4x4(inputTranslation, inputQuaternion, inputScale);

console.log("Восстановленная матрица:");
console.log(reconstructedMatrix.toString());
// Выведет структуру матрицы: 
// [[0, 0, 2, 5], [0, 2, 0, -12], [-2, 0, 0, 0], [0, 0, 0, 1]]

