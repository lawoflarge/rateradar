export const WEB_BASE_URL = "https://rateradar-web.vercel.app";

export const PRE_LOAD_BRIDGE = `
  window.NATIVE_PLATFORM = 'ios';
  window.NATIVE_RATERADAR = { version: '1.0.0', pushTokenPending: true };
  true;
`;
