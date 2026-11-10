using System.Collections.Generic;
using GeoAPI.Geometries;
using NetTopologySuite.Geometries;
using NetTopologySuite.Operation.Polygonize;

public static class ValidateGeometryExtension
{
    public static IGeometry Validate(this IGeometry geom)
    {
        if (geom == null || geom.IsEmpty) return geom;

        if (geom.IsValid)
        {
            var clone = (IGeometry)geom.Clone();
            clone.Normalize();
            return clone;
        }

        if (geom is IPolygon polygon)
        {
            return FixSinglePolygon(polygon);
        }
        
        if (geom is IMultiPolygon multiPolygon)
        {
            var fixedGeoms = new List<IGeometry>();
            for (int i = 0; i < multiPolygon.NumGeometries; i++)
            {
                fixedGeoms.Add(FixSinglePolygon((IPolygon)multiPolygon.GetGeometryN(i)));
            }
            // Объединяем исправленные части обратно в один валидный объект
            return geom.Factory.BuildGeometry(fixedGeoms).Union();
        }

        return geom;
    }

    private static IGeometry FixSinglePolygon(IPolygon polygon)
    {
        var polygonizer = new Polygonizer();
        
        // Извлекаем все линии (включая линии дырок) и передаем в Polygonizer
        IGeometry lines = polygon.Boundary;
        polygonizer.Add(lines);

        // Получаем все замкнутые контуры, которые смог собрать Polygonizer
        var faces = polygonizer.GetPolygons();
        if (faces.Count == 0) return polygon.Factory.CreatePolygon();

        // Процесс восстановления дырок:
        // Нам нужно отсортировать полигоны по площади (от больших к меньшим).
        // Большие полигоны станут внешними границами, а меньшие, 
        // которые попадают внутрь них — будут вычитаться (становиться дырками).
        var sortedFaces = new List<IGeometry>();
        foreach (IGeometry face in faces) sortedFaces.Add(face);
        sortedFaces.Sort((x, y) => y.Area.CompareTo(x.Area)); // Сортировка по убыванию площади

        IGeometry result = sortedFaces[0];

        // Итерируемся по остальным контурам и вычитаем их через симметрическую разность или разность,
        // чтобы "прожечь" дырки в местах пересечений контуров
        for (int i = 1; i < sortedFaces.Count; i++)
        {
            // Используем Симметрическую разность (SymmetricDifference) для восстановления 
            // правильной топологии «вложенных» контуров.
            result = result.SymmetricDifference(sortedFaces[i]);
        }

        return result;
    }
}
