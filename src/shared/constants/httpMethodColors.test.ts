import { describe, it, expect } from 'vitest';
import {
  METHOD_COLORS,
  SWAGGER_METHOD_COLORS,
  WORKFLOW_METHOD_COLORS,
} from './httpMethodColors';

describe('httpMethodColors', () => {
  describe('METHOD_COLORS', () => {
    it('defines colors for all standard HTTP methods', () => {
      expect(METHOD_COLORS).toHaveProperty('GET');
      expect(METHOD_COLORS).toHaveProperty('POST');
      expect(METHOD_COLORS).toHaveProperty('PUT');
      expect(METHOD_COLORS).toHaveProperty('PATCH');
      expect(METHOD_COLORS).toHaveProperty('DELETE');
    });

    it('has exactly 5 methods', () => {
      expect(Object.keys(METHOD_COLORS)).toHaveLength(5);
    });

    it('uses valid hex color values', () => {
      Object.values(METHOD_COLORS).forEach((color) => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
      });
    });

    it('assigns green to GET', () => {
      expect(METHOD_COLORS.GET).toBe('#22c55e');
    });

    it('assigns orange to POST', () => {
      expect(METHOD_COLORS.POST).toBe('#f59e0b');
    });

    it('assigns blue to PUT', () => {
      expect(METHOD_COLORS.PUT).toBe('#3b82f6');
    });

    it('assigns purple to PATCH', () => {
      expect(METHOD_COLORS.PATCH).toBe('#8b5cf6');
    });

    it('assigns red to DELETE', () => {
      expect(METHOD_COLORS.DELETE).toBe('#ef4444');
    });

    it('has unique colors for each method', () => {
      const colors = Object.values(METHOD_COLORS);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(colors.length);
    });
  });

  describe('SWAGGER_METHOD_COLORS', () => {
    it('defines colors for all standard HTTP methods', () => {
      expect(SWAGGER_METHOD_COLORS).toHaveProperty('GET');
      expect(SWAGGER_METHOD_COLORS).toHaveProperty('POST');
      expect(SWAGGER_METHOD_COLORS).toHaveProperty('PUT');
      expect(SWAGGER_METHOD_COLORS).toHaveProperty('PATCH');
      expect(SWAGGER_METHOD_COLORS).toHaveProperty('DELETE');
    });

    it('has exactly 5 methods', () => {
      expect(Object.keys(SWAGGER_METHOD_COLORS)).toHaveLength(5);
    });

    it('uses valid hex color values', () => {
      Object.values(SWAGGER_METHOD_COLORS).forEach((color) => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
      });
    });

    it('assigns Swagger-style green to GET', () => {
      expect(SWAGGER_METHOD_COLORS.GET).toBe('#49cc90');
    });

    it('assigns Swagger-style orange to POST', () => {
      expect(SWAGGER_METHOD_COLORS.POST).toBe('#fca130');
    });

    it('assigns Swagger-style blue to PUT', () => {
      expect(SWAGGER_METHOD_COLORS.PUT).toBe('#61affe');
    });

    it('assigns Swagger-style teal to PATCH', () => {
      expect(SWAGGER_METHOD_COLORS.PATCH).toBe('#50e3c2');
    });

    it('assigns Swagger-style red to DELETE', () => {
      expect(SWAGGER_METHOD_COLORS.DELETE).toBe('#f93e3e');
    });

    it('has unique colors for each method', () => {
      const colors = Object.values(SWAGGER_METHOD_COLORS);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(colors.length);
    });
  });

  describe('WORKFLOW_METHOD_COLORS', () => {
    it('defines colors for all standard HTTP methods', () => {
      expect(WORKFLOW_METHOD_COLORS).toHaveProperty('GET');
      expect(WORKFLOW_METHOD_COLORS).toHaveProperty('POST');
      expect(WORKFLOW_METHOD_COLORS).toHaveProperty('PUT');
      expect(WORKFLOW_METHOD_COLORS).toHaveProperty('PATCH');
      expect(WORKFLOW_METHOD_COLORS).toHaveProperty('DELETE');
    });

    it('has exactly 5 methods', () => {
      expect(Object.keys(WORKFLOW_METHOD_COLORS)).toHaveLength(5);
    });

    it('uses valid hex color values', () => {
      Object.values(WORKFLOW_METHOD_COLORS).forEach((color) => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
      });
    });

    it('assigns green to GET', () => {
      expect(WORKFLOW_METHOD_COLORS.GET).toBe('#22c55e');
    });

    it('assigns blue to POST (workflow-specific)', () => {
      expect(WORKFLOW_METHOD_COLORS.POST).toBe('#3b82f6');
    });

    it('assigns amber to PUT (workflow-specific)', () => {
      expect(WORKFLOW_METHOD_COLORS.PUT).toBe('#f59e0b');
    });

    it('assigns purple to PATCH', () => {
      expect(WORKFLOW_METHOD_COLORS.PATCH).toBe('#a855f7');
    });

    it('assigns red to DELETE', () => {
      expect(WORKFLOW_METHOD_COLORS.DELETE).toBe('#ef4444');
    });

    it('has unique colors for each method', () => {
      const colors = Object.values(WORKFLOW_METHOD_COLORS);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(colors.length);
    });
  });

  describe('color scheme differences', () => {
    it('METHOD_COLORS and SWAGGER_METHOD_COLORS differ', () => {
      const methods = Object.keys(METHOD_COLORS);
      const hasDifference = methods.some(
        (method) => METHOD_COLORS[method] !== SWAGGER_METHOD_COLORS[method]
      );
      expect(hasDifference).toBe(true);
    });

    it('METHOD_COLORS and WORKFLOW_METHOD_COLORS differ for POST', () => {
      expect(METHOD_COLORS.POST).not.toBe(WORKFLOW_METHOD_COLORS.POST);
    });

    it('METHOD_COLORS and WORKFLOW_METHOD_COLORS differ for PUT', () => {
      expect(METHOD_COLORS.PUT).not.toBe(WORKFLOW_METHOD_COLORS.PUT);
    });

    it('all three schemes agree on GET color', () => {
      expect(METHOD_COLORS.GET).toBe(WORKFLOW_METHOD_COLORS.GET);
      // Swagger GET is different though
      expect(METHOD_COLORS.GET).not.toBe(SWAGGER_METHOD_COLORS.GET);
    });

    it('all three schemes agree on DELETE color', () => {
      expect(METHOD_COLORS.DELETE).toBe(WORKFLOW_METHOD_COLORS.DELETE);
      // Swagger DELETE is slightly different
      expect(METHOD_COLORS.DELETE).not.toBe(SWAGGER_METHOD_COLORS.DELETE);
    });
  });

  describe('color usage patterns', () => {
    it('GET methods always use green tones', () => {
      expect(METHOD_COLORS.GET.startsWith('#')).toBe(true);
      expect(SWAGGER_METHOD_COLORS.GET.startsWith('#')).toBe(true);
      expect(WORKFLOW_METHOD_COLORS.GET.startsWith('#')).toBe(true);
    });

    it('DELETE methods always use red tones', () => {
      expect(METHOD_COLORS.DELETE).toMatch(/^#[ef]/);
      expect(SWAGGER_METHOD_COLORS.DELETE).toMatch(/^#f/);
      expect(WORKFLOW_METHOD_COLORS.DELETE).toMatch(/^#[ef]/);
    });

    it('all color schemes have same method keys', () => {
      const methods1 = Object.keys(METHOD_COLORS).sort();
      const methods2 = Object.keys(SWAGGER_METHOD_COLORS).sort();
      const methods3 = Object.keys(WORKFLOW_METHOD_COLORS).sort();
      
      expect(methods1).toEqual(methods2);
      expect(methods2).toEqual(methods3);
    });
  });
});
