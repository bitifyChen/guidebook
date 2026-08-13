import { describe, expect, it } from 'vitest';
import {
  createImportedItineraryItems,
  isGoogleMapsShortUrl,
  parseGoogleMapsDirectionsUrl,
  parseGoogleMapsPlaceUrl,
} from '@/utils/googleMapsRoute';

const SHARED_ROUTE_URL =
  'https://www.google.com/maps/dir/%E9%80%A2%E7%94%B2%E5%A4%A7%E5%AD%B8%E9%AB%94%E8%82%B2%E9%A4%A8+407%E8%87%BA%E4%B8%AD%E5%B8%82%E8%A5%BF%E5%B1%AF%E5%8D%80%E9%B5%AC%E7%A8%8B%E9%87%8C%E6%96%87%E8%8F%AF%E8%B7%AF100%E8%99%9F/%E9%86%B4%E6%9C%AC%E9%9F%93%E5%9C%8B%E6%AD%A3%E7%B5%B1%E7%87%92%E8%82%89+403%E8%87%BA%E4%B8%AD%E5%B8%82%E8%A5%BF%E5%8D%80%E5%9C%9F%E5%BA%AB%E9%87%8C%E4%B8%AD%E7%BE%8E%E8%A1%9743%E8%99%9F/%E5%A5%BD%E5%B8%82%E5%A4%9A+%E5%8C%97%E8%87%BA%E4%B8%AD%E5%BA%97+406%E8%87%BA%E4%B8%AD%E5%B8%82%E5%8C%97%E5%B1%AF%E5%8D%80%E8%88%8A%E7%A4%BE%E9%87%8C%E6%95%A6%E5%AF%8C%E8%B7%AF366%E8%99%9F/@24.1647555,120.6571786,14z/data=!3m1!4b1!4m20!4m19!1m5!1m1!1s0x3469163b57fbd4eb:0x66a16911b18cb3e6!2m2!1d120.6487841!2d24.1816393!1m5!1m1!1s0x34693d03c0cd3a81:0xb446ee16cf7c35a1!2m2!1d120.6600382!2d24.1423771!1m5!1m1!1s0x34691789a4d2af19:0x6c827db810d03508!2m2!1d120.7078043!2d24.1870585!3e1?entry=tts';

describe('Google Maps route parser', () => {
  it('parses ordered labels and coordinates from the supplied share route', () => {
    const result = parseGoogleMapsDirectionsUrl(SHARED_ROUTE_URL);

    expect(result.stops).toHaveLength(3);
    expect(result.stops[0].name).toContain('逢甲大學體育館');
    expect(result.stops[1].name).toContain('醴本韓國正統燒肉');
    expect(result.stops[2].name).toContain('好市多 北臺中店');
    expect(result.stops.map((stop) => stop.geo)).toEqual([
      { lat: 24.1816393, lng: 120.6487841 },
      { lat: 24.1423771, lng: 120.6600382 },
      { lat: 24.1870585, lng: 120.7078043 },
    ]);
  });

  it('parses official api=1 directions and keeps unresolved names', () => {
    const result = parseGoogleMapsDirectionsUrl(
      'https://www.google.com/maps/dir/?api=1&origin=25.0330,121.5654&destination=%E5%8F%B0%E5%8C%97%E8%BB%8A%E7%AB%99&waypoints=25.0478,121.5170'
    );

    expect(result.stops).toHaveLength(3);
    expect(result.stops[0].geo).toEqual({ lat: 25.033, lng: 121.5654 });
    expect(result.stops[1].geo).toEqual({ lat: 25.0478, lng: 121.517 });
    expect(result.stops[2].geo).toEqual({ lat: null, lng: null });
  });

  it('requires short links to be resolved before parsing', () => {
    const url = 'https://maps.app.goo.gl/8g8zPFT6wF8nccKD6';
    expect(isGoogleMapsShortUrl(url)).toBe(true);
    expect(() => parseGoogleMapsDirectionsUrl(url)).toThrow('需要先解析');
  });

  it('creates unsaved itinerary drafts without geo.mapUrl', () => {
    const items = createImportedItineraryItems(
      [
        {
          name: '有座標',
          map: 'https://maps.example/one',
          geo: { lat: 1, lng: 2 },
        },
        { name: '待定位', map: '', geo: { lat: null, lng: null } },
      ],
      { day: 2, startOrder: 4, idFactory: (index) => `temp-${index}` }
    );

    expect(items[0]).toMatchObject({
      id: 'temp-0',
      day: 2,
      order: 4,
      duration: 0,
      fixedStartTime: '',
      geo: { lat: 1, lng: 2 },
    });
    expect(items[1].geo).toEqual({ lat: null, lng: null });
    expect(items[0].geo).not.toHaveProperty('mapUrl');
  });

  it('parses a single Google Maps place URL and preserves the shared URL', () => {
    const sourceUrl =
      'https://www.google.com/maps/place/%E5%8F%B0%E5%8C%97%E8%BB%8A%E7%AB%99/@25.0478,121.517,17z/data=!3d25.0478!4d121.517';
    const result = parseGoogleMapsPlaceUrl(sourceUrl);

    expect(result).toMatchObject({
      name: '台北車站',
      map: sourceUrl,
      geo: { lat: 25.0478, lng: 121.517 },
    });
  });

  it('rejects a place URL without coordinates', () => {
    expect(() =>
      parseGoogleMapsPlaceUrl(
        'https://www.google.com/maps/place/%E5%8F%B0%E5%8C%97%E8%BB%8A%E7%AB%99'
      )
    ).toThrow('無法取得座標');
  });
});
