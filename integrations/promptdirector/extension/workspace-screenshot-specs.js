export const WORKSPACE_SCREENSHOT_SPEC = {
  name: 'capture_workspace',
  description: 'Reads a real screenshot of the currently visible area of the case library, composer or capture page of this plugin, without switching tabs or stealing focus. tabId/surface can be specified; when omitted, only the single active plugin page is chosen, and with several candidates a list is returned. A screenshot only proves the visible picture at the moment of capturedAt and does not represent hidden areas, the complete original or a successful save. Insufficient browser permission returns permission_required, and business state must not pose as a screenshot.',
  parameters: { type: 'object', properties: {
    tabId: { type: 'integer', minimum: 0 }, surface: { enum: ['library', 'composer', 'collector'] }
  }, additionalProperties: false }
};
