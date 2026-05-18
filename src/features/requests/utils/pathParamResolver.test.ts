import { describe, it, expect } from 'vitest';
import { resolvePathParamUrl, findUrlPrefix } from './pathParamResolver';

describe('findUrlPrefix', () => {
  it('finds prefix for absolute URL with server path prefix', () => {
    expect(findUrlPrefix(
      'https://sales.example.com/sales/product/autoassign/v1/vehicles/management/{vin}/onboarding/offers',
      '/vehicles/management/{vin}/onboarding/offers',
    )).toBe('https://sales.example.com/sales/product/autoassign/v1');
  });

  it('finds prefix for relative URL', () => {
    expect(findUrlPrefix(
      '/api/v2/pet/123/uploadImage',
      '/pet/{petId}/uploadImage',
    )).toBe('/api/v2');
  });

  it('returns empty when originalPath is the full URL path', () => {
    expect(findUrlPrefix(
      '/vehicles/management/{vin}/onboarding/offers',
      '/vehicles/management/{vin}/onboarding/offers',
    )).toBe('');
  });

  it('returns empty prefix when anchor token is absent from URL', () => {
    expect(findUrlPrefix('/other/things', '/api/pet/{id}')).toBe('');
  });

  it('returns empty prefix when template is purely placeholders', () => {
    expect(findUrlPrefix('/foo/bar', '{a}/{b}')).toBe('');
  });

  it('returns empty prefix when anchor exists in template but occurs before pathname in oddly shaped urls', () => {
    expect(findUrlPrefix('/z/y/x', '/a/b')).toBe('');
  });

  it('extracts prefix when first concrete segment follows leading placeholders', () => {
    expect(findUrlPrefix(
      '/service/v99/{tenant}/data',
      '/{tenant}/data',
    )).toBe('/service/v99');
  });
});

