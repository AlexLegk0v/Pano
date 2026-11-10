private static IGeometry FixSinglePolygon(IPolygon polygon)
{
    var polygonizer = new Polygonizer();
    
    // Передаем все линии исходного полигона с дырками
    polygonizer.Add(polygon.Boundary);

    var faces = polygonizer.GetPolygons();
    if (faces.Count == 0) return polygon.Factory.CreatePolygon();

    // 1. Сортируем все собранные полигоны по убыванию площади
    var sortedFaces = new List<IPolygon>();
    foreach (IPolygon face in faces) sortedFaces.Add(face);
    sortedFaces.Sort((x, y) => y.Area.CompareTo(x.Area));

    // 2. Самый большой полигон — это наша внешняя оболочка (Shell)
    IPolygon shellPolygon = sortedFaces[0];
    ILinearRing shellRing = (ILinearRing)shellPolygon.ExteriorRing;

    // 3. Все остальные полигоны гарантированно являются дырками (Holes)
    var holeRings = new List<ILinearRing>();
    for (int i = 1; i < sortedFaces.Count; i++)
    {
        // Извлекаем внешнюю границу каждого меньшего полигона 
        // и превращаем её во внутреннее кольцо (дырку) для нашего целевого полигона
        ILinearRing holeRing = (ILinearRing)sortedFaces[i].ExteriorRing;
        
        // ВАЖНО: Для дырки направление обхода точек должно быть противоположным оболочке.
        // Если движок NTS определил обход неверно, принудительно разворачиваем его.
        if (shellRing.IsCCW == holeRing.IsCCW)
        {
            holeRing = (ILinearRing)holeRing.Reverse();
        }
        
        holeRings.Add(holeRing);
    }

    // 4. Собираем ОДИН итоговый IPolygon через фабрику геометрий
    IPolygon fixedPolygon = polygon.Factory.CreatePolygon(shellRing, holeRings.ToArray());

    return fixedPolygon;
}
