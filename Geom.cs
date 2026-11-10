using System.Collections.Generic;
using GeoAPI.Geometries;
using NetTopologySuite.Geometries;

private static IGeometry FixSinglePolygon(IPolygon polygon)
{
    if (polygon == null || polygon.IsEmpty) 
        return polygon;

    // 1. Чиним внешнюю границу (Shell). Превращаем её в полигон, чиним через Buffer(0) и забираем кольцо.
    var shellPoly = polygon.Factory.CreatePolygon(polygon.ExteriorRing).Buffer(0) as IPolygon;
    if (shellPoly == null || shellPoly.IsEmpty) 
        return polygon.Factory.CreatePolygon(); // Если внешняя граница схлопнулась в ноль
        
    ILinearRing fixedShellRing = (ILinearRing)shellPoly.ExteriorRing;

    // 2. Поочередно чиним каждую дырку
    var validHoleRings = new List<ILinearRing>();
    
    for (int i = 0; i < polygon.NumInteriorRings; i++)
    {
        ILinearRing holeRing = (ILinearRing)polygon.GetInteriorRingN(i);
        
        // Превращаем дырку в самостоятельный полигон, чтобы прогнать через движок валидации NTS
        IPolygon holePoly = polygon.Factory.CreatePolygon(holeRing);
        
        // Buffer(0) исправит самопересечения внутри дырки
        var fixedHolePoly = holePoly.Buffer(0);

        // Извлекаем исправленные контуры дырки
        // Если дырка из-за невалидности распалась на несколько мелких, обрабатываем их все
        for (int j = 0; j < fixedHolePoly.NumGeometries; j++)
        {
            var subPoly = fixedHolePoly.GetGeometryN(j) as IPolygon;
            if (subPoly == null || subPoly.IsEmpty) continue;

            ILinearRing validHoleRing = (ILinearRing)subPoly.ExteriorRing;

            // ВАЖНО: Дырка должна находиться строго внутри нашей исправленной внешней границы
            // Если из-за ошибки в исходных данных дырка вылезла наружу, мы её игнорируем
            if (fixedShellRing.Contains(validHoleRing) || fixedShellRing.Covers(validHoleRing))
            {
                // Направление обхода дырки должно быть противоположным внешней границе
                if (fixedShellRing.IsCCW == validHoleRing.IsCCW)
                {
                    validHoleRing = (ILinearRing)validHoleRing.Reverse();
                }
                validHoleRings.Add(validHoleRing);
            }
        }
    }

    // 3. Собираем ОДИН гарантированно валидный полигон с восстановленными дырками
    IPolygon resultPolygon = polygon.Factory.CreatePolygon(fixedShellRing, validHoleRings.ToArray());

    // Финальная проверка: если исправленные дырки начали накладываться друг на друга,
    // Buffer(0) объединит их внутренние пространства корректно
    return resultPolygon.IsValid ? resultPolygon : resultPolygon.Buffer(0);
}