describe('resolvePathParamUrl', () => {
  const realOriginalPath = '/vehicles/management/{vin}/onboarding/vehiclePurchaseOffers';
  const realBaseUrl = 'https://sales-product-autoassign.apps.gmna.test.cvca.atmosdt.gm.com/sales/product/autoassign/v1';

  describe('normal URL with placeholder', () => {
    const normalUrl = `${realBaseUrl}/vehicles/management/{vin}/onboarding/vehiclePurchaseOffers`;

    it('substitutes vin value', () => {
      const result = resolvePathParamUrl(normalUrl, realOriginalPath, [
        { key: 'vin', value: '1GN1RK114R1079748' },
      ]);
      expect(result).toBe(
        `${realBaseUrl}/vehicles/management/1GN1RK114R1079748/onboarding/vehiclePurchaseOffers`,
      );
      expect(result).not.toContain('{vin}');
    });

    it('leaves placeholder when value is empty', () => {
      const result = resolvePathParamUrl(normalUrl, realOriginalPath, [
        { key: 'vin', value: '' },
      ]);
      expect(result).toBe(normalUrl);
      expect(result).toContain('{vin}');
    });
  });

  describe('URL with previously filled value', () => {
    const filledUrl = `${realBaseUrl}/vehicles/management/1GN1RK114R1079748/onboarding/vehiclePurchaseOffers`;

    it('restores placeholder when value is cleared', () => {
      const result = resolvePathParamUrl(filledUrl, realOriginalPath, [
        { key: 'vin', value: '' },
      ]);
      expect(result).toBe(
        `${realBaseUrl}/vehicles/management/{vin}/onboarding/vehiclePurchaseOffers`,
      );
    });

    it('changes to a different value', () => {
      const result = resolvePathParamUrl(filledUrl, realOriginalPath, [
        { key: 'vin', value: 'ABC999' },
      ]);
      expect(result).toBe(
        `${realBaseUrl}/vehicles/management/ABC999/onboarding/vehiclePurchaseOffers`,
      );
    });
  });

  describe('corrupted URL recovery', () => {
    const corruptedUrl = `${realBaseUrl}GN1RK114R1079748/vehicles/management/1GN1RK114R1079748/onboarding/vehiclePurchaseOffers`;

    it('rebuilds path portion correctly even if prefix is corrupted', () => {
      const result = resolvePathParamUrl(corruptedUrl, realOriginalPath, [
        { key: 'vin', value: 'NEWVIN' },
      ]);
      // The path portion after the prefix is rebuilt from the template
      expect(result).toContain('/vehicles/management/NEWVIN/onboarding/vehiclePurchaseOffers');
      // The old vin is gone from the path portion (management/OLD is replaced)
      expect(result).not.toContain('/management/1GN1RK114R1079748/');
    });

    it('restores placeholder in path portion when value is cleared', () => {
      const result = resolvePathParamUrl(corruptedUrl, realOriginalPath, [
        { key: 'vin', value: '' },
      ]);
      expect(result).toContain('/vehicles/management/{vin}/onboarding/vehiclePurchaseOffers');
      expect(result).not.toContain('/management/1GN1RK114R1079748/');
    });
  });

  describe('with query string', () => {
    it('preserves query string when substituting', () => {
      const url = `${realBaseUrl}/vehicles/management/{vin}/onboarding/vehiclePurchaseOffers?channel=WEB&country=US`;
      const result = resolvePathParamUrl(url, realOriginalPath, [
        { key: 'vin', value: 'VIN123' },
      ]);
      expect(result).toBe(
        `${realBaseUrl}/vehicles/management/VIN123/onboarding/vehiclePurchaseOffers?channel=WEB&country=US`,
      );
    });

    it('preserves query string when clearing', () => {
      const url = `${realBaseUrl}/vehicles/management/VIN123/onboarding/vehiclePurchaseOffers?channel=WEB&country=US`;
      const result = resolvePathParamUrl(url, realOriginalPath, [
        { key: 'vin', value: '' },
      ]);
      expect(result).toContain('{vin}');
      expect(result).toContain('?channel=WEB&country=US');
    });

    it('handles multiple query question marks conservatively', () => {
      const url = `${realBaseUrl}/vehicles/management/{vin}/onboarding/vehiclePurchaseOffers?raw=q1?q2=q3`;
      const result = resolvePathParamUrl(url, realOriginalPath, [{ key: 'vin', value: 'ZZ' }]);
      expect(result).toContain('/vehicles/management/ZZ/onboarding/vehiclePurchaseOffers');
      expect(result).toContain('?raw=q1?q2=q3');
    });
  });

  describe('petstore-style (short originalPath, server path prefix)', () => {
    const petOriginalPath = '/pet/{petId}/uploadImage';

    it('substitutes petId', () => {
      const result = resolvePathParamUrl(
        'https://petstore.swagger.io/v2/pet/123/uploadImage',
        petOriginalPath,
        [{ key: 'petId', value: '456' }],
      );
      expect(result).toBe('https://petstore.swagger.io/v2/pet/456/uploadImage');
    });

    it('restores placeholder', () => {
      const result = resolvePathParamUrl(
        'https://petstore.swagger.io/v2/pet/123/uploadImage',
        petOriginalPath,
        [{ key: 'petId', value: '' }],
      );
      expect(result).toBe('https://petstore.swagger.io/v2/pet/{petId}/uploadImage');
    });
  });

  describe('multiple path params', () => {
    const multiOriginalPath = '/users/{userId}/posts/{postId}';

    it('substitutes both', () => {
      const result = resolvePathParamUrl(
        'https://api.example.com/v1/users/42/posts/100',
        multiOriginalPath,
        [{ key: 'userId', value: '42' }, { key: 'postId', value: '200' }],
      );
      expect(result).toBe('https://api.example.com/v1/users/42/posts/200');
    });

    it('clears one, keeps the other', () => {
      const result = resolvePathParamUrl(
        'https://api.example.com/v1/users/42/posts/100',
        multiOriginalPath,
        [{ key: 'userId', value: '' }, { key: 'postId', value: '100' }],
      );
      expect(result).toBe('https://api.example.com/v1/users/{userId}/posts/100');
    });

    it('clears both', () => {
      const result = resolvePathParamUrl(
        'https://api.example.com/v1/users/42/posts/100',
        multiOriginalPath,
        [{ key: 'userId', value: '' }, { key: 'postId', value: '' }],
      );
      expect(result).toBe('https://api.example.com/v1/users/{userId}/posts/{postId}');
    });
  });

  describe('relative URL (no host)', () => {
    it('handles relative URL with prefix', () => {
      const result = resolvePathParamUrl(
        '/sales/product/autoassign/v1/vehicles/management/{vin}/onboarding/offers',
        '/vehicles/management/{vin}/onboarding/offers',
        [{ key: 'vin', value: 'ABC' }],
      );
      expect(result).toBe('/sales/product/autoassign/v1/vehicles/management/ABC/onboarding/offers');
    });
  });
});
